import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nom_lieu, adresse, commentaire } = body

  if (!nom_lieu?.trim()) {
    return NextResponse.json({ error: 'nom_lieu requis' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('suggestions_users').insert({
    nom_lieu: nom_lieu.trim(),
    adresse: adresse?.trim() || null,
    commentaire: commentaire?.trim() || null,
    statut: 'en attente',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
