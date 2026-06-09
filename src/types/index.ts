export type Spot = {
  id: string
  nom: string
  type: string
  vibe: string | null
  adresse: string
  arrondissement: number
  coordonnees_lat: number
  coordonnees_lng: number
  budget: 1 | 2 | 3
  energie: 1 | 2 | 3
  tags: string[]
  horaires: Record<string, string> | null
  note_google: number | null
  place_id_google: string | null
  photo_url: string | null
  photos: string[] | null
  actif: boolean
  vibe_enrichie: boolean
  suggestions_count: number
  date_ajout: string
}

export type SuggestionUser = {
  id: string
  nom_lieu: string
  adresse: string
  commentaire: string
  statut: 'en attente' | 'validé' | 'rejeté'
  date_soumission: string
}

export type MoodSelection = {
  energie: 1 | 2 | 3
  budget: 1 | 2 | 3
  compagnie: 'solo' | 'duo' | 'groupe'
}
