import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Envoi de photos du back-office vers Supabase Storage (bucket public « spot-photos »).
// Les fichiers sont stockés chez TONITE : contrairement aux liens Google, ils n'expirent pas.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'spot-photos'
const MAX_BYTES = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Seul le compte admin peut envoyer des photos. Les inscriptions publiques étant ouvertes
// côté Supabase, « être connecté » ne suffit pas : on vérifie l'identifiant du compte.
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '905b4f60-965e-4b51-b2de-0fe0ce6667ba')
  .split(',').map((s) => s.trim()).filter(Boolean)

export async function POST(req: NextRequest) {
  const admin = createAdminClient()

  // 1. Vérifie la session de l'admin (jeton envoyé par le back-office)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user || !ADMIN_USER_IDS.includes(user.id)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // 2. Contrôle du fichier
  const form = await req.formData()
  const file = form.get('file')
  const spotId = String(form.get('spotId') || 'nouveau').replace(/[^a-zA-Z0-9-]/g, '') || 'nouveau'
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 })
  const ext = EXTENSIONS[file.type]
  if (!ext) return NextResponse.json({ error: 'Format non accepté (JPG, PNG ou WebP).' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Photo trop lourde (5 Mo max).' }, { status: 400 })

  // 3. Envoi dans le stockage TONITE
  const path = `${spotId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) {
    return NextResponse.json({ error: `L'envoi a échoué : ${uploadError.message}` }, { status: 500 })
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
