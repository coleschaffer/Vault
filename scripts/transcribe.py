#!/usr/bin/env python3
"""
Transcribe video/audio files using OpenAI Whisper Large V3.

Usage:
    python scripts/transcribe.py <video_path> [--output json|text|srt]

Examples:
    python scripts/transcribe.py app/public/videos/JordanD1.mp4
    python scripts/transcribe.py video.mp4 --output json
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import whisper
except ImportError:
    print("Error: whisper not installed. Run: pip install openai-whisper")
    print("Also ensure you have ffmpeg installed: brew install ffmpeg")
    sys.exit(1)


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS format."""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"


def transcribe_video(video_path: str, model_name: str = "large-v3") -> dict:
    """
    Transcribe a video file using Whisper.

    Returns:
        dict with 'text' (full transcript) and 'segments' (timestamped segments)
    """
    print(f"Loading Whisper {model_name} model...")
    model = whisper.load_model(model_name)

    print(f"Transcribing: {video_path}")
    result = model.transcribe(
        video_path,
        language="en",
        word_timestamps=True,
        verbose=False
    )

    return result


def format_for_ad_vault(result: dict) -> dict:
    """
    Format Whisper output for Ad Vault data structure.

    Returns:
        dict with:
        - fullTranscript: complete transcript
        - segments: list of {timestamp, transcript} for each segment
    """
    segments = []

    for seg in result.get("segments", []):
        segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "timestamp": f"{format_timestamp(seg['start'])}-{format_timestamp(seg['end'])}",
            "transcript": seg["text"].strip()
        })

    return {
        "fullTranscript": result["text"].strip(),
        "segments": segments
    }


def output_json(data: dict, output_path: str = None):
    """Output as JSON."""
    json_str = json.dumps(data, indent=2, ensure_ascii=False)
    if output_path:
        Path(output_path).write_text(json_str)
        print(f"Saved to: {output_path}")
    else:
        print(json_str)


def output_text(data: dict):
    """Output as readable text."""
    print("\n" + "=" * 60)
    print("FULL TRANSCRIPT")
    print("=" * 60)
    print(data["fullTranscript"])
    print("\n" + "=" * 60)
    print("SEGMENTS (for Shot Breakdown)")
    print("=" * 60)
    for i, seg in enumerate(data["segments"], 1):
        print(f"\n[{i}] {seg['timestamp']}")
        print(f"    \"{seg['transcript']}\"")


def output_srt(result: dict, output_path: str = None):
    """Output as SRT subtitle format."""
    lines = []
    for i, seg in enumerate(result.get("segments", []), 1):
        start = seg["start"]
        end = seg["end"]

        # SRT timestamp format: HH:MM:SS,mmm
        start_str = f"{int(start//3600):02d}:{int((start%3600)//60):02d}:{int(start%60):02d},{int((start%1)*1000):03d}"
        end_str = f"{int(end//3600):02d}:{int((end%3600)//60):02d}:{int(end%60):02d},{int((end%1)*1000):03d}"

        lines.append(str(i))
        lines.append(f"{start_str} --> {end_str}")
        lines.append(seg["text"].strip())
        lines.append("")

    srt_content = "\n".join(lines)
    if output_path:
        Path(output_path).write_text(srt_content)
        print(f"Saved to: {output_path}")
    else:
        print(srt_content)


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe video/audio using Whisper Large V3"
    )
    parser.add_argument("video_path", help="Path to video or audio file")
    parser.add_argument(
        "--output", "-o",
        choices=["json", "text", "srt"],
        default="text",
        help="Output format (default: text)"
    )
    parser.add_argument(
        "--model", "-m",
        default="large-v3",
        help="Whisper model to use (default: large-v3)"
    )
    parser.add_argument(
        "--save", "-s",
        help="Save output to file (for json/srt formats)"
    )

    args = parser.parse_args()

    # Validate input file
    if not Path(args.video_path).exists():
        print(f"Error: File not found: {args.video_path}")
        sys.exit(1)

    # Transcribe
    result = transcribe_video(args.video_path, args.model)

    # Format and output
    if args.output == "json":
        data = format_for_ad_vault(result)
        output_json(data, args.save)
    elif args.output == "srt":
        output_srt(result, args.save)
    else:  # text
        data = format_for_ad_vault(result)
        output_text(data)

    print("\nDone!")


if __name__ == "__main__":
    main()
