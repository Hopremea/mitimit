import React from "react";
import { appel } from "../api.js";
import { Chargement, Erreur, useAction } from "../composants/Etat.jsx";

const LIBELLES = {
  inactif: "Aucun abonnement",
  essai: "Période d'essai",
  actif: "Abonnement actif",
  impaye: "Paiement en échec",
  resilie: "Abonnement résilié",
};

export default function Facturation({ organisation, role }) {
  const [etat, setEtat] = React.useState(null);
  const [erreurChargement, setErreurChargement] = React.useState("");
  const { enCours, erreur, lancer } = useAction();

  // Retour depuis Stripe. Ce paramètre sert UNIQUEMENT à afficher un message : l'état payé
  // du compte vient du webhook, jamais d'une URL que l'on peut taper à la main.
  const retour = new URLSearchParams(window.location.search).get("paiement");

  const charger = React.useCallback(async () => {
    setErreurChargement("");
    setEtat(null);
    try {
      setEtat(await appel("etat", { module: "facturation", organisation: organisation.id }));
    } catch (e) {
      setErreurChargement(e.message);
    }
  }, [organisation.id]);

  React.useEffect(() => { charger(); }, [charger]);

  async function ouvrir(action) {
    const r = await lancer(() =>
      appel(action, { module: "facturation", methode: "POST", organisation: organisation.id })
    );
    if (r && r.url) window.location.assign(r.url);
  }

  const proprietaire = role === "proprietaire";

  return (
    <div className="pile">
      <div>
        <h1>Facturation</h1>
        <p className="doux petit" style={{ margin: 0 }}>
          Abonnement de « {organisation.nom} ». Le paiement se fait sur les pages sécurisées de Stripe.
        </p>
      </div>

      {retour === "ok" && (
        <div className="message succes">
          Paiement enregistré. L'activation est confirmée par Stripe : si le statut ci-dessous
          n'a pas encore changé, rechargez dans quelques secondes.
        </div>
      )}
      {retour === "annule" && <div className="message erreur">Paiement annulé. Rien n'a été débité.</div>}

      {erreurChargement && <Erreur message={erreurChargement} surReessai={charger} />}
      {!erreurChargement && etat === null && <Chargement />}

      {etat && (
        <section className="carte pile">
          <div className="ligne">
            <h2 style={{ margin: 0 }}>{LIBELLES[etat.statut] || etat.statut}</h2>
            <span className={"pastille " + (etat.actif ? "ok" : "ko")}>
              {etat.actif ? "Accès ouvert" : "Accès limité"}
            </span>
          </div>

          <p className="doux petit" style={{ margin: 0 }}>
            Plan <strong>{etat.plan}</strong>
            {etat.periode_fin && (
              <> · période en cours jusqu'au {new Date(etat.periode_fin).toLocaleDateString("fr-FR")}</>
            )}
          </p>

          <Erreur message={erreur} />

          {!etat.configure && (
            <div className="message erreur">
              Facturation non configurée côté serveur : renseignez <code>STRIPE_SECRET_KEY</code> et{" "}
              <code>STRIPE_PRICE_ID</code>, puis redéployez.
            </div>
          )}

          {!proprietaire ? (
            <p className="doux petit" style={{ margin: 0 }}>
              Seul un propriétaire de l'organisation peut modifier l'abonnement.
            </p>
          ) : (
            <div className="ligne">
              {!etat.actif && (
                <button disabled={enCours || !etat.configure} onClick={() => ouvrir("souscrire")}>
                  {enCours ? "Ouverture…" : "S'abonner"}
                </button>
              )}
              {etat.client && (
                <button className="discret" disabled={enCours || !etat.configure} onClick={() => ouvrir("portail")}>
                  Gérer l'abonnement
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
