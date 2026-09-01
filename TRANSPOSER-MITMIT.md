# Transposer MITMIT

> **Note (septembre 2026)** : ce manuel décrit la version **branchée** du logiciel. Depuis, les
> connecteurs ont été débranchés et le dossier `api/` ainsi que `lib/gmail.js`, `lib/depot.js` et
> `lib/bonCommande.js` ont été retirés du dépôt. Pour transposer à partir de la version complète :
> `git checkout ef819fc` (dernier commit branché, PR #494). Voir l'encadré en tête du `README.md`.

Ce document accompagne l'export complet du logiciel. Il dit ce que contient l'archive, ce qu'il faut
pour la faire tourner, et ce qu'il faut changer pour la reposer ailleurs — autre hébergeur, autre
compte, autre marque.

Le `README.md` livré à la racine décrit l'installation nominale sur Vercel. **Ce document-ci traite
de la transposition** : les contraintes dures, les points de rupture, et la liste de ce qui porte la
marque PEN'UP 3D.

---

## 1. Ce que contient l'export

72 fichiers suivis, **3,1 Mo**. Aucun secret : `.env.example` ne contient que des gabarits, et les
fichiers `.env*` réels sont exclus par `.gitignore`. `node_modules` et `dist` ne sont pas dans
l'archive — ils se régénèrent avec `npm install` et `npm run build`.

```
.
├── index.html                  écran de démarrage HTML pur + amorce React
├── package.json                dépendances et scripts (Node 20 minimum)
├── vite.config.js              build, découpe en chunks stables
├── vercel.json                 réécritures d'URL et en-têtes de cache
├── .env.example                gabarit des variables d'environnement
├── README.md                   installation nominale
├── SECURITE.md                 durcissement Supabase et secrets
├── TRANSPOSER-MITMIT.md        ce document
├── MATMAT-KIT-VISUEL.md        30 fonctionnalités visuelles, portables telles quelles
├── MATMAT-KIT-DONNEES.md       40 fonctionnalités données + la carte
│
├── src/
│   ├── main.jsx                racine React, garde Clerk, filet anti-page-blanche, service worker
│   ├── App.jsx                 TOUTE l'application (≈ 1,8 Mo, ~16 800 lignes)
│   ├── supabaseClient.js       client Supabase, jeton Clerk joint à chaque requête
│   ├── restoreData.json        jeu de données de secours du tout premier lancement
│   └── ModeleCanalIndependants.jsx
│
├── lib/                        code partagé entre l'interface ET les fonctions serveur
│   ├── bonCommande.js          page publique de commande + son relais
│   ├── logoPenUp.js            logo en data URI (lisible des deux côtés)
│   ├── productImages.js        visuels catalogue en data URI
│   ├── gmail.js                envoi et lecture Gmail
│   └── depot.js
│
├── api/                        fonctions serverless — EXACTEMENT 12, voir §5
│   ├── state.js                état partagé + branche « bdc » de la page de commande
│   ├── claude.js               relais IA (clé API jamais exposée au navigateur)
│   ├── calendar.js             flux iCalendar protégé par jeton
│   ├── shopify.js  outils.js  status.js
│   ├── gmail.js  gmail-send.js  gmail-draft.js  gmail-sync.js
│   └── auth/google.js  auth/google/callback.js
│
├── public/                     logos, icônes PWA, manifeste, service worker
├── supabase/                   le schéma, à exécuter dans l'ordre
│   ├── migrations/0001_cockpit_state.sql
│   ├── migrations/0002_bons_commande.sql
│   └── rls.sql                 durcissement — LIRE LE §5 AVANT DE L'EXÉCUTER
└── saas/                       coquille SaaS multi-organisations, projet séparé
```

**`src/App.jsx` est un fichier unique de 1,8 Mo.** Ce n'est pas un accident : tout l'écran, tout le
CSS, tous les composants y vivent. C'est le principal fait à connaître avant d'y toucher. Le fichier
est très commenté — les commentaires expliquent presque toujours *pourquoi*, pas *quoi*.

**`saas/` est un projet à part**, avec son propre `package.json` et son propre déploiement. C'est une
coquille multi-organisations (Clerk + Stripe + Supabase) qui ne partage aucun code avec MITMIT.
Voir `saas/README.md`. Vous pouvez la supprimer sans rien casser.

### Ce que l'archive ne contient PAS

Tout le **code** y est, fonctions serveur comprises : les douze fichiers de `api/` et les cinq
modules partagés de `lib/`. Ce qui manque, ce sont les choses qui ne sont pas du code, et qui ne
peuvent pas l'être.

| Absent | Pourquoi | Comment le reconstituer |
|---|---|---|
| **Les clés d'API** | un secret dans une archive est un secret perdu | `.env.example` liste les **21 variables** lues par le code, avec pour chacune où la créer |
| **Les données** | elles vivent dans Supabase et dans les navigateurs | bouton « Sauvegarde » → JSON, ou l'export SQL du §8 |
| **Le projet Supabase** | c'est un service, pas un fichier | le **schéma** est dans l'archive (`supabase/`, trois fichiers SQL) ; à exécuter sur un projet neuf |
| **L'application Clerk** | idem — comptes, sessions, méthodes de connexion | à recréer ; cinq minutes, aucune donnée à migrer si l'équipe se reconnecte |
| **L'app OAuth Google** et son *refresh token* | le jeton s'obtient par un échange interactif | recréer l'app, déclarer l'URL de rappel, puis ouvrir `/api/auth/google` connecté au bon compte : le jeton s'affiche, à recopier en variable |
| **L'app Shopify** | jeton lié à une boutique | app personnalisée, scopes `read_products` + `read_inventory` |
| **Les domaines** | DNS et rattachement Vercel | le domaine dédié à la page de commande est nommé en dur dans `vercel.json`, cf. §5.3 |
| **Les réglages du projet Vercel** | variables, protection de déploiement, liaison Git | à reposer à la main |
| **`node_modules`** | se régénère | `npm install` — `package-lock.json` **est** dans l'archive, les versions sont donc figées à l'identique |
| **L'historique Git** | l'archive est un instantané | si l'historique compte, prenez un clone ou un `git bundle` du dépôt plutôt que cette archive |

**Le piège le plus coûteux est le premier.** Une variable oubliée ne casse pas le démarrage : elle
désactive une fonction en silence, et l'on s'en aperçoit des semaines plus tard. Après déploiement,
ouvrez **`/api/status`** : cette fonction existe pour ça, elle dit quelles variables sont vues par le
serveur et lesquelles manquent.

---

## 2. L'architecture en une page

```
   NAVIGATEUR                          VERCEL (fonctions)              SERVICES
┌──────────────────┐              ┌────────────────────────┐      ┌──────────────┐
│  React (Vite)    │  jeton Clerk │  /api/state            │─────▶│  Supabase    │
│  src/App.jsx     │─────────────▶│  (clé service role)    │      │  cockpit_    │
│                  │              │                        │      │  state       │
│  cache local     │              │  /api/claude           │─────▶│  Anthropic   │
│  IndexedDB       │              │  /api/gmail-*          │─────▶│  Gmail API   │
│  (source locale) │              │  /api/shopify          │─────▶│  Shopify     │
└──────────────────┘              │  /api/calendar         │      └──────────────┘
         │                        └────────────────────────┘
         │  écriture directe (clé anon) ─────────▶ Supabase
         │  ⚠ refusée si la RLS stricte est posée : voir §5
         ▼
   temps réel Supabase (postgres_changes)
```

**Trois principes structurants**, à garder si vous transposez :

1. **Le cache local est la source de vérité pendant la saisie.** L'écriture disque est immédiate,
   l'envoi serveur est différé de 800 ms. Perdre une frappe est inacceptable ; saturer le réseau
   l'est aussi.
2. **Aucune clé secrète n'atteint le navigateur.** Anthropic, Gmail, Shopify, la clé service role
   Supabase : tout passe par une fonction serveur qui vérifie d'abord le jeton Clerk.
3. **L'application démarre sans rien de configuré.** Sans Supabase elle fonctionne en local pur,
   sans Clerk elle s'ouvre sans protection. C'est ce qui rend le développement possible — et une
   panne de service survivable.

---

## 3. Ce qu'il faut, et ce qui est facultatif

**Obligatoire** : Node 20 ou plus (`@supabase/supabase-js` l'exige ; Node 18 fait échouer la
compilation avant même de démarrer). Rien d'autre.

| Service | Rôle | Sans lui |
|---|---|---|
| **Supabase** | base partagée, synchro multi-appareils, temps réel | l'app tourne en **local pur** : données dans le navigateur, un poste = un jeu de données |
| **Clerk** | qui peut ouvrir l'écran, et jeton de toutes les fonctions serveur | l'app s'ouvre **sans protection** (pratique en développement, jamais en production) |
| **Anthropic** | assistant, enrichissement de fiches, rédaction | les boutons IA renvoient une erreur, le reste fonctionne |
| Google OAuth + Gmail | envoi et relève d'e-mails | fonctions Gmail désactivées |
| Shopify | lecture du stock par SKU | bouton de synchro désactivé |
| OpenRouteService | isochrone « à moins de N minutes » | repli sur un cercle à vol d'oiseau, annoncé comme tel |
| La Poste / Colissimo | suivi de colis d'une commande | le champ de suivi reste saisissable, la relève renvoie une erreur |
| Qonto | lecture bancaire, rapprochement des encaissements | onglet Banque inactif |

Les six derniers services se coupent proprement : l'absence d'une variable désactive une
fonction, elle ne casse jamais le démarrage.

---

## 4. Mise en route, de zéro

```bash
npm install
cp .env.example .env.local     # puis remplir — au minimum rien du tout pour un premier essai
npm run dev                    # interface seule, sans les fonctions /api
npx vercel dev                 # interface + fonctions /api (nécessaire pour tester l'IA, Gmail…)
```

**`npm run dev` ne sert pas les fonctions `/api`.** C'est la confusion la plus fréquente : les
boutons IA semblent cassés en local alors que rien ne l'est. Utilisez `npx vercel dev` dès qu'une
fonction serveur entre en jeu.

Ensuite, dans l'ordre :

1. **Supabase** — créer un projet, puis dans SQL Editor exécuter
   `supabase/migrations/0001_cockpit_state.sql`, puis `0002_bons_commande.sql`.
   **Ne pas exécuter `rls.sql` tout de suite** : lire le §5 d'abord.
2. **Clerk** — créer une application, récupérer `pk_` et `sk_`, activer les méthodes de connexion.
   Après le premier déploiement, ajouter le domaine dans les domaines autorisés, sinon la connexion
   est refusée en production.
3. **Anthropic** — une clé dédiée à ce projet, jamais partagée avec un autre usage : elle vit
   uniquement dans la variable serveur.
4. **Vercel** — importer le dépôt. Vite est détecté seul (build `vite build`, sortie `dist`).
   Renseigner les variables d'environnement, déployer.
5. Reporter le domaine de production dans Clerk.
6. Vérifier : `/api/status` répond, la connexion fonctionne, un bouton IA répond, la pastille de
   synchronisation affiche « Synchronisé ».

---

## 5. Les cinq contraintes dures

Ce sont les cinq choses qui, oubliées, font échouer une transposition. Elles sont classées par
fréquence.

### 5.1 · Douze fonctions serverless, pas treize

Le dossier `api/` en contient **exactement douze**. Le plan Hobby de Vercel en autorise douze : au
treizième fichier, **le déploiement entier est refusé** — pas la fonction, le déploiement.

C'est pour cela que la page publique de commande est servie par une *branche* de `api/state.js`
(`?bdc=1`) plutôt que par son propre fichier, et que son URL lisible `/commande` vient d'une
réécriture. Le commentaire en tête de `api/state.js` le dit.

**Si vous ajoutez une fonction** : passez au plan payant, ou greffez-la en branche d'une fonction
existante comme le fait `bdc`, ou regroupez.

### 5.2 · La RLS stricte coupe l'écriture directe

`supabase/rls.sql` retire toutes les policies de `cockpit_state`. C'est la bonne pratique — la clé
anon est publique, elle est dans le bundle — **mais** le navigateur écrit alors dans le vide : la
pastille passe « Hors ligne » et y reste, réseau intact.

Le logiciel sait le rattraper : toute écriture ou lecture directe refusée **repasse par
`/api/state`**, avec la même protection anti-écrasement. Pour que ce repli fonctionne, ces trois
variables serveur doivent être posées :

```
SUPABASE_URL                  = même valeur que VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY     = Project Settings > API > service_role (secret)
CLERK_SECRET_KEY
```

**Sans elles, `rls.sql` rend le logiciel incapable d'enregistrer quoi que ce soit sur le serveur.**
Posez les variables d'abord, vérifiez que la pastille reste « Synchronisé », exécutez `rls.sql`
ensuite. En cas de doute, l'infobulle de la pastille nomme le motif exact du dernier échec.

### 5.3 · Les réécritures d'URL

`vercel.json` porte trois réécritures, et chacune a une raison :

```json
{ "source": "/((?!api/).*)", "has": [{ "type": "host", "value": "commande.penup3d.com" }],
  "destination": "/api/state?bdc=1" },     // domaine dédié → page de commande publique
{ "source": "/commande", "destination": "/api/state?bdc=1" },   // URL lisible sur le domaine principal
{ "source": "/((?!api/).*)", "destination": "/index.html" }     // le reste → l'application (SPA)
```

La première nomme **un domaine en dur**. À changer, ou à retirer si vous n'avez pas de domaine
dédié à la page de commande.

Les en-têtes de cache du même fichier comptent aussi : `immutable` pour `/assets/` (fichiers
empreintés), `no-cache` pour tout le reste. Les inverser sert une version périmée pendant un an.

### 5.4 · Node 20 minimum

Imposé dans `package.json` (`engines`) plutôt que projet par projet, précisément parce qu'une
version obsolète fait échouer la compilation avant de démarrer. Si votre hébergeur propose encore
Node 18 par défaut, forcez la version.

### 5.5 · Le premier lancement est irréversible dans un sens

Au tout premier démarrage, si aucune donnée n'existe nulle part, `src/restoreData.json` est injecté
**et poussé sur le serveur**. Dès qu'un compte existe, ces données sont sacrées et ne sont jamais
écrasées.

Pour partir vide : videz `restoreData.json` (`{}` suffit) avant le premier lancement. Après, il ne
sert plus jamais.

---

## 6. Déployer ailleurs que sur Vercel

L'interface est un site statique : `npm run build` produit `dist/`, servable partout. **Ce sont les
douze fonctions `/api` qui décident** du travail à faire.

| Cible | Ce qu'il faut faire |
|---|---|
| **Netlify** | déplacer `api/*.js` vers `netlify/functions/`, adapter les signatures (`(req, res)` → `(event, context)`), retranscrire les réécritures dans `_redirects` |
| **Cloudflare Pages** | `functions/api/*.js`, signature Workers ; attention à la compatibilité Node des dépendances Clerk et Supabase |
| **Node autonome** (VPS, Docker) | un petit serveur Express qui sert `dist/` et monte les douze modules ; c'est la voie la plus directe, les fonctions sont déjà des handlers `(req, res)` |
| **Statique seul** (GitHub Pages, S3) | possible **uniquement** en mode local pur : ni IA, ni Gmail, ni Shopify, ni flux calendrier, ni page de commande. Retirer les variables `VITE_SUPABASE_*` pour éviter des écritures qui échoueront |

Dans tous les cas hors Vercel, il faut reproduire : le repli SPA vers `index.html`, les en-têtes de
cache du §5.3, et — si vous gardez la page publique — la route `/commande`.

---

## 7. Ce qui porte la marque

Compté sur les fichiers suivis, hors kits MATMAT :

| À remplacer | Occurrences | Où |
|---|---:|---|
| `MITMIT` (nom du logiciel) | 121 | interface, titres, manifeste, clés de stockage |
| `PU3D-…` (codes produits) | 206 | catalogue, prix, images, poids |
| `Fil'Up` (nom de gamme) | 98 | catalogue, textes de prospection |
| `Montauban` / adresse du siège | 83 | documents, carte, mentions |
| `penup3d` (domaines, e-mails) | 47 | liens, expéditeur, page de commande |

Et trois fichiers dont le **nom** porte la marque : `lib/logoPenUp.js`, `public/logo-mitmit.png`,
`public/logo-penup.png`.

**Le point de vigilance** : les clés de stockage local. `penup_cockpit_v3`, `penup_nav`,
`penup_recents_v1`, `penup_autobackup*`… Les renommer est propre — mais un utilisateur existant
perdra son cache local au premier lancement, puisque l'ancienne clé ne sera plus lue. Sur une
transposition vers un nouveau produit, renommez. Sur une reprise en place, ne touchez à rien.

Sont aussi en dur, et parfaitement remplaçables : la grille tarifaire du transporteur
(`DEPT_TARIF`, départements français), les zones de franco de port, les coordonnées bancaires
(`BANK`), les seuils de TVA, le siège pour les distances (`SIEGE`), et les enseignes de démonstration.

Enfin, plusieurs API publiques françaises sont appelées telles quelles :
`recherche-entreprises.api.gouv.fr`, `api-adresse.data.gouv.fr`, `geo.api.gouv.fr`. Hors de France,
elles ne renverront rien d'utile — les fonctions concernées se contentent de ne rien trouver, elles
ne cassent pas.

---

## 8. Emporter les données

Les données ne sont **pas** dans l'archive : elles vivent dans Supabase et dans le navigateur.

**Sortir** — l'application le fait elle-même, et c'est la voie recommandée : bouton
« Sauvegarde » de la barre du haut → un fichier JSON complet et horodaté.

**Entrer** — bouton « Restaurer » avec ce même fichier. Un garde-fou se déclenche si le fichier
contient nettement moins de données que l'état actuel : l'existant est d'abord téléchargé, et une
confirmation renforcée est exigée.

**Directement en base**, si vous préférez :

```sql
-- Sortir
select data from public.cockpit_state where id = 'shared';
-- Entrer, sur la nouvelle instance
insert into public.cockpit_state (id, data, updated_at)
values ('shared', '<le JSON>'::jsonb, now())
on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
```

Les instantanés quotidiens vivent dans la même table, sous `snapshot:AAAA-MM-JJ`. Emportez-les si
vous voulez conserver l'historique de 30 jours.

---

## 9. Vérification, une fois posé ailleurs

Dans cet ordre — chaque ligne dépend des précédentes :

1. `npm install && npm run build` passe, `dist/` est produit.
2. Le site s'ouvre : l'écran de démarrage cède la place à l'application.
3. La connexion Clerk fonctionne, et le domaine est bien déclaré côté Clerk.
4. `/api/status` répond.
5. Une modification s'enregistre : la pastille passe « Enregistrement… » puis « Synchronisé ».
   **Si elle affiche « Hors ligne », survolez-la** : elle nomme le motif — c'est presque toujours
   le §5.2.
6. Rechargement : la modification est toujours là.
7. Un second appareil voit la modification arriver (« Mis à jour par un collègue »).
8. Un bouton IA répond.
9. « Mettre à jour » recharge et ne perd rien.
10. L'impression d'un devis ne sort que le document, pas l'interface.

---

## 10. Reprendre le développement

Le dépôt est prévu pour être repris avec Claude Code. Trois points d'entrée :

- **`CLAUDE.md`** à la racine porte les règles permanentes du projet.
- **Les commentaires de `src/App.jsx`** expliquent les décisions, y compris les erreurs déjà payées.
  Ils valent une documentation d'architecture : lisez-les avant de réécrire quoi que ce soit.
- **`MATMAT-KIT-VISUEL.md`** et **`MATMAT-KIT-DONNEES.md`** extraient 70 fonctionnalités du code
  réel, avec le CSS et le JSX à copier — utiles si vous repartez d'une base neuve plutôt que de
  transposer celle-ci.
