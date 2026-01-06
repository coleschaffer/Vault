#!/bin/bash
# Setup script for Ad Vault transcription tools

echo "Setting up Ad Vault transcription..."

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required. Install it first."
    exit 1
fi

# Check for ffmpeg (required by whisper)
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo "Error: ffmpeg is required. Install it with: brew install ffmpeg"
        exit 1
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d "scripts/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv scripts/.venv
fi

# Activate and install dependencies
echo "Installing Python dependencies (this may take a while for Whisper)..."
source scripts/.venv/bin/activate
pip install -r scripts/requirements.txt

echo ""
echo "Setup complete!"
echo ""
echo "Usage:"
echo "  source scripts/.venv/bin/activate"
echo "  python scripts/transcribe.py <video_path>"
echo ""
echo "Or from app/ directory:"
echo "  npm run transcribe -- <video_path>"
