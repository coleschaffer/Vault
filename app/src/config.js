// API Configuration for Ad Vault
// Set to your Cloudflare Worker URL in production

const isDev = import.meta.env.DEV;

export const API_BASE = isDev
  ? 'http://localhost:8787'  // Wrangler dev server
  : '';  // Same origin in production (Cloudflare Pages + Workers)

export const config = {
  apiBase: API_BASE,
  isDev
};
