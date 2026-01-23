---
description: Deploy Vault to Cloudflare Workers
---

Deploy the Vault app to Cloudflare Workers.

## Steps

1. Build the frontend:
   ```bash
   cd /Users/coleschaffer/Desktop/Ad\ Vault/app && npm run build
   ```

2. Deploy to Cloudflare:
   ```bash
   cd /Users/coleschaffer/Desktop/Ad\ Vault && npx wrangler deploy
   ```

3. Report the deployment URL to the user (should be https://vaultvaultvault.com or the workers.dev URL)

## Notes

- This deploys both frontend (static assets) and API (Worker) together
- The D1 database and R2 storage bindings are configured in wrangler.toml
- Secrets (OPENAI_API_KEY, GEMINI_API_KEY) are set in Cloudflare dashboard
