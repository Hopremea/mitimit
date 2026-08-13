import { verifyToken } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { PRODUCT_IMG } from "./productImages.js";
import { LOGO_DATA_URI } from "./logoPenUp.js";

// Relais du BON DE COMMANDE EN LIGNE (lien public remis aux revendeurs).
//
// Ce module vit dans lib/ et non dans api/ : Vercel compte chaque fichier de api/ comme une
// fonction serverless, et le plan Hobby du projet en autorise 12 par déploiement — un treizième
// fichier fait échouer le déploiement entier. Le point d'entrée est donc le paramètre « bdc » du
// relais /api/state, qui partage d'ailleurs sa raison d'être : l'accès Supabase en clé service role.
//
// Un seul point d'entrée, quatre usages :
//
//   GET  /commande                 -> page publique : le formulaire de commande (aucun compte,
//                                     aucun accès à MITMIT ; c'est le seul lien du client).
//   POST /api/state?bdc=1          -> dépôt d'une commande par le client (public, sans jeton).
//   GET  /api/state?bdc=1&list=1   -> commandes reçues et non traitées (Clerk obligatoire).
//   POST /api/state?bdc=1 {action:"traite"|"ignore"} -> clôture d'une commande (Clerk obligatoire).
//
// Côté MITMIT, la relève est automatique : l'application transforme chaque commande reçue en
// DEVIS BROUILLON, puis appelle « traite » avec la référence du devis créé.
//
// Rien n'est écrit dans l'état partagé (cockpit_state) par ce relais : les commandes vivent dans
// leur propre table (bons_commande), et c'est l'application — seule à savoir fusionner l'état
// partagé sans écraser une session ouverte ailleurs — qui crée le devis.
//
// Variables d'environnement (Vercel) :
//   SUPABASE_URL (ou VITE_SUPABASE_URL) · SUPABASE_SERVICE_ROLE_KEY · CLERK_SECRET_KEY
//   BON_COMMANDE_TOKEN (facultatif) : si défini, le lien public exige ?k=<jeton>.

// ===== Identité et conditions commerciales =====
// Reprises à l'identique du modèle « Bon de commande revendeur » de MITMIT (BonCommandeDoc dans
// src/App.jsx) : mêmes champs, mêmes mentions, mêmes seuils. Toute évolution doit être répercutée
// des deux côtés — le client et le document imprimé doivent dire la même chose.
const SOCIETE = {
  nom: "PEN'UP 3D",
  raison: "Pen'Up 3D SAS",
  adresse: "20 Place Prax Paris, 82000 Montauban",
  siret: "978 651 891 00035",
  rcs: "RCS Montauban 978 651 891",
  capital: "1 000 €",
  email: "matthis-anael@penup3d.com",
  tel: "+33 6 95 50 37 68",
};
const FRANCO_ZONES = {
  metropole: { label: "France métropolitaine", seuil: 300, part: 15 },
  monaco: { label: "Monaco", seuil: 600, part: 35 },
  corse: { label: "Corse", seuil: 760, part: 60 },
};
// Adresse du relais, appelée par la page publique pour déposer la commande. Elle passe par
// /api/state (voir l'en-tête) : la page, elle, reste servie sur l'URL lisible /commande.
const BDC_API = "/api/state?bdc=1";
const CAT_ORDER = ["Stylos & coffrets", "Kits", "Livrets", "Accessoires", "Bobines · lot de 12", "Bobines · lot de 4", "Bobines · lot de 3", "Bobines · à l'unité", "Autres"];

// Classement catalogue : copie conforme de prodBucket/prodCmp (src/App.jsx), pour que la grille en
// ligne présente les références dans l'ordre exact du bon de commande imprimé.
function prodBucket(p) {
  const c = (p.code || "").toUpperCase(); const d = (p.designation || "").toLowerCase();
  if (c === "PU3D-STYLO" || c.includes("-PACK-")) return 0;
  if (c.includes("-KIT-")) return 1;
  if (c.includes("-LIVRET-")) return 2;
  if (c.includes("-POCHO") || c.includes("-PROTEG") || c.includes("-ACCESS")) return 3;
  if (/^PU3D-FIL-/.test(c)) { if (/lot de 12/.test(d)) return 4; if (/lot de 4/.test(d)) return 5; if (/lot de 3/.test(d)) return 6; return 7; }
  return 8;
}
function prodSub(p) { const c = (p.code || "").toUpperCase(); if (c === "PU3D-STYLO") return 0; if (c.includes("-PACK-COMPLET")) return 1; if (c.includes("-PACK-DECOUVERTE")) return 2; if (c.includes("-PACK-")) return 3; return 9; }
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function prodCmp(a, b) { return (prodBucket(a) - prodBucket(b)) || (prodSub(a) - prodSub(b)) || norm(a.designation).localeCompare(norm(b.designation)); }
// Prix revendeur : prix de cession HT quand il est renseigné, sinon le prix public (même règle que
// bdcPU dans MITMIT). Aucune donnée interne (marge, poids, stock, ventes) ne sort d'ici.
const puHT = (p) => Number(p.cessionHT != null ? p.cessionHT : p.pvc) || 0;

function sbClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}

