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

// ─── Horaires ────────────────────────────────────────────────────────────────

type Period = { open: { day: number; time: string }; close?: { day: number; time: string } }

// Vérifie si un spot est ouvert un jour (0=dimanche) à une heure (HHMM) donnés.
function isOpenAt(horaires: unknown, day: number, time: number): boolean {
  const periods = horaires as Period[] | null
  if (!periods || periods.length === 0) return false
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

// Jour et heure à Paris : le serveur Vercel tourne en UTC (1 à 2 h de décalage).
function parisNow(): { day: number; time: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day, time: Number(get('hour')) * 100 + Number(get('minute')) }
}

// « Ouvert ce soir » (Danser) : ouvert à un moment de la nuit qui vient.
// En journée : à 23h (ou maintenant si plus tard), puis à 0h, 1h et 2h le lendemain.
// Déjà en pleine nuit (avant 6h) : maintenant, puis chaque heure jusqu'à 4h.
type Moment = { day: number; time: number }
function tonightMoments(): Moment[] {
  const { day, time } = parisNow()
  if (time < 600) {
    const moments: Moment[] = [{ day, time }]
    for (let h = Math.floor(time / 100) + 1; h <= 4; h++) moments.push({ day, time: h * 100 })
    return moments
  }
  const next = (day + 1) % 7
  return [{ day, time: Math.max(time, 2300) }, { day: next, time: 0 }, { day: next, time: 100 }, { day: next, time: 200 }]
}

// ─── Classement ──────────────────────────────────────────────────────────────
//
// On ne filtre plus : on classe tous les spots de la catégorie, puis on sert les 3 premiers
// (« Autre sélection » sert les 3 suivants). Ordre, du plus prioritaire au moins prioritaire :
//   1. arrondissement choisi, bon prix
//   2. arrondissement choisi, prix voisin (€ ↔ €€, €€ ↔ €€€)
//   3. arrondissements voisins (centres à moins de 2,5 km), bon prix
//   4. arrondissements voisins, prix voisin
//   5. puis cercles suivants (4 km, 6 km, reste de Paris), à chaque fois bon prix puis prix voisin
//   6. en dernier recours : écart de 2 crans (€ ↔ €€€)
// À rang égal : spot avec une vraie photo d'abord, puis au hasard (pour varier les sélections).
// Le filtre « ouvert » s'applique AVANT le classement : si rien n'est ouvert à côté, on va plus loin.

// Cercles de distance : on épuise un cercle (bon prix puis prix voisin) avant de passer au suivant
const ARR_RINGS_KM = [2.5, 4, 6]       // depuis le centre de l'arrondissement choisi
const GEO_RINGS_KM = [1.2, 2.5, 4, 6]  // « autour de moi », depuis la position de l'utilisateur

function ringIndex(km: number, rings: number[]) {
  const i = rings.findIndex(r => km <= r)
  return i === -1 ? rings.length : i
}

type Candidate = {
  id: string
  arrondissement: number | null
  budget: number | null
  coordonnees_lat: number | null
  coordonnees_lng: number | null
  horaires?: unknown
}

// Écart de prix entre le spot et les budgets demandés (0 = bon prix)
function budgetGap(budget: number | null, budgets: number[]): number {
  if (budgets.length === 0) return 0
  if (!budget) return 1
  return Math.min(...budgets.map(b => Math.abs(b - budget)))
}

// Position du spot : ses coordonnées GPS, sinon le centre de son arrondissement
function spotPosition(s: Candidate): { lat: number; lng: number; exact: boolean } | null {
  const lat = Number(s.coordonnees_lat), lng = Number(s.coordonnees_lng)
  if (lat && lng) return { lat, lng, exact: true }
  const c = s.arrondissement ? ARR_CENTERS[s.arrondissement] : undefined
  return c ? { ...c, exact: false } : null
}

