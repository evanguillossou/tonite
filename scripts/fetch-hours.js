/**
 * Récupère les horaires d'ouverture depuis Google Places
 * et les stocke dans le champ `horaires` de chaque spot.
 *
 * Usage: node scripts/fetch-hours.js
 * Coût : 1 appel Place Details par spot avec place_id_google (opération unique)
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

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables manquantes dans .env.local')
  process.exit(1)
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(JSON.parse(data)))
      res.on('error', reject)
    }).on('error', reject)
  })
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
      res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }))
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function getOpeningHours(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=opening_hours&key=${GOOGLE_API_KEY}`
  const res = await httpsGet(url)
  return res.result?.opening_hours?.periods || null
}

async function main() {
  console.log('🕐 Récupération des horaires Google Places...\n')

  // Charger tous les spots avec un place_id_google et sans horaires déjà remplis
  let allSpots = []
  let offset = 0
  while (true) {
    const res = await supabaseRequest(
      `/rest/v1/spots?select=id,nom,place_id_google,horaires&actif=eq.true&place_id_google=not.is.null&offset=${offset}&limit=1000`,
      'GET'
    )
    const page = res.body || []
    allSpots = allSpots.concat(page)
    if (page.length < 1000) break
    offset += 1000
    await sleep(100)
  }

  // On ne refait pas les spots qui ont déjà leurs horaires
  const todo = allSpots.filter(s => !s.horaires)
  const already = allSpots.length - todo.length

  console.log(`📦 ${allSpots.length} spots avec place_id`)
  console.log(`✅ ${already} ont déjà leurs horaires`)
  console.log(`📝 ${todo.length} à traiter\n`)

  if (todo.length === 0) {
    console.log('Rien à faire.')
    return
  }

  let done = 0, filled = 0, empty = 0, errors = 0

  for (const spot of todo) {
    try {
      const periods = await getOpeningHours(spot.place_id_google)

      if (periods) {
        await supabaseRequest(
          `/rest/v1/spots?id=eq.${spot.id}`,
          'PATCH',
          { horaires: periods }
        )
        filled++
      } else {
        empty++
      }
    } catch (err) {
      console.warn(`  ⚠️  Erreur pour ${spot.nom}: ${err.message}`)
      errors++
    }

    done++
    process.stdout.write(`\r  Traité: ${done}/${todo.length} — ${filled} horaires enregistrés`)

    // 100ms entre chaque appel pour ne pas saturer l'API
    await sleep(100)
  }

  console.log(`\n\n🎉 Terminé !`)
  console.log(`  ✅ Horaires enregistrés : ${filled}`)
  console.log(`  ⚪ Pas d'horaires Google : ${empty}`)
  console.log(`  ❌ Erreurs              : ${errors}`)
}

main().catch(console.error)
