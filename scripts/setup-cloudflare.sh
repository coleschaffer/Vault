#!/bin/bash
# Ad Vault - Cloudflare Setup Script
# This script sets up D1, R2, and deploys the Worker

set -e

echo "🚀 Ad Vault Cloudflare Setup"
echo "============================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "📋 Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

echo ""
echo "✅ Logged in to Cloudflare"
echo ""

# Create D1 Database
echo "📊 Creating D1 Database..."
D1_OUTPUT=$(wrangler d1 create ad-vault-db 2>&1 || true)

if echo "$D1_OUTPUT" | grep -q "already exists"; then
    echo "   Database already exists"
else
    echo "$D1_OUTPUT"
    # Extract database_id
    DB_ID=$(echo "$D1_OUTPUT" | grep "database_id" | awk -F'"' '{print $2}')
    if [ -n "$DB_ID" ]; then
        echo "   Database ID: $DB_ID"
        # Update wrangler.toml
        sed -i '' "s/database_id = \"placeholder-will-be-set-after-creation\"/database_id = \"$DB_ID\"/" wrangler.toml
        echo "   Updated wrangler.toml"
    fi
fi

echo ""

# Create R2 Bucket
echo "🪣 Creating R2 Bucket..."
R2_OUTPUT=$(wrangler r2 bucket create ad-vault-storage 2>&1 || true)

if echo "$R2_OUTPUT" | grep -q "already exists"; then
    echo "   Bucket already exists"
else
    echo "   Bucket created"
fi

echo ""

# Run schema
echo "📝 Running database schema..."
wrangler d1 execute ad-vault-db --file=./workers/schema.sql --remote

echo ""

# Set secrets
echo "🔐 Setting API secrets..."
echo "   You'll be prompted to enter your API keys."
echo ""

read -p "Enter your OpenAI API key: " OPENAI_KEY
echo "$OPENAI_KEY" | wrangler secret put OPENAI_API_KEY

read -p "Enter your Gemini API key: " GEMINI_KEY
echo "$GEMINI_KEY" | wrangler secret put GEMINI_API_KEY

echo ""

# Deploy worker
echo "🚀 Deploying Worker..."
wrangler deploy

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Note your Worker URL from the output above"
echo "2. Update app/src/config.js with your Worker URL"
echo "3. Deploy frontend: cd app && npm run build && wrangler pages deploy dist --project-name=ad-vault"
echo ""
echo "Or connect to GitHub for auto-deploy via Cloudflare Dashboard."
