-- ==========================================
-- TONITE — Schéma Supabase
-- Coller dans l'éditeur SQL de Supabase
-- ==========================================

-- Table principale des spots
create table if not exists public.spots (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  type text not null default 'bar',
  vibe text,
  adresse text not null default '',
  arrondissement int not null default 1 check (arrondissement >= 1 and arrondissement <= 20),
  coordonnees_lat float,
  coordonnees_lng float,
  budget int not null default 2 check (budget in (1, 2, 3)),
  energie int not null default 2 check (energie in (1, 2, 3)),
  tags text[] default '{}',
  horaires jsonb,
  note_google float,
  place_id_google text unique,
  photo_url text,
  actif boolean not null default true,
  vibe_enrichie boolean not null default false,
  suggestions_count int not null default 0,
  date_ajout timestamptz not null default now()
);

-- Index pour les requêtes de matching
create index if not exists spots_actif_energie_budget on public.spots (actif, energie, budget);
create index if not exists spots_arrondissement on public.spots (arrondissement);
create index if not exists spots_vibe_enrichie on public.spots (vibe_enrichie);

-- Table des suggestions utilisateurs
create table if not exists public.suggestions_users (
  id uuid default gen_random_uuid() primary key,
  nom_lieu text not null,
  adresse text,
  commentaire text,
  statut text not null default 'en attente' check (statut in ('en attente', 'validé', 'rejeté')),
  date_soumission timestamptz not null default now()
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

alter table public.spots enable row level security;
alter table public.suggestions_users enable row level security;

-- Spots : lecture publique pour les spots actifs
create policy "spots_public_read" on public.spots
  for select using (actif = true);

-- Spots : toutes opérations pour les admins authentifiés
create policy "spots_admin_all" on public.spots
  for all using (auth.role() = 'authenticated');

-- Suggestions : insertion publique (sans auth)
create policy "suggestions_public_insert" on public.suggestions_users
  for insert with check (true);

-- Suggestions : lecture/modif pour admins seulement
create policy "suggestions_admin_all" on public.suggestions_users
  for all using (auth.role() = 'authenticated');

-- ==========================================
-- Données de test (optionnel)
-- ==========================================

-- insert into public.spots (nom, type, vibe, adresse, arrondissement, budget, energie, tags, note_google, actif, vibe_enrichie) values
-- ('Le Syndicat', 'cave à cocktails', 'Le temple du cocktail français — spirits 100% nationaux dans une cave faubourg Saint-Denis.', '51 Rue du Faubourg Saint-Denis, 75010 Paris', 10, 2, 2, ARRAY['cocktails', 'underground', 'français'], 4.5, true, true),
-- ('Concrete', 'club', 'La cathédrale techno de Paris, sous les arches de la Seine — sets de 12h non-stop le week-end.', 'Port de la Rapée, 75012 Paris', 12, 2, 3, ARRAY['techno', 'rave', 'after', 'seine'], 4.2, true, true),
-- ('Le Perchoir Marais', 'rooftop', 'Vue imprenable sur les toits du Marais, cocktails soignés et coucher de soleil en mode cinéma.', '14 Rue Crespin du Gast, 75011 Paris', 11, 3, 2, ARRAY['rooftop', 'vue', 'cocktails', 'marais'], 4.3, true, true);
