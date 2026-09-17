# Transférer MITMIT sur un autre ordinateur

Trois choses composent MITMIT, et elles ne voyagent pas de la même façon :

| Ce qu'il faut | Où ça vit aujourd'hui | Comment ça arrive sur le nouveau poste |
| --- | --- | --- |
| **Le code** | Dépôt GitHub `Hopremea/mitimit` | `git clone` (ou l'archive de transfert) |
| **Les données** (comptes, échanges, devis, pointages…) | Base partagée Supabase | **Automatiquement**, à la première connexion |
| **Les secrets** (clés API) | Variables d'environnement Vercel | À recopier *uniquement* si vous voulez développer en local |

En clair : pour **utiliser** MITMIT sur le nouvel ordinateur, il n'y a rien à installer — il
suffit d'ouvrir <https://mitimit.vercel.app> et de se connecter. Tout ce qui suit concerne le
cas où vous voulez aussi **développer / compiler** depuis cette machine.

---

## 0. Avant de quitter l'ancien ordinateur (2 minutes, à ne pas sauter)

1. Ouvrez MITMIT et attendez que l'indicateur en haut à droite affiche **« Synchronisé »**
   (s'il affiche « Modifications non synchronisées », cliquez sur « Réessayer maintenant » et
   attendez). Cela garantit que vos dernières saisies sont bien parties sur le serveur.
2. Cliquez sur **« Sauvegarde »** : un fichier `penup3d-cockpit-AAAA-MM-JJ.json` est
   téléchargé. C'est votre filet de sécurité — copiez-le sur la clé USB / le disque de
   transfert avec le reste.
3. Cliquez sur **« Historique »** et vérifiez qu'un instantané porte bien la date du jour.
   (Sinon : « Créer un instantané maintenant ».)

Ces trois gestes suffisent : même en cas de problème sur le nouveau poste, les données sont
récupérables de deux manières indépendantes (instantané serveur + fichier JSON).

---

## 1. Prérequis sur le nouvel ordinateur

- **Node.js 20 ou plus récent** — obligatoire, le dépôt refuse les versions antérieures
  (`@supabase/supabase-js` exige Node 20). À télécharger sur <https://nodejs.org>.
- **Git** — <https://git-scm.com>.
- Un navigateur **Chrome ou Edge** : la dictée vocale des comptes rendus n'existe pas
  ailleurs (Firefox et Safari n'implémentent pas la reconnaissance vocale du navigateur).

Vérification rapide, dans un terminal :

```bash
node -v    # doit afficher v20.x ou plus
git --version
```

---

## 2. Récupérer le code

**Option A — depuis GitHub (recommandée, toujours à jour) :**

```bash
git clone https://github.com/Hopremea/mitimit.git
cd mitimit
npm install
```

**Option B — depuis l'archive de transfert** (`mitimit-export-AAAA-MM-JJ.zip`) : décompressez-la
où vous voulez, puis `npm install` dans le dossier obtenu. L'archive contient **l'historique Git
complet et le lien vers GitHub** : `git pull` et `git push` fonctionnent immédiatement, sans
reconfiguration. C'est la solution si vous n'avez pas (encore) accès à GitHub sur cette machine.

---

## 3. Les données : il n'y a rien à copier

Les données ne sont **pas** dans le dossier du projet. Elles vivent dans la base partagée
Supabase, et le navigateur n'en garde qu'un cache local. Sur le nouvel ordinateur :

1. Ouvrez <https://mitimit.vercel.app> ;
2. connectez-vous avec le même compte ;
3. patientez quelques secondes : tout descend du serveur (comptes, établissements, contacts,
   échanges, documents, calendrier, pointages, corbeille, instantanés).

Les deux ordinateurs peuvent ensuite être utilisés en parallèle : depuis la mise en place de la
fusion à trois versions, aucun des deux ne peut écraser le travail de l'autre, et chacun se met
à jour au réveil (retour sur l'onglet, sortie de veille, retour du réseau).

> **Si les données n'apparaissent pas** : cliquez sur « Mettre à jour » (vide le cache et
> recharge). Si l'écran reste vide, utilisez « Restaurer » avec le fichier JSON de l'étape 0.

---

## 4. Variables d'environnement (développement local uniquement)

Le dossier `.env` **n'est pas** dans le dépôt (et ne doit jamais y être). Pour compiler ou
lancer l'app en local, créez un fichier `.env.local` à la racine, sur le modèle de
`.env.example`, avec les valeurs récupérées dans **Vercel → projet `mitimit` → Settings →
Environment Variables**.

| Variable | Rôle | Indispensable en local ? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Adresse de la base partagée | Oui, sinon pas de données |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase (protégée par les règles RLS) | Oui |
| `VITE_CLERK_PUBLISHABLE_KEY` | Écran de connexion | Non (sans elle, l'app s'ouvre sans protection — pratique en dev) |
| `CLERK_SECRET_KEY` | Vérification du jeton côté serveur | Seulement avec `vercel dev` |
| `ANTHROPIC_API_KEY` | Relais IA `/api/claude` | Seulement pour tester l'IA |
| `SUPABASE_SERVICE_ROLE_KEY` | Flux calendrier `.ics` | Non |
| `GOOGLE_*`, `SHOPIFY_*` | Envoi Gmail, stock Shopify | Non |

⚠️ **Ne recopiez jamais ces valeurs dans un fichier versionné, un e-mail ou une capture.** Si une
clé a pu être vue par quelqu'un d'autre pendant le transfert, régénérez-la dans le service
concerné (Anthropic, Clerk, Supabase) puis mettez Vercel à jour.

---

## 5. Lancer en local

```bash
npm install
npm run dev          # interface seule (les fonctions /api ne tournent pas)
npx vercel dev       # interface + fonctions /api (IA, Gmail, Shopify, calendrier)
npm run build        # vérifier que tout compile
```

---

## 6. Déployer depuis le nouvel ordinateur

Rien à configurer : Vercel est branché sur le dépôt GitHub. Un `git push` sur `main` déclenche
le déploiement en production. Le compte Vercel reste le même, vous n'avez pas à réinstaller la
CLI Vercel (sauf si vous voulez `vercel dev`, auquel cas `npm i -g vercel` puis `vercel login`).

---

## 7. Vérification finale sur le nouveau poste

- [ ] `node -v` ≥ 20
- [ ] `npm install` puis `npm run build` se terminent sans erreur
- [ ] <https://mitimit.vercel.app> s'ouvre, connexion OK
- [ ] Le nombre de comptes / établissements correspond à l'ancien poste
- [ ] L'indicateur affiche « Synchronisé » après une modification test
- [ ] « Historique » liste bien les instantanés des jours précédents

---

## En cas de souci

| Symptôme | Cause probable | Geste |
| --- | --- | --- |
| Écran vide ou données anciennes | Cache du navigateur | Bouton « Mettre à jour » |
| « Modifications non synchronisées » persistant | Réseau, ou clés Supabase absentes en local | « Réessayer maintenant » ; en local, vérifier `.env.local` |
| Connexion refusée | Domaine absent des domaines autorisés Clerk | Dashboard Clerk → ajouter le domaine |
| L'IA ne répond pas | `ANTHROPIC_API_KEY` absente ou sans crédits | Réglages → « État des connexions & variables » |
| `npm install` échoue | Node trop ancien | Installer Node 20+ |

En dernier recours, les données sont toujours récupérables : « Restaurer » avec le JSON de
l'étape 0, ou « Historique » → restaurer un instantané quotidien (30 jours conservés).
