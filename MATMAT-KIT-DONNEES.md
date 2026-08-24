# MATMAT — Kit données : sauvegarde, synchronisation, mémoire vive, optimisation

Les **40 meilleures fonctionnalités** de MITMIT dans ces quatre domaines, extraites du code réel
(`src/App.jsx`, `src/supabaseClient.js`, `api/state.js`, `public/sw.js`, `vite.config.js`), avec le
code à copier. Puis, en seconde partie, **la carte mondiale au complet**, retournée pour cartographier
des clients B2C.

**Mode d'emploi** : ouvrez Claude Code dans le dépôt MATMAT et donnez-lui ce fichier.

**À renommer partout** : `penup_cockpit_v3` → la clé de MATMAT, `cockpit_state` → la table de MATMAT,
`PEN'UP` → la marque. Les seuils (800 ms, 30 jours, 5 €…) sont des choix, pas des lois : gardez-les
tant que rien ne justifie de les changer.

**Le fil rouge, à lire avant tout le reste.** Ces quarante fonctionnalités ne sont pas quarante
idées : ce sont quarante réponses à la même question. *Où vit la vérité, et que se passe-t-il quand
deux copies divergent ?* MITMIT y répond par une règle unique — **on ne jette jamais rien en
silence**. Une écriture qui échoue reste en attente, un cache qu'on ne sait pas fusionner est mis de
côté, une fiche supprimée passe par la corbeille, une session non poussée est fusionnée plutôt
qu'écrasée. Portez cette règle avant de porter le code.

---

## Table des 40

| # | Fonctionnalité | Domaine |
|---|---|---|
| 1 | Cache local en IndexedDB, repli localStorage, migration automatique | Sauvegarde |
| 2 | Corbeille 30 jours capturée au centre, jamais à la main | Sauvegarde |
| 3 | Corbeille allégée : les photos ne triplent pas le poids synchronisé | Sauvegarde |
| 4 | Instantané quotidien côté serveur, élagué à 30 jours | Sauvegarde |
| 5 | Sauvegarde automatique horaire dans un dossier du PC | Sauvegarde |
| 6 | Handle de dossier persisté en IndexedDB (impossible en localStorage) | Sauvegarde |
| 7 | Rattrapage d'heure : la sauvegarde manquée se fait au lancement | Sauvegarde |
| 8 | Export / import JSON manuel, horodaté | Sauvegarde |
| 9 | Garde-fou anti-effacement à l'import (chute > 30 %) | Sauvegarde |
| 10 | Données de secours injectées au tout premier lancement seulement | Sauvegarde |
| 11 | État partagé : une ligne JSON derrière un relais serveur authentifié | Synchro |
| 12 | Curseur de synchronisation persisté | Synchro |
| 13 | Base commune persistée, socle des fusions | Synchro |
| 14 | Fusion à trois versions (base / local / distant) | Synchro |
| 15 | Écriture protégée par compare-and-set | Synchro |
| 16 | Anti-rebond 800 ms qui pousse le dernier état, pas le premier | Synchro |
| 17 | Reprise automatique à délai croissant (5 s → 90 s) | Synchro |
| 18 | Vidage de l'écriture en attente à la fermeture de l'onglet | Synchro |
| 19 | Relecture au réveil de l'appareil | Synchro |
| 20 | Canal temps réel avec filtrage de son propre écho | Synchro |
| 21 | Pastille d'état honnête, qui ne croit pas `navigator.onLine` | Synchro |
| 22 | Résolution au chargement : quatre branches, aucune perte | Synchro |
| 23 | Cache mis de côté plutôt que jeté, faute de base commune | Synchro |
| 24 | Registre de tâches de fond qui survit au démontage | Mémoire vive |
| 25 | Déduplication des tâches par identifiant | Mémoire vive |
| 26 | Badge global des tâches en cours | Mémoire vive |
| 27 | Brouillons cloisonnés par dossier (`useKept`) | Mémoire vive |
| 28 | Filtres et tri d'un onglet conservés d'un passage à l'autre (`useVue`) | Mémoire vive |
| 29 | Magasin de vague hors composants, alimenté fenêtre fermée | Mémoire vive |
| 30 | Mémoire de navigation + historique Précédent / Suivant | Mémoire vive |
| 31 | Valeurs récentes par champ, proposées en un clic | Mémoire vive |
| 32 | « Ne plus demander » temporaire, purement en mémoire | Mémoire vive |
| 33 | Annulation d'un niveau, instantanée | Mémoire vive |
| 34 | Découpe en chunks stables | Optimisation |
| 35 | Chargement à la demande des grosses bibliothèques | Optimisation |
| 36 | Service worker : réseau d'abord, cache d'abord selon la ressource | Optimisation |
| 37 | **Bouton « Mettre à jour »** : vide tout et recharge, quoi qu'il arrive | Optimisation |
| 38 | Compression d'image avant stockage | Optimisation |
| 39 | Jauge d'occupation des données | Optimisation |
| 40 | Suivi et alerte de dépense IA, lot asynchrone repris après rechargement | Optimisation |

Puis : **[la carte mondiale, version B2C](#partie-2--la-carte-mondiale-version-b2c)**.

---

# Partie 1 — Sauvegarde

## 1. Cache local en IndexedDB, repli localStorage, migration automatique

**Le problème** : `localStorage` plafonne vers 5 Mo et déborde **silencieusement**. Une photo un peu
lourde, et le cache local devient incomplet sans prévenir.

**La solution** : IndexedDB accepte des centaines de Mo et stocke l'objet tel quel (clonage
structuré, pas de sérialisation JSON). `localStorage` reste le repli, et la source de migration au
premier lancement.

```js
const KEY = "matmat_v1";

let _idbPromesse = null;
const idbBase = () => {
  if (_idbPromesse) return _idbPromesse;
  _idbPromesse = new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("indexedDB indisponible")); return; }
    const rq = indexedDB.open("matmat_cache", 1);
    rq.onupgradeneeded = () => { try { rq.result.createObjectStore("kv"); } catch (e) {} };
    rq.onsuccess = () => res(rq.result);
    rq.onerror  = () => rej(rq.error || new Error("ouverture IndexedDB refusée"));
  }).catch((e) => { _idbPromesse = null; throw e; });   // un échec ne fige pas la promesse
  return _idbPromesse;
};
const idbLire   = async (k) => { const db = await idbBase(); return new Promise((res, rej) => { const rq = db.transaction("kv").objectStore("kv").get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); };
const idbEcrire = async (k, v) => { const db = await idbBase(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); };

async function lireCacheLocal() {
  try { const v = await idbLire(KEY); if (v) return v; } catch (e) {}
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}
```

Et l'écriture, qui **sait si elle a réussi** — point capital, repris au #12 :

```js
const cacheOk = useRef(true);
const cacheEcriture = useRef(Promise.resolve());
const ecrireCache = (state) => {
  const p = (async () => {
    try {
      await idbEcrire(KEY, state); cacheOk.current = true;
      try { localStorage.removeItem(KEY); } catch (e) {}      // migration : libère l'ancien cache
    } catch (e) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); cacheOk.current = true; }
      catch (e2) { cacheOk.current = false; try { localStorage.removeItem(SYNC_KEY); } catch (e3) {} }
    }
  })();
  cacheEcriture.current = p; return p;
};
```

---

## 2. Corbeille 30 jours capturée au centre

**L'idée** : aucune suppression de l'application n'a besoin de penser à la corbeille. La capture se
fait **dans `persist`**, par différence entre l'état d'avant et celui d'après. Un point de
suppression ajouté demain est couvert sans une ligne de plus.

```js
const CORBEILLE_COLLECTIONS = {
  accounts: "Compte", sites: "Établissement", contacts: "Contact",
  interactions: "Échange", events: "Événement", deals: "Document",
};
const CORBEILLE_JOURS = 30;

// … dans persist, entre l'état précédent et le suivant :
const captures = [];
Object.keys(CORBEILLE_COLLECTIONS).forEach((k) => {
  const av = prev[k], ap = next[k];
  if (!Array.isArray(av) || !Array.isArray(ap) || !av.length) return;
  const apIds = new Set(ap.map((x) => x && x.id));
  av.forEach((x) => {
    if (x && x.id != null && !apIds.has(x.id))
      captures.push({ id: "tr_" + x.id + "_" + Date.now().toString(36), kind: k, at: new Date().toISOString(), item: corbeilleAllege(x) });
  });
});
// Élagage au passage : plus de 30 jours, dehors. Plafond dur à 400 entrées.
const seuil = Date.now() - CORBEILLE_JOURS * 86400000;
const propres = (next.trash || []).filter((t) => t && t.at && new Date(t.at).getTime() > seuil);
if (captures.length || propres.length !== (next.trash || []).length)
  next = { ...next, trash: [...propres, ...captures].slice(-400) };
```

La corbeille fait partie des données synchronisées : elle est donc partagée entre appareils et
fusionnée comme le reste.

