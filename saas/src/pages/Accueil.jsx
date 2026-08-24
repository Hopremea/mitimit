import React from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Lien } from "../routeur.jsx";

// Page publique. Elle est volontairement générique : le discours produit s'écrit quand le
// produit existe. Ce qui est en place ici, c'est la structure — titre, promesse, appel à
// l'action, et les deux portes (créer un compte / se connecter).
export default function Accueil() {
  return (
    <>
      <nav className="barre">
        <span className="marque">MATMAT</span>
        <div className="pousse ligne">
          <SignedOut>
            <SignInButton mode="modal"><button className="discret">Se connecter</button></SignInButton>
            <SignUpButton mode="modal"><button>Créer un compte</button></SignUpButton>
          </SignedOut>
          <SignedIn>
            <Lien vers="/app" className="bouton">Ouvrir l'application</Lien>
          </SignedIn>
        </div>
      </nav>

      <header className="hero">
        <h1>MATMAT, le socle est posé.</h1>
        <p>
          Comptes, organisations, rôles, invitations et abonnements fonctionnent déjà.
          Ce qui manque, c'est le métier — remplacez ce texte et l'écran « Ressources »
          par ce que votre produit fait vraiment.
        </p>
        <div className="ligne" style={{ justifyContent: "center", marginTop: 22 }}>
          <SignedOut>
            <SignUpButton mode="modal"><button>Commencer</button></SignUpButton>
          </SignedOut>
          <SignedIn>
            <Lien vers="/app" className="bouton">Ouvrir l'application</Lien>
          </SignedIn>
        </div>
      </header>

      <main className="contenu">
        <div className="grille">
          <section className="carte">
            <h3>Cloisonnement par organisation</h3>
            <p className="doux petit">
              Chaque donnée porte un <code>organisation_id</code>. Le serveur ne sert une requête
              que si l'appelant a une fiche membre dans l'organisation demandée.
            </p>
          </section>
          <section className="carte">
            <h3>Trois rôles</h3>
            <p className="doux petit">
              Propriétaire, administrateur, membre. Le propriétaire seul touche à la facturation ;
              une organisation ne peut jamais se retrouver sans propriétaire.
            </p>
          </section>
          <section className="carte">
            <h3>Abonnements Stripe</h3>
            <p className="doux petit">
              Paiement et portail hébergés par Stripe, aucune carte ne traverse ce code. Le
              webhook signé fait seul foi sur l'état payé d'un compte.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
