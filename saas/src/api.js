// Pont unique vers les fonctions /api.
//
// Deux choses y sont jointes à chaque appel, et c'est tout ce que le serveur regarde :
//   1. le jeton de session Clerk (« qui appelle »),
//   2. l'organisation active (« pour quel client »).
// Le serveur revérifie systématiquement que 1 a le droit d'agir sur 2 — cet en-tête est une
// intention, jamais une autorisation.

let lireJeton = null;

// Posé par le pont Clerk dans main.jsx, dès que la session est disponible.
export function brancherJeton(fn) {
  lireJeton = fn;
}

export class ErreurApi extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export async function appel(action, { methode = "GET", corps, organisation, module = "organisations", parametres } = {}) {
  const jeton = lireJeton ? await lireJeton().catch(() => null) : null;

  const url = new URL(`/api/${module}`, window.location.origin);
  url.searchParams.set("action", action);
  for (const [cle, valeur] of Object.entries(parametres || {})) {
    if (valeur !== undefined && valeur !== null) url.searchParams.set(cle, String(valeur));
  }

  const entetes = {};
  if (jeton) entetes.Authorization = "Bearer " + jeton;
  if (organisation) entetes["X-Organisation"] = organisation;
  if (corps !== undefined) entetes["Content-Type"] = "application/json";

  let reponse;
  try {
    reponse = await fetch(url, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch (e) {
    throw new ErreurApi("Serveur injoignable. Vérifiez votre connexion.", 0);
  }

  // Une erreur de plateforme (502, page d'erreur HTML) ne renvoie pas de JSON : sans ce
  // filet, l'utilisateur verrait « Unexpected token < » au lieu d'un message lisible.
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new ErreurApi((donnees && donnees.error) || `Le serveur a répondu ${reponse.status}.`, reponse.status);
  }
  return donnees;
}
