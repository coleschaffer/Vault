#!/usr/bin/env python3
"""
Add a new ad from X.com URL - fetches video, transcribes, and generates ad stub.

Usage:
    python scripts/add_ad.py <x_url>

Example:
    python scripts/add_ad.py https://x.com/user/status/123456789
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Import our other scripts
from fetch_x_video import fetch_video, generate_ad_stub
from transcribe import transcribe_video, format_for_ad_vault


def add_ad_from_url(url: str, output_dir: str = "app/public/videos") -> dict:
    """
    Complete workflow to add an ad from X.com URL.

    1. Fetches video from X.com
    2. Transcribes using Whisper
    3. Generates ad stub with transcript data
    """
    print("=" * 60)
    print("AD VAULT - Add New Ad")
    print("=" * 60)
    print(f"URL: {url}\n")

    # Step 1: Fetch video
    print("[1/3] Fetching video from X.com...")
    metadata = fetch_video(url, output_dir)
    video_path = metadata["video_path"]
    print(f"      Downloaded: {video_path}\n")

    # Step 2: Transcribe
    print("[2/3] Transcribing with Whisper Large V3...")
    print("      (This may take a minute...)")
    whisper_result = transcribe_video(video_path, model_name="large-v3")
    transcript_data = format_for_ad_vault(whisper_result)
    print(f"      Transcript: {len(transcript_data['fullTranscript'])} chars\n")

    # Step 3: Generate ad stub
    print("[3/3] Generating ad entry...")
    ad_stub = generate_ad_stub(metadata)

    # Merge transcript data
    ad_stub["fullTranscript"] = transcript_data["fullTranscript"]
    ad_stub["hook"]["spoken"] = transcript_data["segments"][0]["transcript"] if transcript_data["segments"] else ""

    # Generate shots from transcript segments
    shots = []
    for i, seg in enumerate(transcript_data["segments"], 1):
        shots.append({
            "id": i,
            "startTime": seg["start"],
            "endTime": seg["end"],
            "timestamp": seg["timestamp"],
            "type": "video",
            "description": "[TODO: Describe what's shown on screen]",
            "transcript": seg["transcript"],
            "purpose": "[TODO: Why this shot works]"
        })

    ad_stub["shots"] = shots

    # Remove internal metadata
    if "_metadata" in ad_stub:
        del ad_stub["_metadata"]

    return ad_stub


def main():
    parser = argparse.ArgumentParser(
        description="Add a new ad from X.com URL"
    )
    parser.add_argument("url", help="X.com or Twitter URL")
    parser.add_argument(
        "--output-dir", "-o",
        default="app/public/videos",
        help="Output directory for video (default: app/public/videos)"
    )
    parser.add_argument(
        "--save", "-s",
        help="Save ad stub to JSON file"
    )

    args = parser.parse_args()

    try:
        ad_stub = add_ad_from_url(args.url, args.output_dir)

        print("\n" + "=" * 60)
        print("SUCCESS! Ad stub generated")
        print("=" * 60)

        ad_json = json.dumps(ad_stub, indent=2, ensure_ascii=False)

        if args.save:
            Path(args.save).write_text(ad_json)
            print(f"Saved to: {args.save}")
        else:
            print("\nAdd this to app/src/data/ads.js:\n")
            print(ad_json)

        print("\n" + "=" * 60)
        print("NEXT STEPS")
        print("=" * 60)
        print("1. Copy the JSON above")
        print("2. Add to the 'ads' array in app/src/data/ads.js")
        print("3. Fill in [TODO] fields:")
        print("   - title: Give it a memorable name")
        print("   - product: What product/service is being advertised")
        print("   - vertical: Industry (Finance, Health, etc.)")
        print("   - type: Organic, Paid, or Affiliate")
        print("   - hook.textOverlay: Text shown on screen in first 2-3 seconds")
        print("   - whyItWorked: Your analysis of why this ad converts")
        print("   - shots[].description: What's visually shown in each shot")
        print("   - shots[].purpose: Why this shot is effective")
        print("   - tags: Keywords for categorization")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
