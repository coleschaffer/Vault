// OpenAI Whisper API integration for Ad Vault
// Uses whisper-1 model (OpenAI's API model based on large-v3-turbo)

/**
 * Transcribe audio/video using OpenAI Whisper API
 * @param {string} openaiKey - OpenAI API key
 * @param {ArrayBuffer} audioData - Audio/video file data
 * @param {string} filename - Original filename (for format detection)
 */
export async function transcribeWithWhisper(openaiKey, audioData, filename) {
  const formData = new FormData();

  // Create a Blob from the ArrayBuffer
  const blob = new Blob([audioData], { type: getMimeType(filename) });
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1'); // OpenAI's Whisper API model
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return formatWhisperResult(result);
}

/**
 * Format Whisper result into our ad vault format
 */
function formatWhisperResult(result) {
  const segments = result.segments || [];

  return {
    fullTranscript: result.text,
    segments: segments.map((seg, i) => ({
      id: i + 1,
      start: seg.start,
      end: seg.end,
      timestamp: formatTimestamp(seg.start, seg.end),
      transcript: seg.text.trim()
    })),
    language: result.language,
    duration: result.duration
  };
}

/**
 * Format seconds to MM:SS-MM:SS timestamp
 */
function formatTimestamp(start, end) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  return `${formatTime(start)}-${formatTime(end)}`;
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'video/webm',
    'm4a': 'audio/m4a',
    'ogg': 'audio/ogg'
  };
  return mimeTypes[ext] || 'video/mp4';
}