**Une exception assumée** : `persist(updater, { corbeille: false })` pour les remplacements globaux
(import d'une sauvegarde, chargement de la démo). Sans elle, importer une sauvegarde jetterait toute
la base actuelle dans la corbeille.

---

## 3. Corbeille allégée

Une fiche supprimée contient parfois une photo en base64 de plusieurs centaines de kilo-octets. La
garder telle quelle triplerait le poids des données synchronisées — pour une fiche que personne ne
restaurera peut-être jamais.

```js
// Les champs texte énormes (photos base64) sont vidés à l'entrée en corbeille.
const corbeilleAllege = (it) => {
  const o = {};
  Object.keys(it || {}).forEach((k) => {
    const v = it[k];
    o[k] = (typeof v === "string" && v.length > 20000) ? "" : v;
  });
  return o;
};
```

Le libellé lisible d'une fiche restaurable, quel que soit son type :

```js
const corbeilleLibelle = (kind, it) => !it ? "—" :
  it.enseigne || it.label || [it.prenom, it.nom].filter(Boolean).join(" ")
  || it.titre || it.sujet || it.ref || (it.adresse ? String(it.adresse).slice(0, 40) : "") || it.id || "—";
```

---

## 4. Instantané quotidien côté serveur

**L'idée** : une photographie complète des données par jour, dans la **même table** que l'état
partagé, sous une clé `snapshot:AAAA-MM-JJ`. Le premier appareil ouvert dans la journée s'en charge.
Restauration en un clic. Élagage à 30 jours dans la foulée.

```js
useEffect(() => {
  if (loading || !supabaseEnabled) return;
  (async () => {
    try {
      const jour = TODAY();
      let marque = null; try { marque = localStorage.getItem(KEY + ":snapJour"); } catch (e) {}
      if (marque === jour) return;                       // déjà fait aujourd'hui sur cet appareil
      const etat = latestRef.current;
      if (!etat || !Array.isArray(etat.accounts) || !etat.accounts.length) return;  // jamais d'instantané d'un état vide
      const { data: deja } = await supabase.from("etat").select("id").eq("id", "snapshot:" + jour).maybeSingle();
      if (!deja) await supabase.from("etat").upsert({ id: "snapshot:" + jour, data: etat, updated_at: new Date().toISOString() }, { onConflict: "id" });
      try { localStorage.setItem(KEY + ":snapJour", jour); } catch (e) {}
      // Élagage : au-delà de 30 jours, on supprime.
      const { data: rows } = await supabase.from("etat").select("id").like("id", "snapshot:%");
      const limite = new Date(Date.now() - CORBEILLE_JOURS * 86400000).toISOString().slice(0, 10);
      const vieux = (rows || []).map((r) => r.id).filter((id) => id.slice(9) < limite);
      if (vieux.length) await supabase.from("etat").delete().in("id", vieux);
    } catch (e) {}
  })();
}, [loading]);
```

**Les deux garde-fous** : « jamais d'instantané d'un état vide » (sinon un démarrage raté écrase
l'instantané du jour par du vide) et la vérification `deja` avant l'écriture (deux appareils ouverts
en même temps ne se marchent pas dessus).

---

## 5. Sauvegarde automatique horaire dans un dossier du PC

**L'idée** : le navigateur ne peut pas écrire librement sur le disque. L'utilisateur choisit **une
fois** un dossier, et l'application y écrit ensuite une sauvegarde au début de chaque heure tant
qu'elle est ouverte. Disponible sur Chromium (Chrome / Edge) ; ailleurs, on retombe sur le
téléchargement classique du #8.

```js
const FS_ACCESS_OK = typeof window !== "undefined" && "showDirectoryPicker" in window;

const chooseFolder = useCallback(async () => {
  if (!FS_ACCESS_OK) { setStatus("Fonction disponible sur Chrome ou Edge (ordinateur)."); return; }
  try {
    const h = await window.showDirectoryPicker({ id: "matmat-backup", mode: "readwrite", startIn: "documents" });
    const perm = await bkDirPermission(h, true);
    if (perm !== "granted") { setStatus("Autorisation refusée sur ce dossier."); return; }
    handleRef.current = h; await bkIdbSet(BK_IDB.key, h);       // cf. #6
    setDirName(h.name || "dossier"); setEnabled(true);
    await doBackup(true);                                       // sauvegarde immédiate de confirmation
  } catch (e) { if (e && e.name !== "AbortError") setStatus("Sélection du dossier annulée."); }
}, []);

// L'autorisation peut avoir expiré : on la redemande avant chaque écriture.
async function bkDirPermission(handle, write) {
  if (!handle) return "denied";
  const opts = { mode: write ? "readwrite" : "read" };
  try { if ((await handle.queryPermission(opts)) === "granted") return "granted"; return await handle.requestPermission(opts); }
  catch (e) { return "denied"; }
}
async function bkWriteToDir(handle, obj, filename) {
  const fh = await handle.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  await w.close();
}
```

Nom de fichier sans caractère interdit, à l'heure réelle d'écriture :

```js
// « save_2026-06-26_17h00.json » — ni « / » ni « : », interdits dans un nom de fichier.
function backupFileName(d) {
  const dt = d || new Date(); const p = (n) => String(n).padStart(2, "0");
  return `save_${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}_${p(dt.getHours())}h${p(dt.getMinutes())}.json`;
}
```

---

## 6. Handle de dossier persisté en IndexedDB

Un `FileSystemDirectoryHandle` **ne peut pas** être stocké en `localStorage` (il ne se sérialise
pas). IndexedDB, si — par clonage structuré. C'est ce qui permet au dossier choisi de survivre aux
rechargements.

```js
const BK_IDB = { name: "matmat_backup", store: "handles", key: "backupDir" };
function bkIdbOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(BK_IDB.name, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(BK_IDB.store); } catch (e) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}
async function bkIdbGet(key) { try { const db = await bkIdbOpen(); return await new Promise((res, rej) => { const tx = db.transaction(BK_IDB.store, "readonly"); const r = tx.objectStore(BK_IDB.store).get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); } catch (e) { return null; } }
async function bkIdbSet(key, val) { try { const db = await bkIdbOpen(); return await new Promise((res, rej) => { const tx = db.transaction(BK_IDB.store, "readwrite"); tx.objectStore(BK_IDB.store).put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }); } catch (e) { return false; } }
```

Au montage, on récupère le handle et on affiche le nom du dossier — l'utilisateur voit **où** ça
sauvegarde :

```js
useEffect(() => {
  if (!supported) return; let alive = true;
  (async () => { const h = await bkIdbGet(BK_IDB.key); if (alive && h) { handleRef.current = h; if (h.name) setDirName(h.name); } })();
  return () => { alive = false; };
}, [supported]);
```

---

## 7. Rattrapage d'heure

**Le problème** : un planificateur qui attend le prochain top d'heure ne sauvegarde jamais si
l'application n'est ouverte que de 9 h 10 à 9 h 50.

**La solution** : on vérifie **souvent** (30 s) pour ne pas rater le changement d'heure, mais on
n'écrit qu'une fois par heure grâce à une clé « année-mois-jour-heure » mémorisée — qui résiste aussi
aux rechargements. Et on lance un `tick()` immédiat au montage : l'heure courante non encore
sauvegardée est rattrapée sur-le-champ.

```js
useEffect(() => {
  if (!supported || !enabled) return;
  const hourKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  const tick = async () => {
    if (!handleRef.current || busyRef.current) return;
    const now = new Date();
    let last = ""; try { last = localStorage.getItem("matmat_autobackup_hourkey") || ""; } catch (e) {}
    if (last === hourKey(now)) return;
    if (await doBackup(false)) { try { localStorage.setItem("matmat_autobackup_hourkey", hourKey(now)); } catch (e) {} }
  };
  tick();                                    // rattrapage immédiat
  const iv = setInterval(tick, 30 * 1000);
  return () => clearInterval(iv);
}, [supported, enabled, doBackup]);
```

Le verrou `busyRef` (une simple `ref`, pas un état) empêche deux écritures concurrentes sans
provoquer de rendu.

---

## 8. Export / import JSON manuel

Le filet universel, qui marche sur tous les navigateurs. Enveloppe versionnée : `exportedAt`,
`version`, `data` — c'est ce qui permettra de migrer un vieux fichier plus tard.

```js
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);        // libère la mémoire, mais après le clic
}

const exportAll = () => {
  const today = new Date().toISOString().slice(0, 10);
  downloadJSON({ exportedAt: new Date().toISOString(), version: 1, data }, `matmat-${today}.json`);
  try { localStorage.setItem("matmat_lastBackup", today); } catch {}
  setBackupDone(today);
};
```

Même recette pour le CSV, avec le BOM qui évite qu'Excel massacre les accents :

```js
const csv = Papa.unparse(rows, { delimiter: ";" });
const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });   // ﻿ = BOM UTF-8
```

---

## 9. Garde-fou anti-effacement à l'import

Restaurer une sauvegarde périmée efface le travail récent. Si le fichier importé contient nettement
moins de données que l'état actuel, on **sauvegarde d'abord l'existant** et on exige une confirmation
renforcée.

```js
const importAll = async (file) => {
  const obj = JSON.parse(await file.text());
  const payload = obj.data || obj;
  if (!payload.accounts || !payload.products) throw new Error("Format non reconnu");

  const curA = (data.accounts || []).length, curD = (data.deals || []).length;
  const newA = (payload.accounts || []).length, newD = (payload.deals || []).length;
  const bigDrop = (curA >= 5 && newA < curA * 0.7) || (curD >= 5 && newD < curD * 0.7);
  if (bigDrop) {
    exportAll();                                   // l'état actuel part sur le disque AVANT
    const ok = await appConfirm(
      `Ce fichier contient ${newA} comptes et ${newD} documents, contre ${curA} et ${curD} actuellement. `
      + `Une sauvegarde de l'état actuel vient d'être téléchargée. Remplacer quand même ?`,
      { title: "Import appauvrissant", confirmLabel: "Remplacer" });
    if (!ok) return;
  }
  persist(() => normalize(payload), { corbeille: false });
};
```

Le seuil de 30 % est arbitraire mais utile : il laisse passer une suppression de ménage normale et
arrête un fichier vieux de six mois.

---

## 10. Données de secours au tout premier lancement seulement

**La règle, écrite en capitales dans le source** : dès qu'un cache local ou une ligne serveur
contient des comptes, ces données sont sacrées et ne sont **jamais** écrasées — y compris après une
restauration manuelle ou un déploiement.

```js
const hasRealData = current && Array.isArray(current.accounts) && current.accounts.length > 0;
if (!cancelled && !hasRealData) {
  const restored = normalize(JSON.parse(JSON.stringify(RESTORE_DATA)));
  setData(restored); ecrireCache(restored); latestRef.current = restored;
  if (supabaseEnabled) { const ts = new Date().toISOString(); await supabase.from("etat").upsert({ id: "shared", data: restored, updated_at: ts }, { onConflict: "id" }); poserCurseur(ts); poserBase(restored); }
}
```

Le test porte sur la **présence de contenu**, pas sur un drapeau « déjà initialisé » : un drapeau
perdu (navigation privée, cache vidé) réinjecterait les données de secours par-dessus du vrai
travail.

---

# Partie 1 — Synchronisation

## 11. État partagé : une ligne JSON derrière un relais authentifié

L'état complet vit dans **une seule ligne** (`id = "shared"`) d'une table `etat(id, data jsonb,
updated_at)`. Simple, atomique, et fusionnable (#14).

L'écriture passe par un relais serveur qui détient la clé service role — jamais exposée au
navigateur — et vérifie le jeton de session avant toute chose. Cela permet un RLS strict sur la table
tout en laissant l'application fonctionner.

```js
// api/state.js
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) { res.status(500).json({ error: "Service role non configuré côté serveur." }); return; }

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (clerkSecret) {
    const authHeader = req.headers.authorization || "";
    const tok = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!tok) { res.status(401).json({ error: "Non authentifié." }); return; }
    try { await verifyToken(tok, { secretKey: clerkSecret }); }
    catch (e) { res.status(401).json({ error: "Session invalide ou expirée." }); return; }
  }

  const sb = createClient(url, svc, { auth: { persistSession: false } });
  if (req.method === "GET") {
    const { data, error } = await sb.from("etat").select("data, updated_at").eq("id", "shared").maybeSingle();
    if (error) throw error;
    res.status(200).json(data || null); return;
  }
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (typeof body.data === "undefined") { res.status(400).json({ error: "Corps invalide (attendu { data })." }); return; }
    const { error } = await sb.from("etat").upsert({ id: "shared", data: body.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    res.status(200).json({ ok: true }); return;
  }
  res.status(405).json({ error: "Méthode non autorisée" });
}
```

Côté navigateur, le client joint le jeton de session à **chaque** requête, sans template JWT ni
secret partagé — et l'application reste fonctionnelle sans configuration, en repli local pur :

```js
export const supabaseEnabled = Boolean(url && anonKey);
export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      accessToken: async () => {
        try { if (window.__getClerkToken) return (await window.__getClerkToken()) || null; }
        catch (e) { /* jeton indisponible : requête anonyme, bloquée par la RLS */ }
        return null;
      },
    })
  : null;
```

**Le point d'architecture** : `supabaseEnabled` est testé partout. MATMAT doit démarrer et fonctionner
sans back-end configuré, en local pur. C'est ce qui rend le développement possible et la panne
serveur survivable.

---

## 12. Curseur de synchronisation persisté

**Ce que le curseur signifie** : « la dernière version serveur que cet appareil a acquittée ».
C'est lui qui, au rechargement, permet de distinguer deux situations que rien d'autre ne sépare —
un cache local **en avance** (fin de session jamais poussée) d'un cache local **en retard**.

```js
const SYNC_KEY = KEY + ":syncAt";
const lireCurseurSync  = () => { try { return localStorage.getItem(SYNC_KEY) || null; } catch (e) { return null; } };
const ecrireCurseurSync = (ts) => { try { if (ts) localStorage.setItem(SYNC_KEY, ts); } catch (e) {} };
```

**La subtilité qui vaut le détour.** Le curseur *certifie* que le cache est au moins aussi récent que
la version serveur correspondante. Si la dernière écriture du cache a échoué (quota dépassé), cette
garantie tombe : on **retire** alors le curseur au lieu de l'écrire. Sinon un prochain chargement
certifierait un cache obsolète et le repousserait par-dessus le serveur.

```js
const poserCurseur = (ts) => {
  lastSyncAt.current = ts || null;
  cacheEcriture.current.then(() => {
    if (lastSyncAt.current !== (ts || null)) return;   // un curseur plus récent a été posé entre-temps
    if (cacheOk.current) ecrireCurseurSync(ts);
    else { try { localStorage.removeItem(SYNC_KEY); } catch (e) {} }
  }).catch(() => {});
};
```

---

## 13. Base commune persistée

La fusion à trois versions a besoin d'une **base** : la dernière version que les deux appareils
avaient en commun. Elle vit en mémoire *et* sur le disque — sinon un appareil qui redémarre derrière
un autre n'a plus de quoi fusionner.

```js
const BASE_KEY = KEY + ":base";
const baseRef = useRef(null);
const poserBase = (state) => {
  baseRef.current = state;
  try { idbEcrire(BASE_KEY, state).catch(() => {}); } catch (e) {}
};
const lireBaseLocale = async () => { try { return (await idbLire(BASE_KEY)) || null; } catch (e) { return null; } };
```

`poserBase` est appelée à **chaque** acquittement serveur : chargement, écriture réussie, réception
temps réel. La base suit le serveur pas à pas.

---

## 14. Fusion à trois versions — la pièce maîtresse

**Le problème** : le stockage partagé est une seule ligne JSON. Sans fusion, deux appareils qui
écrivent chacun leur état complet s'écrasent mutuellement — « dernier écrivain gagne ». Un téléphone
resté ouvert sur un état ancien pouvait effacer toute une session faite sur l'ordinateur.

**La solution** : en cas de conflit, on repart de la base commune. Ce que **chaque** côté a changé
par rapport à elle est conservé ; si les deux ont modifié la même chose, le local — la saisie active
de l'utilisateur — l'emporte.

```js
const jsonEgal = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } };

function fusionValeur(b, l, r, prof) {
  if (jsonEgal(l, r)) return l;

  // --- Cas 1 : liste d'objets identifiés. Le cas qui compte vraiment.
  const listeId = (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && x.id != null);
  if ((Array.isArray(l) || Array.isArray(r)) && listeId(l || []) && listeId(r || []) && ((l && l.length) || (r && r.length))) {
    const bM = new Map((Array.isArray(b) ? b : []).filter((x) => x && x.id != null).map((x) => [x.id, x]));
    const lM = new Map((l || []).map((x) => [x.id, x]));
    const rM = new Map((r || []).map((x) => [x.id, x]));
    const res = [];
    rM.forEach((rv, id) => {
      if (lM.has(id)) { res.push(jsonEgal(lM.get(id), bM.get(id)) ? rv : lM.get(id)); return; } // inchangé ici → distant ; modifié ici → le nôtre
      const bv = bM.get(id);
      if (bv && jsonEgal(rv, bv)) return;      // supprimé ici, intact là-bas → la suppression tient
      res.push(rv);                            // nouveau là-bas, ou supprimé ici mais MODIFIÉ là-bas → on garde
    });
    lM.forEach((lv, id) => {
      if (rM.has(id)) return;
      const bv = bM.get(id);
      if (!bv || !jsonEgal(lv, bv)) res.push(lv);   // créé ici, ou supprimé là-bas mais modifié ici → on garde
    });
    return res;
  }

  // --- Cas 2 : objet simple, sur deux niveaux de profondeur au plus.
  const objSimple = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (objSimple(l) && objSimple(r) && prof < 2) {
    const out = {}; const bO = objSimple(b) ? b : {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
      const v = fusionValeur(bO[k], l[k], r[k], prof + 1);
      if (v !== undefined) out[k] = v;
    });
    // Clé supprimée d'un côté, intacte de l'autre : la suppression tient.
    Object.keys(out).forEach((k) => { if (!(k in l) && jsonEgal(out[k], bO[k])) delete out[k]; });
    return out;
  }

  // --- Cas 3 : scalaire ou structure opaque. Celui qui a changé l'emporte ; le local en cas de double changement.
  return jsonEgal(l, b) ? r : l;
}

function fusionEtats(base, local, distant) {
  if (!local) return distant;
  if (!distant) return local;
  return fusionValeur(base || {}, local, distant, 0);
}
```

**La règle de conduite, en une phrase** : *ne jamais perdre une modification*. Quand une suppression
d'un côté croise une modification de l'autre, la modification gagne — la fiche revient. C'est
délibéré : une fiche qui réapparaît se resupprime en un clic, une fiche perdue est perdue.

**Ce que MATMAT doit respecter pour que ça marche** : toute collection synchronisée doit être un
tableau d'objets portant un `id` stable et unique. C'est la seule contrainte, et elle est
structurante.

---

## 15. Écriture protégée par compare-and-set

L'envoi n'aboutit **que si** le serveur en est toujours à la version que cet appareil a acquittée.
Sinon, un autre appareil a écrit entre-temps : on récupère sa version, on fusionne, on pousse le
résultat.

```js
const pousserServeur = useCallback(async (payload) => {
  const depuis = lastSyncAt.current;
  const ts = new Date().toISOString();

  if (depuis) {
    // Compare-and-set : la clause .eq("updated_at", depuis) ne touche AUCUNE ligne si le serveur a bougé.
    const { data: rows, error } = await supabase.from("etat")
      .update({ data: payload, updated_at: ts })
      .eq("id", "shared").eq("updated_at", depuis).select("updated_at");
    if (error) throw error;
    if (rows && rows.length) { poserCurseur(ts); poserBase(payload); return payload; }

    // Conflit : on relit, on fusionne, on repousse.
    const { data: row, error: e2 } = await supabase.from("etat").select("data, updated_at").eq("id", "shared").maybeSingle();
    if (e2) throw e2;
    const distant = row && row.data ? normalize(row.data) : null;
    const fusion = distant ? normalize(fusionEtats(baseRef.current, payload, distant)) : payload;
    const ts2 = new Date().toISOString();
    await supabase.from("etat").upsert({ id: "shared", data: fusion, updated_at: ts2 }, { onConflict: "id" });
    poserCurseur(ts2); poserBase(fusion); latestRef.current = fusion;
    setData(fusion); ecrireCache(fusion);       // l'écran adopte le résultat de la fusion
    return fusion;
  }

  // Premier envoi de cet appareil : pas de curseur, upsert simple.
  await supabase.from("etat").upsert({ id: "shared", data: payload, updated_at: ts }, { onConflict: "id" });
  poserCurseur(ts); poserBase(payload); return payload;
}, []);
```

Aucun verrou, aucune transaction : `updated_at` **est** le numéro de version.

---

## 16. Anti-rebond qui pousse le dernier état

```js
const persist = useCallback((updater, opts) => {
  setData((prev) => {
    if (snap) undoRef.current = clone(prev);
    let next = normalize(typeof updater === "function" ? updater(clone(prev)) : updater);
    /* … capture corbeille (#2) … */
    latestRef.current = next;        // source de vérité en mémoire
    ecrireCache(next);               // le disque local, tout de suite : jamais débouncé

    if (supabaseEnabled) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (repriseTimer.current) { clearTimeout(repriseTimer.current); repriseTimer.current = null; }
      pendingWrite.current = true; setSyncState("saving");
      saveTimer.current = setTimeout(() => {
        // On pousse latestRef, PAS « next » : plusieurs persist rapprochés partagent le même
        // minuteur, seul le dernier état compte.
        pousserServeur(latestRef.current || next).then(
          () => { pendingWrite.current = false; saveTimer.current = null; repriseEssais.current = 0; setSyncState("saved"); },
          () => { saveTimer.current = null; repriseEssais.current = 0; setSyncState("offline"); planifierReprise(); });
      }, 800);
    }
    return next;
  });
  if (snap) setCanUndo(true);
}, [pousserServeur]);
```

**Deux rythmes distincts, et c'est volontaire** : le cache local est écrit **immédiatement** (perdre
une frappe est inacceptable), le serveur est écrit **après 800 ms de calme** (une frappe par
caractère saturerait le réseau).

**`latestRef` mérite son existence** : c'est le dernier état persisté *en mémoire*. Les vidages (#18)
et les reprises (#17) s'appuient dessus, même si le cache disque a débordé.

---

## 17. Reprise automatique à délai croissant

Une écriture échouée (réseau coupé, tunnel, VPN) est retentée toute seule — 5 s, 15 s, 45 s, 90 s au
plus — et immédiatement au retour du réseau ou de l'onglet. Le drapeau « en attente » reste levé
jusqu'au succès.

```js
const repriseTimer = useRef(null); const repriseEssais = useRef(0);

const retenterPush = (manuel) => {
  if (!supabaseEnabled) return;
  if (repriseTimer.current) { clearTimeout(repriseTimer.current); repriseTimer.current = null; }
  if (!pendingWrite.current || saveTimer.current) return;    // rien à repousser, ou une écriture débouncée arrive déjà
  const payload = latestRef.current; if (!payload) { pendingWrite.current = false; return; }
  if (manuel === true) setSyncState("saving");               // accuser réception du geste utilisateur
  pousserServeur(payload).then(
    () => { pendingWrite.current = false; repriseEssais.current = 0; setSyncState("saved"); },
    () => { repriseEssais.current++; setSyncState("offline"); planifierReprise(); });
};

const planifierReprise = () => {
  if (repriseTimer.current) return;
  const delai = Math.min(90000, 5000 * Math.pow(3, Math.min(3, repriseEssais.current)));
  repriseTimer.current = setTimeout(() => { repriseTimer.current = null; retenterPush(); }, delai);
};
```

**Le détail d'ergonomie qui a coûté un aller-retour** : une reprise **automatique** laisse la pastille
sur « Hors ligne » et ne passe à « Synchronisé » qu'en cas de succès. Sans le paramètre `manuel`, la
pastille clignotait entre les deux états à chaque tentative.

---

## 18. Vidage à la fermeture de l'onglet

Sans cela, une modification faite dans les 800 ms précédant la fermeture est perdue — et le
chargement suivant écrase le local par la version serveur, plus ancienne.

```js
useEffect(() => {
  const flush = () => {
    if (!supabaseEnabled) return;
    if (!pendingWrite.current && !saveTimer.current) return;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const payload = latestRef.current; if (!payload) return;
    const ts = new Date().toISOString(); const depuis = lastSyncAt.current;
    // Écriture protégée là aussi : si un autre appareil a écrit, cet envoi n'écrase rien
    // (0 ligne touchée) — cache + curseur permettront de fusionner au prochain réveil.
    const q = depuis
      ? supabase.from("etat").update({ data: payload, updated_at: ts }).eq("id", "shared").eq("updated_at", depuis).select("updated_at")
      : supabase.from("etat").upsert({ id: "shared", data: payload, updated_at: ts }, { onConflict: "id" });
    q.then(({ data: rows, error }) => {
      if (!error && (!depuis || (rows && rows.length))) { poserCurseur(ts); poserBase(payload); pendingWrite.current = false; }
      else if (!error && depuis) { pousserServeur(payload).then(() => { pendingWrite.current = false; }).catch(() => {}); } // onglet encore vivant : fusion immédiate
    }, () => {});   // échec réseau : le drapeau reste levé, la reprise ou le prochain chargement s'en chargera
  };
  const onVis = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", flush);
  return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flush); };
}, [pousserServeur]);
```

`visibilitychange` **et** `pagehide` : sur mobile, `beforeunload` ne se déclenche pas de façon fiable.

---

## 19. Relecture au réveil de l'appareil

Le canal temps réel ne rejoue pas les événements manqués pendant qu'un téléphone dort. Sans cette
relecture, il repartait d'un état ancien et sa première sauvegarde pouvait effacer la session faite
entre-temps sur l'ordinateur.

```js
useEffect(() => {
  if (!supabaseEnabled) return;
  let enCours = false;
  const rafraichir = async () => {
    if (enCours || document.visibilityState === "hidden") return;
    // Une écriture locale attend depuis un échec : on la repousse d'abord (elle fusionnera au besoin).
    if (pendingWrite.current && !saveTimer.current) { retenterPush(); return; }
    enCours = true;
    try {
      const { data: row, error } = await supabase.from("etat").select("data, updated_at").eq("id", "shared").maybeSingle();
      if (!error && row && row.data && row.updated_at && (!lastSyncAt.current || row.updated_at > lastSyncAt.current)) {
        if (pendingWrite.current || saveTimer.current) return;   // saisie locale en attente : on ne l'écrase pas
        const fresh = normalize(row.data);
        poserCurseur(row.updated_at); poserBase(fresh); latestRef.current = fresh;
        setData(fresh); ecrireCache(fresh);
        setSyncState("remote"); setTimeout(() => setSyncState((s) => s === "remote" ? "saved" : s), 2600);
      }
    } catch (e) {} finally { enCours = false; }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") rafraichir(); });
  window.addEventListener("focus", rafraichir);
  window.addEventListener("online", rafraichir);
  const iv = setInterval(() => { if (document.visibilityState === "visible") rafraichir(); }, 120000);
  return () => { /* … retraits … */ clearInterval(iv); };
}, []);
```

Quatre déclencheurs (retour sur l'onglet, focus, retour réseau, filet de 120 s) et un verrou
`enCours` : le réveil d'un téléphone en déclenche souvent plusieurs d'un coup.

---

## 20. Canal temps réel, avec filtrage de son propre écho

```js
useEffect(() => {
  if (!supabaseEnabled) return;
  const ch = supabase.channel("etat_sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "etat", filter: "id=eq.shared" }, (payload) => {
      const row = payload && payload.new;
      if (!row || !row.data) return;
      if (row.updated_at && lastSyncAt.current && row.updated_at <= lastSyncAt.current) return; // notre propre écho, ou plus ancien
      if (pendingWrite.current) return;      // saisie locale non poussée : priorité absolue, l'écriture protégée fusionnera
      if (row.updated_at) poserCurseur(row.updated_at);
      const merged = normalize(row.data);
      poserBase(merged); latestRef.current = merged;
      setData(merged); ecrireCache(merged);
      setSyncState("remote"); setTimeout(() => setSyncState((s) => s === "remote" ? "saved" : s), 2600);
    })
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch (e) {} };
}, []);
```

**Les deux gardes, dans cet ordre** : ignorer son propre écho (sinon boucle de rendu), puis céder le
pas à toute saisie locale non poussée (sinon on écrase l'utilisateur en train de taper).

---

## 21. Pastille d'état honnête

**Ce qui a été retiré, et pourquoi.** L'indicateur suivait `navigator.onLine`, qui ment souvent —
faux « hors ligne » après une sortie de veille, derrière un VPN ou un réseau d'entreprise. Il
affichait « Hors ligne » alors que tout s'enregistrait normalement.

**La règle actuelle** : seule une écriture serveur **qui échoue vraiment** bascule en « hors ligne ».

```js
const [syncState, setSyncState] = useState("saved");   // saved | saving | remote | offline

const SS = {
  saving:  { l: "Enregistrement…",            c: "#a06a06",     I: RefreshCw },
  saved:   { l: "Synchronisé",                c: "#1d8956",     I: CheckCircle2 },
  remote:  { l: "Mis à jour par un collègue", c: "var(--blue)", I: Users },
  offline: { l: "Hors ligne",                 c: "var(--red)",  I: AlertTriangle },
};
// Hors ligne : la pastille elle-même renvoie au serveur d'un clic.
{syncState === "offline"
  ? <button onClick={() => retenterPush(true)} title="Modifications enregistrées sur cet appareil, pas encore envoyées. Elles partiront automatiquement dès que la connexion le permettra — cliquez pour réessayer tout de suite.">{contenu}</button>
  : <span title="État de la synchronisation des données">{contenu}</span>}
```

Le grand bandeau d'alerte a été supprimé : en apparaissant et disparaissant à chaque tentative, il
décalait toute la page toutes les quelques secondes.

---

## 22. Résolution au chargement : quatre branches

Le moment le plus délicat de toute l'application. On lit le cache local, on lit le serveur, et le
curseur départage.

```js
useEffect(() => {
  let cancelled = false;
  (async () => {
    let current = null;
    try { const c = await lireCacheLocal(); if (c) { current = normalize(c); if (!cancelled) setData(current); } } catch (e) {}

    if (supabaseEnabled) {
      const { data: row, error } = await supabase.from("etat").select("data, updated_at").eq("id", "shared").maybeSingle();
      if (!error && row && row.data) {
        const serveur = normalize(row.data);
        const curseur = lireCurseurSync();
        const localEnAvance = current && !jsonEgal(current, serveur);

        if (localEnAvance && curseur && row.updated_at === curseur) {
          // (A) Fin de session locale jamais poussée, et le serveur n'a rien reçu d'autre
          //     (curseur intact) → on repousse notre cache au lieu de le perdre.
          poserBase(serveur); latestRef.current = current; poserCurseur(row.updated_at);
          const ts = new Date().toISOString();
          await supabase.from("etat").upsert({ id: "shared", data: current, updated_at: ts }, { onConflict: "id" });
          poserCurseur(ts); poserBase(current);

        } else if (localEnAvance) {
          const base = await lireBaseLocale();
          if (base) {
            // (B) Le serveur a AVANCÉ et notre cache contient du travail jamais poussé.
            //     Adopter le serveur perdrait ce travail, le repousser perdrait celui de l'autre
            //     appareil : on fusionne, exactement comme lors d'un conflit d'écriture.
            const fusion = normalize(fusionEtats(normalize(base), current, serveur));
            current = fusion; latestRef.current = fusion;
            setData(fusion); ecrireCache(fusion);
            if (jsonEgal(fusion, serveur)) { poserCurseur(row.updated_at); poserBase(serveur); }
            else { const ts = new Date().toISOString(); await supabase.from("etat").upsert({ id: "shared", data: fusion, updated_at: ts }, { onConflict: "id" }); poserCurseur(ts); poserBase(fusion); }
          } else {
            // (C) Aucune base commune → cf. #23.
            await idbEcrire(ECARTE_KEY, { at: new Date().toISOString(), data: current });
            current = serveur; poserCurseur(row.updated_at); poserBase(serveur); latestRef.current = serveur;
            setData(current); ecrireCache(current);
          }

        } else {
          // (D) Le serveur fait foi : on l'adopte.
          current = serveur; poserCurseur(row.updated_at); poserBase(serveur); latestRef.current = serveur;
          setData(current); ecrireCache(current);
        }
      }
    }
    /* … puis données de secours si vraiment vide (#10) … */
    if (!cancelled) setLoading(false);
  })();
  return () => { cancelled = true; };
}, []);
```

Le drapeau `cancelled` est vérifié avant chaque `setData` : un démontage en plein chargement ne doit
pas écrire dans un composant mort.

---

## 23. Cache mis de côté plutôt que jeté

**Le cas (C) ci-dessus** : le cache local est en avance, le serveur aussi, et il n'y a **aucune base
commune** (premier chargement après une mise à jour, cache vidé…). Fusionner à l'aveugle
ressusciterait les fiches supprimées ailleurs.

On adopte donc le serveur — mais le cache local est **mis de côté**, jamais jeté. Il reste
récupérable depuis « Historique & corbeille ».

```js
const ECARTE_KEY = KEY + ":ecarte";
const lireEcarte = async () => { try { return (await idbLire(ECARTE_KEY)) || null; } catch (e) { return null; } };
// … au moment de la décision :
try { await idbEcrire(ECARTE_KEY, { at: new Date().toISOString(), data: current }); } catch (e) {}
```

C'est l'illustration la plus nette du fil rouge : **on ne jette jamais rien en silence.**

---

# Partie 1 — Mémoire vive

## 24. Registre de tâches de fond qui survit au démontage

**Le problème** : un traitement long lancé depuis une modale meurt — ou pire, continue mais écrit
dans le vide — dès que l'utilisateur ferme la fenêtre. Les appels facturés, eux, continuent.

**La solution** : un registre **singleton hors du cycle de vie React**. Un composant s'y abonne pour
afficher l'avancement ; le traitement, lui, ne dépend d'aucun composant.

```js
const aiJobs = {
  jobs: new Map(),        // id -> { id, label, done, total, _promise }
  subs: new Set(),
  _n: 0,
  _notify() { this.subs.forEach((f) => { try { f(); } catch (e) {} }); },
  subscribe(f) { this.subs.add(f); return () => this.subs.delete(f); },
  list() { return [...this.jobs.values()]; },
  count() { return this.jobs.size; },
  begin(id, label, total) { this.jobs.set(id, { id, label: label || "Traitement…", done: 0, total: total || 0 }); this._notify(); },
  progress(id, done, total) { const j = this.jobs.get(id); if (j) { if (done != null) j.done = done; if (total != null) j.total = total; this._notify(); } },
  end(id) { if (this.jobs.delete(id)) this._notify(); },
  /* run : cf. #25 */
};

function useAiJobs() {
  const [, force] = useState(0);
  useEffect(() => aiJobs.subscribe(() => force((x) => x + 1)), []);
  return aiJobs;
}
```

---

## 25. Déduplication des tâches par identifiant

Deux clics sur le même bouton ne doivent pas lancer deux fois le même traitement — surtout quand
chaque exécution coûte de l'argent.

```js
run(id, label, runner, total) {
  const ex = this.jobs.get(id);
  if (ex && ex._promise) return ex._promise;      // déjà en cours : on renvoie sa promesse
  this.begin(id, label, total);
  const j = this.jobs.get(id);
  const p = (async () => {
    try { return await runner((d, t) => this.progress(id, d, t)); }
    finally { this.end(id); }                     // finally : la tâche sort du registre même en cas d'échec
  })();
  if (j) j._promise = p;
  return p;
},
```

Le `runner` reçoit une fonction de progression `(done, total)` : le traitement rend compte de son
avancement sans rien connaître de l'interface.

---

## 26. Badge global des tâches en cours

Visible sur tous les onglets, dans la barre du haut. L'utilisateur peut naviguer ailleurs pendant un
traitement long sans se demander s'il tourne encore.

```jsx
function AiJobsBadge() {
  const jobs = useAiJobs();
  const list = jobs.list();
  if (!list.length) return null;
  const withProg = list.find((j) => j.total > 0);
  const label = list.length === 1 ? list[0].label : list.length + " traitements";
  const prog = withProg && withProg.total ? " " + withProg.done + "/" + withProg.total : "";
  return (<span title={list.map((j) => j.label + (j.total ? ` (${j.done}/${j.total})` : "")).join("\n")}
    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700,
      color: "#fff", background: "#7c5cf0", borderRadius: 20, padding: "5px 11px", whiteSpace: "nowrap" }}>
    <Sparkles size={13} className="spin" />{label}{prog}
  </span>);
}
```

---

## 27. Brouillons cloisonnés par dossier

**L'idée** : tout ce qui a été saisi ou généré dans une fenêtre survit à sa fermeture. On peut sortir
d'un volet pendant un traitement et le retrouver à l'identique. Le magasin est la **source de
vérité** : un traitement en arrière-plan continue de l'alimenter même fenêtre fermée (un `setState`
sur un composant démonté serait sans effet).

Cloisonné par **scope** — le dossier concerné — pour ne jamais restituer dans une fiche le brouillon
d'une autre.

```js
const aiPanels = {
  vals: new Map(),   // "scope|clé" -> valeur
  subs: new Map(),   // "scope|clé" -> Set de callbacks
  k(scope, key) { return scope + "|" + key; },
  has(scope, key) { return this.vals.has(this.k(scope, key)); },
  get(scope, key) { return this.vals.get(this.k(scope, key)); },
  set(scope, key, upd) {
    const kk = this.k(scope, key);
    const next = typeof upd === "function" ? upd(this.vals.get(kk)) : upd;
    this.vals.set(kk, next);
    const s = this.subs.get(kk); if (s) s.forEach((f) => { try { f(next); } catch (e) {} });
    return next;
  },
  sub(scope, key, f) { const kk = this.k(scope, key); if (!this.subs.has(kk)) this.subs.set(kk, new Set()); this.subs.get(kk).add(f); return () => { const s = this.subs.get(kk); if (s) s.delete(f); }; },
  // Oublie tout ce qui concerne un dossier (bouton « recommencer »).
  clear(scope) { const pre = scope + "|"; [...this.vals.keys()].filter((k) => k.startsWith(pre)).forEach((k) => { this.vals.delete(k); const s = this.subs.get(k); if (s) s.forEach((f) => { try { f(undefined); } catch (e) {} }); }); },
};

// useState dont la valeur survit à la fermeture de la fenêtre. S'utilise exactement comme useState.
function useKept(scope, key, initial) {
  const [v, setV] = useState(() => aiPanels.has(scope, key) ? aiPanels.get(scope, key) : aiPanels.set(scope, key, typeof initial === "function" ? initial() : initial));
  useEffect(() => {
    if (!aiPanels.has(scope, key)) aiPanels.set(scope, key, typeof initial === "function" ? initial() : initial);
    setV(aiPanels.get(scope, key));
    return aiPanels.sub(scope, key, setV);
  }, [scope, key]);
  return [v, useCallback((upd) => aiPanels.set(scope, key, upd), [scope, key])];
}
```

**Ce qui ne convient PAS à ce traitement**, noté dans le source : les fenêtres modales, les
indicateurs d'activité et les messages passagers. Rouvrir une modale que l'utilisateur croyait fermée
serait déroutant, et un « chargement en cours » figé mentirait sur l'état réel.

---

## 28. Filtres et tri d'un onglet conservés

Changer d'onglet **démonte** le précédent. Sans cela, on retrouvait la vue vierge de ses filtres au
retour, et il fallait tout recocher.

```js
const useVue = (vue, cle, initial) => useKept("vue:" + vue, cle, initial);

// À l'usage, indiscernable de useState :
const [secteurs, setSecteurs] = useVue("carte", "secteurs", false);
const [isoMin, setIsoMin]     = useVue("carte", "isoMin", 30);
```

Une ligne à changer par état concerné, et la navigation cesse d'être punitive.

---

## 29. Magasin de vague hors composants

Même principe que #27, pour une liste produite par un traitement long. La génération tourne dans
`aiJobs` (qui survit au démontage) : fermer le volet ne l'interrompt pas. Sans ce magasin, les
résultats déjà produits — et les filtres saisis — étaient pourtant perdus à la fermeture.

```js
const mailingWave = {
  cards: [], form: {}, subs: new Set(),
  sub(f) { this.subs.add(f); return () => this.subs.delete(f); },
  _notify() { this.subs.forEach((f) => { try { f(this.cards); } catch (e) {} }); },
  setCards(next) { this.cards = typeof next === "function" ? next(this.cards) : next; this._notify(); },
  reset() { this.cards = []; this.form = {}; this._notify(); },
};

function useWaveCards() {
  const [cards, set] = useState(mailingWave.cards);
  useEffect(() => mailingWave.sub(set), []);
  return [cards, (n) => mailingWave.setCards(n)];
}
// Champ de formulaire dont la valeur survit à la fermeture du volet.
function useWaveState(key, initial) {
  const [v, setV] = useState(() => (key in mailingWave.form ? mailingWave.form[key] : (typeof initial === "function" ? initial() : initial)));
  return [v, (upd) => setV((prev) => { const next = typeof upd === "function" ? upd(prev) : upd; mailingWave.form[key] = next; return next; })];
}
```

---

## 30. Mémoire de navigation + historique

Au démarrage, on restaure l'onglet **et la fiche ouverte** de la dernière session : après une mise à
jour du logiciel ou un simple rechargement, on reste là où on naviguait.

```js
const NAV_STATE_KEY = "matmat_nav";
const readSavedNav = () => { try { const o = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || "null"); return o && o.tab ? o : null; } catch (e) { return null; } };

const [tab, setTab]     = useState(() => { const o = readSavedNav(); return o ? o.tab : "accueil"; });
const [focus, setFocus] = useState(() => { const o = readSavedNav(); return o ? o.focus : null; });
useEffect(() => { try { localStorage.setItem(NAV_STATE_KEY, JSON.stringify({ tab, focus })); } catch (e) {} }, [tab, focus]);

// Historique interne : chaque navigation empile une « localisation » {tab, focus}.
const navHist = useRef({ stack: [readSavedNav() || { tab: "accueil", focus: null }], pos: 0 });
```

**Le complément indispensable** : l'écran de secours en cas d'erreur de rendu efface ce repère avant
de recharger. Sinon l'écran qui vient de planter est rouvert aussitôt, l'erreur réapparaît, et le
bouton semble ne rien faire.

---

## 31. Valeurs récentes par champ

Mémorise sur cet appareil les dernières valeurs saisies dans les champs récurrents et les propose en
un clic sous le champ. Local, léger, sans back-end.

```js
const RECENTS_KEY = "matmat_recents_v1";
const lireRecents = (champ) => { try { const o = JSON.parse(localStorage.getItem(RECENTS_KEY) || "{}"); return Array.isArray(o[champ]) ? o[champ] : []; } catch (e) { return []; } };
const pousserRecent = (champ, valeur) => {
  const v = String(valeur || "").trim();
  if (v.length < 3 || v.length > 120) return;      // ni bruit, ni pavé
  try {
    const o = JSON.parse(localStorage.getItem(RECENTS_KEY) || "{}");
    o[champ] = [v, ...(Array.isArray(o[champ]) ? o[champ] : []).filter((x) => String(x).toLowerCase() !== v.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(o));
  } catch (e) {}
};
```

À l'enregistrement : `onClick={() => { pousserRecent("echange.sujet", f.sujet); onSave(f); }}`.

---

## 32. « Ne plus demander » temporaire

Une confirmation répétée vingt fois d'affilée devient un réflexe, donc un danger. Une coche
« Ne plus demander pendant 30 minutes », **purement en mémoire** : un rechargement réarme tout.

```js
const _confirmSkips = {};           // clé d'action -> horodatage d'expiration
const CONFIRM_SKIP_MIN = 30;

function appConfirm(message, opts = {}) {
  if (opts.skipKey && (_confirmSkips[opts.skipKey] || 0) > Date.now()) return Promise.resolve(true);
  return new Promise((resolve) => {
    if (_confirmHandler) _confirmHandler({ message, title: opts.title || "Confirmer", confirmLabel: opts.confirmLabel || "Supprimer", skipKey: opts.skipKey || "", resolve });
    else { try { resolve(window.confirm(message)); } catch (e) { resolve(true); } }   // repli si l'hôte n'est pas monté
  });
}
```

Une promesse, pas un `onConfirm` : le code appelant lit comme du séquentiel
(`if (await appConfirm(…)) …`).

---

## 33. Annulation d'un niveau

Un instantané en mémoire, pris avant chaque modification. Un seul niveau, qui meurt au rechargement —
et c'est assumé : le vrai filet, ce sont la corbeille (#2) et les instantanés (#4).

```js
const undoRef = useRef(null);
// … dans persist : if (snap) undoRef.current = clone(prev);
const undo = useCallback(() => {
  if (!undoRef.current) return;
  const snap = undoRef.current; undoRef.current = null; setCanUndo(false);
  persist(() => snap, { snapshot: false });      // ne pas ré-empiler l'annulation elle-même
}, [persist]);

const clone = (x) => typeof structuredClone !== "undefined" ? structuredClone(x) : JSON.parse(JSON.stringify(x));
```

---

# Partie 1 — Optimisation

## 34. Découpe en chunks stables

Combinée aux en-têtes « immutable », les visites suivantes ne retéléchargent pas les bibliothèques
quand seul le code applicatif change.

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-") || id.includes("/d3/")) return "charts";
            if (id.includes("xlsx")) return "xlsx";
            if (id.includes("leaflet")) return "leaflet";   // chargé à la demande (#35)
            return "vendor";
          }
        },
      },
    },
  },
});
```

---

## 35. Chargement à la demande des grosses bibliothèques

Leaflet (≈ 150 Ko) et xlsx (≈ 430 Ko) ne sont chargés qu'au moment où on s'en sert. Le démarrage des
autres onglets n'en porte pas le poids.

```js
// La carte : Leaflet et sa feuille de style, à l'ouverture de l'onglet seulement.
const [LF, setLF] = useState(null);
useEffect(() => {
  let on = true;
  Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
    .then(([mod]) => { if (on) setLF(mod.default || mod); })
    .catch(() => {});
  return () => { on = false; };
}, []);

