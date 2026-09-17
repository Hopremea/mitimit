# Transférer MITMIT sur un autre ordinateur

> **À lire en premier.** Depuis la mise en réserve (PR #495, septembre 2026), MITMIT tourne en
> « local pur » : **les données vivent uniquement dans le navigateur qui les a saisies**
> (IndexedDB). Il n'y a plus de base partagée, plus de synchronisation, plus de compte.
>
> Conséquence directe : **rien ne suit tout seul**. Ouvrir MITMIT sur le nouvel ordinateur
> affichera une application **vide** tant que vous n'y aurez pas importé votre fichier de
> sauvegarde. Le transfert des données (partie A) est donc l'étape indispensable ; le transfert
> du code (partie B) n'est utile que si vous voulez aussi modifier ou compiler l'application.

---

## A. Les données — l'étape à ne pas rater

### A.1 Sur l'ANCIEN ordinateur : produire le fichier

1. Ouvrez MITMIT dans le navigateur **où se trouvent vos données** (c'est important : les données
   appartiennent à un navigateur précis — Chrome et Edge du même poste ont chacun les leurs).
2. Cliquez sur **« Sauvegarde »** dans la barre du haut.
3. Un fichier **`penup3d-cockpit-AAAA-MM-JJ.json`** est téléchargé. Il contient **tout** : groupes,
   établissements, contacts, échanges, devis et factures, produits, calendrier, pointages,
   réglages, corbeille et pièces jointes intégrées.
4. Vérifiez que le fichier n'est pas vide : il doit peser au minimum quelques centaines de Ko
   (souvent plusieurs Mo s'il contient des photos).

> **Si vous aviez activé la sauvegarde automatique horaire** (Réglages → « Sauvegarde automatique
> horaire », qui écrit dans un dossier du PC) : copiez **aussi** ce dossier. Il contient
> l'historique des versions, précieux si le dernier export s'avérait incomplet.

### A.2 Transporter le fichier

Clé USB, disque externe, OneDrive, e-mail à vous-même — peu importe, c'est un simple fichier
texte. Conservez-en une copie **ailleurs que sur le nouvel ordinateur** tant que le transfert
n'est pas vérifié.

### A.3 Sur le NOUVEL ordinateur : importer

1. Ouvrez MITMIT (voir partie C pour l'adresse).
2. Cliquez sur **« Restaurer »** dans la barre du haut.
3. Choisissez le fichier `penup3d-cockpit-AAAA-MM-JJ.json`.
4. Confirmez le remplacement (l'application est vide, il n'y a rien à perdre).
5. **Vérifiez les compteurs** : nombre de groupes, d'établissements, de contacts et de documents
   doivent correspondre à l'ancien poste.

### A.4 Ne videz l'ancien poste qu'après vérification

Tant que le nouvel ordinateur n'affiche pas vos données au complet, **ne supprimez rien** sur
l'ancien : ne videz pas le cache du navigateur, ne désinstallez pas, ne réinitialisez pas la
machine. C'est aujourd'hui votre seule copie vivante.

---

## B. Le code (seulement pour développer / compiler)

**Option 1 — depuis GitHub, recommandée :**

```bash
git clone https://github.com/Hopremea/mitimit.git
cd mitimit
npm install
```

**Option 2 — depuis l'archive de transfert** (`mitimit-export-AAAA-MM-JJ.zip`) : décompressez-la
où vous voulez, puis `npm install`. L'archive embarque **l'historique Git complet et le lien vers
GitHub**, donc `git pull` et `git push` fonctionnent sans reconfiguration.

Prérequis : **Node.js 20 ou plus récent** (le dépôt refuse les versions antérieures) et Git.

```bash
npm run dev      # interface en développement
npm run build    # compilation (produit dist/)
npm run preview  # servir la version compilée
```

Il n'y a **plus de dossier `api/`, plus de variables d'environnement à renseigner, plus de clés
à recopier** : l'application est devenue un site statique. Le fichier `.env.example` n'est
conservé que pour mémoire de la version branchée.

> La version d'avant le débranchement (Supabase, Clerk, IA, Gmail, Shopify) reste consultable :
> `git checkout ef819fc`.

---

## C. Où ouvrir MITMIT sur le nouvel ordinateur

| Usage | Adresse | Remarque |
| --- | --- | --- |
| Normal | <https://mitimit.vercel.app> | Déploiement existant. Si l'accès est protégé par Vercel Authentication, connectez-vous au compte Vercel. |
| Hors ligne / sans Vercel | `npm run build` puis `npm run preview` | Sert l'application en local (`http://localhost:4173`) |

⚠️ **Chaque adresse a ses propres données.** Le navigateur isole le stockage par origine :
`mitimit.vercel.app` et `localhost` sont deux espaces distincts. Choisissez **une** adresse de
travail et importez la sauvegarde **là**, sinon vous vous retrouverez avec deux jeux de données
divergents.

Navigateur conseillé : **Chrome ou Edge sur ordinateur** — la dictée vocale et la sauvegarde
automatique dans un dossier n'existent que là.

---

## D. Vérification finale

- [ ] Le fichier JSON de sauvegarde est copié en lieu sûr (au moins deux emplacements)
- [ ] MITMIT s'ouvre sur le nouvel ordinateur
- [ ] Après « Restaurer », les compteurs correspondent à l'ancien poste
- [ ] Un établissement ouvert au hasard affiche bien son historique d'échanges
- [ ] La barre du haut affiche « Enregistré » après une modification test
- [ ] Nouvelle sauvegarde immédiate depuis le nouveau poste (« Sauvegarde ») pour repartir propre
- [ ] Réglages → réactiver la **sauvegarde automatique horaire** vers un dossier du nouveau PC

---

## E. En cas de souci

| Symptôme | Cause | Geste |
| --- | --- | --- |
| Application vide sur le nouveau poste | Normal : aucune donnée n'est synchronisée | Importer le JSON (« Restaurer ») |
| « Format non reconnu » à l'import | Mauvais fichier (export partiel, fichier d'une autre app) | Reprendre l'export depuis l'ancien poste |
| Les données ont disparu de l'ancien poste | Cache du navigateur vidé, mode privé, ou autre navigateur | Réimporter le dernier JSON, ou le dossier de sauvegarde automatique |
| Compteurs plus bas qu'attendu | Sauvegarde trop ancienne | Reprendre l'export le plus récent ; l'app avertit d'une chute > 30 % avant de remplacer |
| Boutons IA / Gmail / Shopify sans effet | Connecteurs débranchés depuis la mise en réserve | Comportement attendu, voir l'encadré du README |
| `npm install` échoue | Node trop ancien | Installer Node 20 ou plus |

En dernier recours : la **corbeille** (30 jours) et la **version mise de côté** sont incluses dans
le fichier JSON, donc elles voyagent avec lui — accessibles via « Historique » une fois
l'import fait.
