import type { Spot } from '@/types'

// « Danser » = les spots de type club. Pour eux, pas de prix affiché (c'est toujours cher)
// et un lien optionnel vers la programmation de la boîte.
export function isClub(spot: Pick<Spot, 'type'>) {
  return spot.type === 'club'
}

// Lien de programmation prêt à ouvrir (ajoute https:// si on a collé « shotgun.live/… »)
export function programmationUrl(spot: Pick<Spot, 'type' | 'lien_programmation'>): string | null {
  if (!isClub(spot)) return null
  const raw = (spot.lien_programmation || '').trim()
  if (!raw) return null
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}
