#!/usr/bin/env python3
"""
Simple API server for fetching X.com tweet data (images + text).
Run with: python scripts/server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import re
import os
import requests
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = 'AIzaSyCu47TAZqfXJwHSEq_dm1n84CRpbKFAwL8'
GEMINI_MODEL = 'gemini-3-flash-preview'

def extract_tweet_id(url):
    """Extract tweet ID from X.com or Twitter URL."""
    # Handle various URL formats
    patterns = [
        r'(?:twitter|x)\.com/\w+/status/(\d+)',
        r'(?:twitter|x)\.com/i/web/status/(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def fetch_tweet_with_ytdlp(url):
    """Use yt-dlp to extract tweet metadata."""
    try:
        result = subprocess.run(
            ['yt-dlp', '--dump-json', '--no-download', url],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception as e:
        print(f"yt-dlp error: {e}")
    return None

def fetch_tweet_syndication(tweet_id):
    """Try to fetch via Twitter's syndication API."""
    try:
        # This endpoint sometimes works for public tweets
        url = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&token=0"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Syndication API error: {e}")
    return None

def fetch_tweet_fxtwitter(tweet_id):
    """Try to fetch via FXTwitter API (provides full text)."""
    try:
        url = f"https://api.fxtwitter.com/status/{tweet_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"FXTwitter API error: {e}")
    return None

def fetch_tweet_vxtwitter(tweet_id):
    """Try to fetch via VXTwitter API (provides full text)."""
    try:
        url = f"https://api.vxtwitter.com/status/{tweet_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"VXTwitter API error: {e}")
    return None

def extract_json_from_text(text):
    """Extract JSON object from tweet text using simple parsing."""
    if not text:
        return None

    # Try to find JSON in the text - look for { ... } pattern
    # The prompts usually start with { and contain nested objects
    brace_count = 0
    start_idx = None

    for i, char in enumerate(text):
        if char == '{':
            if brace_count == 0:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                json_str = text[start_idx:i+1]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # Try to fix common issues
                    start_idx = None
                    continue

    return None

def extract_prompt_from_text(text):
    """Extract prompt from tweet text - handles both JSON and natural language formats.

    Returns: (prompt_string, is_json)
    - prompt_string: The extracted prompt text
    - is_json: True if it's JSON format, False if natural language
    """
    if not text:
        return None, False

    # Normalize whitespace - replace non-breaking spaces with regular spaces
    # Twitter/X often uses \xa0 (NBSP) for indentation which breaks JSON parsing
    text = text.replace('\xa0', ' ')

    # Clean up citation annotations that some AI tools add (e.g., [cite_start], [cite: 4])
    text = re.sub(r'\[cite_start\]', '', text)
    text = re.sub(r'\[cite:\s*\d+\]', '', text)

    # First, try to extract JSON prompt
    json_prompt = extract_json_prompt(text)
    if json_prompt:
        return json_prompt, True

    # If no JSON found, try to extract natural language prompt
    # Look for "Prompt" with optional punctuation (: ! ?) and optional emoji, followed by text
    prompt_match = re.search(r'[Pp]rompt[!?:]?\s*[^\n]*\n+(.*)', text, re.DOTALL)
    if prompt_match:
        prompt_text = prompt_match.group(1).strip()
        # Clean up - remove any trailing hashtags or mentions at the very end
        prompt_text = re.sub(r'\s*#\w+\s*$', '', prompt_text)
        prompt_text = re.sub(r'\s*@\w+\s*$', '', prompt_text)
        if len(prompt_text) > 50:  # Minimum length to be considered a valid prompt
            return prompt_text, False

    return None, False


def extract_json_prompt(text):
    """Extract JSON prompt from text, preserving exact formatting."""
    if not text:
        return None

    # Find the first { and track braces to find the matching }
    brace_count = 0
    start_idx = None

    for i, char in enumerate(text):
        if char == '{':
            if brace_count == 0:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx is not None:
                json_str = text[start_idx:i+1]
                # Validate it's parseable JSON
                try:
                    json.loads(json_str)
                    return json_str
                except json.JSONDecodeError:
                    # Continue looking
                    start_idx = None
                    continue

    # If we have unclosed braces, try to close them
    if start_idx is not None and brace_count > 0:
        json_str = text[start_idx:].rstrip()

        # Remove trailing comma before adding closing braces
        json_str = re.sub(r',\s*$', '', json_str)

        # Add closing braces
        json_str += '\n' + '}' * brace_count

        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError as e:
            # Try fixing common JSON issues
            # Remove trailing commas before } or ]
            fixed = re.sub(r',(\s*[}\]])', r'\1', json_str)
            try:
                json.loads(fixed)
                return fixed
            except json.JSONDecodeError:
                print(f"JSON still invalid after fixes: {e}")

    return None


def extract_raw_json_string(text):
    """Legacy function - now wraps extract_prompt_from_text for backwards compatibility."""
    prompt, is_json = extract_prompt_from_text(text)
    return prompt if is_json else None

def extract_fallback_title_and_tags(prompt_json):
    """Extract basic title and tags from prompt JSON when Gemini fails."""
    if not prompt_json:
        return 'Untitled', []

    title_parts = []
    tags = []

    try:
        # Try to parse the JSON to extract key info
        prompt_str = prompt_json if isinstance(prompt_json, str) else json.dumps(prompt_json)
        prompt_lower = prompt_str.lower()

        # Common settings/locations
        settings = ['bedroom', 'bathroom', 'kitchen', 'living room', 'hotel', 'beach', 'pool',
                   'gym', 'studio', 'office', 'car', 'outdoor', 'street', 'club', 'sauna',
                   'yacht', 'restaurant', 'bar', 'balcony', 'rooftop', 'garden']
        for setting in settings:
            if setting in prompt_lower:
                title_parts.append(setting.title())
                tags.append(setting.title())
                break

        # Subject descriptors
        if 'woman' in prompt_lower or 'female' in prompt_lower or 'girl' in prompt_lower:
            tags.append('Woman')
        if 'man' in prompt_lower or 'male' in prompt_lower:
            tags.append('Man')

        # Hair colors
        hair_colors = ['blonde', 'brunette', 'redhead', 'black hair', 'brown hair', 'platinum']
        for hair in hair_colors:
            if hair in prompt_lower:
                tags.append(hair.title())
                break

        # Clothing items
        clothing = ['bikini', 'lingerie', 'dress', 'jeans', 'shorts', 'tank top', 'bodysuit',
                   'swimsuit', 'bra', 'underwear', 't-shirt', 'blouse', 'skirt']
        for item in clothing:
            if item in prompt_lower:
                tags.append(item.title())

        # Photo styles
        styles = ['selfie', 'mirror', 'candid', 'portrait', 'full body']
        for style in styles:
            if style in prompt_lower:
                tags.append(style.title())

        # Build title
        if not title_parts:
            title_parts.append('Photo')
        if tags and 'Woman' in tags:
            title_parts.append('- Woman')
        elif tags and 'Man' in tags:
            title_parts.append('- Man')

        # Add a clothing/style element to title
        for tag in tags:
            if tag.lower() in clothing:
                title_parts.append(f'in {tag}')
                break

        title = ' '.join(title_parts) if title_parts else 'AI Generated Image'

        # Ensure we have at least some tags
        if not tags:
            tags = ['AI Generated', 'Photorealistic']

        return title, tags[:8]  # Limit to 8 tags

    except Exception as e:
        print(f"Fallback extraction error: {e}")
        return 'AI Generated Image', ['AI Generated']


