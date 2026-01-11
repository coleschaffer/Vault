// Ad Processing module for Ad Vault
// Handles video download, transcription, and AI analysis

import { transcribeWithWhisper } from './whisper.js';
import { uploadToR2 } from './storage.js';

/**
 * Extract tweet ID from X.com URL
 */
export function extractTweetId(url) {
  const patterns = [
    /(?:twitter|x)\.com\/\w+\/status\/(\d+)/,
    /(?:twitter|x)\.com\/i\/web\/status\/(\d+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract username from X.com URL
 */
export function extractUsername(url) {
  const match = url.match(/(?:twitter|x)\.com\/([^\/]+)\/status/);
  return match ? match[1] : null;
}

/**
 * Fetch tweet data and video URL from FXTwitter API
 */
export async function fetchTweetData(url) {
  const tweetId = extractTweetId(url);
  const username = extractUsername(url);

  if (!tweetId || !username) {
    throw new Error('Invalid Twitter/X URL');
  }

  const fxUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;
  const response = await fetch(fxUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`FXTwitter API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(`FXTwitter error: ${data.message || 'Unknown error'}`);
  }

  const tweet = data.tweet;
  const media = tweet.media || {};
  const videos = media.videos || [];

  if (videos.length === 0) {
    throw new Error('No video found in tweet');
  }

  // Get highest quality video
  const videoInfo = videos[0];
  const formats = videoInfo.formats || [];
  const mp4Formats = formats.filter(f => f.container === 'mp4');
  const bestFormat = mp4Formats.length > 0
    ? mp4Formats.reduce((a, b) => (a.bitrate || 0) > (b.bitrate || 0) ? a : b)
    : null;

  const videoUrl = bestFormat?.url || videoInfo.url;

  return {
    tweetId,
    videoUrl,
    author: tweet.author?.screen_name || username,
    authorName: tweet.author?.name || '',
    text: tweet.text || ''
  };
}

/**
 * Download video from URL
 */
export async function downloadVideo(videoUrl) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * Analyze ad with Gemini AI
 */
export async function analyzeAdWithGemini(geminiKey, transcript, tweetText, shots) {
  const prompt = `Analyze this video ad transcript and generate structured analysis.

TWEET TEXT (context about the ad):
${tweetText?.substring(0, 2000) || 'N/A'}

FULL TRANSCRIPT:
${transcript}

SHOT SEGMENTS (with timestamps and spoken words):
${JSON.stringify(shots.map(s => ({ id: s.id, timestamp: s.timestamp, transcript: s.transcript })), null, 2)}

Generate a complete ad analysis in this EXACT JSON format:
{
  "title": "Catchy 5-10 word title describing the ad concept",
  "product": "Product/Service being advertised (e.g. 'Personal Loans', 'Weight Loss App')",
  "vertical": "Industry vertical (e.g. 'Finance/Loans', 'Health/Fitness', 'E-commerce')",
  "type": "Ad type: 'Affiliate', 'Paid', or 'Organic'",
  "hook": {
    "textOverlay": "The attention-grabbing text shown on screen in first 3 seconds (ALL CAPS typical)",
    "spoken": "First sentence spoken that hooks the viewer"
  },
  "whyItWorked": {
    "summary": "2-3 sentence explanation of why this ad is effective",
    "tactics": [
      {"name": "Tactic Name", "description": "How this tactic is used in the ad"},
      {"name": "Another Tactic", "description": "Description of the tactic"}
    ],
    "keyLesson": "One sentence key takeaway for other advertisers"
  },
  "shots": [
    {
      "id": 1,
      "description": "Visual description of what's shown on screen",
      "textOverlay": "Text shown on screen during this segment (or empty string if none)",
      "purpose": "Why this shot works / its role in the ad"
    }
  ],
  "tags": ["tag1", "tag2", "tag3"]
}

Important:
- For shots, provide analysis for EACH shot ID from the input
- Be specific about visual descriptions based on what's likely shown
- Identify real advertising tactics being used
- Generate 5-8 relevant tags

Respond with ONLY the JSON, no other text.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096
        }
      })
    }
  );

  if (!response.ok) {
    console.error('Gemini API error:', response.status);
    return null;
  }

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    let resultText = data.candidates[0].content.parts[0].text;
    // Clean markdown
    resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      return JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse Gemini response:', e);
      return null;
    }
  }

  return null;
}