// Catalogue proposé au client : uniquement les références en vente, hors kits (comme le bon de
// commande imprimé), réduites aux champs nécessaires — code, désignation, prix HT.
async function chargerCatalogue(sb) {
  const { data, error } = await sb.from("cockpit_state").select("data").eq("id", "shared").maybeSingle();
  if (error) throw error;
  const products = (data && data.data && data.data.products) || [];
  const tva = (data && data.data && data.data.settings && data.data.settings.tva) || 20;
  const retenues = (data && data.data && data.data.settings && data.data.settings.bonCommandeRefs) || null;
  let vend = products.filter((p) => p && p.vendable && !(p.code || "").includes("-KIT-") && puHT(p) > 0);
  // La sélection enregistrée dans MITMIT (« Bon de commande revendeur ») pilote aussi la page en
  // ligne : ce qui n'y figure pas n'est pas proposé au client.
  if (Array.isArray(retenues) && retenues.length) {
    const garde = new Set(retenues);
    const filtre = vend.filter((p) => garde.has(p.code));
    if (filtre.length) vend = filtre;
  }
  vend.sort(prodCmp);
  const m = {};
  // La vignette voyage avec la référence : embarquée dans la page, elle s'affiche sans requête
  // supplémentaire. Un produit sans photo reçoit une pastille neutre plutôt qu'une image cassée.
  vend.forEach((p) => { const g = CAT_ORDER[prodBucket(p)]; (m[g] = m[g] || []).push({ code: p.code, designation: p.designation || p.code, pu: puHT(p), img: PRODUCT_IMG[p.code] || "" }); });
  return { catalogue: CAT_ORDER.filter((g) => m[g]).map((g) => ({ groupe: g, items: m[g] })), tva };
}

async function authClerk(req) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return true; // développement local sans Clerk
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok) return false;
  try { await verifyToken(tok, { secretKey: secret }); return true; } catch (e) { return false; }
}

