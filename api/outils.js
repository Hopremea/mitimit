import { verifyToken } from "@clerk/backend";
import dns from "node:dns/promises";
import net from "node:net";

// ===== Routeur d'outils =====
// Quatre services regroupés derriere UN SEUL point d'entree, pilotes par le champ « action » :
//   scrape    : lecture des coordonnees publiques sur le site d'un magasin (gratuit)
//   isochrone : zone atteignable en N minutes (OpenRouteService, cle ORS_API_KEY)
//   suivi     : suivi d'un colis Colissimo / La Poste (cle LAPOSTE_API_KEY)
//   batch:*   : lots de requetes Claude, factures 50 % moins cher (cle ANTHROPIC_API_KEY)
//
// Le regroupement n'est pas cosmetique : Vercel compte chaque fichier de api/ comme une fonction
// serverless, et le plan Hobby en autorise 12 par deploiement. Quatre fichiers separes faisaient
// passer le depot a 15 et cassaient le deploiement d'un des projets rattaches.
//
// Toutes les cles restent cote serveur et chaque action exige une session Clerk valide.
export const config = { maxDuration: 60 };

// ===== Garde-fous SSRF =====
// Cet endpoint va chercher une URL fournie par le client : sans contrôle, il permettrait d'atteindre
// le réseau interne de l'hébergeur (metadata cloud, services privés). On n'autorise donc que http/s
// vers une adresse IP PUBLIQUE, on refuse toute redirection sortant de ce cadre, et on borne la
// taille comme la durée de lecture.
const PRIVATE_V4 = [
  [10, 0, 0, 0, 8], [127, 0, 0, 0, 8], [169, 254, 0, 0, 16], [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16], [100, 64, 0, 0, 10], [192, 0, 0, 0, 24], [198, 18, 0, 0, 15], [0, 0, 0, 0, 8],
];
function isPrivateV4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const v = ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
  return PRIVATE_V4.some(([a, b, c, d, bits]) => {
    const base = ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (v & mask) >>> 0 === (base & mask) >>> 0;
  });
}
function isPrivateV6(ip) {
  const s = String(ip).toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fc") || s.startsWith("fd")) return true;      // unique local
  if (s.startsWith("fe80")) return true;                           // link-local
  if (s.startsWith("::ffff:")) return isPrivateV4(s.slice(7));     // IPv4 mappée
  return false;
}
// Vérifie qu'une URL est publique et exploitable ; renvoie l'URL normalisée ou null.
async function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/\.(local|internal|localhost)$/i.test(host) || host === "localhost") return null;
  // Une IP littérale doit être publique ; un nom doit résoudre vers une IP publique.
  if (net.isIP(host)) {
    if (net.isIPv4(host) ? isPrivateV4(host) : isPrivateV6(host)) return null;
  } else {
    let addrs;
    try { addrs = await dns.lookup(host, { all: true }); } catch (e) { return null; }
    if (!addrs.length) return null;
    if (addrs.some((a) => (a.family === 4 ? isPrivateV4(a.address) : isPrivateV6(a.address)))) return null;
  }
  return u;
}

const MAX_BYTES = 900 * 1024; // au-delà, une page de contact n'apporte plus rien d'utile
// Lecture d'une page avec redirections suivies MANUELLEMENT : chaque saut est revalidé (une
// redirection est le contournement classique d'un contrôle d'URL fait une seule fois au départ).
async function fetchPage(url, signal) {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const safe = await safeUrl(cur); if (!safe) return "";
    let res;
    try {
      res = await fetch(safe.href, {
        redirect: "manual", signal,
        headers: { "User-Agent": "MITMIT/1.0 (+contact lookup)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9" },
      });
    } catch (e) { return ""; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location"); if (!loc) return "";
      try { cur = new URL(loc, safe.href).href; } catch (e) { return ""; }
      continue;
    }
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) return "";
    // Lecture bornée : on coupe dès MAX_BYTES pour ne pas se faire tirer un flux infini.
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) { const t = await res.text(); return t.slice(0, MAX_BYTES); }
    const chunks = []; let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read(); if (done) break;
      chunks.push(value); size += value.length;
    }
    try { reader.cancel(); } catch (e) {}
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8").slice(0, MAX_BYTES);
  }
  return "";
}