// Le tableur : au moment de lire le fichier, pas avant.
const buf = await file.arrayBuffer();
const XLSX = await import("xlsx");
```

Le drapeau `on` évite d'écrire dans un composant démonté pendant le chargement.

---

## 36. Service worker : la bonne stratégie par ressource

```js
const CACHE = "matmat-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install",  e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // ne JAMAIS intercepter les appels tiers
  if (url.pathname.startsWith("/api/")) return;      // les relais serveur vont droit au réseau

  // Navigation : réseau d'abord (toujours la dernière version), cache en repli hors ligne.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req)
      .then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put("/index.html", c)); return res; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  // Fichiers empreintés : cache d'abord, ils sont immuables.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then(hit => hit ||
      fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); return res; })));
  }
});
```

**Les deux exclusions en tête sont vitales** : un service worker qui met en cache `/api/` sert des
données périmées, et un qui intercepte les domaines tiers casse l'authentification.

---

## 37. Le bouton « Mettre à jour »

**Le problème** : entre un service worker, la Cache API et le cache HTTP du navigateur, un
utilisateur peut rester bloqué des jours sur une version ancienne sans le savoir. « Videz votre
cache » n'est pas une réponse acceptable.

**La solution** : un bouton qui vide tout et recharge — et qui recharge **quoi qu'il arrive**.

```jsx
<button className="btn btn-ghost btn-s" onClick={hardRefresh}
  title="Forcer la mise à jour : vide le cache et recharge la dernière version">
  <RefreshCw size={15} /> Mettre à jour