const clean = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 200);
const escapeHtml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Injection sûre d'un objet dans une balise <script> : </script> ne peut pas fermer la balise.
const toScriptJSON = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const ipHash = (req) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.headers["x-real-ip"] || "";
  if (!ip) return "";
  return createHash("sha256").update(ip + "|" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "sel")).digest("hex").slice(0, 32);
};
// Message d'erreur enrichi. « Invalid API key » ne dit pas SI la clé est fausse ou seulement
// tronquée, et une variable marquée « Sensitive » sur Vercel ne se relit plus : impossible de
// vérifier autrement qu'en la réécrivant à l'aveugle. On y joint donc la LONGUEUR de la clé
// configurée et la présence d'espaces autour — jamais son contenu. Une clé service_role fait un peu
// plus de 200 caractères : 40 caractères annoncent un copier-coller coupé, sans autre enquête.
function decrireErreur(e) {
  const msg = (e && e.message) ? e.message : String(e);
  if (!/invalid api key/i.test(msg)) return msg;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const projet = (url.match(/^https?:\/\/([a-z0-9-]+)\./i) || [])[1] || "?";
  return msg + " — clé de " + cle.length + " caractères"
    + (cle !== cle.trim() ? ", espaces ou saut de ligne autour" : "")
    + (cle && !cle.startsWith("eyJ") && !cle.startsWith("sb_secret") ? ", format inattendu" : "")
    + ", projet « " + projet + " »";
}
// Référence lisible d'une commande reçue, ex. BC-20260813-4F2A : c'est elle qui est annoncée au
// client à l'écran et reprise dans la note du devis brouillon, pour rapprocher les deux sans effort.
function refCommande() {
  const d = new Date();
  const j = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return "BC-" + j + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Point d'entrée appelé par /api/state dès que le paramètre « bdc » est présent.
export default async function bonCommandeHandler(req, res) {
  // HEAD est traité comme GET : c'est la requête qu'envoient les vérificateurs de lien, les sondes
  // de supervision et « curl -I ». Y répondre « méthode non autorisée » sur une page publique
  // laisserait croire le lien mort. Node retire lui-même le corps de la réponse à une requête HEAD.
  if (req.method === "HEAD") req = Object.create(req, { method: { value: "GET" } });
  // La page publique est vue par un client, jamais par nous : une panne de configuration doit lui
  // parler, pas lui montrer du JSON. Les appels techniques, eux, gardent le message exact — c'est
  // lui qui dit quoi réparer.
  const pagePublique = req.method === "GET" && !(req.query && (req.query.list || req.query.liste));
  const sb = sbClient();
  if (!sb) {
    if (pagePublique) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(503).send(pageMessage("Formulaire momentanément indisponible", "Merci de réessayer dans quelques minutes, ou de nous adresser votre commande à " + SOCIETE.email + "."));
      return;
    }
    res.status(500).json({ error: "Supabase service role non configuré côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." });
    return;
  }
  const attendu = process.env.BON_COMMANDE_TOKEN || "";

  try {
    if (req.method === "GET") {
      // --- Relève côté MITMIT (authentifiée) ---
      if (req.query && (req.query.list || req.query.liste)) {
        if (!(await authClerk(req))) { res.status(401).json({ error: "Non authentifié." }); return; }
        const tous = req.query.tous === "1";
        let q = sb.from("bons_commande").select("id, ref, created_at, statut, client, lignes, total_ht, deal_id, deal_ref").order("created_at", { ascending: false }).limit(tous ? 200 : 50);
        if (!tous) q = q.eq("statut", "nouveau");
        const { data, error } = await q;
        if (error) throw error;
        res.status(200).json({ commandes: data || [] });
        return;
      }
      // --- Page publique ---
      if (attendu && (!req.query || req.query.k !== attendu)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(403).send(pageMessage("Lien incomplet", "Ce bon de commande s'ouvre avec le lien complet qui vous a été transmis. Contactez-nous à " + SOCIETE.email + " pour le recevoir à nouveau."));
        return;
      }
      const { catalogue, tva } = await chargerCatalogue(sb);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(200).send(pageCommande(catalogue, tva, attendu ? req.query.k : ""));
      return;
    }

    if (req.method === "POST") {
      let body = {};
      try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch (e) { body = {}; }

      // --- Clôture ou suppression d'une commande par MITMIT (authentifiée) ---
      if (body.action) {
        if (!(await authClerk(req))) { res.status(401).json({ error: "Non authentifié." }); return; }
        if (!body.id) { res.status(400).json({ error: "Identifiant manquant." }); return; }
        // Suppression définitive : sert à effacer une commande d'essai, ou une commande erronée.
        // La ligne disparaît du journal ; le devis qu'elle a produit est supprimé côté application,
        // où il rejoint la corbeille et reste donc récupérable trente jours.
        if (body.action === "supprimer") {
          const { error } = await sb.from("bons_commande").delete().eq("id", body.id);
          if (error) throw error;
          res.status(200).json({ ok: true });
          return;
        }
        const statut = body.action === "ignore" ? "ignore" : "traite";
        const { error } = await sb.from("bons_commande")
          .update({ statut, deal_id: clean(body.dealId, 60) || null, deal_ref: clean(body.dealRef, 40) || null, traite_at: new Date().toISOString() })
          .eq("id", body.id);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      // --- Dépôt d'une commande par le client (public) ---
      if (attendu && body.k !== attendu) { res.status(403).json({ error: "Lien invalide." }); return; }
      if (clean(body.website, 50)) { res.status(200).json({ ok: true, ref: refCommande() }); return; } // piège à robots : accusé de réception sans enregistrement

      const emp = ipHash(req);
      if (emp) {
        const depuis = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        // L'erreur est relevée, pas ignorée : sans cela, une base injoignable ou une clé invalide
        // faisaient silencieusement passer le compteur à zéro — le garde-fou anti-rafale sautait
        // sans bruit, et la panne se cachait jusqu'à un appel plus loin.
        const { count, error } = await sb.from("bons_commande").select("id", { count: "exact", head: true }).eq("ip_hash", emp).gte("created_at", depuis);
        if (error) throw error;
        if ((count || 0) >= 8) { res.status(429).json({ error: "Trop de commandes envoyées coup sur coup. Réessayez dans quelques minutes." }); return; }
      }

      const client = {
        raisonSociale: clean(body.raisonSociale, 160),
        enseigne: clean(body.enseigne, 160),
        contact: clean(body.contact, 120),
        email: clean(body.email, 160),
        tel: clean(body.tel, 40),
        siret: clean(body.siret, 60),
        tvaIntra: clean(body.tvaIntra, 40),
        adresseLivraison: clean(body.adresseLivraison, 300),
        adresseFacturation: clean(body.adresseFacturation, 300),
        refClient: clean(body.refClient, 80),
        dateSouhaitee: clean(body.dateSouhaitee, 20),
        message: clean(body.message, 1000),
      };
      const manquants = [];
      if (!client.raisonSociale) manquants.push("raison sociale");
      if (!client.contact) manquants.push("nom du contact");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) manquants.push("courriel valide");
      if (!client.adresseLivraison) manquants.push("adresse de livraison");
      if (manquants.length) { res.status(400).json({ error: "Champs à compléter : " + manquants.join(", ") + "." }); return; }

      // Les lignes sont revalidées ICI contre le catalogue : ni code inconnu, ni prix envoyé par le
      // navigateur ne sont acceptés. C'est le serveur qui fixe la désignation et le prix HT.
      const { catalogue } = await chargerCatalogue(sb);
      const cat = {}; catalogue.forEach((g) => g.items.forEach((it) => { cat[it.code] = it; }));
      const brutes = Array.isArray(body.lignes) ? body.lignes.slice(0, 200) : [];
      const lignes = [];
      brutes.forEach((l) => {
        const code = clean(l && l.code, 60); const it = cat[code];
        const qte = Math.min(99999, Math.max(0, Math.round(Number(l && l.qte) || 0)));
        if (it && qte > 0) lignes.push({ code, designation: it.designation, qte, pu: it.pu });
      });
      if (!lignes.length) { res.status(400).json({ error: "Aucune quantité saisie." }); return; }
      const totalHt = lignes.reduce((s, l) => s + l.qte * l.pu, 0);

      const ref = refCommande();
      const { error } = await sb.from("bons_commande").insert({
        ref, statut: "nouveau", client, lignes, total_ht: Math.round(totalHt * 100) / 100, ip_hash: emp || null,
        meta: { ua: clean(req.headers["user-agent"], 200), source: "lien public" },
      });
      if (error) throw error;
      res.status(200).json({ ok: true, ref });
      return;
    }

    res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    const msg = decrireErreur(e);
    if (req.method === "GET" && !(req.query && (req.query.list || req.query.liste))) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Le client lit une page rassurante ; le motif réel part dans un en-tête. Sans lui, une panne
      // de configuration ne se distingue pas d'une base en rade : il a fallu sonder l'API par
      // l'envoi d'une commande factice pour découvrir un simple « Invalid API key ».
      // « curl -I https://…/commande » suffit désormais à le lire.
      // Un en-tête HTTP ne transporte que de l'ASCII. On translittère donc les accents au lieu de
      // les remplacer par des espaces, sans quoi « clé de 220 caractères » arrivait en « cl de 220
      // caract res » — le diagnostic devenait plus pénible à lire que la panne elle-même.
      res.setHeader("X-Bdc-Error", String(msg).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[«»]/g, '"').replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200));
      res.status(502).send(pageMessage("Formulaire momentanément indisponible", "Merci de réessayer dans quelques minutes, ou de nous adresser votre commande à " + SOCIETE.email + "."));
      return;
    }
    res.status(502).json({ error: "Bon de commande indisponible : " + msg });
  }
}

