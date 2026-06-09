/**
 * Script de récupération des spots nightlife parisiens via Google Places API
 * Usage: node scripts/fetch-spots.js
 * Nécessite: GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// Charger .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables manquantes dans .env.local')
  process.exit(1)
}

// Zones de recherche : centre + quartiers nightlife
const SEARCH_ZONES = [
  // Arrondissements centraux
  { name: '1er', lat: 48.8606, lng: 2.3477 },
  { name: '2e', lat: 48.8661, lng: 2.3477 },
  { name: '3e', lat: 48.8630, lng: 2.3601 },
  { name: '4e', lat: 48.8549, lng: 2.3527 },
  { name: '5e', lat: 48.8462, lng: 2.3461 },
  { name: '6e', lat: 48.8496, lng: 2.3341 },
  { name: '7e', lat: 48.8566, lng: 2.3122 },
  { name: '8e', lat: 48.8741, lng: 2.3036 },
  { name: '9e', lat: 48.8764, lng: 2.3363 },
  { name: '10e', lat: 48.8764, lng: 2.3641 },
  { name: '11e', lat: 48.8590, lng: 2.3790 },
  { name: '12e', lat: 48.8393, lng: 2.3930 },
  { name: '13e', lat: 48.8320, lng: 2.3564 },
  { name: '14e', lat: 48.8330, lng: 2.3264 },
  { name: '15e', lat: 48.8425, lng: 2.2967 },
  { name: '16e', lat: 48.8636, lng: 2.2769 },
  { name: '17e', lat: 48.8877, lng: 2.3135 },
  { name: '18e', lat: 48.8916, lng: 2.3446 },
  { name: '19e', lat: 48.8816, lng: 2.3823 },
  { name: '20e', lat: 48.8641, lng: 2.4019 },
  // Quartiers nightlife spécifiques
  { name: 'Oberkampf', lat: 48.8659, lng: 2.3756 },
  { name: 'Canal Saint-Martin', lat: 48.8707, lng: 2.3658 },
  { name: 'Belleville', lat: 48.8716, lng: 2.3859 },
  { name: 'Pigalle', lat: 48.8831, lng: 2.3348 },
  { name: 'Marais', lat: 48.8570, lng: 2.3565 },
  { name: 'Bastille', lat: 48.8532, lng: 2.3694 },
  { name: 'République', lat: 48.8672, lng: 2.3630 },
  { name: 'Montmartre', lat: 48.8867, lng: 2.3431 },
  { name: 'Saint-Germain', lat: 48.8534, lng: 2.3344 },
  // Zones limitrophes
  { name: 'Montreuil', lat: 48.8637, lng: 2.4435 },
  { name: 'Saint-Ouen', lat: 48.9135, lng: 2.3335 },
  { name: 'Vincennes', lat: 48.8469, lng: 2.4390 },
]

const SEARCH_TYPES = ['bar', 'night_club']
const KEYWORDS = ['bar', 'cocktail bar', 'bar à vin', 'underground bar', 'techno club', 'jazz bar']

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(JSON.parse(data)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function supabaseRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path)
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    }
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)

    const req = https.request(options, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Centres GPS des arrondissements parisiens
const ARR_CENTERS = {
  1:  { lat: 48.8606, lng: 2.3477 },
  2:  { lat: 48.8661, lng: 2.3477 },
  3:  { lat: 48.8630, lng: 2.3601 },
  4:  { lat: 48.8549, lng: 2.3527 },
  5:  { lat: 48.8462, lng: 2.3461 },
  6:  { lat: 48.8496, lng: 2.3341 },
  7:  { lat: 48.8566, lng: 2.3122 },
  8:  { lat: 48.8741, lng: 2.3036 },
  9:  { lat: 48.8764, lng: 2.3363 },
  10: { lat: 48.8764, lng: 2.3641 },
  11: { lat: 48.8590, lng: 2.3790 },
  12: { lat: 48.8393, lng: 2.3930 },
  13: { lat: 48.8320, lng: 2.3564 },
  14: { lat: 48.8330, lng: 2.3264 },
  15: { lat: 48.8425, lng: 2.2967 },
  16: { lat: 48.8636, lng: 2.2769 },
  17: { lat: 48.8877, lng: 2.3135 },
  18: { lat: 48.8916, lng: 2.3446 },
  19: { lat: 48.8816, lng: 2.3823 },
  20: { lat: 48.8641, lng: 2.4019 },
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Détermine l'arrondissement depuis les coordonnées GPS réelles du lieu
function inferArrondissement(lat, lng) {
  // Si hors Paris (zones limitrophes), on prend l'arr. le plus proche
  let best = 1
  let bestDist = Infinity
  for (const [arr, center] of Object.entries(ARR_CENTERS)) {
    const d = haversineKm(lat, lng, center.lat, center.lng)
    if (d < bestDist) { bestDist = d; best = Number(arr) }
  }
  return best
}

function inferBudget(priceLevel) {
  if (priceLevel === undefined || priceLevel === null) return 2
  if (priceLevel <= 1) return 1
  if (priceLevel === 2) return 2
  return 3
}

function inferEnergie(types) {
  if (types.includes('night_club')) return 3
  if (types.includes('bar')) return 2
  return 2
}

function inferType(types, name) {
  const n = (name || '').toLowerCase()
  if (types.includes('night_club') || n.includes('club')) return 'club'
  if (n.includes('rooftop') || n.includes('terrasse')) return 'rooftop'
  if (n.includes('cocktail') || n.includes('mixology')) return 'cave à cocktails'
  if (n.includes('vin') || n.includes('wine')) return 'bar à vin'
  if (n.includes('bière') || n.includes('beer') || n.includes('brasserie')) return 'bar à bière'
  if (types.includes('bar')) return 'bar'
  return 'bar'
}

async function fetchNearbyPlaces(lat, lng, type, pageToken = null) {
  // radius=1000 pour couvrir ~1km autour du centre de chaque zone
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=${type}&key=${GOOGLE_API_KEY}`
  if (pageToken) url += `&pagetoken=${pageToken}`
  console.log(`    → Requête: location=${lat},${lng} radius=1000 type=${type}${pageToken ? ' [nextPage]' : ''}`)
  return httpsGet(url)
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry,opening_hours,rating,photos,types,price_level&key=${GOOGLE_API_KEY}`
  return httpsGet(url)
}

async function main() {
  console.log('🚀 Démarrage du fetch Google Places...\n')

  // Récupérer les place_ids déjà en base
  const existing = await supabaseRequest('/rest/v1/spots?select=place_id_google', 'GET')
  const existingIds = new Set(
    (existing.body || []).map((s) => s.place_id_google).filter(Boolean)
  )
  console.log(`📦 ${existingIds.size} spots déjà en base\n`)

  const allPlaces = new Map() // place_id → place data

  for (const zone of SEARCH_ZONES) {
    console.log(`🔍 Zone: ${zone.name}`)
    let zoneCount = 0

    for (const type of SEARCH_TYPES) {
      let pageToken = null
      let page = 0

      do {
        if (pageToken) await sleep(2000) // Google exige un délai avant pageToken
        const result = await fetchNearbyPlaces(zone.lat, zone.lng, type, pageToken)

        if (result.status !== 'OK' && result.status !== 'ZERO_RESULTS') {
          console.log(`  ⚠️  Status: ${result.status}`)
          break
        }

        for (const place of result.results || []) {
          if (!allPlaces.has(place.place_id)) {
            allPlaces.set(place.place_id, place)
            zoneCount++
          }
        }

        pageToken = result.next_page_token || null
        page++
        await sleep(300)
      } while (pageToken && page < 3)
    }

    console.log(`  → ${zoneCount} nouveaux lieux trouvés`)
    await sleep(200)
  }

  console.log(`\n✅ Total unique: ${allPlaces.size} lieux`)

  const toInsert = []
  let skipped = 0

  for (const [placeId, place] of allPlaces) {
    if (existingIds.has(placeId)) {
      skipped++
      continue
    }

    // Coordonnées réelles du lieu — on refuse le fallback silencieux
    const lat = place.geometry?.location?.lat
    const lng = place.geometry?.location?.lng
    if (!lat || !lng) {
      console.warn(`  ⚠️  Pas de coordonnées pour "${place.name}" (${placeId}) — ignoré`)
      skipped++
      continue
    }

    // Arrondissement détecté depuis les coordonnées GPS (plus fiable que vicinity)
    const arrondissement = inferArrondissement(lat, lng)

    let photoUrl = null
    if (place.photos && place.photos[0]) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
    }

    // Exclure les lieux qui sont des restaurants sans être des bars
    const types = place.types || []
    const isBar = types.includes('bar') || types.includes('night_club')
    const isRestaurantOnly = (
      !isBar && (
        types.includes('restaurant') ||
        types.includes('meal_delivery') ||
        types.includes('meal_takeaway') ||
        types.includes('food')
      )
    )
    if (isRestaurantOnly) {
      console.log(`  ⛔ Exclu (restaurant) : ${place.name} [${types.join(', ')}]`)
      skipped++
      continue
    }

    toInsert.push({
      nom: place.name,
      type: inferType(place.types || [], place.name),
      vibe: null,
      adresse: place.vicinity || '',
      arrondissement,
      coordonnees_lat: lat,
      coordonnees_lng: lng,
      budget: inferBudget(place.price_level),
      energie: inferEnergie(place.types || []),
      tags: [],
      horaires: null,
      note_google: place.rating || null,
      place_id_google: placeId,
      photo_url: photoUrl,
      actif: true,
      vibe_enrichie: false,
      suggestions_count: 0,
    })
  }

  console.log(`\n📝 À insérer: ${toInsert.length} | Ignorés (déjà en base): ${skipped}`)

  if (toInsert.length === 0) {
    console.log('Rien à insérer.')
    return
  }

  // Insertion par batch de 50
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const res = await supabaseRequest('/rest/v1/spots', 'POST', batch)
    if (res.status >= 200 && res.status < 300) {
      inserted += batch.length
      process.stdout.write(`\r  Inséré: ${inserted}/${toInsert.length}`)
    } else {
      console.error('\n  ❌ Erreur insertion:', res.body)
    }
    await sleep(100)
  }

  console.log(`\n\n🎉 Terminé ! ${inserted} spots insérés dans Supabase.`)
}

main().catch(console.error)