</button>
```

```js
const hardRefresh = useCallback(async () => {
  // Chacune des étapes ci-dessous peut rester en suspens indéfiniment (requête sans réponse, Cache
  // API bloquée, service worker qui ne répond pas) : un `await` sur l'une d'elles suffirait à rendre
  // le bouton inerte, sans message ni rechargement. On arme donc un compte à rebours qui recharge
  // coûte que coûte, et chaque étape est bornée dans le temps. Au pire on perd la synchronisation
  // d'une écriture en attente ; ne pas recharger du tout serait pire, puisque c'est précisément ce
  // qu'on demande au bouton.
  const go = () => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("_v", Date.now().toString(36));   // casse le cache HTTP du document
      window.location.replace(u.toString());               // replace, pas assign : pas d'entrée d'historique
    } catch (e) { try { window.location.reload(); } catch (e2) {} }
  };

  const filet = setTimeout(go, 5000);                      // le rechargement AURA lieu
  const borne = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(r, ms))]);

  // 1. Vider l'écriture serveur en attente (persist est débouncé de 800 ms) : sinon une valeur
  //    enregistrée juste avant serait perdue, le chargement suivant écrasant le local par la
  //    version serveur, obsolète.
  try {
    // On ne renvoie au serveur QUE si une modification locale attend réellement : sinon un appareil
    // qui n'a rien changé (mais dont le cache est plus ancien) écraserait les modifications faites
    // entre-temps sur un autre appareil.
    const hadPending = pendingWrite.current || !!saveTimer.current;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (supabaseEnabled && hadPending) {
      const payload = latestRef.current;
      if (payload) { await borne(pousserServeur(payload), 2500); pendingWrite.current = false; }
    }
  } catch (e) {}

  // 2. Vider la Cache API.
  try { if (typeof caches !== "undefined") { const ks = await borne(caches.keys(), 1500) || []; await borne(Promise.all(ks.map((k) => caches.delete(k))), 1500); } } catch (e) {}

  // 3. Désinscrire les service workers.
  try { if (navigator.serviceWorker) { const regs = await borne(navigator.serviceWorker.getRegistrations(), 1500) || []; await borne(Promise.all(regs.map((r) => r.unregister())), 1500); } } catch (e) {}

  clearTimeout(filet);
  go();
}, [pousserServeur]);
```

**Les quatre idées à retenir**, dans l'ordre d'importance :

1. **Le filet de 5 s.** Le bouton promet un rechargement : il doit tenir, même si toutes les étapes
   se figent. Un bouton qui ne fait rien est pire qu'un bouton qui recharge trop tôt.
2. **Chaque étape est bornée** par `Promise.race` — 2,5 s pour le réseau, 1,5 s pour les caches.
   `borne` avale aussi les rejets (`.catch(() => null)`) : un échec ne doit pas court-circuiter la
   suite.
3. **On ne pousse que si `hadPending`.** Repousser systématiquement transformerait ce bouton en arme :
   un appareil au cache ancien écraserait le travail fait ailleurs.
4. **`replace` avec un paramètre `_v`.** `reload()` peut resservir le document depuis le cache HTTP ;
   une URL différente, non.

---

## 38. Compression d'image avant stockage

Une photo de téléphone en base64 pèse plusieurs mégaoctets et sature le stockage **et** la
synchronisation. On la redimensionne et on la recompresse — sans jamais la refuser.

```js
// Le plus grand côté est borné à maxDim, la qualité ajustée. Fond blanc pour les PNG transparents.
function compressImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);      // sinon le transparent devient noir en JPEG
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

