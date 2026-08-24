import React from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { appel } from "../api.js";
import { Chargement, Erreur, useAction } from "../composants/Etat.jsx";

// Acceptation d'une invitation, ouverte depuis le lien reçu (/rejoindre?jeton=…).
export default function Rejoindre({ surAdhesion }) {
  const jeton = new URLSearchParams(window.location.search).get("jeton") || "";
  const [apercu, setApercu] = React.useState(null);
  const [erreurApercu, setErreurApercu] = React.useState("");
  const { enCours, erreur, lancer } = useAction();

  React.useEffect(() => {
    let vivant = true;
    if (!jeton) { setErreurApercu("Lien d'invitation incomplet."); return; }
    appel("invitation", { parametres: { jeton } })
      .then((r) => { if (vivant) setApercu(r); })
      .catch((e) => { if (vivant) setErreurApercu(e.message); });
    return () => { vivant = false; };
  }, [jeton]);

  async function accepter() {
    const r = await lancer(() => appel("rejoindre", { methode: "POST", corps: { jeton } }));
    if (r) surAdhesion(r.organisation);
  }

  return (
    <>
      <nav className="barre">
        <span className="marque">MATMAT</span>
        <div className="pousse ligne">
          <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
        </div>
      </nav>

      <main className="contenu" style={{ maxWidth: 480, paddingTop: "10vh" }}>
        <div className="carte pile">
          <h1 style={{ fontSize: 20 }}>Invitation</h1>

          {erreurApercu && <Erreur message={erreurApercu} />}
          {!erreurApercu && !apercu && <Chargement texte="Vérification du lien…" />}

          {apercu && (
            <>
              <p style={{ margin: 0 }}>
                Vous êtes invité à rejoindre <strong>{apercu.organisation}</strong> en tant que{" "}
                {apercu.role === "admin" ? "administrateur" : "membre"}.
              </p>

              {/* Rejoindre exige un compte : la fiche membre se rattache à un utilisateur Clerk,
                  il faut donc en avoir un avant de pouvoir accepter. */}
              <SignedOut>
                <p className="doux petit" style={{ margin: 0 }}>
                  Connectez-vous ou créez un compte pour accepter.
                </p>
                <div className="ligne">
                  <SignUpButton mode="modal"><button>Créer un compte</button></SignUpButton>
                  <SignInButton mode="modal"><button className="discret">Se connecter</button></SignInButton>
                </div>
              </SignedOut>

              <SignedIn>
                <Erreur message={erreur} />
                <button onClick={accepter} disabled={enCours}>
                  {enCours ? "Adhésion…" : "Rejoindre l'organisation"}
                </button>
              </SignedIn>
            </>
          )}
        </div>
      </main>
    </>
  );
}
