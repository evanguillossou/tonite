/**
 * Réécrit les vibes trop génériques avec plus de variété.
 * Usage: node scripts/rewrite-vibes.js
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

// Mots et formules trop génériques à détecter
const BANNED_PATTERNS = [
  'ambiance bohème', 'ambiance cosy', 'ambiance intimiste', 'ambiance conviviale',
  'ambiance décontractée', 'ambiance festive', 'ambiance lounge', 'cadre intimiste',
  'atmosphère bohème', 'atmosphère cosy', 'noctambules avertis', 'jusqu\'à l\'aube',
]

function isTooGeneric(vibe) {
  if (!vibe) return false
  const v = vibe.toLowerCase()
  return BANNED_PATTERNS.some(p => v.includes(p))
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
      max_tokens: 100,
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
        try { resolve(JSON.parse(d).content?.[0]?.text || '') }
        catch { resolve('') }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('✍️  Réécriture des vibes génériques...\n')

  let allSpots = []
  let offset = 0
  while (true) {
    const res = await supabaseRequest(
      `/rest/v1/spots?select=id,nom,adresse,type,arrondissement,vibe&actif=eq.true&vibe_enrichie=eq.true&vibe=not.is.null&offset=${offset}&limit=1000`,
      'GET'
    )
    const page = res.body || []
    allSpots = allSpots.concat(page)
    if (page.length < 1000) break
    offset += 1000
    await sleep(100)
  }

  const toRewrite = allSpots.filter(s => isTooGeneric(s.vibe))
  console.log(`📝 ${allSpots.length} vibes chargées`)
  console.log(`✍️  ${toRewrite.length} à réécrire\n`)

  let done = 0, errors = 0

  for (let i = 0; i < toRewrite.length; i++) {
    const spot = toRewrite[i]
    process.stdout.write(`\r[${i+1}/${toRewrite.length}] ${spot.nom.slice(0, 35).padEnd(35)} | ✅ ${done} réécrites`)

    const prompt = `Tu es un rédacteur expert de la vie nocturne parisienne. Tu écris des descriptions courtes, précises et vivantes.

Lieu : ${spot.nom}
Adresse : ${spot.adresse || `${spot.arrondissement}e arr., Paris`}
Type : ${spot.type}
Ancienne description (trop générique) : "${spot.vibe}"

Réécris une description en UNE phrase de 10-15 mots maximum.

RÈGLES ABSOLUES :
- Interdit : "ambiance", "atmosphère", "bohème", "cosy", "intimiste", "convivial", "décontracté", "noctambules", "jusqu'à l'aube", "lounge"
- Sois précis et concret : parle de la déco, du son, du type de clientèle, de la boisson signature, du quartier
- Style direct, pas de langue de bois
- En français
- Pas de guillemets, pas d'explication

Exemples de bonnes vibes :
- Comptoir en zinc, bières belges et terrasse sur canal Saint-Martin
- Vinyles sur les murs, shots de mezcal, clientèle tatouée du 11e
- Cave voûtée, natural wines et DJ sets le vendredi
- Rooftop avec vue Sacré-Cœur, cocktails maison à 12€`

    try {
      const text = (await callClaude(prompt)).trim()
      if (text.length > 5 && text.length < 200) {
        await supabaseRequest(`/rest/v1/spots?id=eq.${spot.id}`, 'PATCH', { vibe: text })
        done++
      }
    } catch {
      errors++
    }

    await sleep(200)
  }

  console.log(`\n\n🎉 Terminé !`)
  console.log(`  ✅ Vibes réécrites : ${done}`)
  console.log(`  ❌ Erreurs         : ${errors}`)
}

main().catch(console.error)