// Taille réelle d'une image encodée en Data URL, pour décider quoi que ce soit d'informé.
const dataUrlBytes = (u) => { const i = (u || "").indexOf(","); const b64 = i >= 0 ? u.slice(i + 1) : (u || ""); return Math.round(b64.length * 3 / 4); };
```

---

## 39. Jauge d'occupation des données

On ne surveille bien que ce qu'on voit. Un écran « État du logiciel » montre le poids réel des
données par rapport à la limite du navigateur, avec un code couleur qui vire au rouge avant la panne.

```jsx
let dataBytes;
try { dataBytes = new Blob([JSON.stringify(data)]).size; } catch (e) { dataBytes = JSON.stringify(data).length; }
const LIMIT = 5 * 1024 * 1024;
const dataPct = Math.round(dataBytes / LIMIT * 100);

<Gauge label="Poids des données enregistrées"
  pct={dataPct}
  valueText={dataBytes < 1024 * 1024 ? ko(dataBytes) + " Ko" : mo(dataBytes) + " Mo"}
  color={dataPct >= 80 ? "var(--red)" : dataPct >= 50 ? "var(--amber)" : "var(--green)"}
  hint={`sur ~5 Mo disponibles dans le navigateur (${dataPct} %)`} />
```

La même jauge sert à mesurer la complétude des données métier (part des fiches dont un champ clé est
renseigné) : même composant, même lecture immédiate.

---

## 40. Suivi et alerte de dépense, lot asynchrone repris

**L'origine, écrite dans le source** : une facture de 84 $ arrivée sans prévenir. La réponse tient en
deux mécanismes.

**Le premier — l'alerte par palier.** À chaque tranche de 5 € atteinte dans la journée, une fenêtre
s'impose avec le montant du jour. Ce n'est **pas** un blocage : rien n'est coupé, on informe.

```js
const ALERTE_PAS_EUR = 5;
// Palier déjà signalé aujourd'hui (0 si l'acquittement date d'un autre jour : remise à zéro chaque jour).
const paliersSignales = (u) => { const a = u && u.alerte; return a && a.date === TODAY() ? (a.palier || 0) : 0; };

