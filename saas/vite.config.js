import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Même découpe que le cockpit : les dépendances dans un chunk stable, servi « immutable ».
// Une visite suivante ne retélécharge pas React quand seul le code applicatif change.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
