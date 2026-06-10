import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BAR_TYPES = ['bar', 'club', 'bar à cocktails', 'bar à vin', 'bar à bière', 'rooftop']

export async function GET() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('spots')
    .select('id,nom,type,vibe,budget,arrondissement,coordonnees_lat,coordonnees_lng,photo_url')
    .eq('actif', true)
    .in('type', BAR_TYPES)
    .not('coordonnees_lat', 'is', null)
    .not('coordonnees_lng', 'is', null)

  return NextResponse.json(data || [])
}
