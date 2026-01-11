# Ad Vault - Cloudflare Deployment Guide

This guide walks you through deploying Ad Vault to Cloudflare (Pages + Workers + D1 + R2).

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install with `npm install -g wrangler`
3. **Node.js**: Version 18+

## Quick Deploy (5 minutes)

### Step 1: Login to Cloudflare

```bash
wrangler login
```

### Step 2: Create D1 Database

```bash
wrangler d1 create ad-vault-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ad-vault-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### Step 3: Create R2 Bucket

```bash
wrangler r2 bucket create ad-vault-storage
```

### Step 4: Run Database Schema

```bash
wrangler d1 execute ad-vault-db --file=./workers/schema.sql
```

### Step 5: Set API Keys (Secrets)

```bash
wrangler secret put OPENAI_API_KEY
# Enter your OpenAI API key when prompted

wrangler secret put GEMINI_API_KEY
# Enter your Gemini API key when prompted
```

### Step 6: Deploy Worker

```bash
wrangler deploy
```

Note the Worker URL (e.g., `https://ad-vault-api.your-subdomain.workers.dev`)

### Step 7: Update Frontend Config

Edit `app/src/config.js` and set the production API URL:

```javascript
export const API_BASE = isDev
  ? 'http://localhost:8787'
  : 'https://ad-vault-api.your-subdomain.workers.dev';
```

### Step 8: Deploy Frontend to Cloudflare Pages

```bash
cd app
npm run build
wrangler pages deploy dist --project-name=ad-vault
```

## GitHub Auto-Deploy Setup

### Connect to GitHub

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click "Create a project" → "Connect to Git"
3. Select your `ad-vault` repository
4. Configure build settings:
   - **Build command**: `cd app && npm install && npm run build`
   - **Build output directory**: `app/dist`
   - **Root directory**: `/`

### Environment Variables in Cloudflare Dashboard

Add these in Pages → Settings → Environment variables:
- `VITE_API_BASE`: Your Worker URL

## Migrate Existing Data

If you have existing data in JS files:

```bash
# Generate migration SQL
node workers/migrate-data.js

# Run migration
wrangler d1 execute ad-vault-db --file=./workers/seed-data.sql
```

## Local Development

```bash
# Start Worker locally
wrangler dev

# In another terminal, start frontend
cd app && npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Edge                     │
├─────────────────────────────────────────────────────┤
│  Pages (Frontend)     │     Workers (API)           │
│  - React App          │     - /api/ads              │
│  - Static Assets      │     - /api/images           │
│                       │     - /api/tweets           │
│                       │     - /api/process-ad       │
├───────────────────────┼─────────────────────────────┤
│        D1 Database    │        R2 Storage           │
│  - ads, images,       │  - Videos (.mp4)            │
│    tweets tables      │  - Images (.jpg)            │
│  - Tactics, shots     │  - Thumbnails               │
└─────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
    ┌───────────┐           ┌───────────────┐
    │  OpenAI   │           │    Gemini     │
    │  Whisper  │           │      AI       │
    └───────────┘           └───────────────┘
```

## Costs

- **Cloudflare Pages**: Free (unlimited sites)
- **Cloudflare Workers**: Free (100k requests/day)
- **Cloudflare D1**: Free (5GB storage)
- **Cloudflare R2**: Free (10GB storage, 1M requests/month)
- **OpenAI Whisper**: ~$0.006/minute of audio

**Total**: Essentially free for personal use!

## Troubleshooting

### "D1 database not found"
Make sure you've created the database and updated `wrangler.toml` with the correct `database_id`.

### "R2 bucket not found"
Run `wrangler r2 bucket create ad-vault-storage`.

### "Unauthorized" errors
Make sure you've set the API secrets:
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put GEMINI_API_KEY
```

### CORS issues
The Worker includes CORS headers. If issues persist, check that your frontend is calling the correct Worker URL.
