import React from "react";
import { UserButton } from "@clerk/clerk-react";
import { useAction, Erreur } from "../composants/Etat.jsx";

// Premier écran d'un compte qui n'appartient encore à aucune organisation : sans locataire,
// aucune donnée n'a d'endroit où exister. On ne propose donc qu'une chose, en créer une.
export default function Bienvenue({ surCreation }) {
  const [nom, setNom] = React.useState("");
  const { enCours, erreur, lancer } = useAction();

  async function valider(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    await lancer(() => surCreation(nom.trim()));
  }

  return (
    <>
      <nav className="barre">
        <span className="marque">MATMAT</span>
        <div className="pousse" style={{ display: "flex" }}><UserButton afterSignOutUrl="/" /></div>
      </nav>

      <main className="contenu" style={{ maxWidth: 520, paddingTop: "9vh" }}>
        <div className="carte pile">
          <div>
            <h1 style={{ fontSize: 21 }}>Créez votre organisation</h1>
            <p className="doux petit" style={{ margin: 0 }}>
              C'est l'espace qui contiendra vos données et vos collègues. Vous en serez le
              propriétaire, et pourrez inviter votre équipe juste après.
            </p>
          </div>

          <form onSubmit={valider} className="pile" style={{ gap: 12 }}>
            <div>
              <label htmlFor="nom-organisation">Nom de l'organisation</label>
              <input
                id="nom-organisation"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Mon entreprise"
                maxLength={80}
                autoFocus
              />
            </div>
            <Erreur message={erreur} />
            <button type="submit" disabled={enCours || !nom.trim()}>
              {enCours ? "Création…" : "Créer l'organisation"}
            </button>
          </form>

          <p className="doux petit" style={{ margin: 0 }}>
            Vous attendiez une invitation ? Ouvrez le lien qu'on vous a envoyé : il vous
            rattachera directement à l'organisation concernée.
          </p>
        </div>
      </main>
    </>
  );
}