def generate_title_and_tags(text, prompt_json):
    """Use Gemini for generating title and tags, with fallback extraction."""
    if not text and not prompt_json:
        return '', []

    context = prompt_json if prompt_json else text

    gemini_prompt = f"""Based on this AI image generation prompt, generate a title and tags.

PROMPT:
{context[:4000]}

Generate:
1. A descriptive title (5-10 words) in format: "[Setting] - [Subject Description]"
   Example: "Cozy Bedroom - Young Woman in Pink Loungewear"

2. 5-10 relevant tags for categorization (setting, appearance, clothing, mood, style)

Respond with ONLY this JSON:
{{
  "title": "<generated title>",
  "tags": ["tag1", "tag2", ...]
}}"""

    try:
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': gemini_prompt}]}],
                'generationConfig': {
                    'temperature': 0.3,
                    'maxOutputTokens': 1024,
                }
            },
            timeout=30
        )

        data = response.json()

        if 'candidates' in data and data['candidates']:
            result_text = data['candidates'][0]['content']['parts'][0]['text']
            result_text = re.sub(r'```json\n?', '', result_text)
            result_text = re.sub(r'```\n?', '', result_text)
            result_text = result_text.strip()

            result = json.loads(result_text)
            title = result.get('title', '')
            tags = result.get('tags', [])

            # If Gemini returned empty, use fallback
            if title and tags:
                return title, tags

        # Gemini failed or returned empty, use fallback
        print("Gemini returned empty, using fallback extraction")
        return extract_fallback_title_and_tags(context)

    except Exception as e:
        print(f"Gemini title/tags error: {e}, using fallback")
        return extract_fallback_title_and_tags(context)

def extract_images_from_tweet(tweet_data):
    """Extract image URLs from tweet data."""
    images = []

    if not tweet_data:
        return images

    # From yt-dlp format
    if 'thumbnails' in tweet_data:
        for thumb in tweet_data.get('thumbnails', []):
            url = thumb.get('url', '')
            if 'pbs.twimg.com/media' in url:
                # Get highest quality version
                url = re.sub(r'\?.*$', '', url)
                if '?' not in url:
                    url = url + '?format=jpg&name=large'
                images.append(url)

    # From syndication format
    if 'mediaDetails' in tweet_data:
        for media in tweet_data.get('mediaDetails', []):
            if media.get('type') == 'photo':
                url = media.get('media_url_https', '')
                if url:
                    images.append(url + '?format=jpg&name=large')

    # Also check photos array
    if 'photos' in tweet_data:
        for photo in tweet_data.get('photos', []):
            url = photo.get('url', '')
            if url:
                images.append(url)

    # Deduplicate while preserving order
    seen = set()
    unique_images = []
    for img in images:
        base_url = re.sub(r'\?.*$', '', img)
        if base_url not in seen:
            seen.add(base_url)
            unique_images.append(img)

    return unique_images

@app.route('/api/fetch-tweet', methods=['POST'])
def fetch_tweet():
    """Fetch tweet data including images and text."""
    data = request.get_json()
    url = data.get('url', '')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return jsonify({'error': 'Invalid X.com/Twitter URL'}), 400

    # Try multiple methods to fetch tweet data
    tweet_data = None
    text = None
    images = []

    # Method 1: Try FXTwitter first (provides full text for long tweets)
    fx_data = fetch_tweet_fxtwitter(tweet_id)
    if fx_data and 'tweet' in fx_data:
        tweet_obj = fx_data['tweet']
        text = tweet_obj.get('text', '')
        # Get images from FXTwitter
        if 'media' in tweet_obj and 'photos' in tweet_obj['media']:
            for photo in tweet_obj['media']['photos']:
                if 'url' in photo:
                    images.append(photo['url'])
        tweet_data = fx_data
        print(f"FXTwitter: Got {len(text)} chars of text")

    # Method 2: Try VXTwitter as backup
    if not text or len(text) < 500:
        vx_data = fetch_tweet_vxtwitter(tweet_id)
        if vx_data and 'text' in vx_data:
            vx_text = vx_data.get('text', '')
            if len(vx_text) > len(text or ''):
                text = vx_text
                print(f"VXTwitter: Got {len(text)} chars of text")
            if not images and 'media_extended' in vx_data:
                for media in vx_data['media_extended']:
                    if media.get('type') == 'image':
                        images.append(media.get('url', ''))
            if not tweet_data:
                tweet_data = vx_data

    # Method 3: Try syndication API (for images if needed)
    syndication_data = fetch_tweet_syndication(tweet_id)
    if syndication_data:
        # Only use syndication text if we don't have better text
        if not text or len(text) < 200:
            synd_text = syndication_data.get('text', '')
            if len(synd_text) > len(text or ''):
                text = synd_text
        # Get images from syndication if we don't have any
        if not images:
            images = extract_images_from_tweet(syndication_data)
        if not tweet_data:
            tweet_data = syndication_data

    # Method 4: Try yt-dlp as last resort
    if not images:
        ytdlp_data = fetch_tweet_with_ytdlp(url)
        if ytdlp_data:
            if not text:
                text = ytdlp_data.get('description', '')
            images = extract_images_from_tweet(ytdlp_data)
            if not tweet_data:
                tweet_data = ytdlp_data

    if not tweet_data:
        return jsonify({'error': 'Could not fetch tweet data'}), 404

    # Extract prompt - handles both JSON and natural language formats
    raw_prompt_str, is_json = extract_prompt_from_text(text)
    prompt = None
    if raw_prompt_str:
        if is_json:
            try:
                # Parse JSON to validate, but we'll store using ordered parsing
                prompt = json.loads(raw_prompt_str, object_pairs_hook=lambda pairs: dict(pairs))
                print(f"Extracted JSON prompt with {len(raw_prompt_str)} chars")
            except json.JSONDecodeError as e:
                print(f"JSON parse error: {e}")
        else:
            # Natural language prompt - store as-is
            prompt = raw_prompt_str  # Store the string directly
            print(f"Extracted natural language prompt with {len(raw_prompt_str)} chars")

    # Use Gemini only for title and tags
    title, tags = generate_title_and_tags(text, raw_prompt_str)

    # Get creator handle
    creator = None
    if 'user' in tweet_data:
        creator = '@' + tweet_data['user'].get('screen_name', 'unknown')
    elif 'uploader' in tweet_data:
        creator = '@' + tweet_data.get('uploader', 'unknown')
    elif 'core' in tweet_data:
        creator = '@' + tweet_data.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {}).get('screen_name', 'unknown')

    # Extract from URL if not found
    if not creator:
        url_match = re.search(r'(?:twitter|x)\.com/([^/]+)/status', url)
        if url_match:
            creator = '@' + url_match.group(1)

    return jsonify({
        'success': True,
        'tweet_id': tweet_id,
        'text': text,
        'images': images,
        'prompt': prompt,
        'rawPrompt': raw_prompt_str,  # Exact string from tweet, preserves order
        'title': title or '',
        'tags': tags or [],
        'creator': creator,
        'source': url
    })

