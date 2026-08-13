-- MITMIT : bons de commande saisis par les clients depuis le lien public /commande.
--
-- Le client remplit le formulaire en ligne (aucun compte, aucun accès à MITMIT) : la commande est
-- déposée ici par le relais serveur /api/commande, avec la clé SERVICE ROLE. MITMIT la relève
-- ensuite (utilisateur authentifié Clerk) et la transforme en DEVIS BROUILLON.
--
-- Sécurité : RLS activée SANS AUCUNE POLICY. Personne n'accède à cette table avec la clé anon
-- publique (ni lecture, ni écriture) ; seule la clé service role, qui vit uniquement côté serveur
-- Vercel, la traverse. Les coordonnées des clients ne sont donc jamais exposées au navigateur.
--
-- À coller dans Supabase : SQL Editor > New query > Run.

create table if not exists public.bons_commande (
  id uuid primary key default gen_random_uuid(),
  ref text not null,                                  -- référence lisible, ex. BC-20260813-4F2A
  created_at timestamptz not null default now(),
  statut text not null default 'nouveau',             -- nouveau | traite | ignore
  client jsonb not null default '{}'::jsonb,          -- coordonnées déclarées par le client
  lignes jsonb not null default '[]'::jsonb,          -- [{ code, designation, qte, pu }]
  total_ht numeric not null default 0,
  deal_id text,                                       -- id du devis brouillon créé dans MITMIT
  deal_ref text,                                      -- référence du devis, ex. DV-2026-012
  traite_at timestamptz,
  ip_hash text,                                       -- empreinte d'IP (anti-abus), jamais l'IP brute
  meta jsonb not null default '{}'::jsonb
);

create index if not exists bons_commande_statut_idx on public.bons_commande (statut, created_at desc);
create index if not exists bons_commande_ip_idx on public.bons_commande (ip_hash, created_at desc);

alter table public.bons_commande enable row level security;

-- Aucune policy volontairement : la clé anon publique ne peut rien lire ni écrire ici.
-- Tout passe par le relais serveur /api/commande (clé service role + vérification Clerk en lecture).
