import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { haversineKm, arrondissementsByDistance, ARR_CENTERS } from '@/lib/geo'

export const dynamic = 'force-dynamic'

// Types par catégorie
const TYPES_BY_CATEGORIE: Record<string, string[]> = {
  bar:      ['bar', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop'],
  clubbing: ['club'],
  terrasse: ['terrasse'],
  bouffe:   ['bistrot', 'restaurant', 'grec', 'asiatique', 'italien', 'tapas', 'bonne bouffe'],
}

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
    types?: string[]
    requirePhoto?: boolean
  },
  seenIds: Set<string>,
  limit: number
): Promise<Record<string, unknown>[]> {
  const collected: Record<string, unknown>[] = []
  for (const a of arrList) {
    if (collected.length >= limit) break
    let q = supabase.from('spots').select('*').eq('actif', true).eq('arrondissement', a)
    if (filters.types && filters.types.length > 0) q = q.in('type', filters.types)
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
  const categorie   = searchParams.get('categorie') || 'bar'
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

  const types = TYPES_BY_CATEGORIE[categorie] || TYPES_BY_CATEGORIE['bar']

  // ── Passes avec photo obligatoire ──
  collected.push(...await fetchFromArr(supabase, nearbyArrs, { types, requirePhoto: true }, seenIds, 9))

  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, extendedArrs, { types, requirePhoto: true }, seenIds, 9))
  }

  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, arrByProximity, { types, requirePhoto: true }, seenIds, 9))
  }

  // ── Passes sans contrainte photo (fallback) ──
  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, nearbyArrs, { types }, seenIds, 9))
  }

  if (collected.length < 3) {
    collected.push(...await fetchFromArr(supabase, arrByProximity, { types }, seenIds, 9))
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