// Compare deux clés de tri (tableaux de nombres) dans l'ordre
function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categorie   = searchParams.get('categorie') || 'bar'
  const openNow     = searchParams.get('openNow') === 'true'
  const soir        = searchParams.get('soir') === 'true'
  const excludeIds  = new Set((searchParams.get('exclude') || '').split(',').filter(Boolean))
  const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
  const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
  const arrParam = searchParams.get('arr') ? Number(searchParams.get('arr')) : null
  const arr = arrParam && ARR_CENTERS[arrParam] ? arrParam : null

  // Budgets demandés (1-3), CSV ; vide = tous. Clubs : le prix ne compte pas (c'est toujours cher).
  const budgets = categorie === 'clubbing' ? [] : (searchParams.get('budget') || '')
    .split(',').map(Number).filter(n => n >= 1 && n <= 3)

  // Filtre « ouvert à un horaire choisi » : openAt=HHMM & openAtDay=0-6
  const openAtTime = searchParams.get('openAt') ? parseInt(searchParams.get('openAt')!) : null
  const openAtDay  = searchParams.get('openAtDay') != null ? Number(searchParams.get('openAtDay')) : null
  const hasOpenAt  = openAtTime != null && openAtDay != null && !Number.isNaN(openAtTime) && !Number.isNaN(openAtDay)

  // Quels moments tester ? (null = pas de filtre d'horaire ; ouvert à l'un d'eux = gardé)
  const moments: Moment[] | null = hasOpenAt ? [{ day: openAtDay!, time: openAtTime! }]
    : soir ? tonightMoments()
    : openNow ? [parisNow()]
    : null
  const isOpen = (s: { horaires?: unknown }) => !moments || moments.some(m => isOpenAt(s.horaires, m.day, m.time))

  const supabase = createAdminClient()
  const types = TYPES_BY_CATEGORIE[categorie] || TYPES_BY_CATEGORIE['bar']

  // ── Mode carte : tous les spots géolocalisés de la catégorie ──
  if (searchParams.get('all') === 'true') {
    const { data } = await supabase
      .from('spots')
      .select('*')
      .eq('actif', true)
      .in('type', types)
      .not('coordonnees_lat', 'is', null)
      .not('coordonnees_lng', 'is', null)
      .limit(2000)
    const open = ((data || []) as (Candidate & Record<string, unknown>)[]).filter(isOpen)
    // Bon prix ; s'il n'y en a aucun, prix voisins ; sinon tout (la carte n'est jamais vide à tort)
    const exact = open.filter(s => budgetGap(s.budget, budgets) === 0)
    const close = open.filter(s => budgetGap(s.budget, budgets) <= 1)
    return NextResponse.json(exact.length ? exact : close.length ? close : open)
  }

  // ── Mode liste : on classe toute la catégorie (requête légère), puis on charge les 3 retenus ──
  const columns = 'id, arrondissement, budget, coordonnees_lat, coordonnees_lng' + (moments ? ', horaires' : '')
  const [candRes, photoRes] = await Promise.all([
    supabase.from('spots').select(columns).eq('actif', true).in('type', types).limit(2000),
    // Spots avec une vraie photo (pas vide, pas un lien Google expiré)
    supabase.from('spots').select('id').eq('actif', true).in('type', types)
      .not('photo_url', 'is', null).not('photo_url', 'like', '%googleusercontent.com/gps-cs-s/%').limit(2000),
  ])
  if (candRes.error) return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 })

  const withPhoto = new Set(((photoRes.data || []) as { id: string }[]).map(s => s.id))
  const candidates = ((candRes.data || []) as unknown as Candidate[])
    .filter(s => !excludeIds.has(s.id))
    .filter(isOpen)

  // Contexte de localisation
  const user = lat && lng ? { lat, lng } : null
  const center = !user && arr ? ARR_CENTERS[arr] : null
  const arrRank = new Map<number, number>()
  if (center) arrondissementsByDistance(center.lat, center.lng).forEach((a, i) => arrRank.set(a, i))

  const ranked = candidates.map(s => {
    const gap = budgetGap(s.budget, budgets)
    const lastResort = gap >= 2 ? 1 : 0
    const photo = withPhoto.has(s.id) ? 0 : 1
    const random = Math.random()
    const pos = spotPosition(s)
    let key: number[]
    let distance: number | undefined

    if (user) {
      // « Autour de moi » : anneaux de distance, bon prix d'abord dans chaque anneau
      const d = pos ? haversineKm(user.lat, user.lng, pos.lat, pos.lng) : 99
      const ring = ringIndex(d, GEO_RINGS_KM)
      if (pos?.exact) distance = d
      key = [lastResort, ring, gap, photo, d]
    } else if (center && arr) {
      // Arrondissement choisi d'abord, puis les arrondissements par cercles de distance
      const a = s.arrondissement || 0
      const aCenter = ARR_CENTERS[a]
      const zone = a === arr ? 0
        : aCenter ? 1 + ringIndex(haversineKm(center.lat, center.lng, aCenter.lat, aCenter.lng), ARR_RINGS_KM)
        : 1 + ARR_RINGS_KM.length
      key = [lastResort, zone, gap, arrRank.get(a) ?? 99, photo, random]
    } else {
      // Sans localisation : bon prix, photo, hasard
      key = [lastResort, gap, photo, random]
    }
    return { id: s.id, key, distance }
  }).sort((a, b) => compareKeys(a.key, b.key))

  const top = ranked.slice(0, 3)
  if (top.length === 0) return NextResponse.json([])

  // Charge les fiches complètes des 3 spots retenus, dans l'ordre du classement
  const { data: full } = await supabase.from('spots').select('*').in('id', top.map(t => t.id))
  const byId = new Map(((full || []) as Record<string, unknown>[]).map(s => [s.id as string, s]))
  const result = top
    .map(t => {
      const s = byId.get(t.id)
      if (!s) return null
      return t.distance != null ? { ...s, _distance: t.distance } : s
    })
    .filter(Boolean)

  return NextResponse.json(result)
}
