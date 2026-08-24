import React from "react";
import { appel } from "../api.js";
import { Chargement, Erreur, useAction } from "../composants/Etat.jsx";

// Écran métier de démonstration.
//
// Il n'existe que pour prouver le cloisonnement de bout en bout : ce qui est créé ici
// n'est visible que depuis l'organisation active. Changez d'organisation dans la barre du
// haut, la liste change. C'est CE fichier, et la table « ressources », que vous remplacez
// par votre vrai produit.
export default function Tableau({ organisation }) {
  const [ressources, setRessources] = React.useState(null);
  const [erreurChargement, setErreurChargement] = React.useState("");
  const [titre, setTitre] = React.useState("");
  const [note, setNote] = React.useState("");
  const { enCours, erreur, lancer } = useAction();

  const charger = React.useCallback(async () => {
    setErreurChargement("");
    setRessources(null);
    try {
      const r = await appel("ressources", { organisation: organisation.id });
      setRessources(r.ressources);
    } catch (e) {
      setErreurChargement(e.message);
    }
  }, [organisation.id]);

  React.useEffect(() => { charger(); }, [charger]);

  async function ajouter(e) {
    e.preventDefault();
    if (!titre.trim()) return;
    const r = await lancer(() =>
      appel("ressource-creer", {
        methode: "POST",
        organisation: organisation.id,
        corps: { titre: titre.trim(), note: note.trim() },
      })
    );
    if (!r) return;
    setTitre("");
    setNote("");
    setRessources((liste) => [r.ressource, ...(liste || [])]);
  }

  async function supprimer(id) {
    const r = await lancer(() =>
      appel("ressource-retirer", { methode: "POST", organisation: organisation.id, corps: { id } })
    );
    if (r) setRessources((liste) => (liste || []).filter((x) => x.id !== id));
  }

  return (
    <div className="pile">
      <div>
        <h1>{organisation.nom}</h1>
        <p className="doux petit" style={{ margin: 0 }}>
          Écran de démonstration : tout ce qui est ajouté ici appartient à cette organisation
          et à elle seule. Remplacez-le par votre métier.
        </p>
      </div>

      <form onSubmit={ajouter} className="carte pile" style={{ gap: 12 }}>
        <h2>Ajouter une ressource</h2>
        <div className="ligne" style={{ alignItems: "flex-end" }}>
          <div className="champ">
            <label htmlFor="titre">Titre</label>
            <input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} placeholder="Ma première ressource" />
          </div>
          <div className="champ">
            <label htmlFor="note">Note (facultatif)</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Quelques mots" />
          </div>
          <button type="submit" disabled={enCours || !titre.trim()}>Ajouter</button>
        </div>
        <Erreur message={erreur} />
      </form>

      <section className="carte">
        <h2>Ressources</h2>
        {erreurChargement && <Erreur message={erreurChargement} surReessai={charger} />}
        {!erreurChargement && ressources === null && <Chargement />}
        {ressources !== null && ressources.length === 0 && (
          <p className="vide">Rien pour le moment. Ajoutez une ressource ci-dessus.</p>
        )}
        {ressources !== null && ressources.length > 0 && (
          <ul className="liste">
            {ressources.map((r) => (
              <li key={r.id}>
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                  <strong>{r.titre}</strong>
                  {r.note && <div className="doux petit">{r.note}</div>}
                </div>
                <span className="doux petit">{new Date(r.cree_le).toLocaleDateString("fr-FR")}</span>
                <button className="danger mini pousse" onClick={() => supprimer(r.id)} disabled={enCours}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
