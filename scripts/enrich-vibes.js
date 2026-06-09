/**
 * Enrichit les vibes de tous les spots actifs sans vibe.
 * Si le spot s'avère être un restaurant/bistrot, le désactive.
 *
 * Usage: node scripts/enrich-vibes.js
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

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!ANTHROPIC_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables manquantes dans .env.local')
  process.exit(1)
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

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = https.request(options, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(d)
          resolve(parsed.content?.[0]?.text || '')
        } catch { resolve('') }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('✨ Enrichissement des vibes Tonite...\n')

  // Charger tous les spots actifs sans vibe
  let allSpots = []
  let offset = 0
  while (true) {
    const res = await supabaseRequest(
      `/rest/v1/spots?select=id,nom,adresse,type,arrondissement,note_google&actif=eq.true&vibe_enrichie=eq.false&offset=${offset}&limit=1000`,
      'GET'
    )
    const page = res.body || []
    allSpots = allSpots.concat(page)
    if (page.length < 1000) break
    offset += 1000
    await sleep(100)
  }

  console.log(`📝 ${allSpots.length} spots à enrichir\n`)

  let enriched = 0, deactivated = 0, errors = 0

  for (let i = 0; i < allSpots.length; i++) {
    const spot = allSpots[i]
    process.stdout.write(`\r[${i+1}/${allSpots.length}] ${spot.nom.slice(0, 40).padEnd(40)} | ✅ ${enriched} vibes | 🚫 ${deactivated} désactivés`)

    const prompt = `Tu es expert de la vie nocturne parisienne.

Voici un lieu :
- Nom : ${spot.nom}
- Adresse : ${spot.adresse || `${spot.arrondissement}e arrondissement, Paris`}
- Type déclaré : ${spot.type}
- Note Google : ${spot.note_google || 'non renseignée'}

MISSION : Écris une vibe pour ce lieu. Exception : si c'est CLAIREMENT un restaurant, bistrot ou brasserie sans aucun aspect bar/sortie nocturne, réponds uniquement DESACTIVER.

Dans le doute, écris toujours une vibe — on préfère une vibe approximative à pas de vibe.

Vibe : 1 phrase max, 15 mots max, en français, style nocturne parisien cool.
Pas de guillemets. Pas d'explication. Juste la vibe.`

    try {
      const response = await callClaude(prompt)
      const text = response.trim()

      if (text.includes('DESACTIVER')) {
        await supabaseRequest(`/rest/v1/spots?id=eq.${spot.id}`, 'PATCH', { actif: false })
        deactivated++
      } else if (text.length > 5 && text.length < 200) {
        await supabaseRequest(`/rest/v1/spots?id=eq.${spot.id}`, 'PATCH', {
          vibe: text,
          vibe_enrichie: true,
        })
        enriched++
      }
    } catch (err) {
      errors++
    }

    // Respecter le rate limit Claude Haiku
    await sleep(200)
  }

  console.log(`\n\n🎉 Terminé !`)
  console.log(`  ✅ Vibes enrichies  : ${enriched}`)
  console.log(`  🚫 Désactivés       : ${deactivated}`)
  console.log(`  ❌ Erreurs          : ${errors}`)
}

main().catch(console.error)