// ===== Extraction =====
// Adresses de service, plateformes et fichiers : jamais des contacts de magasin.
const EMAIL_BLOCK = /(^|@)(no-?reply|ne-?pas-?repondre|postmaster|abuse|mailer-daemon|privacy|dpo|webmaster@wix|sentry|wixpress|example|domain|votresite|votre-site|email|adresse|nom)\b/i;
const EMAIL_BLOCK_HOST = /(sentry\.io|wixpress\.com|example\.(com|org|fr)|schema\.org|w3\.org|googlemail|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\.css|\.js)$/i;
function extractEmails(html) {
  const out = new Map(); // e-mail -> score (mailto: = source la plus fiable)
  const add = (raw, score) => {
    const e = String(raw || "").trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return;
    const host = e.split("@")[1] || "";
    if (EMAIL_BLOCK.test(e) || EMAIL_BLOCK_HOST.test(host) || EMAIL_BLOCK_HOST.test(e)) return;
    if (e.length > 90) return;
    out.set(e, Math.max(out.get(e) || 0, score));
  };
  (html.match(/mailto:[^"'>\s]+/gi) || []).forEach((m) => add(m, 3));
  // Anti-spam courant : « contact [at] magasin.fr » / « contact (arobase) magasin.fr ».
  const deob = html.replace(/\s*[\[(]\s*(at|arobase|@)\s*[\])]\s*/gi, "@").replace(/\s*[\[(]\s*(dot|point)\s*[\])]\s*/gi, ".");
  (deob.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).forEach((m) => add(m, 1));
  // Un e-mail générique (contact@, magasin@…) vaut mieux qu'une adresse nominative.
  const generic = /^(contact|info|infos|magasin|boutique|accueil|commande|commandes|hello|bonjour|direction|secretariat|administration|commercial)@/i;
  return [...out.entries()]
    .sort((a, b) => (generic.test(b[0]) ? 1 : 0) - (generic.test(a[0]) ? 1 : 0) || b[1] - a[1])
    .map(([e]) => e).slice(0, 5);
}
// Numéros français : format national (0X …) ou international (+33 …), tolérant aux séparateurs.
function extractPhones(html) {
  const out = new Map();
  const add = (raw, score) => {
    let d = String(raw || "").replace(/[^\d+]/g, "");
    if (d.startsWith("0033")) d = "+33" + d.slice(4);
    if (d.startsWith("+33")) d = "0" + d.slice(3);
    if (!/^0[1-9]\d{8}$/.test(d)) return;
    if (/^0[89]/.test(d)) score -= 1; // numéros surtaxés / spéciaux : moins pertinents
    const fmt = d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    out.set(fmt, Math.max(out.get(fmt) || 0, score));
  };
  (html.match(/tel:\+?[\d\s().-]{8,20}/gi) || []).forEach((m) => add(m.replace(/^tel:/i, ""), 3));
  const txt = html.replace(/<[^>]+>/g, " ");
  (txt.match(/(?:\+33|0033|0)\s?[1-9](?:[\s.\-]?\d{2}){4}/g) || []).forEach((m) => add(m, 1));
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 4);
}

// Pages où se trouvent presque toujours les coordonnées d'un commerce.
const PATHS = ["", "/contact", "/contact.html", "/contactez-nous", "/nous-contacter", "/mentions-legales", "/infos-pratiques"];

// Traduction des codes d'etape en libelle court et en indicateur « livre / en cours / probleme »,
// pour un affichage lisible dans la fiche commande.
function etatDepuisCode(code) {
  const c = String(code || "").toUpperCase();
  if (["DI1", "DI2"].includes(c)) return { etat: "livre", label: "Livré" };
  if (["ET1", "ET2", "ET3", "ET4", "EP1", "PC1", "PC2"].includes(c)) return { etat: "en_cours", label: "En cours d'acheminement" };
  if (["DO1", "DO2", "DO3"].includes(c)) return { etat: "attente", label: "En attente de retrait" };
  if (["ND1", "AG1", "RE1"].includes(c)) return { etat: "probleme", label: "Incident de livraison" };
  return { etat: "en_cours", label: "" };
}


// ===== Points d'entree tiers =====
const API_BATCH = "https://api.anthropic.com/v1/messages/batches";
const MAX_REQUESTS = 500;
// Plafonds imposes par OpenRouteService sur la duree d'une isochrone, et qui different selon le
// mode de deplacement (openrouteservice.org/restrictions). Au-dela, l'API refuse la requete : on
// borne donc ici plutot que de laisser remonter une erreur incomprehensible cote carte.
const MAX_MINUTES = { "driving-car": 60, "cycling-regular": 300, "foot-walking": 1200 };
const NUM_VALIDE = /^[A-Z0-9]{8,20}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  // Authentification Clerk obligatoire pour TOUTES les actions : sans elle, ce routeur serait a la
  // fois un proxy HTTP ouvert et un acces libre a des API payantes.
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) { res.status(500).json({ error: "Authentification non configuree cote serveur." }); return; }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
  try { await verifyToken(token, { secretKey: clerkSecret }); }
  catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const action = String(body.action || "");

  try {
    // ---------- Lecture du site d'un magasin (gratuit, aucune cle) ----------
    if (action === "scrape") return await actionScrape(body, res);
    // ---------- Isochrone (OpenRouteService) ----------
    if (action === "isochrone") return await actionIsochrone(body, res);
    // ---------- Suivi de colis (La Poste) ----------
    if (action === "suivi") return await actionSuivi(body, res);
    // ---------- Lots Claude ----------
    if (action.startsWith("batch:")) return await actionBatch(action.slice(6), body, res);
    res.status(400).json({ error: "Action inconnue : " + action });
  } catch (e) {
    res.status(502).json({ error: "Service indisponible : " + (e && e.message ? e.message : String(e)) });
  }
}

