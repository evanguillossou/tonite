import { NextResponse } from 'next/server'

// Lue à l'exécution (pas au build) : robuste face au cache de build Vercel.
export const dynamic = 'force-dynamic'

export async function GET() {
  // IMPORTANT : notation entre crochets. Next.js ne peut PAS « inliner »
  // process.env['NEXT_PUBLIC_...'] au build (contrairement à process.env.NEXT_PUBLIC_...),
  // donc c'est une vraie lecture du runtime Vercel.
  const env = process.env as Record<string, string | undefined>
  const token =
    env['NEXT_PUBLIC_MAPBOX_TOKEN'] ||
    env['MAPBOX_TOKEN'] ||
    ''

  // Diagnostic non sensible : on expose seulement les NOMS de variables liées à Mapbox
  // et la longueur du token, jamais la valeur.
  const mapboxKeys = Object.keys(env).filter(k => k.toUpperCase().includes('MAPBOX'))

  return NextResponse.json({
    token,
    ok: token.length > 0,
    _diag: { mapboxKeys, tokenLength: token.length },
  })
}
