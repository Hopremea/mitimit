import { verifyToken } from "@clerk/backend";
import dns from "node:dns/promises";
import net from "node:net";

// Extraction GRATUITE des coordonnées publiques depuis le site web d'un magasin (page d'accueil,
// « contact », « mentions légales »). Aucun coût d'API : c'est le serveur qui lit les pages, puis
// renvoie les e-mails et téléphones trouvés. Remplace autant d'appels IA payants.
//
// Le navigateur ne peut pas lire un site tiers (CORS) : ce relais est indispensable.
export const config = { maxDuration: 30 };

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

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  // Authentification Clerk OBLIGATOIRE : sans elle, ce relais serait un proxy HTTP ouvert.
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) { res.status(500).json({ error: "Authentification non configuree cote serveur." }); return; }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
  try { await verifyToken(token, { secretKey: clerkSecret }); }
  catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
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
