import { createClient } from '@supabase/supabase-js'

// Next.js 14 met en cache côté serveur toutes les réponses de fetch() (« Data Cache »,
// jusqu'à 1 an), même avec `dynamic = 'force-dynamic'`. Sans ça, une fiche modifiée
// dans le back-office (photos, horaires…) n'apparaissait jamais dans les résultats.
// On force donc chaque requête Supabase à aller lire la base en direct.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  { global: { fetch: noStoreFetch } }
)

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
    { global: { fetch: noStoreFetch } }
  )
}
