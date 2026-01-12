// API Configuration for Ad Vault
// Same-origin API since frontend and functions are served from same domain

const isDev = import.meta.env.DEV;

export const API_BASE = isDev
  ? 'http://localhost:8788'  // Wrangler pages dev server
  : '';  // Same origin in production (Pages + Functions)

export const config = {
  apiBase: API_BASE,
  isDev
};
