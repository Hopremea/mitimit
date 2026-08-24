# MATMAT

Socle d'une application SaaS multi-clients : comptes, organisations, rôles, invitations,
abonnements. Même terrain technique que le cockpit MITMIT — Vite + React, fonctions
serverless Vercel, Supabase, Clerk — mais un projet Vercel **distinct**, avec sa propre base
et sa propre application Clerk.

## Ce que ça fait, et ce que ça ne fait pas

À lire avant de construire dessus.

**En place :**

1. **Cloisonnement par organisation.** Chaque donnée porte un `organisation_id`. Aucune
   fonction `/api` ne lit ni n'écrit une ligne sans avoir vérifié, en base, que l'appelant a
   une fiche membre dans l'organisation demandée. L'en-tête `X-Organisation` envoyé par le
   navigateur est une intention, jamais une autorisation.
2. **Trois rôles** : propriétaire, administrateur, membre. Le propriétaire seul touche à la
   facturation. Une organisation ne peut jamais se retrouver sans propriétaire.
3. **Invitations par lien**, avec jeton aléatoire, expiration à sept jours, révocation.
4. **Abonnements Stripe** : souscription (Checkout), gestion (portail client), et un webhook
   à signature vérifiée qui est la seule source de vérité sur l'état payé d'un compte.
5. **Base verrouillée.** RLS activée, aucune policy accordée à `anon` ni à `authenticated` :
   la clé anon publique ne donne accès à rien. Tout passe par les fonctions `/api`, qui
   vérifient le jeton Clerk puis utilisent la clé `service_role`.

**Pas en place — et c'est volontaire :**

1. **Aucun métier.** L'écran « Tableau de bord » et la table `ressources` sont une
   démonstration du cloisonnement, rien d'autre. C'est ce que vous remplacez en premier.
2. **Aucun envoi d'e-mail.** Une invitation produit un lien, affiché à la personne qui
   invite, à transmettre à la main. Brancher un envoi automatique est un chantier à part
   (Resend, Postmark, ou le relais Gmail déjà présent dans le cockpit).
3. **Aucune limite d'usage par plan.** Le statut d'abonnement est lu et affiché, mais rien
   ne bloque encore un compte impayé : c'est une décision produit, pas une brique technique.
4. **Aucune suppression d'organisation.** Volontairement absent tant qu'il n'y a pas de
   sauvegarde ni d'export : une suppression en cascade est irréversible.

## Arborescence

```
saas/
├── api/                    fonctions serverless (3 — le plan Hobby en autorise 12)
│   ├── organisations.js    organisations, membres, invitations, rôles, ressources
│   ├── facturation.js      état d'abonnement, souscription, portail Stripe
│   └── stripe-webhook.js   notifications d'abonnement signées
├── lib/
│   ├── auth.js             vérification Clerk + résolution de l'organisation active
│   ├── db.js               client Supabase service_role, helpers de réponse
│   └── stripe.js           API Stripe en REST, sans dépendance, + vérification de signature
├── src/
│   ├── api.js              pont navigateur → /api (jeton Clerk + organisation)
│   ├── routeur.jsx         routeur minimal, sans dépendance
│   ├── App.jsx             chargement du contexte, choix de l'organisation, aiguillage
│   ├── composants/         cadre commun, états de chargement et d'erreur
│   └── pages/              accueil publique, bienvenue, tableau, équipe, facturation, invitation
└── supabase/migrations/    schéma multi-clients
```

## Mise en route

### 1. Base Supabase

Créez un **nouveau** projet Supabase, puis SQL Editor → New query → collez et exécutez
`supabase/migrations/0001_socle_saas.sql`.

Récupérez ensuite dans Project Settings → API : l'URL du projet et la clé `service_role`.

### 2. Application Clerk

Créez une **nouvelle** application Clerk, activez les méthodes de connexion voulues, et
récupérez les clés `pk_` et `sk_`. Après le premier déploiement, ajoutez le domaine Vercel
dans les domaines autorisés de Clerk — sans quoi la connexion sera refusée en production.

### 3. Stripe

1. Products → créez un produit et un tarif **récurrent** ; notez son identifiant `price_…`.
2. Developers → API keys → clé secrète.
3. Developers → Webhooks → Add endpoint, URL `https://votre-domaine/api/stripe-webhook`,
   événements `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Notez le *signing secret*.

### 4. Projet Vercel

Add New → Project → Import `Hopremea/mitimit`, puis :

- **Root Directory : `saas`** — le réglage à ne pas rater, sinon c'est le cockpit qui se
  redéploie une seconde fois.
- Framework « Vite », build `npm run build`, sortie `dist` : détectés automatiquement.
- Renseignez les variables de `.env.example` avant le premier déploiement.
- Settings → Git → *Ignored Build Step* : `git diff --quiet HEAD^ HEAD -- saas/`
  Sans cela, chaque commit du cockpit redéploierait MATMAT pour rien.

### 5. En local

```bash
cd saas
npm install
npx vercel dev    # sert l'interface ET les fonctions /api
```

`npm run dev` seul suffit pour travailler l'interface, mais les fonctions `/api` ne tournent
pas : tous les écrans afficheront une erreur de chargement.

## Par où commencer à construire

1. Remplacez la table `ressources` (migration) par vos vraies tables — en gardant la colonne
   `organisation_id` et la clé étrangère `on delete cascade`.
2. Remplacez les trois actions `ressource*` de `api/organisations.js`, ou créez un nouveau
   fichier `api/` dédié — en gardant l'appel à `contexte()` en tête de chaque action.
3. Remplacez `src/pages/Tableau.jsx` par vos écrans.
4. Réécrivez `src/pages/Accueil.jsx` quand le discours produit existe.