// ===== Pages =====
const CSS = `
:root{--blue:#3F60AA;--blue-d:#2c4582;--orange:#EE7E3A;--yellow:#F8B133;--ink:#1E2533;--muted:#6b7589;--line:#e7e9f0;--bg:#f5f6fb;--soft:#eef2fb;--green:#2bb673;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased;background-image:radial-gradient(circle at 12% 8%,rgba(63,96,170,.06),transparent 38%),radial-gradient(circle at 88% 4%,rgba(238,126,58,.07),transparent 34%);background-attachment:fixed;padding-bottom:104px;}
.wrap{max-width:880px;margin:0 auto;padding:0 18px;}
header{padding:34px 0 18px;}
.brandline{display:flex;align-items:center;gap:13px;}
/* Le vrai logo, celui des devis imprimés : un « P » dans un carré dégradé tenait lieu de marque
   faute de mieux, alors que l'image existait déjà dans l'application. Le logo portant déjà le nom,
   il ne reste à côté que la baseline. */
/* Le PNG du logo n'a pas de couche de transparence : posé tel quel sur le fond teinté de la page,
   il traînait un rectangle blanc derrière lui. Le mode « multiply » fait disparaître ce blanc dans
   le fond — clair ici — sans toucher aux couleurs du logo, et sans retoucher l'image elle-même,
   qui sert aussi aux documents imprimés sur papier blanc. */
.logo{height:54px;width:auto;display:block;mix-blend-mode:multiply;}
.brandline .baseline{font-size:13px;color:var(--muted);font-weight:600;align-self:center;}
@media(max-width:560px){.brandline{flex-wrap:wrap;}.logo{height:46px;}.brandline .baseline{flex:1 1 100%;}}
.brandtxt b{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:19px;display:block;line-height:1.1;}
.brandtxt span{font-size:12.5px;color:var(--muted);font-weight:600;}
h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:32px;letter-spacing:-.02em;margin:20px 0 6px;line-height:1.1;}
h1 .em{color:var(--orange);}
.lead{color:var(--muted);font-size:14.5px;max-width:64ch;}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;margin:16px 0;box-shadow:0 1px 2px rgba(30,37,51,.03);}
.sec-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:17px;margin-bottom:3px;}
.sec-sub{color:var(--muted);font-size:13px;margin-bottom:15px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
@media(max-width:620px){.grid2{grid-template-columns:1fr;}}
label{display:block;font-size:11.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;}
.req::after{content:" *";color:var(--orange);}
input,textarea{width:100%;font-family:inherit;font-size:14.5px;color:var(--ink);border:1.5px solid var(--line);border-radius:11px;padding:11px 13px;background:#fff;transition:.15s;}
input:focus,textarea:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(63,96,170,.12);}
input.err{border-color:var(--orange);background:#fff8f3;}
textarea{resize:vertical;min-height:62px;}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}
.grp{margin:22px 0 4px;}
.grp-h{display:flex;align-items:baseline;gap:10px;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;padding-bottom:8px;border-bottom:2px solid var(--soft);margin-bottom:2px;}
.grp-h .cnt{font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;color:var(--muted);}
.row{display:flex;align-items:center;gap:12px;padding:11px 6px;border-bottom:1px solid var(--line);}
.row:last-child{border-bottom:0;}
.thumb{width:52px;height:52px;border-radius:10px;object-fit:cover;border:1px solid var(--line);background:#fff;flex-shrink:0;}
.thumb.ph{background:linear-gradient(135deg,var(--soft),#fff);}
.row.head .sp{width:52px;flex-shrink:0;}
.row .nm{flex:1;min-width:0;}
.row .nm b{font-weight:700;font-size:14.5px;display:block;}
.row .nm code{font-size:11.5px;color:var(--muted);font-family:ui-monospace,Menlo,monospace;}
.row .pu{font-weight:800;font-size:14px;white-space:nowrap;min-width:86px;text-align:right;font-variant-numeric:tabular-nums;}
.row .lt{font-size:12px;color:var(--muted);min-width:92px;text-align:right;font-variant-numeric:tabular-nums;}
.stepper{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:11px;overflow:hidden;flex-shrink:0;}
.stepper button{width:36px;height:40px;border:0;background:#fff;cursor:pointer;font-size:19px;font-weight:700;color:var(--blue);font-family:inherit;}
.stepper button:hover{background:var(--soft);}
.stepper input{width:52px;height:40px;border:0;border-left:1.5px solid var(--line);border-right:1.5px solid var(--line);border-radius:0;text-align:center;font-weight:800;padding:0;font-size:15px;}
.stepper input:focus{box-shadow:none;}
.row.has-qty{background:linear-gradient(90deg,rgba(238,126,58,.06),transparent);border-radius:10px;}
.row.has-qty .nm b{color:var(--blue-d);}
.row.has-qty .lt{color:var(--ink);font-weight:700;}
/* En-tête de colonnes, repris au début de chaque famille : sans lui, le prix unitaire et le total
   de la ligne n'étaient que deux montants côte à côte, sans rien qui dise lequel est lequel. */
.row.head{padding:4px 6px 7px;border-bottom:1px solid var(--line);font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.row.head .qte{width:127px;flex-shrink:0;text-align:center;}
@media(max-width:560px){
  /* La vignette et le nom restent sur la même ligne : la laisser seule au-dessus du produit
     gaspillait une ligne entière sur un écran étroit. */
  .row{flex-wrap:wrap;}.row .nm{flex:1 1 calc(100% - 64px);}.row .lt{min-width:0;}
  /* Les colonnes se replient : l'en-tête n'aurait plus rien à surmonter, chaque montant porte
     donc son propre libellé. */
  .row.head{display:none;}
  .row .pu::before{content:"PU HT ";font-weight:600;color:var(--muted);font-size:11px;}
  .row .lt::before{content:"Total ";font-weight:600;font-size:11px;}
}
.cond{border:1px solid var(--blue);border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.65;}
.cond h3{font-family:'Bricolage Grotesque',sans-serif;color:var(--blue);font-size:13.5px;margin-bottom:5px;letter-spacing:.04em;}
.cond b{color:var(--ink);}
.mentions{font-size:11.5px;color:var(--muted);line-height:1.7;margin-top:14px;}
.tot{display:flex;justify-content:space-between;padding:6px 0;font-size:13.5px;}
.tot .lab{color:var(--muted);}
/* Le montant ne se coupe jamais : « Frais de port HT · France métropolitaine » est assez long pour
   rejeter « 15,00 € » sur deux lignes, l'euro se retrouvant seul sous la somme. */
.tot strong{font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:10px;}
.tot .lab{min-width:0;}
.tot.big{background:var(--blue);color:#fff;border-radius:10px;padding:10px 14px;margin-top:6px;font-size:15px;}
.tot.big .lab{color:#dce4f6;}
.bar{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-top:1px solid var(--line);box-shadow:0 -4px 20px rgba(30,37,51,.07);z-index:30;}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 18px;}
.tally{font-size:13.5px;font-weight:700;}
.tally b{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;color:var(--blue);}
.tally .fr{display:block;font-size:11.5px;font-weight:600;color:var(--muted);}
.btn{display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;font-family:inherit;font-weight:800;font-size:14.5px;padding:12px 22px;border-radius:13px;}
.btn-p{background:linear-gradient(100deg,var(--blue),var(--orange));color:#fff;box-shadow:0 5px 16px rgba(63,96,170,.3);}
.btn-p:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;}
.btn-g{background:var(--soft);color:var(--blue-d);}
footer{text-align:center;color:var(--muted);font-size:11.5px;padding:18px 0 8px;line-height:1.7;}
/* Écran de chargement : la page se construit en JavaScript (grille du catalogue, totaux), et sur une
   connexion lente le client verrait d'abord un formulaire sans produits. Les bobines tournent le
   temps que la grille soit prête.
   Le voile s'affiche IMMÉDIATEMENT et tient une durée minimale (voir plus bas). Une première
   version le retardait de 150 ms pour éviter tout clignotement : la page étant servie prête, images
   comprises, la grille se construisait en quelques millisecondes et le voile n'apparaissait jamais.
   L'animation existait, personne ne la voyait. */
#chargement{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:var(--bg);opacity:1;}
#chargement.parti{opacity:0!important;pointer-events:none;transition:opacity .35s;}
#chargement .bobines{width:132px;height:132px;animation:bdc-tournoie 1.6s linear infinite;transform-origin:50% 50%;}
@keyframes bdc-tournoie{to{transform:rotate(360deg);}}
#chargement .txt{font-size:13.5px;font-weight:800;color:var(--muted);letter-spacing:.02em;}
/* Une rotation continue gêne certaines personnes : on la retire quand le système le demande. */
@media(prefers-reduced-motion:reduce){#chargement .bobines{animation:none;}}
.msg{margin:10px 0 0;font-size:13px;font-weight:700;color:var(--orange);}
.ok{max-width:620px;margin:8vh auto;text-align:center;background:#fff;border:1px solid var(--line);border-radius:20px;padding:34px 28px;box-shadow:0 12px 40px rgba(20,32,58,.1);}
.ok .pastille{width:58px;height:58px;border-radius:50%;background:rgba(43,182,115,.12);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 14px;}
.ok h2{font-family:'Bricolage Grotesque',sans-serif;font-size:23px;margin-bottom:8px;}
.ok p{color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:10px;}
.ok .ref{display:inline-block;font-weight:800;background:var(--soft);color:var(--blue-d);border-radius:9px;padding:7px 14px;font-size:14px;margin:6px 0 14px;}
`;