/**
 * Process a single ad - full pipeline
 */
export async function processAd(env, url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error('Invalid Twitter/X URL');
  }

  // Step 1: Fetch tweet data
  console.log(`[${tweetId}] Fetching tweet data...`);
  const tweetData = await fetchTweetData(url);

  // Step 2: Download video
  console.log(`[${tweetId}] Downloading video...`);
  const videoData = await downloadVideo(tweetData.videoUrl);

  // Step 3: Upload video to R2
  console.log(`[${tweetId}] Uploading to R2...`);
  const videoKey = `videos/${tweetId}.mp4`;
  await uploadToR2(env.STORAGE, videoKey, videoData, 'video/mp4');

  // Step 4: Transcribe with Whisper
  console.log(`[${tweetId}] Transcribing with Whisper...`);
  const transcriptData = await transcribeWithWhisper(
    env.OPENAI_API_KEY,
    videoData,
    `${tweetId}.mp4`
  );

  // Step 5: Build initial shots
  const shots = transcriptData.segments.map(seg => ({
    id: seg.id,
    startTime: seg.start,
    endTime: seg.end,
    timestamp: seg.timestamp,
    type: 'video',
    transcript: seg.transcript
  }));

  // Step 6: Analyze with Gemini
  console.log(`[${tweetId}] Analyzing with Gemini AI...`);
  const analysis = await analyzeAdWithGemini(
    env.GEMINI_API_KEY,
    transcriptData.fullTranscript,
    tweetData.text,
    shots
  );

  // Step 7: Generate thumbnails (extract frames at each shot timestamp)
  // Note: We can't do ffmpeg in Workers, so we'll skip thumbnails for now
  // or use a placeholder approach

  // Step 8: Build final ad object
  const today = new Date().toISOString().split('T')[0];

  if (analysis) {
    // Merge shot analysis
    const aiShots = {};
    (analysis.shots || []).forEach(s => { aiShots[s.id] = s; });

    shots.forEach(shot => {
      const aiShot = aiShots[shot.id] || {};
      shot.description = aiShot.description || '[Describe what\'s shown]';
      shot.textOverlay = aiShot.textOverlay || '';
      shot.purpose = aiShot.purpose || '[Why this works]';
      shot.thumbnail = null; // No thumbnail generation in Workers
    });

    return {
      id: tweetId,
      title: analysis.title || `Ad from @${tweetData.author}`,
      videoSrc: `/storage/${videoKey}`,
      source: url,
      creator: `@${tweetData.author}`,
      product: analysis.product || '[Unknown Product]',
      vertical: analysis.vertical || '[Unknown Vertical]',
      type: analysis.type || 'Unknown',
      hook: analysis.hook || {
        textOverlay: '',
        spoken: shots[0]?.transcript || ''
      },
      fullTranscript: transcriptData.fullTranscript,
      whyItWorked: analysis.whyItWorked || {
        summary: '[Analysis pending]',
        tactics: [],
        keyLesson: '[Key lesson pending]'
      },
      shots,
      tags: analysis.tags || [],
      dateAdded: today
    };
  } else {
    // Fallback without AI analysis
    shots.forEach(shot => {
      shot.description = '[Describe what\'s shown]';
      shot.textOverlay = '';
      shot.purpose = '[Why this works]';
      shot.thumbnail = null;
    });

    return {
      id: tweetId,
      title: `Ad from @${tweetData.author}`,
      videoSrc: `/storage/${videoKey}`,
      source: url,
      creator: `@${tweetData.author}`,
      product: '[Unknown Product]',
      vertical: '[Unknown Vertical]',
      type: 'Unknown',
      hook: {
        textOverlay: '',
        spoken: shots[0]?.transcript || ''
      },
      fullTranscript: transcriptData.fullTranscript,
      whyItWorked: {
        summary: '[AI analysis failed]',
        tactics: [],
        keyLesson: '[Key lesson pending]'
      },
      shots,
      tags: [],
      dateAdded: today
    };
  }
}
