// Connecteur Supabase DÉBRANCHÉ (mise en réserve du logiciel, septembre 2026).
//
// L'application tourne désormais en « local pur » : les données vivent dans ce navigateur
// (IndexedDB / localStorage), sans base partagée, sans synchronisation, sans temps réel.
// Aucune variable d'environnement n'est lue, aucune bibliothèque Supabase n'est embarquée.
//
// Le reste du code garde ses gardes « supabaseEnabled && supabase » : elles sont toutes fausses,
// donc les branches serveur ne s'exécutent jamais. La version branchée reste consultable dans
// l'historique Git (étiquette « avant-debranchement »).
export const supabaseEnabled = false;
export const supabase = null;
