import React from "react";

// Routeur minimal, sans dépendance.
//
// L'application compte cinq écrans et aucune route imbriquée : react-router apporterait
// ici plus de poids que de service. Si le nombre d'écrans grandit, c'est le moment de
// remplacer ce fichier — l'interface (chemin, naviguer, Lien) restera la même.

const Contexte = React.createContext({ chemin: "/", naviguer: () => {} });

export function Routeur({ children }) {
  const [chemin, setChemin] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    // Les boutons « précédent / suivant » du navigateur doivent rester fonctionnels :
    // sans cet écouteur, l'URL changerait mais l'écran affiché resterait figé.
    const surRetour = () => setChemin(window.location.pathname);
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
  }, []);

  const naviguer = React.useCallback((vers, { remplacer = false } = {}) => {
    if (vers === window.location.pathname + window.location.search) return;
    window.history[remplacer ? "replaceState" : "pushState"]({}, "", vers);
    setChemin(window.location.pathname);
    window.scrollTo(0, 0);
  }, []);

  return <Contexte.Provider value={{ chemin, naviguer }}>{children}</Contexte.Provider>;
}

export function useRoute() {
  return React.useContext(Contexte);
}

export function Lien({ vers, className, children, ...reste }) {
  const { naviguer } = useRoute();
  return (
    <a
      href={vers}
      className={className}
      onClick={(e) => {
        // Un clic milieu, ou avec Ctrl/Cmd, doit ouvrir un onglet comme sur n'importe quel
        // lien : on ne détourne que le clic gauche simple.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        naviguer(vers);
      }}
      {...reste}
    >
      {children}
    </a>
  );
}
