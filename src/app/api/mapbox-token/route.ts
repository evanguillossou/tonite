import { NextResponse } from 'next/server'

// Lue à l'exécution (pas au build) : robuste face au cache de build Vercel.
// Tant que la variable existe dans Vercel, la carte fonctionne — sans rebuild.
export const dynamic = 'force-dynamic'

export async function GET() {
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.MAPBOX_TOKEN ||
    ''
  return NextResponse.json({ token })
}
