// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    // Allow overriding the base path (useful for GitHub Pages/project pages).
    // Only apply the override for production builds so the dev server
    // continues to run at '/'. Set `SVELTE_BASE` to your repo path
    // (e.g. '/my-repo') when building for GitHub Pages.
    paths: {
      base: (process.env.SVELTE_BASE && process.env.NODE_ENV === 'production') ? process.env.SVELTE_BASE : '',
    },
  },
};

export default config;