@app.route('/api/download-image', methods=['POST'])
def download_image():
    """Download an image and save it to the vault."""
    data = request.get_json()
    image_url = data.get('url', '')
    filename = data.get('filename', '')

    if not image_url or not filename:
        return jsonify({'error': 'URL and filename are required'}), 400

    # Ensure filename is safe
    filename = re.sub(r'[^a-zA-Z0-9_\-.]', '', filename)
    if not filename.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        filename += '.jpg'

    # Download the image
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        response = requests.get(image_url, headers=headers, timeout=30)
        response.raise_for_status()

        # Save to vault directory
        vault_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'images', 'vault')
        os.makedirs(vault_dir, exist_ok=True)

        filepath = os.path.join(vault_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(response.content)

        return jsonify({
            'success': True,
            'filename': filename,
            'path': f'/images/vault/{filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add-image-entry', methods=['POST'])
def add_image_entry():
    """Add a new entry to images.js."""
    data = request.get_json()

    required_fields = ['id', 'title', 'imageSrc', 'source', 'creator', 'tags', 'dateAdded']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Need either prompt or rawPrompt
    if 'prompt' not in data and 'rawPrompt' not in data:
        return jsonify({'error': 'Missing required field: prompt or rawPrompt'}), 400

    images_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'images.js')

    try:
        # Read current file
        with open(images_file, 'r') as f:
            content = f.read()

        # Find the array content - between "export const images = [" and the final "];"
        match = re.search(r'export const images = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse images.js'}), 500

        array_content = match.group(1).strip()

        # Get the raw prompt string - this preserves exact formatting from tweet
        raw_prompt = data.get('rawPrompt', '')
        if not raw_prompt and data.get('prompt'):
            if isinstance(data.get('prompt'), str):
                raw_prompt = data.get('prompt')
            else:
                raw_prompt = json.dumps(data.get('prompt', {}), indent=2)

        # Build the entry manually to preserve prompt formatting
        def escape_js_string(s):
            return json.dumps(s)

        # Check if raw_prompt is valid JSON
        is_json_prompt = False
        if raw_prompt:
            try:
                json.loads(raw_prompt)
                is_json_prompt = True
            except (json.JSONDecodeError, TypeError):
                is_json_prompt = False

        # Escape the raw prompt for storage as a JS template literal
        raw_prompt_escaped = raw_prompt.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

        tags_str = '[' + ', '.join(escape_js_string(t) for t in data.get('tags', [])) + ']'

        # Format prompt field based on type
        if is_json_prompt:
            # JSON prompt - write as JS object
            prompt_lines = raw_prompt.strip().split('\n')
            indented_prompt = prompt_lines[0]
            for line in prompt_lines[1:]:
                indented_prompt += '\n      ' + line
            prompt_field = indented_prompt
        else:
            # Natural language prompt - write as template literal
            prompt_field = f'`{raw_prompt_escaped}`'

        new_entry = f'''{{
    id: {escape_js_string(data['id'])},
    title: {escape_js_string(data['title'])},
    imageSrc: {escape_js_string(data['imageSrc'])},
    source: {escape_js_string(data['source'])},
    creator: {escape_js_string(data['creator'])},
    prompt: {prompt_field},
    rawPrompt: `{raw_prompt_escaped}`,
    tags: {tags_str},
    dateAdded: {escape_js_string(data['dateAdded'])}
  }}'''

        # Add to array
        if array_content:
            # There are existing entries - add comma and new entry
            new_array_content = array_content + ',\n  ' + new_entry
        else:
            # Empty array - just add the entry
            new_array_content = '\n  ' + new_entry + '\n'

        # Write back
        new_content = f'export const images = [{new_array_content}\n];\n'

        with open(images_file, 'w') as f:
            f.write(new_content)

        return jsonify({
            'success': True,
            'message': 'Image entry added to images.js'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-image', methods=['POST'])
def delete_image():
    """Delete an image entry from images.js and optionally the file."""
    data = request.get_json()
    image_id = data.get('id', '')
    delete_file = data.get('deleteFile', True)

    if not image_id:
        return jsonify({'error': 'Image ID is required'}), 400

    images_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'images.js')

    try:
        # Read current file
        with open(images_file, 'r') as f:
            content = f.read()

        # Parse the images array to find and remove the entry
        # Find the entry with matching id
        pattern = rf'\{{\s*id:\s*["\']' + re.escape(image_id) + r'["\'].*?\n\s*\}}'

        # More robust: read as module and manipulate
        # For simplicity, we'll use a different approach - find and remove the object

        # Find all image entries
        match = re.search(r'export const images = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse images.js'}), 500

        array_content = match.group(1)

        # Find the image entry to get its imageSrc before deleting
        image_src = None
        id_pattern = rf'id:\s*["\']' + re.escape(image_id) + r'["\']'
        if re.search(id_pattern, array_content):
            # Find imageSrc for this entry
            src_match = re.search(
                rf'\{{\s*id:\s*["\']' + re.escape(image_id) + r'["\'].*?imageSrc:\s*["\']([^"\']+)["\']',
                array_content,
                re.DOTALL
            )
            if src_match:
                image_src = src_match.group(1)

        # Remove the entry - find object boundaries
        # This is tricky with nested objects, so we'll parse more carefully
        new_entries = []
        brace_count = 0
        current_entry = ""
        in_entry = False

        for char in array_content:
            if char == '{':
                if brace_count == 0:
                    in_entry = True
                    current_entry = char
                else:
                    current_entry += char
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                current_entry += char
                if brace_count == 0 and in_entry:
                    # Check if this entry has our id
                    if not re.search(id_pattern, current_entry):
                        new_entries.append(current_entry)
                    current_entry = ""
                    in_entry = False
            elif in_entry:
                current_entry += char

        if len(new_entries) == array_content.count('id:'):
            return jsonify({'error': 'Image not found'}), 404

        # Rebuild the file
        if new_entries:
            new_array_content = ',\n  '.join(e.strip() for e in new_entries)
            new_content = f'export const images = [\n  {new_array_content}\n];\n'
        else:
            new_content = 'export const images = [];\n'

        with open(images_file, 'w') as f:
            f.write(new_content)

        # Delete the image file if requested
        if delete_file and image_src:
            file_path = os.path.join(
                os.path.dirname(__file__), '..', 'app', 'public',
                image_src.lstrip('/')
            )
            if os.path.exists(file_path):
                os.remove(file_path)

        return jsonify({
            'success': True,
            'message': 'Image deleted successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def fetch_single_tweet_data(url):
    """Helper function to fetch a single tweet's data (for parallel processing)."""
    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return {'url': url, 'error': 'Invalid X.com/Twitter URL', 'success': False}

    tweet_data = None
    text = None
    images = []

    # Method 1: Try FXTwitter first
    fx_data = fetch_tweet_fxtwitter(tweet_id)
    if fx_data and 'tweet' in fx_data:
        tweet_obj = fx_data['tweet']
        text = tweet_obj.get('text', '')
        if 'media' in tweet_obj and 'photos' in tweet_obj['media']:
            for photo in tweet_obj['media']['photos']:
                if 'url' in photo:
                    images.append(photo['url'])
        tweet_data = fx_data

    # Method 2: Try VXTwitter as backup
    if not text or len(text) < 500:
        vx_data = fetch_tweet_vxtwitter(tweet_id)
        if vx_data and 'text' in vx_data:
            vx_text = vx_data.get('text', '')
            if len(vx_text) > len(text or ''):
                text = vx_text
            if not images and 'media_extended' in vx_data:
                for media in vx_data['media_extended']:
                    if media.get('type') == 'image':
                        images.append(media.get('url', ''))
            if not tweet_data:
                tweet_data = vx_data

    # Method 3: Try syndication API
    syndication_data = fetch_tweet_syndication(tweet_id)
    if syndication_data:
        if not text or len(text) < 200:
            synd_text = syndication_data.get('text', '')
            if len(synd_text) > len(text or ''):
                text = synd_text
        if not images:
            images = extract_images_from_tweet(syndication_data)
        if not tweet_data:
            tweet_data = syndication_data

    # Method 4: Try yt-dlp as last resort
    if not images:
        ytdlp_data = fetch_tweet_with_ytdlp(url)
        if ytdlp_data:
            if not text:
                text = ytdlp_data.get('description', '')
            images = extract_images_from_tweet(ytdlp_data)
            if not tweet_data:
                tweet_data = ytdlp_data

    if not tweet_data:
        return {'url': url, 'error': 'Could not fetch tweet data', 'success': False}

    # Extract prompt - handles both JSON and natural language formats
    raw_prompt_str, is_json = extract_prompt_from_text(text)
    prompt = None
    if raw_prompt_str:
        if is_json:
            try:
                prompt = json.loads(raw_prompt_str, object_pairs_hook=lambda pairs: dict(pairs))
            except json.JSONDecodeError:
                pass
        else:
            # Natural language prompt
            prompt = raw_prompt_str

    # Generate title and tags
    title, tags = generate_title_and_tags(text, raw_prompt_str)

    # Get creator handle
    creator = None
    if 'user' in tweet_data:
        creator = '@' + tweet_data['user'].get('screen_name', 'unknown')
    elif 'uploader' in tweet_data:
        creator = '@' + tweet_data.get('uploader', 'unknown')
    elif 'core' in tweet_data:
        creator = '@' + tweet_data.get('core', {}).get('user_results', {}).get('result', {}).get('legacy', {}).get('screen_name', 'unknown')

    if not creator:
        url_match = re.search(r'(?:twitter|x)\.com/([^/]+)/status', url)
        if url_match:
            creator = '@' + url_match.group(1)

    return {
        'success': True,
        'url': url,
        'tweet_id': tweet_id,
        'text': text,
        'images': images,
        'prompt': prompt,
        'rawPrompt': raw_prompt_str,
        'title': title or '',
        'tags': tags or [],
        'creator': creator,
        'source': url
    }


@app.route('/api/fetch-tweets-batch', methods=['POST'])
def fetch_tweets_batch():
    """Fetch multiple tweets in parallel."""
    data = request.get_json()
    urls = data.get('urls', [])

    if not urls:
        return jsonify({'error': 'URLs array is required'}), 400

    # Filter out empty URLs
    urls = [u.strip() for u in urls if u.strip()]

    if not urls:
        return jsonify({'error': 'No valid URLs provided'}), 400

    print(f"[Batch] Fetching {len(urls)} tweets in parallel...")

    results = []

    # Use ThreadPoolExecutor for parallel fetching
    with ThreadPoolExecutor(max_workers=min(len(urls), 5)) as executor:
        # Submit all fetch tasks
        future_to_url = {executor.submit(fetch_single_tweet_data, url): url for url in urls}

        # Collect results as they complete
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                result = future.result()
                results.append(result)
                if result.get('success'):
                    print(f"[Batch] ✓ Fetched: {url[:50]}...")
                else:
                    print(f"[Batch] ✗ Failed: {url[:50]}... - {result.get('error')}")
            except Exception as e:
                print(f"[Batch] ✗ Exception for {url}: {e}")
                results.append({
                    'url': url,
                    'error': str(e),
                    'success': False
                })

    # Sort results to match original URL order
    url_to_result = {r['url']: r for r in results}
    sorted_results = [url_to_result.get(url, {'url': url, 'error': 'Unknown error', 'success': False}) for url in urls]

    successful = sum(1 for r in sorted_results if r.get('success'))
    print(f"[Batch] Complete: {successful}/{len(urls)} successful")

    return jsonify({
        'success': True,
        'results': sorted_results,
        'total': len(urls),
        'successful': successful
    })


@app.route('/api/add-images-batch', methods=['POST'])
def add_images_batch():
    """Add multiple image entries at once."""
    data = request.get_json()
    entries = data.get('entries', [])

    if not entries:
        return jsonify({'error': 'Entries array is required'}), 400

    images_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'images.js')
    results = []
    added_count = 0

    try:
        # Read current file
        with open(images_file, 'r') as f:
            content = f.read()

        match = re.search(r'export const images = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse images.js'}), 500

        array_content = match.group(1).strip()
        new_entries_str = []

        for entry in entries:
            try:
                # Download image first
                image_url = entry.get('imageUrl', '')
                filename = entry.get('filename', '')

                if not image_url or not filename:
                    results.append({'id': entry.get('id', 'unknown'), 'success': False, 'error': 'Missing imageUrl or filename'})
                    continue

                # Download the image
                headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
                response = requests.get(image_url, headers=headers, timeout=30)
                response.raise_for_status()

                vault_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'images', 'vault')
                os.makedirs(vault_dir, exist_ok=True)

                filepath = os.path.join(vault_dir, filename)
                with open(filepath, 'wb') as f:
                    f.write(response.content)

                # Build the JS entry
                def escape_js_string(s):
                    return json.dumps(s)

                raw_prompt = entry.get('rawPrompt', '')
                if not raw_prompt and entry.get('prompt'):
                    if isinstance(entry.get('prompt'), str):
                        raw_prompt = entry.get('prompt')
                    else:
                        raw_prompt = json.dumps(entry.get('prompt', {}), indent=2)

                # Check if raw_prompt is valid JSON
                is_json_prompt = False
                if raw_prompt:
                    try:
                        json.loads(raw_prompt)
                        is_json_prompt = True
                    except (json.JSONDecodeError, TypeError):
                        is_json_prompt = False

                raw_prompt_escaped = raw_prompt.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
                tags_str = '[' + ', '.join(escape_js_string(t) for t in entry.get('tags', [])) + ']'

                # Format prompt field based on type
                if is_json_prompt:
                    # JSON prompt - write as JS object
                    prompt_lines = raw_prompt.strip().split('\n')
                    indented_prompt = prompt_lines[0]
                    for line in prompt_lines[1:]:
                        indented_prompt += '\n      ' + line
                    prompt_field = indented_prompt
                else:
                    # Natural language prompt - write as template literal
                    prompt_field = f'`{raw_prompt_escaped}`'

                new_entry = f'''{{
    id: {escape_js_string(entry['id'])},
    title: {escape_js_string(entry['title'])},
    imageSrc: {escape_js_string(f"/images/vault/{filename}")},
    source: {escape_js_string(entry['source'])},
    creator: {escape_js_string(entry['creator'])},
    prompt: {prompt_field},
    rawPrompt: `{raw_prompt_escaped}`,
    tags: {tags_str},
    dateAdded: {escape_js_string(entry['dateAdded'])}
  }}'''

                new_entries_str.append(new_entry)
                results.append({'id': entry['id'], 'success': True})
                added_count += 1

            except Exception as e:
                results.append({'id': entry.get('id', 'unknown'), 'success': False, 'error': str(e)})

        # Add all new entries to the file
        if new_entries_str:
            if array_content:
                new_array_content = array_content + ',\n  ' + ',\n  '.join(new_entries_str)
            else:
                new_array_content = '\n  ' + ',\n  '.join(new_entries_str) + '\n'

            new_content = f'export const images = [{new_array_content}\n];\n'

            with open(images_file, 'w') as f:
                f.write(new_content)

        return jsonify({
            'success': True,
            'results': results,
            'added': added_count,
            'total': len(entries)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/add-tweet', methods=['POST'])
def add_tweet():
    """Add a new tweet entry to tweets.js."""
    data = request.get_json()
    url = data.get('url', '').strip()
    tags = data.get('tags', [])

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    if not tags:
        return jsonify({'error': 'At least one tag is required'}), 400

    tweets_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'tweets.js')

    try:
        # Read current file
        with open(tweets_file, 'r') as f:
            content = f.read()

        # Generate unique ID from URL
        tweet_id = extract_tweet_id(url)
        if not tweet_id:
            return jsonify({'error': 'Invalid X.com/Twitter URL'}), 400

        unique_id = f"tweet-{tweet_id}"

        # Check if tweet already exists
        if unique_id in content:
            return jsonify({'error': 'Tweet already exists in vault'}), 400

        # Find the array content
        match = re.search(r'export const tweets = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse tweets.js'}), 500

        array_content = match.group(1).strip()

        # Build the entry
        def escape_js_string(s):
            return json.dumps(s)

        tags_str = '[' + ', '.join(escape_js_string(t) for t in tags) + ']'
        today = __import__('datetime').date.today().isoformat()

        new_entry = f'''{{
    id: {escape_js_string(unique_id)},
    url: {escape_js_string(url)},
    tags: {tags_str},
    addedAt: {escape_js_string(today)}
  }}'''

        # Add to array
        if array_content:
            new_array_content = array_content + ',\n  ' + new_entry
        else:
            new_array_content = '\n  ' + new_entry + '\n'

        # Write back
        new_content = f'export const tweets = [{new_array_content}\n];\n'

        with open(tweets_file, 'w') as f:
            f.write(new_content)

        return jsonify({
            'success': True,
            'message': 'Tweet added to vault',
            'id': unique_id
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/add-tweets-batch', methods=['POST'])
def add_tweets_batch():
    """Add multiple tweets with the same tags."""
    data = request.get_json()
    urls = data.get('urls', [])
    tags = data.get('tags', [])

    if not urls:
        return jsonify({'error': 'URLs array is required'}), 400

    if not tags:
        return jsonify({'error': 'At least one tag is required'}), 400

    tweets_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'tweets.js')
    results = []
    added_count = 0

    try:
        # Read current file
        with open(tweets_file, 'r') as f:
            content = f.read()

        # Find the array content
        match = re.search(r'export const tweets = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse tweets.js'}), 500

        array_content = match.group(1).strip()
        new_entries = []

        def escape_js_string(s):
            return json.dumps(s)

        today = __import__('datetime').date.today().isoformat()
        tags_str = '[' + ', '.join(escape_js_string(t) for t in tags) + ']'

        for url in urls:
            url = url.strip()
            tweet_id = extract_tweet_id(url)

            if not tweet_id:
                results.append({'url': url, 'success': False, 'error': 'Invalid URL'})
                continue

            unique_id = f"tweet-{tweet_id}"

            # Check if already exists
            if unique_id in content or any(unique_id in e for e in new_entries):
                results.append({'url': url, 'success': False, 'error': 'Already exists'})
                continue

            new_entry = f'''{{
    id: {escape_js_string(unique_id)},
    url: {escape_js_string(url)},
    tags: {tags_str},
    addedAt: {escape_js_string(today)}
  }}'''

            new_entries.append(new_entry)
            results.append({'url': url, 'success': True, 'id': unique_id})
            added_count += 1

        # Add all new entries to file
        if new_entries:
            if array_content:
                new_array_content = array_content + ',\n  ' + ',\n  '.join(new_entries)
            else:
                new_array_content = '\n  ' + ',\n  '.join(new_entries) + '\n'

            new_content = f'export const tweets = [{new_array_content}\n];\n'

            with open(tweets_file, 'w') as f:
                f.write(new_content)

        return jsonify({
            'success': True,
            'results': results,
            'added': added_count,
            'total': len(urls)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/delete-tweet', methods=['POST'])
def delete_tweet():
    """Delete a tweet entry from tweets.js."""
    data = request.get_json()
    tweet_id = data.get('id', '')

    if not tweet_id:
        return jsonify({'error': 'Tweet ID is required'}), 400

    tweets_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'tweets.js')

    try:
        # Read current file
        with open(tweets_file, 'r') as f:
            content = f.read()

        # Find the array content
        match = re.search(r'export const tweets = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse tweets.js'}), 500

        array_content = match.group(1)

        # Check if tweet exists
        id_pattern = rf'id:\s*["\']' + re.escape(tweet_id) + r'["\']'
        if not re.search(id_pattern, array_content):
            return jsonify({'error': 'Tweet not found'}), 404

        # Parse and filter entries
        new_entries = []
        brace_count = 0
        current_entry = ""
        in_entry = False

        for char in array_content:
            if char == '{':
                if brace_count == 0:
                    in_entry = True
                    current_entry = char
                else:
                    current_entry += char
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                current_entry += char
                if brace_count == 0 and in_entry:
                    # Check if this entry has our id
                    if not re.search(id_pattern, current_entry):
                        new_entries.append(current_entry)
                    current_entry = ""
                    in_entry = False
            elif in_entry:
                current_entry += char

        # Rebuild the file
        if new_entries:
            new_array_content = ',\n  '.join(e.strip() for e in new_entries)
            new_content = f'export const tweets = [\n  {new_array_content}\n];\n'
        else:
            new_content = 'export const tweets = [\n];\n'

        with open(tweets_file, 'w') as f:
            f.write(new_content)

        return jsonify({
            'success': True,
            'message': 'Tweet deleted successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def download_twitter_video_fxtwitter(url, output_dir):
    """Download Twitter video using FXTwitter API."""
    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        raise ValueError("Invalid Twitter URL")

    # Extract username from URL
    username_match = re.search(r'(?:twitter|x)\.com/([^/]+)/status', url)
    if not username_match:
        raise ValueError("Could not extract username from URL")
    username = username_match.group(1)

    # Use FXTwitter API
    fx_url = f"https://api.fxtwitter.com/{username}/status/{tweet_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    response = requests.get(fx_url, headers=headers, timeout=30)
    if response.status_code != 200:
        raise Exception(f"FXTwitter API error: {response.status_code}")

    data = response.json()
    if data.get("code") != 200:
        raise Exception(f"FXTwitter error: {data.get('message', 'Unknown error')}")

    tweet = data.get("tweet", {})
    media = tweet.get("media", {})
    videos = media.get("videos", [])

    if not videos:
        raise Exception("No video found in tweet")

    # Get highest quality video (highest bitrate mp4)
    video_info = videos[0]
    formats = video_info.get("formats", [])

    # Filter for mp4 and sort by bitrate
    mp4_formats = [f for f in formats if f.get("container") == "mp4"]
    if mp4_formats:
        best_format = max(mp4_formats, key=lambda x: x.get("bitrate", 0))
        video_url = best_format.get("url")
    else:
        # Fallback to the default URL
        video_url = video_info.get("url")

    if not video_url:
        raise Exception("No video URL found")

    # Download the video
    video_response = requests.get(video_url, timeout=120)
    if video_response.status_code != 200:
        raise Exception(f"Failed to download video: {video_response.status_code}")

    # Save to file
    os.makedirs(output_dir, exist_ok=True)
    video_path = os.path.join(output_dir, f"{tweet_id}.mp4")
    with open(video_path, 'wb') as f:
        f.write(video_response.content)

    # Return metadata from fxtwitter
    author = tweet.get("author", {})
    return {
        "tweet_id": tweet_id,
        "url": url,
        "video_path": video_path,
        "uploader": author.get("name", ""),
        "uploader_id": author.get("screen_name", ""),
        "description": tweet.get("text", "")
    }


def generate_thumbnails_for_shots(video_path, shots, tweet_id):
    """Generate thumbnail images for each shot using ffmpeg."""
    thumbnails_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'thumbnails', tweet_id)
    os.makedirs(thumbnails_dir, exist_ok=True)

    for shot in shots:
        shot_id = shot.get('id', 1)
        start_time = shot.get('startTime', 0)
        # Extract frame at 0.5 seconds into the shot (or at start if shot is too short)
        frame_time = start_time + 0.5
        output_path = os.path.join(thumbnails_dir, f"shot_{shot_id:02d}.jpg")

        try:
            subprocess.run([
                'ffmpeg', '-y', '-ss', str(frame_time), '-i', video_path,
                '-vframes', '1', '-q:v', '2', output_path
            ], capture_output=True, timeout=30)
            shot['thumbnail'] = f"/thumbnails/{tweet_id}/shot_{shot_id:02d}.jpg"
        except Exception as e:
            print(f"Thumbnail generation failed for shot {shot_id}: {e}")
            shot['thumbnail'] = None

    return shots


def analyze_ad_with_gemini(transcript, tweet_text, shots):
    """Use Gemini to analyze the ad and generate title, tactics, shot descriptions."""
    prompt = f"""Analyze this video ad transcript and generate structured analysis.

TWEET TEXT (context about the ad):
{tweet_text[:2000] if tweet_text else 'N/A'}

FULL TRANSCRIPT:
{transcript}

SHOT SEGMENTS (with timestamps and spoken words):
{json.dumps([{"id": s["id"], "timestamp": s["timestamp"], "transcript": s["transcript"]} for s in shots], indent=2)}

Generate a complete ad analysis in this EXACT JSON format:
{{
  "title": "Catchy 5-10 word title describing the ad concept",
  "product": "Product/Service being advertised (e.g. 'Personal Loans', 'Weight Loss App')",
  "vertical": "Industry vertical (e.g. 'Finance/Loans', 'Health/Fitness', 'E-commerce')",
  "type": "Ad type: 'Affiliate', 'Paid', or 'Organic'",
  "hook": {{
    "textOverlay": "The attention-grabbing text shown on screen in first 3 seconds (ALL CAPS typical)",
    "spoken": "First sentence spoken that hooks the viewer"
  }},
  "whyItWorked": {{
    "summary": "2-3 sentence explanation of why this ad is effective",
    "tactics": [
      {{"name": "Tactic Name", "description": "How this tactic is used in the ad"}},
      {{"name": "Another Tactic", "description": "Description of the tactic"}}
    ],
    "keyLesson": "One sentence key takeaway for other advertisers"
  }},
  "shots": [
    {{
      "id": 1,
      "description": "Visual description of what's shown on screen",
      "textOverlay": "Text shown on screen during this segment (or empty string if none)",
      "purpose": "Why this shot works / its role in the ad"
    }}
  ],
  "tags": ["tag1", "tag2", "tag3"]
}}

Important:
- For shots, provide analysis for EACH shot ID from the input
- Be specific about visual descriptions based on what's likely shown
- Identify real advertising tactics being used
- Generate 5-8 relevant tags

Respond with ONLY the JSON, no other text."""

    try:
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}',
            headers={'Content-Type': 'application/json'},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {
                    'temperature': 0.4,
                    'maxOutputTokens': 4096,
                }
            },
            timeout=60
        )

        data = response.json()

        if 'candidates' in data and data['candidates']:
            result_text = data['candidates'][0]['content']['parts'][0]['text']
            # Clean up markdown code blocks
            result_text = re.sub(r'```json\n?', '', result_text)
            result_text = re.sub(r'```\n?', '', result_text)
            result_text = result_text.strip()

            analysis = json.loads(result_text)
            return analysis

    except Exception as e:
        print(f"Gemini ad analysis error: {e}")

    return None