async function actionScrape(body, res) {
  const raw = String(body.url || "").trim();
  if (!raw) { res.status(400).json({ error: "URL manquante." }); return; }
  const start = await safeUrl(/^https?:\/\//i.test(raw) ? raw : "https://" + raw.replace(/^\/+/, ""));
  if (!start) { res.status(400).json({ error: "URL invalide ou non autorisee." }); return; }

  // Budget global : on abandonne proprement avant la limite Vercel.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const emails = new Map(); const phones = new Map(); const visited = [];
    for (const path of PATHS) {
      if (controller.signal.aborted) break;
      // On s'arrête dès qu'on tient un e-mail ET un téléphone : inutile de charger d'autres pages.
      if (emails.size && phones.size) break;
      let target;
      try { target = new URL(path, start.origin + start.pathname.replace(/\/$/, "") + "/").href; } catch (e) { continue; }
      const html = await fetchPage(path ? target : start.href, controller.signal);
      if (!html) continue;
      visited.push(path || "/");
      extractEmails(html).forEach((e, i) => { if (!emails.has(e)) emails.set(e, i); });
      extractPhones(html).forEach((p, i) => { if (!phones.has(p)) phones.set(p, i); });
    }
    res.status(200).json({
      email: [...emails.keys()][0] || "",
      telephone: [...phones.keys()][0] || "",
      emails: [...emails.keys()],
      telephones: [...phones.keys()],
      pages: visited,
    });
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "Delai depasse." : ("Lecture impossible : " + ((e && e.message) || String(e)));
    res.status(200).json({ email: "", telephone: "", emails: [], telephones: [], pages: [], error: msg });
  } finally {
    clearTimeout(timer);
  }
}

async function actionIsochrone(body, res) {
  const key = process.env.ORS_API_KEY;
  if (!key) { res.status(500).json({ error: "ORS_API_KEY manquante cote serveur. Creez une cle gratuite sur openrouteservice.org, puis ajoutez-la dans les variables d'environnement Vercel." }); return; }
  const lat = Number(body.lat), lng = Number(body.lng);
  const profil = ["driving-car", "cycling-regular", "foot-walking"].includes(body.profil) ? body.profil : "driving-car";
  const minutes = Math.min(Math.max(Number(body.minutes) || 30, 1), MAX_MINUTES[profil]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { res.status(400).json({ error: "Coordonnees invalides." }); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    // ORS attend les coordonnees en [longitude, latitude] — l'inverse de l'usage courant.
    const up = await fetch("https://api.openrouteservice.org/v2/isochrones/" + profil, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key, Accept: "application/geo+json" },
      body: JSON.stringify({ locations: [[lng, lat]], range: [minutes * 60], range_type: "time" }),
      signal: controller.signal,
    });
    const txt = await up.text();
    if (!up.ok) {
      let motif = "";
      try { const j = JSON.parse(txt); motif = (j.error && (j.error.message || j.error)) || j.message || ""; } catch (e) { motif = txt.slice(0, 160); }
      res.status(up.status === 403 || up.status === 401 ? 502 : up.status).json({ error: "OpenRouteService : " + (motif || "erreur " + up.status) });
      return;
    }
    res.status(200).setHeader("Content-Type", "application/json");
    res.send(txt);
  } finally { clearTimeout(timer); }
}