const palier = Math.floor(eurDuJour / ALERTE_PAS_EUR);
if (palier <= paliersSignales(usage)) return null;   // un seul affichage même si plusieurs paliers franchis d'un coup
```

Le message dit franchement ce qu'il en est : *« Rien n'est bloqué. Si le montant vous surprend, la
cause la plus fréquente est un traitement de masse en cours — vous pouvez le laisser finir ou le
suspendre. »*

**Le second — le lot asynchrone repris après rechargement.** Un lot dure jusqu'à 24 h. Son identifiant
est enregistré **dans les données synchronisées** : le veilleur le reprend donc après un rechargement,
une fermeture, ou depuis un autre appareil.

```jsx
function BatchWatcher({ batch, persist }) {
  const id = batch && batch.id;
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const tick = async () => {
      let r;
      try { r = await batchCall("results", { id }); }
      catch (e) {
        // Lot introuvable (supprimé, ou expiré) : on cesse de le surveiller au lieu de boucler.
        if (/404|not_found|introuvable/i.test(String((e && e.message) || e)))
          persist((d) => ({ ...d, batch: null, batchMsg: { ok: false, t: "Le lot n'est plus disponible — il a été abandonné." } }));
        return;
      }
      if (stop || !r) return;
      if (r.pending && r.request_counts) {
        // L'API dit combien de requêtes sont traitées : on l'affiche, au lieu de montrer
        // éternellement la taille du lot.
        const c = r.request_counts;
        const faites = (c.succeeded || 0) + (c.errored || 0) + (c.canceled || 0) + (c.expired || 0);
        persist((d) => ({ ...d, batch: { ...d.batch, faites } }), { snapshot: false });
      }
      /* … application des résultats quand le lot est terminé … */
    };
    tick(); const iv = setInterval(tick, 30000);
    return () => { stop = true; clearInterval(iv); };
  }, [id]);
  return null;
}
```

**Le `{ snapshot: false }`** sur la mise à jour de progression : une barre qui avance ne doit pas
remplir la pile d'annulation.

---

# Partie 2 — La carte mondiale, version B2C

Toutes les fonctionnalités visuelles de la carte MITMIT, à l'identique. **Une seule différence** :
là où MITMIT place des établissements B2B (points de vente, sièges décisionnaires, entrepôts),
MATMAT place la **localisation des clients B2C** — les particuliers qui ont acheté.

Ce que ce retournement change vraiment est listé à la fin, sous **[Ce qui change en B2C](#ce-qui-change-en-b2c)**.
Le reste — fonds de carte, marqueurs, halos, tracés, zones, réglages de performance — se copie tel quel.

## Chargement à la demande

Voir #35 : la carte n'est montée qu'à l'ouverture de son onglet.

## Initialisation, réglée pour la fluidité

```js
const map = LF.map(mapEl.current, {
  zoomControl: false,           // on dessine les nôtres (voir plus bas)
  attributionControl: true,     // obligatoire : les fonds sont sous licence
  worldCopyJump: true,          // le monde se répète : un client en Nouvelle-Zélande reste atteignable
  scrollWheelZoom: false,       // la molette fait défiler la PAGE, pas la carte — sinon on la traverse par accident
  preferCanvas: true,           // rendu canvas : indispensable au-delà de ~200 points
  zoomSnap: 0.5, zoomDelta: 0.5,
  wheelDebounceTime: 40,
}).setView(depart.c, depart.z);
```

`preferCanvas: true` est **le** réglage qui décide de la fluidité. En SVG, chaque point est un nœud
DOM ; en canvas, tout est peint d'un coup. Sur une carte B2C, qui compte des milliers de clients
là où le B2B en comptait deux cents, ce n'est plus une optimisation mais une condition.

## Quatre fonds superposés, satellite ou plan

```js
satLayer.current = LF.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, maxNativeZoom: 19, attribution: "Imagerie © Esri, Maxar, Earthstar Geographics" });