function pageMessage(titre, texte) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex, nofollow" /><title>${escapeHtml(titre)} — ${escapeHtml(SOCIETE.nom)}</title><style>${CSS}</style></head><body><div class="ok"><h2>${escapeHtml(titre)}</h2><p>${escapeHtml(texte)}</p></div></body></html>`;
}

function pageCommande(catalogue, tva, jeton) {
  const z = FRANCO_ZONES;
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Bon de commande revendeur — ${escapeHtml(SOCIETE.nom)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>
<!-- Trois bobines Fil'Up entrelacées, dessinées en SVG : quelques lignes plutôt qu'une photo à
     charger, nettes à toutes les tailles, et la rotation reste fluide. Les couleurs sont celles du
     lot Nature — vert, brun, bleu. -->
<div id="chargement" role="status" aria-live="polite">
  <svg class="bobines" viewBox="0 0 130 130" aria-hidden="true">
    <defs>
      <!-- Une bobine : l'anneau de couleur, puis de fines hachures blanches qui figurent les spires. -->
      <g id="bobine">
        <circle r="26" fill="none" stroke-width="13" />
        <circle r="26" fill="none" stroke-width="13" stroke-dasharray="2 5" stroke-opacity=".38" stroke="#fff" />
      </g>
    </defs>
    <!-- Empilées comme sur la photo : le bleu derrière, le brun au milieu, le vert devant. -->
    <g transform="translate(65 65)">
      <use href="#bobine" x="27" stroke="#2BA8DC" />
      <use href="#bobine" x="0" stroke="#8B5A3C" />
      <use href="#bobine" x="-27" stroke="#3FA85F" />
    </g>
  </svg>
  <div class="txt">Chargement du catalogue…</div>
</div>
<!-- Sans JavaScript, la grille ne se construit pas et le voile ne se retirerait jamais : il ne doit
     alors pas masquer le formulaire, où figurent nos coordonnées pour commander autrement. -->
<noscript><style>#chargement{display:none;}</style></noscript>
<div class="wrap" id="form">
<header>
  <div class="brandline"><img class="logo" src="${LOGO_DATA_URI}" alt="${escapeHtml(SOCIETE.nom)}" /><span class="baseline">Stylos 3D &amp; loisirs créatifs pour enfants</span></div>
  <h1>Bon de commande <span class="em">revendeur</span></h1>
  <p class="lead">Renseignez vos coordonnées et les quantités souhaitées. Nous vous adresserons en retour un devis chiffré et détaillé pour validation. Tous nos produits sont conformes aux normes jouets en vigueur (CE, EN 71).</p>
</header>

<div class="card">
  <div class="sec-title">Vos coordonnées</div>
  <div class="sec-sub">Pour établir le devis au bon nom et livrer à la bonne adresse.</div>
  <div class="grid2">
    <!-- Aucun nom d'entreprise en exemple : inventer une raison sociale, c'est risquer de désigner
         une société qui existe. L'indication dit où trouver la sienne, ce qui la distingue en outre
         du champ suivant (l'enseigne du magasin, souvent différente). -->
    <div><label class="req" for="f_raisonSociale">Raison sociale</label><input id="f_raisonSociale" autocomplete="organization" placeholder="Tel qu'inscrit au registre du commerce" /></div>
    <div><label for="f_enseigne">Magasin / Enseigne</label><input id="f_enseigne" placeholder="Nom du point de vente ou du réseau" /></div>
    <div><label class="req" for="f_contact">Nom du contact</label><input id="f_contact" autocomplete="name" placeholder="Prénom Nom" /></div>
    <div><label class="req" for="f_email">Email</label><input id="f_email" type="email" autocomplete="email" placeholder="vous@votre-magasin.fr" /></div>
    <div><label for="f_tel">Téléphone</label><input id="f_tel" type="tel" autocomplete="tel" placeholder="06 12 34 56 78" /></div>
    <div><label for="f_siret">N° SIRET</label><input id="f_siret" placeholder="14 chiffres" /></div>
    <div><label for="f_tvaIntra">TVA intracommunautaire</label><input id="f_tvaIntra" placeholder="FR00 000000000" /></div>
    <div><label for="f_refClient">Votre référence de commande</label><input id="f_refClient" placeholder="Facultatif" /></div>
  </div>
  <div style="margin-top:13px"><label class="req" for="f_adresseLivraison">Adresse de livraison</label><textarea id="f_adresseLivraison" placeholder="N°, voie, code postal, ville"></textarea></div>
  <div style="margin-top:13px"><label for="f_adresseFacturation">Adresse de facturation (si différente)</label><textarea id="f_adresseFacturation" placeholder="Laissez vide si identique à l'adresse de livraison"></textarea></div>
  <div class="grid2" style="margin-top:13px">
    <div><label for="f_dateSouhaitee">Date de livraison souhaitée</label><input id="f_dateSouhaitee" type="date" /></div>
    <div><label for="f_message">Message</label><input id="f_message" placeholder="Précision, contexte du point de vente…" /></div>
  </div>
  <div class="hp" aria-hidden="true"><label for="f_website">Ne pas remplir</label><input id="f_website" tabindex="-1" autocomplete="off" /></div>
</div>

<div class="card">
  <div class="sec-title">Votre sélection</div>
  <div class="sec-sub">Prix unitaires hors taxes, réservés aux revendeurs. Laissez à 0 ce qui ne vous intéresse pas.</div>
  <div id="catalog"></div>
  <div style="margin-top:18px;max-width:320px;margin-left:auto">
    <div class="tot"><span class="lab">Total marchandise HT</span><strong id="tHt">0,00 €</strong></div>
    <div class="tot"><span class="lab" id="labPort">Frais de port HT</span><strong id="tPort">—</strong></div>
    <div class="tot"><span class="lab">TVA ${escapeHtml(String(tva))} %</span><strong id="tTva">0,00 €</strong></div>
    <div class="tot big"><span class="lab">Total TTC estimé</span><strong id="tTtc">0,00 €</strong></div>
  </div>
  <div class="mentions">Montants donnés à titre indicatif : seul le devis que nous vous adresserons fait foi.</div>
</div>

<div class="card">
  <div class="cond">
    <h3>CONDITIONS</h3>
    <div><b>Livraison :</b> franco ${z.metropole.seuil} € HT France métropolitaine, participation ${z.metropole.part} € HT en dessous (Monaco ${z.monaco.seuil} € HT, participation ${z.monaco.part} € HT · Corse ${z.corse.seuil} € HT, participation ${z.corse.part} € HT).</div>
    <div><b>Paiement :</b> première commande à régler à la commande. Des conditions à 30 jours date de facture peuvent être mises en place après ouverture de compte et validation du dossier.</div>
    <div><b>Validité :</b> le devis établi en retour est valable 30 jours.</div>
  </div>
  <div class="mentions">
    Cette sélection vaut demande de commande ; elle sera confirmée par notre devis, soumis à nos CGV.<br />
    Pénalités de retard : trois fois le taux d'intérêt légal ; indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du code de commerce). Pas d'escompte pour paiement anticipé.<br />
    Les informations saisies servent uniquement à établir votre devis et à assurer le suivi commercial. Pour y accéder, les rectifier ou les faire supprimer : ${escapeHtml(SOCIETE.email)}.
  </div>
  <div class="msg" id="msg" style="display:none"></div>
</div>

<footer>
  ${escapeHtml(SOCIETE.raison)} · ${escapeHtml(SOCIETE.adresse)} · SIRET ${escapeHtml(SOCIETE.siret)}<br />
  ${escapeHtml(SOCIETE.email)} · ${escapeHtml(SOCIETE.tel)} · SAS au capital de ${escapeHtml(SOCIETE.capital)} · ${escapeHtml(SOCIETE.rcs)}
</footer>
</div>

<div class="bar" id="bar"><div class="wrap">
  <div class="tally"><b id="tCount">0</b> article(s) · <span id="tRefs">0</span> référence(s)<span class="fr" id="tFranco">Franco de port dès ${z.metropole.seuil} € HT</span></div>
  <button class="btn btn-p" id="envoyer" disabled>Envoyer ma commande</button>
</div></div>

<div class="wrap" id="confirme" style="display:none"></div>

<script>
var CATALOGUE = ${toScriptJSON(catalogue)};
var TVA = ${Number(tva) || 20};
var JETON = ${toScriptJSON(jeton || "")};
var FRANCO = ${toScriptJSON(FRANCO_ZONES)};
var EMAIL = ${toScriptJSON(SOCIETE.email)};
var API = ${toScriptJSON(BDC_API)};
var PRIX = {}, NOMS = {}, qty = {};
CATALOGUE.forEach(function (g) { g.items.forEach(function (it) { PRIX[it.code] = it.pu; NOMS[it.code] = it.designation; }); });

function eur(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
function val(id) { var e = document.getElementById("f_" + id); return e ? (e.value || "").trim() : ""; }

// Zone de livraison déduite du code postal saisi (Corse 20xxx, Monaco 98000, sinon métropole) :
// le seuil de franco affiché est celui qui s'appliquera réellement.
function zone() {
  var m = (val("adresseLivraison") || "").match(/\\b(\\d{5})\\b/);
  if (!m) return FRANCO.metropole;
  if (m[1].indexOf("20") === 0) return FRANCO.corse;
  if (m[1] === "98000") return FRANCO.monaco;
  return FRANCO.metropole;
}

var catEl = document.getElementById("catalog");
CATALOGUE.forEach(function (g) {
  var bloc = document.createElement("div"); bloc.className = "grp";
  var h = document.createElement("div"); h.className = "grp-h";
  h.appendChild(document.createTextNode(g.groupe));
  var cnt = document.createElement("span"); cnt.className = "cnt"; cnt.textContent = g.items.length + " réf."; h.appendChild(cnt);
  bloc.appendChild(h);
  var entete = document.createElement("div"); entete.className = "row head";
  [["sp", ""], ["nm", "Produit"], ["pu", "Prix unitaire HT"], ["qte", "Quantité"], ["lt", "Total HT"]].forEach(function (c) {
    var d = document.createElement("div"); d.className = c[0]; d.textContent = c[1]; entete.appendChild(d);
  });
  bloc.appendChild(entete);
  g.items.forEach(function (it) {
    var r = document.createElement("div"); r.className = "row";
    // La photo aide à commander : sur une gamme de bobines, le coloris se reconnaît d'un coup d'œil
    // là où « Lot de 4 bobines Fil'Up Galaxie » demande un effort de mémoire.
    var vig;
    if (it.img) { vig = document.createElement("img"); vig.className = "thumb"; vig.src = it.img; vig.alt = it.designation; vig.loading = "lazy"; }
    else { vig = document.createElement("div"); vig.className = "thumb ph"; }
    var nm = document.createElement("div"); nm.className = "nm";
    var b = document.createElement("b"); b.textContent = it.designation;
    var c = document.createElement("code"); c.textContent = it.code;
    nm.appendChild(b); nm.appendChild(c);
    var pu = document.createElement("div"); pu.className = "pu"; pu.textContent = eur(it.pu) + " HT";
    var st = document.createElement("div"); st.className = "stepper";
    var moins = document.createElement("button"); moins.type = "button"; moins.textContent = "−"; moins.setAttribute("aria-label", "Retirer un " + it.designation);
    var input = document.createElement("input"); input.type = "number"; input.min = "0"; input.value = "0"; input.setAttribute("inputmode", "numeric"); input.setAttribute("aria-label", "Quantité — " + it.designation);
    var plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "Ajouter un " + it.designation);
    st.appendChild(moins); st.appendChild(input); st.appendChild(plus);
    var lt = document.createElement("div"); lt.className = "lt"; lt.textContent = "—";
    r.appendChild(vig); r.appendChild(nm); r.appendChild(pu); r.appendChild(st); r.appendChild(lt);
    function set(v) {
      v = Math.max(0, Math.min(99999, parseInt(v || 0, 10) || 0));
      qty[it.code] = v; input.value = v;
      r.className = v > 0 ? "row has-qty" : "row";
      lt.textContent = v > 0 ? eur(v * it.pu) : "—";
      refresh();
    }
    moins.addEventListener("click", function () { set((qty[it.code] || 0) - 1); });
    plus.addEventListener("click", function () { set((qty[it.code] || 0) + 1); });
    input.addEventListener("input", function () { set(input.value); });
    bloc.appendChild(r);
  });
  catEl.appendChild(bloc);
});

var tCount = document.getElementById("tCount"), tRefs = document.getElementById("tRefs"), tFranco = document.getElementById("tFranco"), envoyer = document.getElementById("envoyer");
function refresh() {
  var c = 0, r = 0, ht = 0;
  Object.keys(qty).forEach(function (k) { if (qty[k] > 0) { c += qty[k]; r++; ht += qty[k] * PRIX[k]; } });
  var z = zone();
  var port = (ht > 0 && ht < z.seuil) ? z.part : 0;
  var tva = (ht + port) * TVA / 100;
  tCount.textContent = c; tRefs.textContent = r;
  document.getElementById("tHt").textContent = eur(ht);
  document.getElementById("labPort").textContent = "Frais de port HT · " + z.label;
  document.getElementById("tPort").textContent = ht === 0 ? "—" : (port > 0 ? eur(port) : "Franco (offert)");
  document.getElementById("tTva").textContent = eur(tva);
  document.getElementById("tTtc").textContent = eur(ht + port + tva);
  tFranco.textContent = ht === 0 ? ("Franco de port dès " + z.seuil + " € HT (" + z.label + ")")
    : (port > 0 ? ("Encore " + eur(z.seuil - ht) + " HT pour le franco de port") : "Franco de port atteint : livraison offerte");
  envoyer.disabled = (r === 0);
}
refresh();
document.getElementById("f_adresseLivraison").addEventListener("input", refresh);
// La grille est construite : le voile s'efface, puis il est retiré du document pour ne pas laisser
// une animation tourner indéfiniment derrière la page.
//
// Durée minimale d'affichage : la page arrive prête, images comprises, et la grille se construit en
// quelques millisecondes. Sans ce plancher, le voile disparaissait avant d'avoir été vu — autant ne
// pas l'avoir. On compte depuis l'ouverture de la page (performance.now), donc un chargement lent ne
// s'allonge de rien : le plancher est déjà dépassé quand la grille est prête.
var BDC_VISIBLE_MS = 900;
(function () {
  var voile = document.getElementById("chargement");
  if (!voile) return;
  var reste = Math.max(0, BDC_VISIBLE_MS - (window.performance && performance.now ? performance.now() : 0));
  setTimeout(function () {
    voile.classList.add("parti");
    setTimeout(function () { if (voile.parentNode) voile.parentNode.removeChild(voile); }, 450);
  }, reste);
})();

var msg = document.getElementById("msg");
function erreur(t) { msg.textContent = t; msg.style.display = "block"; }
var REQUIS = [["raisonSociale", "la raison sociale"], ["contact", "le nom du contact"], ["email", "le courriel"], ["adresseLivraison", "l'adresse de livraison"]];

envoyer.addEventListener("click", function () {
  msg.style.display = "none";
  var manque = [], premier = null;
  REQUIS.forEach(function (f) {
    var el = document.getElementById("f_" + f[0]); var vide = !val(f[0]);
    if (f[0] === "email" && !vide && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val("email"))) vide = true;
    el.className = vide ? "err" : "";
    if (vide) { manque.push(f[1]); if (!premier) premier = el; }
  });
  if (manque.length) { erreur("Merci de renseigner " + manque.join(", ") + "."); if (premier) { premier.focus(); premier.scrollIntoView({ block: "center", behavior: "smooth" }); } return; }

  var lignes = [];
  CATALOGUE.forEach(function (g) { g.items.forEach(function (it) { if (qty[it.code] > 0) lignes.push({ code: it.code, qte: qty[it.code] }); }); });
  if (!lignes.length) { erreur("Indiquez au moins une quantité."); return; }

  var corps = { k: JETON, lignes: lignes, website: val("website") };
  ["raisonSociale", "enseigne", "contact", "email", "tel", "siret", "tvaIntra", "adresseLivraison", "adresseFacturation", "refClient", "dateSouhaitee", "message"].forEach(function (n) { corps[n] = val(n); });

  envoyer.disabled = true; envoyer.textContent = "Envoi en cours…";
  fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (res) {
      if (!res.ok) throw new Error((res.j && res.j.error) || "Envoi impossible.");
      confirmer(res.j.ref, lignes);
    })
    .catch(function (e) {
      envoyer.disabled = false; envoyer.textContent = "Envoyer ma commande";
      erreur((e.message || "Envoi impossible.") + " Vous pouvez aussi nous écrire à " + EMAIL + ".");
    });
});

function confirmer(ref, lignes) {
  var ht = 0; lignes.forEach(function (l) { ht += l.qte * PRIX[l.code]; });
  document.getElementById("form").style.display = "none";
  document.getElementById("bar").style.display = "none";
  var recap = lignes.map(function (l) { return "<tr><td style=\\"padding:5px 0;text-align:left\\">" + NOMS[l.code] + "</td><td style=\\"padding:5px 0;text-align:right\\">" + l.qte + "</td><td style=\\"padding:5px 0;text-align:right\\">" + eur(l.qte * PRIX[l.code]) + "</td></tr>"; }).join("");
  var c = document.getElementById("confirme");
  c.style.display = "block";
  c.innerHTML = '<div class="ok"><div class="pastille">✓</div><h2>Commande bien reçue</h2>' +
    '<p>Merci ! Votre demande est enregistrée. Nous établissons votre devis chiffré et revenons vers vous à <b>' + val("email") + '</b>, en général sous 24 à 48 h ouvrées.</p>' +
    '<div class="ref">Référence ' + ref + '</div>' +
    '<table style="width:100%;font-size:13px;border-top:1px solid #e7e9f0;margin-bottom:12px"><tbody>' + recap +
    '<tr><td style="padding:8px 0;text-align:left;font-weight:800;border-top:1px solid #e7e9f0">Total marchandise HT</td><td style="border-top:1px solid #e7e9f0"></td><td style="padding:8px 0;text-align:right;font-weight:800;border-top:1px solid #e7e9f0">' + eur(ht) + '</td></tr>' +
    '</tbody></table>' +
    '<p style="font-size:12px">Cette sélection vaut demande de commande ; elle sera confirmée par notre devis, soumis à nos CGV. Une question&nbsp;? <a href="mailto:' + EMAIL + '" style="color:#3F60AA;font-weight:700">' + EMAIL + '</a></p>' +
    '<button class="btn btn-g" onclick="window.print()" style="margin-top:6px">Imprimer le récapitulatif</button></div>';
  window.scrollTo(0, 0);
}
</script>
</body></html>`;
}
