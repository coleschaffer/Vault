#!/usr/bin/env python3
"""
Fetch video and metadata from X.com (Twitter) post.

Usage:
    python scripts/fetch_x_video.py <tweet_url> [--output-dir <dir>]

Examples:
    python scripts/fetch_x_video.py https://x.com/user/status/123456789
    python scripts/fetch_x_video.py https://twitter.com/user/status/123456789 --output-dir app/public/videos
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime

try:
    import yt_dlp
except ImportError:
    print("Error: yt-dlp not installed. Run: pip install yt-dlp")
    sys.exit(1)


def extract_tweet_id(url: str) -> str:
    """Extract tweet ID from X.com/Twitter URL."""
    # Match patterns like:
    # https://x.com/user/status/123456789
    # https://twitter.com/user/status/123456789
    match = re.search(r'/status/(\d+)', url)
    if match:
        return match.group(1)
    raise ValueError(f"Could not extract tweet ID from URL: {url}")


def fetch_video(url: str, output_dir: str = ".") -> dict:
    """
    Download video and extract metadata from X.com post.

    Returns:
        dict with video path and metadata
    """
    tweet_id = extract_tweet_id(url)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Configure yt-dlp
    ydl_opts = {
        'outtmpl': str(output_path / f'{tweet_id}.%(ext)s'),
        'format': 'best[ext=mp4]/best',
        'writeinfojson': True,
        'quiet': False,
        'no_warnings': False,
    }

    print(f"Fetching video from: {url}")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    # Find the downloaded video file
    video_files = list(output_path.glob(f"{tweet_id}.*"))
    video_file = next((f for f in video_files if f.suffix in ['.mp4', '.webm', '.mkv']), None)

    if not video_file:
        raise FileNotFoundError(f"No video file found for tweet {tweet_id}")

    return {
        "tweet_id": tweet_id,
        "url": url,
        "video_path": str(video_file),
        "title": info.get("title", ""),
        "description": info.get("description", ""),
        "uploader": info.get("uploader", ""),
        "uploader_id": info.get("uploader_id", ""),
        "duration": info.get("duration"),
        "view_count": info.get("view_count"),
        "like_count": info.get("like_count"),
        "repost_count": info.get("repost_count"),
        "upload_date": info.get("upload_date"),
        "fetched_at": datetime.now().isoformat()
    }


def generate_ad_stub(metadata: dict) -> dict:
    """Generate a stub ad entry for ads.js."""
    tweet_id = metadata["tweet_id"]

    return {
        "id": tweet_id,
        "title": f"[TODO] {metadata.get('description', '')[:50]}...",
        "videoSrc": f"/videos/{Path(metadata['video_path']).name}",
        "source": metadata["url"],
        "creator": f"@{metadata.get('uploader_id', 'unknown')}",
        "product": "[TODO: Product/Service]",
        "vertical": "[TODO: Vertical]",
        "type": "[TODO: Organic/Paid/Affiliate]",
        "hook": {
            "textOverlay": "[TODO: Text overlay from video]",
            "spoken": "[TODO: Run transcription]"
        },
        "fullTranscript": "[TODO: Run transcription]",
        "whyItWorked": {
            "summary": "[TODO: Why this ad works]",
            "tactics": [],
            "keyLesson": "[TODO: Key takeaway]"
        },
        "shots": [],
        "tags": [],
        "dateAdded": datetime.now().strftime("%Y-%m-%d"),
        "_metadata": metadata
    }


def main():
    parser = argparse.ArgumentParser(
        description="Fetch video and metadata from X.com post"
    )
    parser.add_argument("url", help="X.com or Twitter URL")
    parser.add_argument(
        "--output-dir", "-o",
        default="app/public/videos",
        help="Output directory for video (default: app/public/videos)"
    )
    parser.add_argument(
        "--generate-stub", "-g",
        action="store_true",
        help="Generate a stub ad entry for ads.js"
    )

    args = parser.parse_args()

    try:
        metadata = fetch_video(args.url, args.output_dir)

        print("\n" + "=" * 60)
        print("VIDEO DOWNLOADED")
        print("=" * 60)
        print(f"Path: {metadata['video_path']}")
        print(f"Creator: @{metadata.get('uploader_id', 'unknown')}")
        print(f"Duration: {metadata.get('duration', 'unknown')}s")

        if args.generate_stub:
            stub = generate_ad_stub(metadata)
            print("\n" + "=" * 60)
            print("AD STUB (add to ads.js)")
            print("=" * 60)
            print(json.dumps(stub, indent=2))

        print("\n" + "=" * 60)
        print("NEXT STEPS")
        print("=" * 60)
        print(f"1. Transcribe: python scripts/transcribe.py {metadata['video_path']}")
        print("2. Add entry to app/src/data/ads.js")
        print("3. Fill in hook, whyItWorked, shots, and tags")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
