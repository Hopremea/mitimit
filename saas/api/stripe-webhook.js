import { baseAdmin } from "../lib/db.js";
import { stripe, signatureValide, statutDepuisStripe } from "../lib/stripe.js";

// Vercel analyse le corps des requêtes et renvoie un objet déjà décodé. Ici, il faut le TEXTE
// exact reçu : la signature Stripe porte sur les octets d'origine, et un aller-retour par
// JSON.parse/stringify la casserait (ordre des clés, espaces, nombres reformatés).
export const config = { api: { bodyParser: false } };

function corpsBrut(req) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    req.on("data", (m) => morceaux.push(m));
    req.on("end", () => resoudre(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", rejeter);
  });
}

// Notifications d'abonnement envoyées par Stripe.
//
// C'est la SEULE source de vérité sur l'état payé d'un compte : le retour de navigateur après
// paiement peut être perdu (onglet fermé, réseau coupé) ou fabriqué de toutes pièces, alors que
// ce point d'entrée est signé et réessayé par Stripe jusqu'à réception.
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET manquante côté serveur." }); return; }

  let brut;
  try { brut = await corpsBrut(req); }
  catch (e) { res.status(400).json({ error: "Corps illisible." }); return; }

  if (!signatureValide(brut, req.headers["stripe-signature"], secret)) {
    res.status(400).json({ error: "Signature invalide." });
    return;
  }

  let evenement;
  try { evenement = JSON.parse(brut); }
  catch (e) { res.status(400).json({ error: "Corps illisible." }); return; }

  const sb = baseAdmin();
  if (!sb) { res.status(500).json({ error: "Base non configurée côté serveur." }); return; }

  try {
    await traiter(sb, evenement);
  } catch (e) {
    // Un 5xx dit à Stripe de réessayer plus tard — préférable à un échec silencieux qui
    // laisserait un client payant bloqué sur « inactif ».
    res.status(502).json({ error: "Traitement impossible : " + (e && e.message ? e.message : String(e)) });
    return;
  }

  res.status(200).json({ recu: true });
}

async function traiter(sb, evenement) {
  const type = evenement && evenement.type;
  const objet = (evenement && evenement.data && evenement.data.object) || {};

  if (type === "checkout.session.completed") {
    // La session de paiement ne porte pas le statut de l'abonnement : on va le chercher,
    // plutôt que de supposer « actif » (un prélèvement peut encore échouer ensuite).
    if (!objet.subscription) return;
    const abonnement = await stripe(`/subscriptions/${objet.subscription}`);
    await appliquer(sb, abonnement, objet.client_reference_id || null);
    return;
  }

  if (type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    await appliquer(sb, objet, null);
    return;
  }

  // Tout autre événement est acquitté sans traitement : répondre 200 évite que Stripe
  // réessaie indéfiniment des notifications dont l'application n'a rien à faire.
}

async function appliquer(sb, abonnement, organisationIdDeSecours) {
  // Trois pistes pour retrouver l'organisation, de la plus fiable à la moins fiable.
  const organisationId =
    (abonnement.metadata && abonnement.metadata.organisation_id) || organisationIdDeSecours || null;

  const filtre = organisationId
    ? { colonne: "id", valeur: organisationId }
    : abonnement.customer
      ? { colonne: "stripe_customer_id", valeur: abonnement.customer }
      : null;

  if (!filtre) throw new Error("Événement sans organisation identifiable.");

  const statut = statutDepuisStripe(abonnement.status);
  // Depuis la version d'API 2025-03-31, Stripe a déplacé la fin de période du niveau de
  // l'abonnement vers ses lignes. On lit les deux : selon la version épinglée sur le compte,
  // c'est l'un ou l'autre qui est renseigné.
  const ligne = abonnement.items && abonnement.items.data && abonnement.items.data[0];
  const finBrute = abonnement.current_period_end || (ligne && ligne.current_period_end) || null;
  const fin = finBrute ? new Date(finBrute * 1000).toISOString() : null;

  const { error } = await sb
    .from("organisations")
    .update({
      statut_abonnement: statut,
      // Un abonnement résilié laisse le plan payant jusqu'au terme déjà réglé ; c'est le
      // statut, pas le plan, qui ferme l'accès le moment venu.
      plan: statut === "resilie" || statut === "inactif" ? "gratuit" : "pro",
      stripe_subscription_id: abonnement.id || null,
      stripe_customer_id: abonnement.customer || undefined,
      periode_fin: fin,
    })
    .eq(filtre.colonne, filtre.valeur);

  if (error) throw new Error(error.message);
}
