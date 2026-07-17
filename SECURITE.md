# Sécurité MITMIT — durcissement Supabase (#32) et secrets (#33)

Ce document décrit deux corrections de sécurité et les étapes à réaliser côté Supabase / Vercel.
Le code de l'application est déjà prêt ; certaines étapes (variables d'environnement, SQL) ne peuvent
être faites que par vous, avec vos accès.

## 1. Secrets hors de la base synchronisée (#33) — DÉJÀ EN PLACE

**Problème** : le jeton Admin Shopify était stocké dans `data.settings`, donc synchronisé dans la base
partagée `cockpit_state` — lisible par quiconque possède la clé anon publique.

**Correctif livré** :
- Le jeton et le domaine Shopify sont désormais stockés **localement, par appareil** (jamais dans le
  blob synchronisé). Une migration les retire automatiquement de `settings` s'ils y étaient.
- Le relais `api/shopify.js` donne désormais la **priorité aux variables d'environnement serveur**.

**Recommandé (pour ne plus rien saisir dans le navigateur)** — définir sur Vercel :
- `SHOPIFY_STORE_DOMAIN` = `votre-boutique.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` = jeton Admin API (scopes `read_products`, `read_inventory`)

Une fois ces variables posées, le navigateur n'a plus besoin du jeton du tout.

> Le `calendarToken` (flux ICS en lecture seule) reste dans les réglages : il est déjà validé côté
> serveur (`api/calendar.js`) et ne donne accès qu'au calendrier. Régénérez-le si besoin depuis
> « Connecter le calendrier ».

## 2. Row Level Security sur `cockpit_state` (#32) — ACTION REQUISE

**Problème** : le navigateur lit/écrit directement `cockpit_state` avec la **clé anon publique**
(visible dans le bundle). Sans RLS stricte, cette clé permet de lire/écrire toute la base.

**Correctif** : router les accès par un relais serveur authentifié par Clerk et utilisant la clé
**service_role**, puis bloquer tout accès direct via la clé anon.

### Étapes

1. **Vercel → Settings → Environment Variables**, ajoutez (si absentes) :
   - `SUPABASE_URL` = même valeur que `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API → `service_role` (secret)
   - `CLERK_SECRET_KEY` (déjà présente normalement)
   Redéployez.

2. Le relais **`api/state.js`** est déjà livré (GET/POST de la ligne « shared »). Vérifiez qu'il
   répond : une fois connecté, `GET /api/state` doit renvoyer l'état, `POST /api/state { data }`
   doit l'écrire.

3. **Bascule du client vers le relais** (étape applicative, à tester sur la preview avant la prod) :
   remplacer, dans `src/App.jsx`, les appels directs `supabase.from("cockpit_state")…` (lecture,
   upsert, realtime) par des appels à `/api/state`. Cette étape modifie le cœur de la synchro : à
   faire et tester ensemble, sur une preview Vercel, avant fusion en production.

4. **Supabase → SQL Editor** : exécutez `supabase/rls.sql` pour activer le RLS strict (aucune policy
   anon → tout accès direct par la clé anon est refusé ; seul le relais service_role passe).

> Tant que l'étape 3 n'est pas faite, n'exécutez pas encore le SQL strict : le client, qui écrit
> encore avec la clé anon, serait bloqué. Faites 1 → 2 → 3 (testé) → 4 dans cet ordre.