// Étiquettes (villes, pays) posées PAR-DESSUS le satellite : sans elles, l'imagerie est illisible.
labelsLayer.current = LF.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, maxNativeZoom: 19 });

// Fond « plan » : CARTO Voyager, lisible et sobre.
planLayer.current = LF.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  { maxZoom: 20, maxNativeZoom: 20, subdomains: "abcd", attribution: "© OpenStreetMap, © CARTO" });

// Routes en surcouche optionnelle.
roadsLayer.current = LF.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 19, maxNativeZoom: 19 });
```

L'ordre d'empilement est réimposé à chaque bascule — sans quoi les étiquettes finissent sous
l'imagerie :

```js
useEffect(() => {
  const base = fondPlan ? planLayer.current : satLayer.current;
  if (base && map.hasLayer(base)) base.bringToBack();
  [labelsLayer.current, roadsLayer.current].forEach((c) => { if (c && map.hasLayer(c)) c.bringToFront(); });
}, [mapReady, fondPlan, showRoads]);
```

Le `{r}` de l'URL CARTO sert les tuiles en haute densité sur écran Retina.

## Couches de contenu, séparées

```js
routesLayer.current  = LF.layerGroup().addTo(map);   // tracés
markersLayer.current = LF.layerGroup().addTo(map);   // points
isoLayer.current     = LF.layerGroup().addTo(map);   // zone « à moins de N minutes »
zoneLayer.current    = LF.layerGroup().addTo(map);   // sélection rectangulaire
```

Chaque couche se vide et se redessine indépendamment. Sans cette séparation, changer un filtre
effacerait le tracé en cours.

## Marqueurs SVG : la forme dit le type, la couleur dit le segment

Chaque marqueur est un `divIcon` contenant un SVG inline — donc stylable en CSS, animable, et sans
une seule requête réseau.

```js
const shapePath = (type) =>
    type === "pin"       ? "M0,0 C-6.5,-8 -6.5,-15 0,-15 C6.5,-15 6.5,-8 0,0 Z"
  : type === "diamond"   ? "M0,-9 L9,0 L0,9 L-9,0 Z"
  : type === "hex"       ? "M0,-10 L8.66,-5 L8.66,5 L0,10 L-8.66,5 L-8.66,-5 Z"
  : type === "warehouse" ? "M-9,7 L-9,-3 L0,-11 L9,-3 L9,7 Z"
  : /* étoile */           "M0,-10 L2.9,-3.1 L10,-3.1 L4.2,1.6 L6.4,9 L0,4.6 L-6.4,9 L-4.2,1.6 L-10,-3.1 L-2.9,-3.1 Z";

const iconeClient = (p, on) => {
  const col = clientColor(p);
  const tp  = (CLIENT_TYPES[p.type] || CLIENT_TYPES.acheteur).shape;
  const W = on ? 38 : 30; const H = W * 26 / 24;
  const html = `<svg width="${W}" height="${H}" viewBox="-12 -16 24 26"
      style="overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))">
    ${on ? `<circle class="halo" cx="0" cy="0" r="6" fill="${col}"/>` : ""}
    <path d="${shapePath(tp)}" fill="${col}" stroke="#fff" stroke-width="1.6"/>
    ${tp === "pin" ? `<circle cx="0" cy="-9" r="2.4" fill="#fff"/>` : ""}
  </svg>`;
  return { icon: LF.divIcon({ html, className: "site-marker", iconSize: [W, H], iconAnchor: [W / 2, W * 2 / 3] }), W };
};
```

Le `drop-shadow` en filtre SVG (et non une ombre CSS) détache le marqueur d'une imagerie satellite
chargée. `iconAnchor` à `W * 2/3` place la **pointe** du repère sur les coordonnées, pas son centre.

Le halo qui pulse sur le marqueur sélectionné, et le grossissement au survol :

```css
.site-marker{background:transparent;border:none;}
.site-marker .halo{transform-origin:center;animation:halo 2.2s ease-out infinite;}
@keyframes halo{0%{r:6;opacity:.5;}100%{r:20;opacity:0;}}

.site-marker svg{transition:transform .16s ease;}
.site-marker.marker-hover svg{transform:scale(1.55);transform-origin:50% 62%;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.6)) !important;}

/* Étiquette permanente du marqueur sélectionné */
.site-tip{background:rgba(20,32,58,.92);color:#fff;border:none;border-radius:7px;
  font-weight:700;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.45);padding:2px 8px;}
.site-tip::before{display:none;}   /* pas de flèche : sur une carte, elle ajoute du bruit */
```

Le `r` animé dans `@keyframes` anime l'**attribut SVG**, pas une propriété CSS — c'est ce qui permet
au halo de grandir depuis son centre géométrique exact.

## Ne pas reconstruire deux cents marqueurs pour en changer un

L'optimisation la plus payante de tout l'écran.

```js
// Clé de rendu volontairement DÉPOURVUE de la sélection : elle ne change qu'un marqueur sur deux
// cents, et la faire entrer ici reconstruirait toute la couche à chaque clic.
const markerKey = useMemo(() =>
  shown.map((p) => p.id + ":" + p.lat + ":" + p.lng + ":" + clientColor(p)).join("|")
  + "#M" + (mePos ? mePos.lat.toFixed(4) + "," + mePos.lng.toFixed(4) : ""),
  [shown, mePos]);

const selRendu = useRef(null);
useEffect(() => { /* … reconstruction complète de la couche … */ }, [mapReady, markerKey]);

// Changement de sélection : DEUX marqueurs retouchés, pas deux cents recréés.
useEffect(() => {
  if (!mapReady || selRendu.current === sel) return;
  retoucher(selRendu.current, false);
  retoucher(sel, true);
  selRendu.current = sel;
}, [sel, mapReady]);
```

La position est arrondie à quatre décimales dans la clé : le GPS d'un téléphone bouge en permanence
de quelques centimètres, et sans arrondi la couche se reconstruirait plusieurs fois par seconde.

## Position de l'utilisateur

```js
const html = `<svg width="26" height="26" viewBox="-13 -13 26 26" style="overflow:visible">
  <circle class="halo" cx="0" cy="0" r="9" fill="#2563EB"/>
  <circle cx="0" cy="0" r="6" fill="#2563EB" stroke="#fff" stroke-width="2.5"/></svg>`;