def process_single_ad(url, add_to_file=True):
    """Process a single ad - download video, transcribe, optionally add to ads.js."""
    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return {'success': False, 'error': 'Invalid URL'}

    try:
        output_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'videos')

        # Step 1: Download video using FXTwitter API
        print(f"[{tweet_id}] Downloading video via FXTwitter...")
        metadata = download_twitter_video_fxtwitter(url, output_dir)
        video_path = metadata["video_path"]

        # Step 2: Transcribe with Whisper large-v3
        print(f"[{tweet_id}] Transcribing with Whisper large-v3...")
        import sys
        scripts_dir = os.path.dirname(__file__)
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)

        from transcribe import transcribe_video, format_for_ad_vault
        whisper_result = transcribe_video(video_path, model_name="large-v3")
        transcript_data = format_for_ad_vault(whisper_result)

        # Step 3: Build initial shots from transcript segments
        from datetime import datetime
        shots = []
        for i, seg in enumerate(transcript_data["segments"], 1):
            shots.append({
                "id": i,
                "startTime": seg["start"],
                "endTime": seg["end"],
                "timestamp": seg["timestamp"],
                "type": "video",
                "transcript": seg["transcript"]
            })

        # Step 4: Analyze ad with Gemini AI
        print(f"[{tweet_id}] Analyzing ad with Gemini AI...")
        tweet_text = metadata.get('description', '')
        analysis = analyze_ad_with_gemini(transcript_data["fullTranscript"], tweet_text, shots)

        # Step 5: Generate thumbnails for each shot
        print(f"[{tweet_id}] Generating thumbnails...")
        shots = generate_thumbnails_for_shots(video_path, shots, tweet_id)

        # Step 6: Merge AI analysis into ad stub
        if analysis:
            # Merge shot analysis from AI
            ai_shots = {s['id']: s for s in analysis.get('shots', [])}
            for shot in shots:
                if shot['id'] in ai_shots:
                    ai_shot = ai_shots[shot['id']]
                    shot['description'] = ai_shot.get('description', '[Describe what\'s shown]')
                    shot['textOverlay'] = ai_shot.get('textOverlay', '')
                    shot['purpose'] = ai_shot.get('purpose', '[Why this works]')
                else:
                    shot['description'] = '[Describe what\'s shown]'
                    shot['textOverlay'] = ''
                    shot['purpose'] = '[Why this works]'

            ad_stub = {
                "id": tweet_id,
                "title": analysis.get('title', f"Ad from @{metadata.get('uploader_id', 'unknown')}"),
                "videoSrc": f"/videos/{tweet_id}.mp4",
                "source": url,
                "creator": f"@{metadata.get('uploader_id', 'unknown')}",
                "product": analysis.get('product', '[Unknown Product]'),
                "vertical": analysis.get('vertical', '[Unknown Vertical]'),
                "type": analysis.get('type', 'Unknown'),
                "hook": analysis.get('hook', {
                    "textOverlay": "",
                    "spoken": transcript_data["segments"][0]["transcript"] if transcript_data["segments"] else ""
                }),
                "fullTranscript": transcript_data["fullTranscript"],
                "whyItWorked": analysis.get('whyItWorked', {
                    "summary": "[Analysis pending]",
                    "tactics": [],
                    "keyLesson": "[Key lesson pending]"
                }),
                "shots": shots,
                "tags": analysis.get('tags', []),
                "dateAdded": datetime.now().strftime("%Y-%m-%d")
            }
        else:
            # Fallback if AI analysis fails
            for shot in shots:
                shot['description'] = '[Describe what\'s shown]'
                shot['textOverlay'] = ''
                shot['purpose'] = '[Why this works]'

            ad_stub = {
                "id": tweet_id,
                "title": f"Ad from @{metadata.get('uploader_id', 'unknown')}",
                "videoSrc": f"/videos/{tweet_id}.mp4",
                "source": url,
                "creator": f"@{metadata.get('uploader_id', 'unknown')}",
                "product": "[Unknown Product]",
                "vertical": "[Unknown Vertical]",
                "type": "Unknown",
                "hook": {
                    "textOverlay": "",
                    "spoken": transcript_data["segments"][0]["transcript"] if transcript_data["segments"] else ""
                },
                "fullTranscript": transcript_data["fullTranscript"],
                "whyItWorked": {
                    "summary": "[AI analysis failed - please add manually]",
                    "tactics": [],
                    "keyLesson": "[Key lesson pending]"
                },
                "shots": shots,
                "tags": [],
                "dateAdded": datetime.now().strftime("%Y-%m-%d")
            }

        if add_to_file:
            # Add to ads.js
            ads_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'ads.js')

            with open(ads_file, 'r') as f:
                content = f.read()

            if f'id: "{ad_stub["id"]}"' in content:
                return {'success': False, 'error': 'Already exists', 'id': ad_stub["id"]}

            match = re.search(r'export const ads = \[(.*)\];', content, re.DOTALL)
            if not match:
                return {'success': False, 'error': 'Could not parse ads.js'}

            array_content = match.group(1).strip()
            ad_json = json.dumps(ad_stub, indent=2, ensure_ascii=False)
            ad_js = re.sub(r'"([a-zA-Z_][a-zA-Z0-9_]*)":', r'\1:', ad_json)

            if array_content:
                new_array_content = array_content + ',\n  ' + ad_js
            else:
                new_array_content = '\n  ' + ad_js + '\n'

            new_content = f'export const ads = [{new_array_content}\n];\n'

            with open(ads_file, 'w') as f:
                f.write(new_content)

        print(f"[{tweet_id}] Done!")
        return {
            'success': True,
            'id': ad_stub["id"],
            'title': ad_stub["title"],
            'creator': ad_stub["creator"],
            'transcript_length': len(ad_stub["fullTranscript"]),
            'shots_count': len(ad_stub["shots"])
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}


