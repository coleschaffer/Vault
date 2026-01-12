# Vault

![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-7-646cff)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

A personal advertising swipe file for collecting, organizing, and analyzing successful video ads.

## Overview

Ad Vault is a comprehensive tool for marketers, entrepreneurs, and creators to study winning ad campaigns. Paste an X.com video URL, and the app automatically downloads the video, transcribes the audio with OpenAI Whisper, and generates an AI-powered breakdown of why the ad works using Google Gemini.

Also includes vaults for saving AI-generated images with prompts and curating interesting tweets.

## Features

### Ad Vault
- **Batch Import** - Paste multiple X.com URLs at once
- **Auto-Transcription** - OpenAI Whisper transcribes audio
- **AI Analysis** - Gemini 2.0 generates structured insights:
  - Catchy titles
  - Product/vertical classification
  - Hook identification (text overlay & spoken)
  - 5-8 advertising tactics breakdown
  - Key takeaways/lessons
  - Shot-by-shot analysis with timestamps
- **Interactive Player** - Seek to specific shots
- **Tag Organization** - Filter by topics

### Image Vault
- Store AI-generated images with prompts
- Reusable prompt library
- Tag-based filtering
- Image download

### Tweet Vault
- Save tweets by URL
- Tag organization
- Search and filter

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| AI | OpenAI Whisper, Google Gemini 2.0 Flash |
| Data Source | FXTwitter API |

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account
- OpenAI API key
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/coleschaffer/Vault.git
cd Vault

# Install dependencies
npm install
cd app && npm install && cd ..
```

### Development

```bash
# Start Wrangler dev server (API)
wrangler dev
# Runs on http://localhost:8788

# In another terminal, start React frontend
cd app && npm run dev
# Runs on http://localhost:5173
```

### Deployment

```bash
# Create D1 database
wrangler d1 create ad-vault-db

# Create R2 bucket
wrangler r2 bucket create ad-vault-storage

# Run database schema
wrangler d1 execute ad-vault-db --file=./workers/schema.sql

# Set API secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put GEMINI_API_KEY

# Deploy
wrangler deploy

# Deploy frontend
cd app && npm run build
wrangler pages deploy dist --project-name=ad-vault
```

## Project Structure

```
Vault/
├── app/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdCard.jsx       # Ad display with analysis
│   │   │   ├── AddAdForm.jsx    # URL import
│   │   │   ├── ImageVault.jsx   # Image grid
│   │   │   ├── TweetVault.jsx   # Tweet grid
│   │   │   └── ShotBreakdown.jsx # Shot analysis
│   │   ├── hooks/
│   │   │   └── useData.js       # Data fetching
│   │   └── services/
│   │       └── api.js           # API client
│   └── vite.config.js
├── functions/                    # Cloudflare Worker endpoints
│   └── api/
│       ├── ads.js               # GET/POST ads
│       ├── process-ad.js       # Download & analyze
│       ├── images.js           # Image operations
│       └── tweets.js           # Tweet operations
├── lib/                         # Shared utilities
│   ├── adProcessor.js          # Processing pipeline
│   ├── storage.js              # R2 uploads
│   └── whisper.js              # Transcription
├── workers/
│   └── schema.sql              # Database schema
├── wrangler.toml               # Cloudflare config
└── DEPLOY.md                   # Deployment guide
```

## Processing Pipeline

1. User pastes X.com URL
2. Worker fetches video from FXTwitter API
3. Whisper transcribes audio
4. Gemini analyzes and generates structured JSON:
   - Title, product, vertical
   - Hooks (text + spoken)
   - Tactics breakdown
   - Key takeaways
   - Shot-by-shot with timestamps
5. Video stored in R2, data in D1
6. Frontend displays rich analysis

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
```

### Wrangler Config

```toml
[[d1_databases]]
binding = "DB"
database_name = "ad-vault-db"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "ad-vault-storage"
```

## Database Schema

- **ads** - Video ads with metadata, transcripts, analysis
- **ad_tactics** - Tactics per ad (1-to-many)
- **ad_shots** - Shot breakdown per ad (1-to-many)
- **images** - AI images with prompts
- **tweets** - Saved tweet URLs with tags

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run scrape` | Scrape X.com data |
| `npm run transcribe` | Local transcription |

## License

MIT License
