import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { haversineKm, arrondissementsByDistance, ARR_CENTERS } from '@/lib/geo'

export const dynamic = 'force-dynamic'

// Types qui correspondent vraiment à des bars/clubs nightlife
const BAR_TYPES = ['bar', 'club', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop']

// Vérifie si un spot est ouvert maintenant (même logique que côté client)
type Period = { open: { day: number; time: string }; close?: { day: number; time: string } }

function isOpenNow(horaires: unknown): boolean {
  const periods = horaires as Period[] | null
  if (!periods || periods.length === 0) return false
  const now = new Date()
  const day = now.getDay()
  const time = now.getHours() * 100 + now.getMinutes()
  if (periods.length === 1 && !periods[0].close) return true
  for (const p of periods) {
    if (!p.close) continue
    const openDay = p.open.day, closeDay = p.close.day
    const openTime = parseInt(p.open.time), closeTime = parseInt(p.close.time)
    if (openDay === closeDay) {
      if (day === openDay && time >= openTime && time < closeTime) return true
    } else if (closeDay === (openDay + 1) % 7) {
      if ((day === openDay && time >= openTime) || (day === closeDay && time < closeTime)) return true
    }
  }
  return false
}

async function fetchFromArr(
  supabase: ReturnType<typeof createAdminClient>,
  arrList: number[],
  filters: {
    energie?: number
    budget?: number
    excludeClubs?: boolean
    preferClubs?: boolean
    requirePhoto?: boolean
  },
  seenIds: Set<string>,
  limit: number
): Promise<Record<string, unknown>[]> {
  const collected: Record<string, unknown>[] = []
  for (const a of arrList) {
    if (collected.length >= limit) break
    let q = supabase.from('spots').select('*').eq('actif', true).eq('arrondissement', a)
    // Whitelist — exclut restaurants et autres types non-nightlife
    q = q.in('type', BAR_TYPES)
    if (filters.energie) q = q.eq('energie', filters.energie)
    if (filters.budget)  q = q.eq('budget', filters.budget)
    if (filters.excludeClubs) q = q.neq('type', 'club')
    if (filters.preferClubs)  q = q.in('type', ['club', 'bar'])
    if (filters.requirePhoto) q = q.not('photo_url', 'is', null)
    q = q.limit(30)
    const { data } = await q
    for (const s of data || []) {
      if (!seenIds.has(s.id as string)) {
        seenIds.add(s.id as string)
        collected.push(s as Record<string, unknown>)
      }
    }
  }
  return collected
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const energie     = Number(searchParams.get('energie')) || 2
  const budget      = Number(searchParams.get('budget'))  || 2
  const compagnie   = searchParams.get('compagnie') || 'duo'
  const openNow     = searchParams.get('openNow') === 'true'
  const excludeRaw  = searchParams.get('exclude') || ''
  const excludeIds  = excludeRaw.split(',').filter(Boolean)
  const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
  const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
  const arr = searchParams.get('arr') ? Number(searchParams.get('arr')) : null

  const supabase = createAdminClient()

  // Arrondissements triés du plus proche au plus loin
  let arrByProximity: number[]
  if (lat && lng) {
    arrByProximity = arrondissementsByDistance(lat, lng)
  } else if (arr) {
    // Utilise le centre GPS de l'arrondissement pour trier les voisins géographiquement
    const center = ARR_CENTERS[arr]
    arrByProximity = center
      ? arrondissementsByDistance(center.lat, center.lng)
      : [arr, ...Array.from({ length: 20 }, (_, i) => i + 1).filter(n => n !== arr)]
  } else {
    arrByProximity = Array.from({ length: 20 }, (_, i) => i + 1)
  }

  const nearbyArrs   = arrByProximity.slice(0, 4)
  const extendedArrs = arrByProximity.slice(0, 8)

  const seenIds = new Set(excludeIds)
  const collected: Record<string, unknown>[] = []

  // Contraintes compagnie
  const excludeClubs = compagnie === 'solo'
  const preferClubs  = compagnie === 'groupe' && energie >= 2

  // ── Passes avec photo obligatoire ──
  // Passe 1 — tous filtres + photo + proches
  collected.push(...await fetchFromArr(supabase, nearbyArrs, { energie, budget, excludeClubs, preferClubs, requirePhoto: true }, seenIds, 9))

  // Passe 2 — budget + compagnie + photo + proches
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, nearbyArrs, { budget, excludeClubs, preferClubs, requirePhoto: true }, seenIds, 9))
  }

  // Passe 3 — tous filtres + photo + étendus
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, extendedArrs, { energie, budget, excludeClubs, preferClubs, requirePhoto: true }, seenIds, 9))
  }

  // Passe 4 — budget + photo + tous arrondissements
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, arrByProximity, { budget, requirePhoto: true }, seenIds, 9))
  }

  // ── Passes sans contrainte photo (fallback) ──
  // Passe 5 — tous filtres + sans photo + proches
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, nearbyArrs, { energie, budget, excludeClubs, preferClubs }, seenIds, 9))
  }

  // Passe 6 — budget seul + tous arrondissements
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, arrByProximity, { budget }, seenIds, 9))
  }

  // Passe 7 — sans contrainte (dernier recours)
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, arrByProximity, {}, seenIds, 9))
  }

  // Trier : spots avec photo en premier, puis par distance si géoloc dispo
  let result = collected
  if (lat && lng) {
    result = collected
      .filter(s => s.coordonnees_lat && s.coordonnees_lng)
      .map(s => ({
        ...s,
        _distance: haversineKm(lat, lng, s.coordonnees_lat as number, s.coordonnees_lng as number),
      }))
      .sort((a, b) => {
        const aHasPhoto = (a as Record<string, unknown>).photo_url ? 0 : 1
        const bHasPhoto = (b as Record<string, unknown>).photo_url ? 0 : 1
        if (aHasPhoto !== bHasPhoto) return aHasPhoto - bHasPhoto
        return (a._distance as number) - (b._distance as number)
      })
  } else {
    // Sans géoloc : photos d'abord, puis aléatoire dans chaque groupe
    const withPhoto    = collected.filter(s => s.photo_url).sort(() => Math.random() - 0.5)
    const withoutPhoto = collected.filter(s => !s.photo_url).sort(() => Math.random() - 0.5)
    result = [...withPhoto, ...withoutPhoto]
  }

  // Si openNow : ne garder que les spots ouverts maintenant
  if (openNow) {
    const openResults = result.filter(s => isOpenNow(s.horaires))
    return NextResponse.json(openResults.slice(0, 3))
  }

  return NextResponse.json(result.slice(0, 3))
}
