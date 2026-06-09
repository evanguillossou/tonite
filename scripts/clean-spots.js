/**
 * Deux opérations en une passe :
 * 1. Corrige les arrondissements depuis les coordonnées GPS réelles
 * 2. Désactive les spots qui sont des restaurants (pas des bars)
 *
 * Usage: node scripts/clean-spots.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables Supabase manquantes dans .env.local')
  process.exit(1)
}

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

// Types Google Places qui indiquent un restaurant (et PAS un bar)
const RESTAURANT_ONLY_TYPES = [
  'restaurant', 'meal_delivery', 'meal_takeaway', 'bakery',
  'food', 'grocery_or_supermarket', 'supermarket',
]

// Types qui confirment que c'est bien un bar
const BAR_TYPES = ['bar', 'night_club', 'casino', 'liquor_store']

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function inferArrondissement(lat, lng) {
  let best = 1, bestDist = Infinity
  for (const [arr, center] of Object.entries(ARR_CENTERS)) {
    const d = haversineKm(lat, lng, center.lat, center.lng)
    if (d < bestDist) { bestDist = d; best = Number(arr) }
  }
  return best
}

function supabaseRequest(urlPath, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + urlPath)
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('🔧 Nettoyage de la base Tonite...\n')

  // ── Chargement de tous les spots ──
  let allSpots = []
  let offset = 0
  while (true) {
    const res = await supabaseRequest(
      `/rest/v1/spots?select=id,nom,type,coordonnees_lat,coordonnees_lng,arrondissement,tags,actif&offset=${offset}&limit=1000`,
      'GET'
    )
    const page = res.body || []
    allSpots = allSpots.concat(page)
    process.stdout.write(`\r  Chargé ${allSpots.length} spots...`)
    if (page.length < 1000) break
    offset += 1000
    await sleep(100)
  }
  console.log(`\n✅ ${allSpots.length} spots chargés\n`)

  // ── Analyse ──
  const arrFixes   = []  // { id, arrondissement }
  const toDisable  = []  // { id, raison }

  for (const spot of allSpots) {
    const lat = spot.coordonnees_lat
    const lng = spot.coordonnees_lng

    // 1. Corriger l'arrondissement via coordonnées GPS
    if (lat && lng) {
      const correct = inferArrondissement(lat, lng)
      if (correct !== spot.arrondissement) {
        arrFixes.push({ id: spot.id, arrondissement: correct })
      }
    }

    // 2. Détecter les restaurants déguisés en bars
    //    On se base sur le champ `type` stocké et les `tags`
    const typeStr = (spot.type || '').toLowerCase()
    const tagsStr = (spot.tags || []).join(' ').toLowerCase()
    const nom = (spot.nom || '').toLowerCase()

    const isRestaurant = (
      typeStr === 'restaurant' ||
      tagsStr.includes('restaurant') ||
      // Noms typiques de restaurants (heuristiques)
      nom.includes('restaurant') ||
      nom.includes(' brasserie') ||   // ex: "Brasserie Lipp" OK mais "Restaurant brasserie" non
      nom.includes('pizz') ||
      nom.includes('sushi') ||
      nom.includes('ramen') ||
      nom.includes('kebab') ||
      nom.includes('burger king') ||
      nom.includes('mcdonald') ||
      nom.includes('quick ') ||
      nom.includes('subway')
    )

    // Ne désactive que si actif et clairement restaurant
    if (isRestaurant && spot.actif) {
      toDisable.push({ id: spot.id, raison: `type="${spot.type}" nom="${spot.nom}"` })
    }
  }

  console.log(`📍 Arrondissements à corriger : ${arrFixes.length}`)
  console.log(`🍽️  Restaurants à désactiver  : ${toDisable.length}\n`)

  // ── Corrections arrondissements ──
  if (arrFixes.length > 0) {
    console.log('Correction des arrondissements...')
    let done = 0
    const BATCH = 50
    for (let i = 0; i < arrFixes.length; i += BATCH) {
      const batch = arrFixes.slice(i, i + BATCH)
      await Promise.all(batch.map(({ id, arrondissement }) =>
        supabaseRequest(`/rest/v1/spots?id=eq.${id}`, 'PATCH', { arrondissement })
      ))
      done += batch.length
      process.stdout.write(`\r  ${done}/${arrFixes.length}`)
      await sleep(80)
    }
    console.log('\n✅ Arrondissements corrigés')
  }

  // ── Désactivation restaurants ──
  if (toDisable.length > 0) {
    console.log('\nDésactivation des restaurants...')
    // Log des 20 premiers pour vérification
    console.log('  Exemples désactivés:')
    toDisable.slice(0, 20).forEach(({ raison }) => console.log(`    – ${raison}`))
    if (toDisable.length > 20) console.log(`    ... et ${toDisable.length - 20} autres`)

    let done = 0
    const BATCH = 50
    for (let i = 0; i < toDisable.length; i += BATCH) {
      const batch = toDisable.slice(i, i + BATCH)
      await Promise.all(batch.map(({ id }) =>
        supabaseRequest(`/rest/v1/spots?id=eq.${id}`, 'PATCH', { actif: false })
      ))
      done += batch.length
      process.stdout.write(`\r  ${done}/${toDisable.length}`)
      await sleep(80)
    }
    console.log('\n✅ Restaurants désactivés')
  }

  // ── Résumé final ──
  const resAfter = await supabaseRequest('/rest/v1/spots?select=arrondissement&actif=eq.true', 'GET')
  const activeSpots = resAfter.body || []
  const byArr = {}
  for (const s of activeSpots) byArr[s.arrondissement] = (byArr[s.arrondissement] || 0) + 1

  console.log('\n📊 Spots actifs par arrondissement après nettoyage:')
  Object.entries(byArr)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([arr, n]) => console.log(`  ${String(arr).padStart(2)}e : ${n}`))
  console.log(`\n  TOTAL actifs : ${activeSpots.length}`)
}

main().catch(console.error)