@app.route('/api/process-ad', methods=['POST'])
def process_ad():
    """Process a single ad from X.com URL - fetch video, transcribe, add to vault."""
    data = request.get_json()
    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return jsonify({'error': 'Invalid X.com/Twitter URL'}), 400

    result = process_single_ad(url, add_to_file=True)

    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify({'error': result.get('error', 'Unknown error')}), 400


def download_video_for_batch(url):
    """Download a single video for batch processing using FXTwitter."""
    tweet_id = extract_tweet_id(url)
    if not tweet_id:
        return {'url': url, 'success': False, 'error': 'Invalid URL'}

    try:
        output_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'videos')
        metadata = download_twitter_video_fxtwitter(url, output_dir)
        return {'url': url, 'success': True, 'metadata': metadata}
    except Exception as e:
        return {'url': url, 'success': False, 'error': str(e)}


@app.route('/api/process-ads-batch', methods=['POST'])
def process_ads_batch():
    """Process multiple ads from X.com URLs with parallel downloads."""
    data = request.get_json()
    urls = data.get('urls', [])

    if not urls:
        return jsonify({'error': 'URLs array is required'}), 400

    # Clean URLs
    urls = [u.strip() for u in urls if u.strip() and extract_tweet_id(u.strip())]

    if not urls:
        return jsonify({'error': 'No valid URLs provided'}), 400

    print(f"[BATCH] Processing {len(urls)} ads...")

    # Step 1: Download all videos in parallel
    print(f"[BATCH] Downloading {len(urls)} videos in parallel...")
    download_results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        download_results = list(executor.map(download_video_for_batch, urls))

    # Filter successful downloads
    successful_downloads = [r for r in download_results if r.get('success')]
    failed_downloads = [r for r in download_results if not r.get('success')]

    print(f"[BATCH] Downloaded {len(successful_downloads)}/{len(urls)} videos")

    # Step 2: Transcribe videos (sequential to avoid memory issues with large-v3)
    print(f"[BATCH] Transcribing {len(successful_downloads)} videos with Whisper large-v3...")
    import sys
    scripts_dir = os.path.dirname(__file__)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    from transcribe import transcribe_video, format_for_ad_vault
    from datetime import datetime

    processed_ads = []
    for i, download in enumerate(successful_downloads):
        metadata = download['metadata']
        video_path = metadata['video_path']
        tweet_id = metadata['tweet_id']

        print(f"[BATCH] Transcribing {i+1}/{len(successful_downloads)}: {tweet_id}")

        try:
            whisper_result = transcribe_video(video_path, model_name="large-v3")
            transcript_data = format_for_ad_vault(whisper_result)

            ad_stub = {
                "id": tweet_id,
                "title": f"[TODO] {metadata.get('description', '')[:50]}...",
                "videoSrc": f"/videos/{tweet_id}.mp4",
                "source": download['url'],
                "creator": f"@{metadata.get('uploader_id', 'unknown')}",
                "product": "[TODO: Product/Service]",
                "vertical": "[TODO: Vertical]",
                "type": "[TODO: Organic/Paid/Affiliate]",
                "hook": {
                    "textOverlay": "[TODO: Text overlay from video]",
                    "spoken": transcript_data["segments"][0]["transcript"] if transcript_data["segments"] else ""
                },
                "fullTranscript": transcript_data["fullTranscript"],
                "whyItWorked": {
                    "summary": "[TODO: Why this ad works]",
                    "tactics": [],
                    "keyLesson": "[TODO: Key takeaway]"
                },
                "shots": [],
                "tags": [],
                "dateAdded": datetime.now().strftime("%Y-%m-%d")
            }

            for j, seg in enumerate(transcript_data["segments"], 1):
                ad_stub["shots"].append({
                    "id": j,
                    "startTime": seg["start"],
                    "endTime": seg["end"],
                    "timestamp": seg["timestamp"],
                    "type": "video",
                    "description": "[Describe what's shown]",
                    "transcript": seg["transcript"],
                    "textOverlay": "[TODO: Text on screen]",
                    "purpose": "[Why this works]"
                })

            processed_ads.append({
                'url': download['url'],
                'success': True,
                'ad_stub': ad_stub,
                'id': tweet_id,
                'title': ad_stub['title']
            })

        except Exception as e:
            processed_ads.append({
                'url': download['url'],
                'success': False,
                'error': f"Transcription failed: {str(e)}"
            })

    # Step 3: Add all successful ads to ads.js at once
    successful_ads = [a for a in processed_ads if a.get('success')]

    if successful_ads:
        print(f"[BATCH] Adding {len(successful_ads)} ads to vault...")
        ads_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'ads.js')

        with open(ads_file, 'r') as f:
            content = f.read()

        match = re.search(r'export const ads = \[(.*)\];', content, re.DOTALL)
        if match:
            array_content = match.group(1).strip()

            new_entries = []
            for ad in successful_ads:
                ad_stub = ad['ad_stub']
                # Check if already exists
                if f'id: "{ad_stub["id"]}"' not in content:
                    ad_json = json.dumps(ad_stub, indent=2, ensure_ascii=False)
                    ad_js = re.sub(r'"([a-zA-Z_][a-zA-Z0-9_]*)":', r'\1:', ad_json)
                    new_entries.append(ad_js)

            if new_entries:
                if array_content:
                    new_array_content = array_content + ',\n  ' + ',\n  '.join(new_entries)
                else:
                    new_array_content = '\n  ' + ',\n  '.join(new_entries) + '\n'

                new_content = f'export const ads = [{new_array_content}\n];\n'

                with open(ads_file, 'w') as f:
                    f.write(new_content)

    # Compile results
    all_results = []
    for r in failed_downloads:
        all_results.append({'url': r['url'], 'success': False, 'error': r.get('error', 'Download failed')})
    for r in processed_ads:
        if r.get('success'):
            all_results.append({'url': r['url'], 'success': True, 'id': r['id'], 'title': r['title']})
        else:
            all_results.append({'url': r['url'], 'success': False, 'error': r.get('error', 'Processing failed')})

    added_count = len([r for r in all_results if r.get('success')])
    print(f"[BATCH] Complete! Added {added_count}/{len(urls)} ads")

    return jsonify({
        'success': True,
        'results': all_results,
        'added': added_count,
        'total': len(urls)
    })


