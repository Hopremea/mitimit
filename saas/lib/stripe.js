import crypto from "node:crypto";

// Accès à Stripe par son API REST, avec fetch — sans le paquet « stripe ».
// Motif : le SDK pèse lourd dans un bundle de fonction serverless alors que trois appels
// suffisent (créer un client, ouvrir un paiement, ouvrir le portail). Même parti pris que
// lib/gmail.js du cockpit, qui parle à Google en direct.

const BASE = "https://api.stripe.com/v1";

export function stripeConfigure() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

// Stripe attend du form-urlencoded, y compris pour les structures imbriquées, qu'il note
// « parent[enfant] ». Cette fonction aplatit un objet JavaScript vers cette notation.
function aplatir(objet, prefixe = "", sortie = new URLSearchParams()) {
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur === undefined || valeur === null) continue;
    const nom = prefixe ? `${prefixe}[${cle}]` : cle;
    if (typeof valeur === "object" && !Array.isArray(valeur)) aplatir(valeur, nom, sortie);
    else if (Array.isArray(valeur)) valeur.forEach((v, i) => aplatir({ [i]: v }, nom, sortie));
    else sortie.append(nom, String(valeur));
  }
  return sortie;
}

export async function stripe(chemin, corps) {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) throw new Error("STRIPE_SECRET_KEY manquante côté serveur.");

  const reponse = await fetch(BASE + chemin, {
    method: corps ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + cle,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: corps ? aplatir(corps).toString() : undefined,
  });

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error((donnees.error && donnees.error.message) || `Stripe a répondu ${reponse.status}.`);
  }
  return donnees;
}

// Vérifie la signature d'un webhook Stripe.
//
// Sans cette vérification, n'importe qui connaissant l'URL pourrait déclarer un abonnement payé.
// Stripe signe « timestamp.corps brut » en HMAC-SHA256 avec le secret du endpoint, et envoie le
// tout dans l'en-tête « stripe-signature » (t=… , v1=…). Le corps doit être le texte EXACT reçu :
// le reformater par JSON.parse/stringify invaliderait la signature.
export function signatureValide(corpsBrut, entete, secret) {
  if (!corpsBrut || !entete || !secret) return false;

  const parties = Object.fromEntries(
    String(entete)
      .split(",")
      .map((p) => p.split("="))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()])
  );
  if (!parties.t || !parties.v1) return false;

  // Rejeu : au-delà de cinq minutes, on refuse même une signature mathématiquement correcte.
  const age = Math.abs(Date.now() / 1000 - Number(parties.t));
  if (!Number.isFinite(age) || age > 300) return false;

  const attendu = crypto
    .createHmac("sha256", secret)
    .update(`${parties.t}.${corpsBrut}`, "utf8")
    .digest("hex");

  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(parties.v1, "utf8");
  // Comparaison à temps constant : une comparaison ordinaire fuit, par sa durée, le nombre de
  // caractères devinés justes, ce qui permet de reconstruire la signature octet par octet.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Traduit le statut Stripe vers le vocabulaire de la base.
export function statutDepuisStripe(statut) {
  if (statut === "trialing") return "essai";
  if (statut === "active") return "actif";
  if (statut === "past_due" || statut === "unpaid") return "impaye";
  if (statut === "canceled" || statut === "incomplete_expired") return "resilie";
  return "inactif";
}