async function actionSuivi(body, res) {
  const key = process.env.LAPOSTE_API_KEY;
  if (!key) { res.status(500).json({ error: "LAPOSTE_API_KEY manquante cote serveur. Creez une cle gratuite sur developer.laposte.fr (produit « Suivi »), puis ajoutez-la dans les variables d'environnement Vercel." }); return; }
  const num = String(body.numero || "").trim().replace(/\s/g, "");
  if (!NUM_VALIDE.test(num)) { res.status(400).json({ error: "Numero de suivi invalide (8 a 20 caracteres alphanumeriques)." }); return; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const up = await fetch("https://api.laposte.fr/suivi/v2/idships/" + encodeURIComponent(num) + "?lang=fr_FR", {
      headers: { "X-Okapi-Key": key, Accept: "application/json" },
      signal: controller.signal,
    });
    const txt = await up.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!up.ok) {
      const motif = (j && (j.message || j.returnMessage)) || ("erreur " + up.status);
      res.status(up.status === 404 ? 200 : 502).json(up.status === 404
        ? { introuvable: true, error: "Numero inconnu du service de suivi (colis pas encore pris en charge ?)." }
        : { error: "La Poste : " + motif });
      return;
    }
    const sh = (j && (j.shipment || (j.shipments && j.shipments[0]))) || null;
    if (!sh) { res.status(200).json({ introuvable: true, error: "Aucune information de suivi pour ce numero." }); return; }
    const evts = (sh.event || sh.events || []).map((e) => ({
      date: String(e.date || "").slice(0, 10),
      heure: String(e.date || "").slice(11, 16),
      libelle: e.label || "",
      code: e.code || "",
    }));
    const dernier = evts[0] || null;
    const st = etatDepuisCode(dernier && dernier.code);
    res.status(200).json({
      numero: sh.idShip || num,
      produit: sh.product || "",
      etat: st.etat,
      etatLabel: st.label || (dernier && dernier.libelle) || "",
      dernierEvenement: dernier,
      evenements: evts.slice(0, 12),
      url: sh.url || "",
    });
  } finally { clearTimeout(timer); }
}

async function actionBatch(sousAction, body, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY manquante cote serveur." }); return; }
  const H = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  const id = String(body.id || "");

  if (sousAction === "create") {
    const requests = Array.isArray(body.requests) ? body.requests : [];
    if (!requests.length) { res.status(400).json({ error: "Aucune requete dans le lot." }); return; }
    if (requests.length > MAX_REQUESTS) { res.status(400).json({ error: "Lot trop volumineux (max " + MAX_REQUESTS + ")." }); return; }
    const up = await fetch(API_BATCH, { method: "POST", headers: H, body: JSON.stringify({ requests }) });
    const txt = await up.text();
    res.status(up.status).setHeader("Content-Type", "application/json"); res.send(txt); return;
  }
  if (!id) { res.status(400).json({ error: "Identifiant de lot manquant." }); return; }
  if (sousAction === "status") {
    const up = await fetch(API_BATCH + "/" + encodeURIComponent(id), { headers: H });
    const txt = await up.text();
    res.status(up.status).setHeader("Content-Type", "application/json"); res.send(txt); return;
  }
  if (sousAction === "cancel") {
    const up = await fetch(API_BATCH + "/" + encodeURIComponent(id) + "/cancel", { method: "POST", headers: H });
    const txt = await up.text();
    res.status(up.status).setHeader("Content-Type", "application/json"); res.send(txt); return;
  }
  if (sousAction === "results") {
    const meta = await fetch(API_BATCH + "/" + encodeURIComponent(id), { headers: H });
    if (!meta.ok) { res.status(meta.status).send(await meta.text()); return; }
    const info = await meta.json();
    if (info.processing_status !== "ended") { res.status(200).json({ pending: true, processing_status: info.processing_status, request_counts: info.request_counts || null }); return; }
    if (!info.results_url) { res.status(200).json({ pending: false, results: [] }); return; }
    const r = await fetch(info.results_url, { headers: H });
    if (!r.ok) { res.status(r.status).send(await r.text()); return; }
    const jsonl = await r.text();
    const results = [];
    for (const line of jsonl.split("\n")) {
      const t = line.trim(); if (!t) continue;
      try { results.push(JSON.parse(t)); } catch (e) {}
    }
    res.status(200).json({ pending: false, results, request_counts: info.request_counts || null });
    return;
  }
  res.status(400).json({ error: "Sous-action de lot inconnue : " + sousAction });
}