@app.route('/api/delete-ad', methods=['POST'])
def delete_ad():
    """Delete an ad entry from ads.js and optionally the video file."""
    data = request.get_json()
    ad_id = data.get('id', '')
    delete_file = data.get('deleteFile', True)

    if not ad_id:
        return jsonify({'error': 'Ad ID is required'}), 400

    ads_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'data', 'ads.js')

    try:
        with open(ads_file, 'r') as f:
            content = f.read()

        match = re.search(r'export const ads = \[(.*)\];', content, re.DOTALL)
        if not match:
            return jsonify({'error': 'Could not parse ads.js'}), 500

        array_content = match.group(1)

        # Check if ad exists
        id_pattern = rf'id:\s*["\']' + re.escape(str(ad_id)) + r'["\']'
        if not re.search(id_pattern, array_content):
            return jsonify({'error': 'Ad not found'}), 404

        # Find videoSrc before deleting
        video_src = None
        src_match = re.search(
            rf'\{{\s*id:\s*["\']' + re.escape(str(ad_id)) + r'["\'].*?videoSrc:\s*["\']([^"\']+)["\']',
            array_content,
            re.DOTALL
        )
        if src_match:
            video_src = src_match.group(1)

        # Parse and filter entries
        new_entries = []
        brace_count = 0
        current_entry = ""
        in_entry = False

        for char in array_content:
            if char == '{':
                if brace_count == 0:
                    in_entry = True
                    current_entry = char
                else:
                    current_entry += char
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                current_entry += char
                if brace_count == 0 and in_entry:
                    if not re.search(id_pattern, current_entry):
                        new_entries.append(current_entry)
                    current_entry = ""
                    in_entry = False
            elif in_entry:
                current_entry += char

        # Rebuild the file
        if new_entries:
            new_array_content = ',\n  '.join(e.strip() for e in new_entries)
            new_content = f'export const ads = [\n  {new_array_content}\n];\n'
        else:
            new_content = 'export const ads = [];\n'

        with open(ads_file, 'w') as f:
            f.write(new_content)

        # Delete the video file if requested
        if delete_file and video_src:
            file_path = os.path.join(
                os.path.dirname(__file__), '..', 'app', 'public',
                video_src.lstrip('/')
            )
            if os.path.exists(file_path):
                os.remove(file_path)

        return jsonify({
            'success': True,
            'message': 'Ad deleted successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Starting Ad Vault API server on http://localhost:3001")
    print("Endpoints:")
    print("  POST /api/fetch-tweet - Fetch single tweet images and text")
    print("  POST /api/fetch-tweets-batch - Fetch multiple tweets in parallel")
    print("  POST /api/download-image - Download and save image to vault")
    print("  POST /api/add-image-entry - Add single image entry")
    print("  POST /api/add-images-batch - Add multiple image entries")
    print("  POST /api/delete-image - Delete image entry")
    print("  POST /api/add-tweet - Add tweet to Tweet Vault")
    print("  POST /api/add-tweets-batch - Add multiple tweets with same tags")
    print("  POST /api/delete-tweet - Delete tweet from Tweet Vault")
    print("  POST /api/process-ad - Process ad (fetch video, transcribe, add)")
    print("  POST /api/process-ads-batch - Process multiple ads")
    print("  POST /api/delete-ad - Delete ad from vault")
    print("  GET /api/health - Health check")
    app.run(host='localhost', port=3001, debug=True)
