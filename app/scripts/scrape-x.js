#!/usr/bin/env node

/**
 * X/Twitter Ad Scraper
 *
 * Downloads video and fetches tweet content from an X URL
 *
 * Usage: node scrape-x.js <twitter-url> [output-name]
 * Example: node scrape-x.js https://x.com/user/status/123456 my-ad
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = join(__dirname, '../public/videos');
const ADS_DATA_FILE = join(__dirname, '../src/data/ads.js');

// Ensure videos directory exists
if (!existsSync(VIDEOS_DIR)) {
  mkdirSync(VIDEOS_DIR, { recursive: true });
}

async function fetchTweetContent(url) {
  // Use Twitter's oEmbed API to get tweet content
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;

  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error(`oEmbed API returned ${response.status}`);
    }
    const data = await response.json();

    // Parse HTML to extract text
    const html = data.html;
    // Remove HTML tags and decode entities
    const text = html
      .replace(/<blockquote[^>]*>/gi, '')
      .replace(/<\/blockquote>/gi, '')
      .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&mdash;/g, '—')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .trim();

    return {
      text,
      author: data.author_name,
      authorUrl: data.author_url
    };
  } catch (error) {
    console.error('Warning: Could not fetch tweet content via oEmbed:', error.message);
    return null;
  }
}

function downloadVideo(url, outputName) {
  const outputPath = join(VIDEOS_DIR, `${outputName}.mp4`);

  console.log(`\nDownloading video to: ${outputPath}`);

  try {
    // Use yt-dlp to download the video
    execSync(
      `yt-dlp -f "best[ext=mp4]/best" -o "${outputPath}" "${url}"`,
      { stdio: 'inherit' }
    );

    return `/videos/${outputName}.mp4`;
  } catch (error) {
    console.error('Error downloading video:', error.message);
    return null;
  }
}

function generateAdId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function createAdTemplate(id, videoPath, tweetData, sourceUrl) {
  const template = `
  {
    id: "${id}",
    title: "TODO: Add title",
    videoSrc: "${videoPath}",
    source: "${sourceUrl}",
    creator: "${tweetData?.author || 'Unknown'}",
    product: "TODO: Identify product",

    whyItWorked: {
      summary: "TODO: Write summary of why this ad works",
      tactics: [
        {
          name: "TODO: Tactic 1",
          description: "TODO: Describe this tactic"
        }
      ],
      keyLesson: "TODO: Key takeaway"
    },

    shots: [
      {
        id: 1,
        timestamp: "0:00-0:03",
        description: "TODO: Describe scene 1",
        visualElements: ["TODO"],
        purpose: "TODO: Purpose of this scene"
      }
    ],

    tags: ["TODO"],
    dateAdded: "${new Date().toISOString().split('T')[0]}"
  }`;

  return template;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
X/Twitter Ad Scraper
====================

Usage: node scrape-x.js <twitter-url> [output-name]

Arguments:
  twitter-url   The full URL to the X/Twitter post containing the video
  output-name   (Optional) Name for the output files. Defaults to tweet ID.

Examples:
  node scrape-x.js https://x.com/user/status/123456789
  node scrape-x.js https://x.com/user/status/123456789 my-awesome-ad

The script will:
  1. Download the video to public/videos/
  2. Fetch the tweet text content
  3. Generate an ad template you can add to src/data/ads.js
`);
    process.exit(1);
  }

  const url = args[0];

  // Extract tweet ID from URL
  const tweetIdMatch = url.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    console.error('Error: Could not extract tweet ID from URL');
    process.exit(1);
  }

  const tweetId = tweetIdMatch[1];
  const outputName = args[1] || `ad-${tweetId}`;
  const adId = generateAdId(outputName);

  console.log('='.repeat(50));
  console.log('X/Twitter Ad Scraper');
  console.log('='.repeat(50));
  console.log(`\nURL: ${url}`);
  console.log(`Tweet ID: ${tweetId}`);
  console.log(`Output name: ${outputName}`);

  // Step 1: Fetch tweet content
  console.log('\n[1/3] Fetching tweet content...');
  const tweetData = await fetchTweetContent(url);

  if (tweetData) {
    console.log('\n--- Tweet Content ---');
    console.log(`Author: ${tweetData.author}`);
    console.log(`\n${tweetData.text}`);
    console.log('-------------------\n');
  }

  // Step 2: Download video
  console.log('[2/3] Downloading video...');
  const videoPath = downloadVideo(url, outputName);

  if (!videoPath) {
    console.error('Failed to download video');
    process.exit(1);
  }

  console.log(`\nVideo saved to: ${videoPath}`);

  // Step 3: Generate template
  console.log('\n[3/3] Generating ad template...\n');
  const template = createAdTemplate(adId, videoPath, tweetData, url);

  console.log('='.repeat(50));
  console.log('ADD THIS TO src/data/ads.js:');
  console.log('='.repeat(50));
  console.log(template);
  console.log('='.repeat(50));

  // Save tweet content to a separate file for reference
  const infoPath = join(VIDEOS_DIR, `${outputName}-info.json`);
  writeFileSync(infoPath, JSON.stringify({
    url,
    tweetId,
    author: tweetData?.author,
    text: tweetData?.text,
    videoPath,
    scrapedAt: new Date().toISOString()
  }, null, 2));

  console.log(`\nInfo saved to: ${infoPath}`);
  console.log('\nDone! Now fill in the TODOs in the template and add it to your ads.js file.');
}

main().catch(console.error);
