-- === Socle SaaS multi-clients ===
--
-- Modèle : un « locataire » = une organisation. Un utilisateur Clerk peut appartenir à
-- plusieurs organisations, avec un rôle par organisation. Toute donnée métier porte une
-- colonne organisation_id : c'est elle, et elle seule, qui sépare les clients.
--
-- Sécurité : la RLS est ACTIVÉE et AUCUNE policy n'est accordée aux rôles « anon » et
-- « authenticated ». Le navigateur ne parle donc jamais directement à Postgres — il passe
-- par les fonctions /api, qui vérifient le jeton Clerk puis utilisent la clé service_role
-- (laquelle contourne la RLS). C'est le même choix que le cockpit MITMIT, et pour la même
-- raison : la clé anon est publique, visible dans le bundle JavaScript.
--
-- À exécuter dans Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- organisations (locataires)
create table if not exists public.organisations (
  id                     uuid primary key default gen_random_uuid(),
  nom                    text not null,
  -- Identifiant lisible, utilisable plus tard dans une URL (/o/mon-equipe).
  slug                   text not null unique,
  plan                   text not null default 'gratuit',
  -- Reflet du statut Stripe : inactif · essai · actif · impaye · resilie.
  statut_abonnement      text not null default 'inactif',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- Fin de la période payée en cours : sert à laisser l'accès jusqu'au terme après résiliation.
  periode_fin            timestamptz,
  cree_le                timestamptz not null default now()
);

-- ---------------------------------------------------------------- membres (utilisateur × organisation)
create table if not exists public.membres (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  -- Identité déléguée à Clerk : aucun mot de passe ne transite ni ne dort ici.
  clerk_user_id   text not null,
  email           text,
  nom             text,
  role            text not null default 'membre'
                  check (role in ('proprietaire', 'admin', 'membre')),
  rejoint_le      timestamptz not null default now(),
  unique (organisation_id, clerk_user_id)
);

create index if not exists membres_par_utilisateur on public.membres (clerk_user_id);

-- ---------------------------------------------------------------- invitations
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email           text not null,
  role            text not null default 'membre'
                  check (role in ('admin', 'membre')),
  -- Secret du lien d'invitation. Unique : c'est la clé de recherche à l'acceptation.
  jeton           text not null unique,
  expire_le       timestamptz not null default now() + interval '7 days',
  accepte_le      timestamptz,
  cree_par        text,
  cree_le         timestamptz not null default now()
);

-- Une seule invitation EN ATTENTE par e-mail et par organisation. L'index est partiel :
-- une invitation déjà acceptée ne doit pas empêcher d'en émettre une nouvelle plus tard.
create unique index if not exists invitations_en_attente_uniques
  on public.invitations (organisation_id, lower(email))
  where accepte_le is null;

-- ---------------------------------------------------------------- ressources (EXEMPLE À REMPLACER)
-- Table de démonstration : elle n'existe que pour prouver, de bout en bout, que le cloisonnement
-- par organisation fonctionne (création, lecture, suppression, toutes filtrées). Remplacez-la par
-- vos vraies tables métier — en gardant la colonne organisation_id et la clé étrangère en cascade.
create table if not exists public.ressources (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre           text not null,
  note            text,
  cree_par        text,
  cree_le         timestamptz not null default now()
);

create index if not exists ressources_par_organisation on public.ressources (organisation_id, cree_le desc);

-- ---------------------------------------------------------------- verrouillage
-- RLS activée, aucune policy : tout accès direct par la clé anon publique (lecture, écriture,
-- realtime) est refusé. Seul le service_role, utilisé par les fonctions /api authentifiées
-- par Clerk, peut lire et écrire.
alter table public.organisations enable row level security;
alter table public.membres       enable row level security;
alter table public.invitations   enable row level security;
alter table public.ressources    enable row level security;
