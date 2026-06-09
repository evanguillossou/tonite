import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

const ARR_CENTERS: Record<number, { lat: number; lng: number }> = {
  1:  { lat: 48.8606, lng: 2.3477 }, 2:  { lat: 48.8661, lng: 2.3477 },
  3:  { lat: 48.8630, lng: 2.3601 }, 4:  { lat: 48.8549, lng: 2.3527 },
  5:  { lat: 48.8462, lng: 2.3461 }, 6:  { lat: 48.8496, lng: 2.3341 },
  7:  { lat: 48.8566, lng: 2.3122 }, 8:  { lat: 48.8741, lng: 2.3036 },
  9:  { lat: 48.8764, lng: 2.3363 }, 10: { lat: 48.8764, lng: 2.3641 },
  11: { lat: 48.8590, lng: 2.3790 }, 12: { lat: 48.8393, lng: 2.3930 },
  13: { lat: 48.8320, lng: 2.3564 }, 14: { lat: 48.8330, lng: 2.3264 },
  15: { lat: 48.8425, lng: 2.2967 }, 16: { lat: 48.8636, lng: 2.2769 },
  17: { lat: 48.8877, lng: 2.3135 }, 18: { lat: 48.8916, lng: 2.3446 },
  19: { lat: 48.8816, lng: 2.3823 }, 20: { lat: 48.8641, lng: 2.4019 },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function inferArrondissement(lat: number, lng: number): number {
  let best = 1, bestDist = Infinity
  for (const [arr, center] of Object.entries(ARR_CENTERS)) {
    const d = haversineKm(lat, lng, center.lat, center.lng)
    if (d < bestDist) { bestDist = d; best = Number(arr) }
  }
  return best
}

// Résout une URL courte (goo.gl, maps.app.goo.gl) en suivant les redirects
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return res.url
  } catch {
    // Si HEAD échoue, essayer GET
    try {
      const res = await fetch(url, { redirect: 'follow' })
      return res.url
    } catch {
      return url
    }
  }
}

// Extrait les infos d'une URL Google Maps résolue
function parseGoogleMapsUrl(url: string): { name?: string; lat?: number; lng?: number; placeId?: string } {
  try {
    const u = new URL(url)

    // place_id direct dans les params
    const placeId = u.searchParams.get('place_id') || undefined

    // Coordonnées dans l'URL /@lat,lng,zoom
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const lat = coordMatch ? parseFloat(coordMatch[1]) : undefined
    const lng = coordMatch ? parseFloat(coordMatch[2]) : undefined

    // Nom depuis /maps/place/NOM/
    const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/)
    const name = placeMatch
      ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      : undefined

    return { name, lat, lng, placeId }
  } catch {
    return {}
  }
}

// Cherche un lieu par texte + localisation
async function findPlaceFromText(name: string, lat?: number, lng?: number): Promise<string | null> {
  const location = lat && lng ? `&locationbias=circle:500@${lat},${lng}` : '&locationbias=circle:50000@48.8566,2.3522'
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id${location}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return data.candidates?.[0]?.place_id || null
}

// Récupère les détails complets d'un lieu
async function getPlaceDetails(placeId: string) {
  const fields = 'place_id,name,formatted_address,geometry,rating,photos,types,price_level,opening_hours'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return data.result || null
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'Paramètre url manquant' }, { status: 400 })
  }

  try {
    // 1. Résoudre les URLs courtes
    let resolvedUrl = rawUrl
    if (rawUrl.includes('goo.gl') || rawUrl.includes('maps.app.goo.gl')) {
      resolvedUrl = await resolveUrl(rawUrl)
    }

    // 2. Parser l'URL pour extraire nom, coords, place_id
    const parsed = parseGoogleMapsUrl(resolvedUrl)

    // 3. Obtenir le place_id
    let placeId = parsed.placeId || null
    if (!placeId && parsed.name) {
      placeId = await findPlaceFromText(parsed.name, parsed.lat, parsed.lng)
    }
    if (!placeId) {
      return NextResponse.json({ error: 'Lieu introuvable. Vérifie l\'URL ou entre les infos manuellement.' }, { status: 404 })
    }

    // 4. Récupérer les détails
    const details = await getPlaceDetails(placeId)
    if (!details) {
      return NextResponse.json({ error: 'Impossible de récupérer les détails du lieu.' }, { status: 404 })
    }

    const lat = details.geometry?.location?.lat
    const lng = details.geometry?.location?.lng
    const arrondissement = lat && lng ? inferArrondissement(lat, lng) : null

    // URL photo via Places Photos API
    let photo_url: string | null = null
    if (details.photos?.[0]?.photo_reference) {
      photo_url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${details.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
    }

    return NextResponse.json({
      place_id_google: placeId,
      nom: details.name,
      adresse: details.formatted_address,
      arrondissement,
      coordonnees_lat: lat,
      coordonnees_lng: lng,
      note_google: details.rating || null,
      photo_url,
      horaires: details.opening_hours?.periods || null,
      budget: details.price_level != null
        ? details.price_level <= 1 ? 1 : details.price_level === 2 ? 2 : 3
        : null,
    })
  } catch (err) {
    console.error('[places/import]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
