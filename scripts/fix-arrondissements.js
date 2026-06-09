/**
 * Corrige les arrondissements en base à partir des coordonnées GPS réelles.
 * Usage: node scripts/fix-arrondissements.js
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
  console.error('❌ Variables Supabase manquantes')
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
  console.log('🔧 Correction des arrondissements en base...\n')

  // Récupère tous les spots avec leurs coordonnées (pagination 1000 par page)
  let allSpots = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const res = await supabaseRequest(
      `/rest/v1/spots?select=id,coordonnees_lat,coordonnees_lng,arrondissement&offset=${offset}&limit=${pageSize}`,
      'GET'
    )
    const page = res.body || []
    allSpots = allSpots.concat(page)
    console.log(`  Chargé ${allSpots.length} spots...`)
    if (page.length < pageSize) break
    offset += pageSize
  }

  console.log(`\n📦 Total: ${allSpots.length} spots à vérifier\n`)

  // Stats par arrondissement avant
  const beforeCount = {}
  for (const s of allSpots) {
    beforeCount[s.arrondissement] = (beforeCount[s.arrondissement] || 0) + 1
  }
  console.log('Avant correction — top 5 arrondissements:')
  Object.entries(beforeCount).sort((a,b) => b[1]-a[1]).slice(0,5).forEach(([arr,n]) => console.log(`  ${arr}e: ${n}`))

  // Calcule le bon arrondissement pour chaque spot
  const toUpdate = []
  let noCoords = 0

  for (const spot of allSpots) {
    const lat = spot.coordonnees_lat
    const lng = spot.coordonnees_lng

    if (!lat || !lng) {
      noCoords++
      continue
    }

    const correct = inferArrondissement(lat, lng)
    if (correct !== spot.arrondissement) {
      toUpdate.push({ id: spot.id, arrondissement: correct })
    }
  }

  console.log(`\n📝 ${toUpdate.length} spots à corriger | ${allSpots.length - toUpdate.length} déjà corrects | ${noCoords} sans coordonnées`)

  if (toUpdate.length === 0) {
    console.log('✅ Rien à corriger.')
    return
  }

  // Mise à jour par batch de 50
  let updated = 0
  const BATCH = 50

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)

    await Promise.all(batch.map(({ id, arrondissement }) =>
      supabaseRequest(
        `/rest/v1/spots?id=eq.${id}`,
        'PATCH',
        { arrondissement }
      )
    ))

    updated += batch.length
    process.stdout.write(`\r  Mis à jour: ${updated}/${toUpdate.length}`)
    await sleep(100)
  }

  console.log(`\n\n🎉 Terminé ! ${updated} arrondissements corrigés.`)

  // Stats après
  const afterCount = {}
  for (const s of allSpots) {
    const arr = toUpdate.find(u => u.id === s.id)?.arrondissement ?? s.arrondissement
    afterCount[arr] = (afterCount[arr] || 0) + 1
  }
  console.log('\nAprès correction — répartition par arrondissement:')
  Object.entries(afterCount).sort((a,b) => Number(a[0])-Number(b[0])).forEach(([arr,n]) => console.log(`  ${arr}e: ${n}`))
}

main().catch(console.error)
