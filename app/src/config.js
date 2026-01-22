// API Configuration for Ad Vault
// Same-origin API since frontend and backend are served from same server

const isDev = import.meta.env.DEV;

export const API_BASE = isDev
  ? 'http://localhost:3000'  // Local Express server
  : '';  // Same origin in production (Railway serves both)

export const config = {
  apiBase: API_BASE,
  isDev
};
