import React from "react";

export function Chargement({ texte = "Chargement…" }) {
  return <div className="vide" role="status">{texte}</div>;
}

export function Erreur({ message, surReessai }) {
  if (!message) return null;
  return (
    <div className="ligne" style={{ gap: 12 }}>
      <div className="message erreur" style={{ flex: 1 }}>{message}</div>
      {surReessai && <button className="discret mini" onClick={surReessai}>Réessayer</button>}
    </div>
  );
}

// Petit crochet pour les actions qui écrivent : il porte l'attente et le message d'erreur,
// pour ne pas réécrire le même try/catch/setEnCours dans chaque écran.
export function useAction() {
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState("");

  const lancer = React.useCallback(async (travail) => {
    setEnCours(true);
    setErreur("");
    try {
      return await travail();
    } catch (e) {
      setErreur(e && e.message ? e.message : String(e));
      return null;
    } finally {
      setEnCours(false);
    }
  }, []);

  return { enCours, erreur, setErreur, lancer };
}
