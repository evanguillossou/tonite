import { supabase } from './supabase'
import type { MoodSelection, Spot } from '@/types'

export async function getMatchingSpots(mood: MoodSelection, excludeIds: string[] = []): Promise<Spot[]> {
  let query = supabase
    .from('spots')
    .select('*')
    .eq('actif', true)
    .eq('energie', mood.energie)
    .eq('budget', mood.budget)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) throw error

  let spots = data as Spot[]

  if (spots.length < 3) {
    const { data: fallback } = await supabase
      .from('spots')
      .select('*')
      .eq('actif', true)
      .eq('budget', mood.budget)
      .not('id', 'in', spots.length > 0 ? `(${spots.map(s => s.id).join(',')})` : '()')
      .limit(3 - spots.length)

    spots = [...spots, ...((fallback as Spot[]) || [])]
  }

  const shuffled = spots.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}
