/**
 * Data Migration Script for Ad Vault
 *
 * This script exports existing data from JS files and generates SQL
 * for importing into Cloudflare D1.
 *
 * Usage:
 * 1. Run: node workers/migrate-data.js
 * 2. This generates: workers/seed-data.sql
 * 3. Run: wrangler d1 execute ad-vault-db --file=./workers/seed-data.sql
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str !== 'string') str = String(str);
  return `'${str.replace(/'/g, "''")}'`;
}

// Read and parse JS data file (handle ES module exports)
function parseJsDataFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Extract the array from "export const xxx = [...]"
  const match = content.match(/export\s+const\s+\w+\s*=\s*(\[[\s\S]*\]);/);
  if (!match) {
    console.error(`Could not parse ${filePath}`);
    return [];
  }

  // Evaluate the array (careful - this is a simple approach)
  // We'll use a safer regex-based extraction
  try {
    // Replace JS object syntax with JSON
    let jsonStr = match[1];
    // Convert JS objects to JSON (handle unquoted keys)
    jsonStr = jsonStr.replace(/(\w+):/g, '"$1":');
    // Handle template literals - convert to regular strings
    jsonStr = jsonStr.replace(/`([^`]*)`/g, (_, str) => JSON.stringify(str));
    // Remove trailing commas
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e.message);
    console.log('Falling back to eval (less safe)...');

    // Fallback: use Function constructor (safer than eval)
    try {
      const fn = new Function(`return ${match[1]}`);
      return fn();
    } catch (e2) {
      console.error('Fallback also failed:', e2.message);
      return [];
    }
  }
}

function generateAdsSql(ads) {
  const statements = [];

  for (const ad of ads) {
    // Insert main ad
    statements.push(`INSERT INTO ads (id, title, video_src, source, creator, product, vertical, type, hook_text_overlay, hook_spoken, full_transcript, why_summary, why_key_lesson, tags, date_added) VALUES (
  ${escapeSql(ad.id)},
  ${escapeSql(ad.title)},
  ${escapeSql(ad.videoSrc)},
  ${escapeSql(ad.source)},
  ${escapeSql(ad.creator)},
  ${escapeSql(ad.product)},
  ${escapeSql(ad.vertical)},
  ${escapeSql(ad.type)},
  ${escapeSql(ad.hook?.textOverlay || '')},
  ${escapeSql(ad.hook?.spoken || '')},
  ${escapeSql(ad.fullTranscript)},
  ${escapeSql(ad.whyItWorked?.summary || '')},
  ${escapeSql(ad.whyItWorked?.keyLesson || '')},
  ${escapeSql(JSON.stringify(ad.tags || []))},
  ${escapeSql(ad.dateAdded || new Date().toISOString().split('T')[0])}
);`);

    // Insert tactics
    const tactics = ad.whyItWorked?.tactics || [];
    for (let i = 0; i < tactics.length; i++) {
      const tactic = tactics[i];
      statements.push(`INSERT INTO ad_tactics (ad_id, name, description, sort_order) VALUES (
  ${escapeSql(ad.id)},
  ${escapeSql(tactic.name)},
  ${escapeSql(tactic.description)},
  ${i}
);`);
    }

    // Insert shots
    const shots = ad.shots || [];
    for (const shot of shots) {
      statements.push(`INSERT INTO ad_shots (ad_id, shot_number, start_time, end_time, timestamp, type, thumbnail, description, transcript, text_overlay, purpose) VALUES (
  ${escapeSql(ad.id)},
  ${shot.id || 1},
  ${shot.startTime || 0},
  ${shot.endTime || 0},
  ${escapeSql(shot.timestamp)},
  ${escapeSql(shot.type || 'video')},
  ${escapeSql(shot.thumbnail)},
  ${escapeSql(shot.description)},
  ${escapeSql(shot.transcript)},
  ${escapeSql(shot.textOverlay)},
  ${escapeSql(shot.purpose)}
);`);
    }
  }

  return statements;
}

function generateImagesSql(images) {
  const statements = [];

  for (const img of images) {
    const prompt = typeof img.prompt === 'object' ? JSON.stringify(img.prompt) : img.prompt;
    statements.push(`INSERT INTO images (id, title, image_src, source, creator, prompt, raw_prompt, tags, date_added) VALUES (
  ${escapeSql(img.id)},
  ${escapeSql(img.title)},
  ${escapeSql(img.imageSrc)},
  ${escapeSql(img.source)},
  ${escapeSql(img.creator)},
  ${escapeSql(prompt)},
  ${escapeSql(img.rawPrompt)},
  ${escapeSql(JSON.stringify(img.tags || []))},
  ${escapeSql(img.dateAdded || new Date().toISOString().split('T')[0])}
);`);
  }

  return statements;
}

function generateTweetsSql(tweets) {
  const statements = [];

  for (const tweet of tweets) {
    statements.push(`INSERT INTO tweets (id, url, tags, added_at) VALUES (
  ${escapeSql(tweet.id)},
  ${escapeSql(tweet.url)},
  ${escapeSql(JSON.stringify(tweet.tags || []))},
  ${escapeSql(tweet.addedAt || new Date().toISOString().split('T')[0])}
);`);
  }

  return statements;
}

// Main
async function main() {
  console.log('Ad Vault Data Migration');
  console.log('=======================\n');

  const appDir = join(__dirname, '..', 'app', 'src', 'data');
  const outputFile = join(__dirname, 'seed-data.sql');

  let allStatements = [];
  allStatements.push('-- Ad Vault Seed Data');
  allStatements.push('-- Generated: ' + new Date().toISOString());
  allStatements.push('');

  // Migrate ads
  try {
    const adsPath = join(appDir, 'ads.js');
    console.log(`Reading ${adsPath}...`);
    const ads = parseJsDataFile(adsPath);
    console.log(`Found ${ads.length} ads`);
    allStatements.push('-- ADS');
    allStatements.push(...generateAdsSql(ads));
    allStatements.push('');
  } catch (e) {
    console.error('Error migrating ads:', e.message);
  }

  // Migrate images
  try {
    const imagesPath = join(appDir, 'images.js');
    console.log(`Reading ${imagesPath}...`);
    const images = parseJsDataFile(imagesPath);
    console.log(`Found ${images.length} images`);
    allStatements.push('-- IMAGES');
    allStatements.push(...generateImagesSql(images));
    allStatements.push('');
  } catch (e) {
    console.error('Error migrating images:', e.message);
  }

  // Migrate tweets
  try {
    const tweetsPath = join(appDir, 'tweets.js');
    console.log(`Reading ${tweetsPath}...`);
    const tweets = parseJsDataFile(tweetsPath);
    console.log(`Found ${tweets.length} tweets`);
    allStatements.push('-- TWEETS');
    allStatements.push(...generateTweetsSql(tweets));
  } catch (e) {
    console.error('Error migrating tweets:', e.message);
  }

  // Write output
  writeFileSync(outputFile, allStatements.join('\n'));
  console.log(`\nMigration SQL written to: ${outputFile}`);
  console.log('\nNext steps:');
  console.log('1. Create D1 database: wrangler d1 create ad-vault-db');
  console.log('2. Run schema: wrangler d1 execute ad-vault-db --file=./workers/schema.sql');
  console.log('3. Run seed data: wrangler d1 execute ad-vault-db --file=./workers/seed-data.sql');
}

main().catch(console.error);