LF.marker([mePos.lat, mePos.lng], {
  icon: LF.divIcon({ html, className: "site-marker", iconSize: [26, 26], iconAnchor: [13, 13] }),
  zIndexOffset: 2000, title: "Ma position",
}).addTo(lg).bindTooltip("Ma position", { direction: "top", offset: [0, -12], className: "site-tip" });
```

`zIndexOffset: 2000` : la position de l'utilisateur passe devant tout le reste, toujours.

## Regroupement (clusters)

Indispensable en B2C, où mille clients dans une métropole deviendraient une bouillie de points.

```css
.cluster{cursor:pointer;}
.cluster text{font-weight:800;fill:#fff;}
```

```js
// Pastille de regroupement : un disque coloré portant le nombre. Le rayon suit le compte,
// en racine carrée — sinon un groupe de 500 écrase visuellement un groupe de 50.
const iconeCluster = (n, col) => {
  const r = Math.min(28, 12 + Math.sqrt(n) * 1.6);
  const html = `<svg width="${r * 2}" height="${r * 2}" viewBox="${-r} ${-r} ${r * 2} ${r * 2}" class="cluster">
    <circle cx="0" cy="0" r="${r}" fill="${col}" fill-opacity=".85" stroke="#fff" stroke-width="2"/>
    <text x="0" y="4" text-anchor="middle" font-size="${r > 20 ? 13 : 11}">${n}</text></svg>`;
  return LF.divIcon({ html, className: "cluster", iconSize: [r * 2, r * 2], iconAnchor: [r, r] });
};
```

## Tracés animés

```css
/* Tracé routier : tirets qui défilent, le trajet « coule » vers sa destination */
.lroute{stroke-linecap:round;stroke-dasharray:7 9;animation:ldash 1s linear infinite;}
@keyframes ldash{to{stroke-dashoffset:-16;}}

/* Trait à vol d'oiseau : pointillés fins, plus lents — visuellement « moins engageant » */
.route{vector-effect:non-scaling-stroke;stroke-dasharray:1.4 4.2;stroke-linecap:round;
  animation:dash 5s linear infinite;}
@keyframes dash{to{stroke-dashoffset:-11.2;}}
```

```js
LF.polyline(latlngs, { color: col, weight: 3, opacity: 0.9, className: "lroute" }).addTo(lg);

// Pastille numérotée sur la destination, quand une étape en regroupe plusieurs.
if (cnt > 1) LF.marker([dest.lat, dest.lng], { icon: LF.divIcon({
  html: `<div style="background:${col};color:#fff;font-weight:800;font-size:10px;width:18px;height:18px;
    border-radius:50%;display:grid;place-items:center;border:1.5px solid #fff;
    box-shadow:0 1px 3px rgba(0,0,0,.4)">${cnt}</div>`,
  className: "route-badge", iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(lg);
```

`vector-effect: non-scaling-stroke` garde l'épaisseur du trait constante quel que soit le zoom.

## Zone « à moins de N minutes » et test d'appartenance local

Le polygone vient d'un service d'isochrone (via relais serveur, clé jamais exposée). **Le test
d'appartenance est fait localement** : aucune donnée client ne sort de l'application.

```js
// Algorithme du rayon (ray casting) : compte les intersections d'une demi-droite avec le contour.
const pointDansPolygone = (lat, lng, anneau) => {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const xi = anneau[i][0], yi = anneau[i][1], xj = anneau[j][0], yj = anneau[j][1];  // [lng, lat]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
};

// GeoJSON est en [lng, lat] ; Leaflet attend [lat, lng]. La confusion la plus fréquente du domaine.
LF.polygon(anneau.map((c) => [c[1], c[0]]), { color: "#7c5cf0", weight: 2, fillColor: "#7c5cf0", fillOpacity: 0.12 })
  .addTo(isoLayer.current);
```

**Le repli honnête** : sans clé pour le calcul routier, on retombe sur un cercle à vol d'oiseau —
nettement moins juste (il ignore les routes et les reliefs), ce que le message dit franchement plutôt
que de laisser croire à un isochrone.

```js
LF.circle([lat, lng], { radius: rayonKm * 1000, color: "#7c5cf0", weight: 2,
  dashArray: "5 4", fillColor: "#7c5cf0", fillOpacity: 0.08 }).addTo(isoLayer.current);
```

## Analyse de secteurs

Départements (ou régions, ou codes postaux) colorés selon une mesure — en B2C, la densité de clients
ou le panier moyen. Les contours sont téléchargés **une fois** puis mis en cache local : c'est un
fichier volumineux, on ne le reprend pas à chaque ouverture.

```js
const cle = "matmat_contours_v1";
let geo = null;
try { geo = await idbLire(cle); } catch (e) {}
if (!geo) { geo = await (await fetch(URL_CONTOURS)).json(); try { await idbEcrire(cle, geo); } catch (e) {} }
```

## Habillage, contrôles et cadrage

```css
.mapwrap{position:relative;background:linear-gradient(180deg,#f7fafe,#eef3fb);
  border:1px solid var(--line);border-radius:18px;overflow:hidden;isolation:isolate;}
.pu-root.dark .mapwrap{background:linear-gradient(180deg,#10172a,#0c1322);}
.leaflet-container{height:100%;width:100%;background:#0b1a2b;font:inherit;}

/* Contrôles de zoom maison, accordés au reste de l'application */
.zoomctl{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:6px;z-index:4;}
.zbtn{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:#fff;
  display:grid;place-items:center;cursor:pointer;color:var(--ink);
  box-shadow:0 2px 6px rgba(20,32,58,.12);font-weight:800;}
.zbtn:hover{border-color:var(--blue);color:var(--blue);}

/* Fiche au clic sur un point */
.pin-pop{position:absolute;background:#fff;border:1px solid var(--line);border-radius:14px;
  box-shadow:0 16px 40px rgba(20,32,58,.22);padding:14px;width:248px;z-index:5;}
```

`isolation: isolate` sur le conteneur : la carte crée son propre contexte d'empilement, ses couches
internes ne peuvent plus passer devant les modales de l'application.

Cadrage automatique sur l'ensemble des points visibles :

```js
if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 12 });
```

`maxZoom: 12` : sans lui, un seul client affiché zoome jusqu'au niveau de la rue et on perd tout
repère géographique.

---

## Ce qui change en B2C

Voilà la seule vraie différence, et elle tient à ce que les données décrivent.

**1. Le volume change d'ordre de grandeur.** Deux cents établissements deviennent des milliers de
clients. Trois conséquences, toutes déjà couvertes plus haut : `preferCanvas: true` cesse d'être
optionnel, le **regroupement en clusters** devient la vue par défaut (pas une option), et la clé de
rendu des marqueurs (#37 de la carte) doit impérativement exclure la sélection.

**2. Le point n'est plus une adresse, mais une zone.** On ne géolocalise pas un particulier à sa
porte — c'est intrusif, souvent illégal, et sans intérêt analytique. Agrégez au **code postal** ou à
la commune, et placez le marqueur au centroïde. Le marqueur porte alors un **nombre de clients**, pas
un nom.

```js
// Un point par code postal, pas un point par personne.
const parZone = new Map();
clients.forEach((c) => {
  const z = c.codePostal; if (!z) return;
  const e = parZone.get(z) || { cp: z, ville: c.ville, n: 0, ca: 0, lat: null, lng: null };
  e.n++; e.ca += c.totalAchats || 0;
  parZone.set(z, e);
});
// … puis lat/lng = centroïde du code postal (table de référence, chargée et mise en cache une fois).
```

**3. Les types de marqueur changent de sens.** La forme ne dit plus « point de vente / siège /
entrepôt » mais le **statut client** ; la couleur ne dit plus l'enseigne mais un **segment**.

```js
const CLIENT_TYPES = {
  acheteur:  { label: "Client",           shape: "pin" },
  fidele:    { label: "Client fidèle",    shape: "diamond" },
  vip:       { label: "Meilleur client",  shape: "star" },
  inactif:   { label: "Client inactif",   shape: "hex" },
};
// Couleur = valeur du client, du plus pâle au plus soutenu. Même principe que le dégradé de bleus
// qui codait la surface de vente en B2B.
const SEGMENT_COLOR = {
  "1 achat":       "#9ec9f5",
  "2 à 3 achats":  "#4f86d6",
  "4 à 9 achats":  "#2b59a8",
  "10 achats et +": "#16306b",
  "Inactif > 12 mois": "#9aa6bd",
};
const clientColor = (z) => SEGMENT_COLOR[segmentDe(z)] || "#9aa6bd";
```

**4. Le tracé change de raison d'être.** En B2B, la ligne animée figurait une **tournée commerciale**
depuis l'entrepôt. En B2C, il n'y a pas de tournée : gardez exactement le même tracé animé pour
figurer des **flux de livraison** depuis l'entrepôt vers les zones, l'épaisseur codant le volume
expédié. Le code ne change pas, seule la donnée injectée change.

**5. L'isochrone change de question.** « Quels magasins sont à 30 minutes d'ici ? » devient
« **combien de clients** dans cette zone ? » — utile pour choisir un point de retrait, un corner, ou
cibler une opération locale. Le `fichesDeZone` de MITMIT renvoie déjà un décompte : il suffit de lui
donner les zones clients.

**6. Un point que MITMIT n'avait pas à traiter.** Une carte de clients particuliers est un traitement
de données personnelles. Trois règles qui découlent directement de ce qui précède, et qu'il vaut
mieux inscrire dans le code dès le premier jour :

- **Agréger, ne jamais pointer un individu** (règle 2 ci-dessus) — c'est la mesure la plus efficace,
  et elle améliore aussi la lisibilité.
- **Ne jamais afficher un nom ou une adresse sur la carte** : le marqueur porte une zone et un
  décompte. Le détail nominatif, s'il est nécessaire, se consulte dans la fiche client, pas sur un
  écran de vue d'ensemble qu'on projette en réunion.
- **Garder le calcul local** : le test d'appartenance à une zone est déjà fait dans le navigateur
  (voir plus haut). Aucune coordonnée client ne doit partir vers un service tiers — seul le **centre**
  de la zone est envoyé au service d'isochrone.

---

## Ordre de portage conseillé

1. **Le socle de persistance** (#1, #16, #33) — cache local, `persist`, annulation. Rien d'autre ne
   tient sans lui.
2. **La corbeille** (#2, #3) — quelques lignes dans `persist`, et le filet est posé.
3. **La synchronisation** (#11 à #23) — le gros morceau. Portez-le d'un bloc : ces treize
   fonctionnalités forment un seul mécanisme, en prendre la moitié donne le pire des deux mondes.
4. **La mémoire vive** (#24 à #33) — indépendante du reste, portable à tout moment, effet immédiat
   sur le confort.
5. **Les sauvegardes** (#4 à #10) — instantanés, dossier automatique, export/import.
6. **L'optimisation** (#34 à #40) — dont le bouton « Mettre à jour », à poser tôt : c'est lui qui
   vous sauvera pendant le développement.
7. **La carte** — en dernier, quand les données clients ont une forme stable.

## Le piège à ne pas reproduire

MITMIT a commencé avec « dernier écrivain gagne ». C'est simple, ça marche pendant des mois, et un
jour un téléphone resté ouvert efface une journée de travail. Toute la partie synchronisation de ce
document est née de cet incident.

Si MATMAT doit être multi-appareils, portez le curseur (#12), la base (#13) et la fusion (#14)
**dès le départ**. Les greffer après coup demande de reprendre chaque point d'écriture.
