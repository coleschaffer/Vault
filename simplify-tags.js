// Simplify image tags to a cleaner catalog
import pg from 'pg';

const DATABASE_URL = process.argv[2];
if (!DATABASE_URL) {
  console.error('Usage: node simplify-tags.js <DATABASE_URL>');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Simplified tag categories
const TAG_RULES = {
  // Location
  'Indoor': ['bedroom', 'bathroom', 'kitchen', 'living room', 'apartment', 'interior', 'studio', 'closet', 'mirror', 'dressing room', 'fitting room', 'elevator', 'lobby', 'staircase', 'gym', 'cafe', 'restaurant', 'store', 'convenience', 'gas station', 'restroom', 'clinic', 'museum', 'billiard', 'vinyl'],
  'Outdoor': ['beach', 'outdoor', 'street', 'urban', 'city', 'balcony', 'patio', 'rooftop', 'parking', 'pool', 'tropical', 'mediterranean', 'ski', 'snow', 'garden', 'temple'],
  'Vehicle': ['car', 'suv', 'boat', 'yacht', 'ferrari', 'lamborghini', 'luxury car'],
  'Hotel/Luxury': ['hotel', 'resort', 'penthouse', 'luxury', 'maldives', 'monaco', 'monte carlo'],

  // Subject
  'Portrait': ['woman', 'man', 'portrait', 'selfie', 'candid', 'lifestyle'],

  // Hair
  'Blonde': ['blonde', 'platinum'],
  'Brunette': ['brunette', 'dark hair', 'brown hair'],
  'Colorful Hair': ['silver hair', 'lavender', 'red hair', 'auburn', 'pink hair'],

  // Style/Outfit
  'Swimwear': ['bikini', 'swimwear', 'microkini', 'beach wear'],
  'Loungewear': ['loungewear', 'pajama', 'robe', 'tank top', 'sweats', 'cozy'],
  'Fitness': ['athletic', 'fitness', 'workout', 'gym', 'activewear', 'sports'],
  'Glamorous': ['dress', 'glamorous', 'elegant', 'formal', 'gown', 'satin', 'rhinestone', 'jewelry'],
  'Streetwear': ['streetwear', 'casual', 'jeans', 'y2k', 'urban fashion'],
  'Lingerie': ['lingerie', 'bodysuit', 'corset', 'lace', 'sheer'],

  // Aesthetic/Mood
  'Cozy': ['cozy', 'warm', 'intimate', 'morning', 'hygge'],
  'Night/Moody': ['night', 'moody', 'dark', 'nocturnal', 'flash photography', 'neon'],
  'Summer Vibes': ['summer', 'golden hour', 'sun', 'vacation', 'tropical'],
  'Editorial': ['editorial', 'fashion', 'cinematic', 'professional'],

  // Photo type
  'Mirror Selfie': ['mirror selfie', 'mirror'],
  'Photorealistic': ['photorealistic', 'realistic', 'hyper-realistic', 'raw photo', '8k'],
};

function getSimplifiedTags(existingTags, title) {
  const newTags = new Set();

  // Combine existing tags and title for matching
  const searchText = [...existingTags, title].join(' ').toLowerCase();

  for (const [newTag, keywords] of Object.entries(TAG_RULES)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        newTags.add(newTag);
        break;
      }
    }
  }

  // Ensure at least one tag
  if (newTags.size === 0) {
    newTags.add('Other');
  }

  return Array.from(newTags).sort();
}

async function simplifyTags() {
  const client = await pool.connect();

  try {
    const result = await client.query('SELECT id, title, tags FROM images');
    console.log(`Processing ${result.rows.length} images...\n`);

    let updated = 0;
    const newTagCounts = new Map();

    for (const row of result.rows) {
      let existingTags = row.tags;
      if (typeof existingTags === 'string') {
        try {
          existingTags = JSON.parse(existingTags);
        } catch(e) {
          // Try splitting by comma if it's a comma-separated string
          existingTags = existingTags.split(',').map(t => t.trim());
        }
      }
      existingTags = existingTags || [];

      const newTags = getSimplifiedTags(existingTags, row.title || '');

      // Count new tags
      newTags.forEach(tag => {
        newTagCounts.set(tag, (newTagCounts.get(tag) || 0) + 1);
      });

      // Update in database
      await client.query(
        'UPDATE images SET tags = $1 WHERE id = $2',
        [JSON.stringify(newTags), row.id]
      );
      updated++;
    }

    console.log(`Updated ${updated} images.\n`);
    console.log('New tag distribution:');
    const sorted = [...newTagCounts.entries()].sort((a, b) => b[1] - a[1]);
    sorted.forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });
    console.log(`\nTotal unique tags: ${sorted.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

simplifyTags().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
