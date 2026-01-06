/**
 * Backfill script to generate titles for existing untitled sessions
 * Run with: npx tsx packages/server/scripts/backfill-session-titles.ts
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment variables from the server package
config({ path: new URL('../.env', import.meta.url).pathname });

// LLM configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.0-flash-exp';

if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Generate a title using Gemini LLM
 */
async function generateTitleWithLLM(summary: string): Promise<string> {
  if (!summary || summary.trim().length === 0) {
    return 'Work Session';
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a title generator. Generate a concise, descriptive title (3-8 words) for a work session based on its summary. The title should capture the main activity or goal. Do not use quotes or punctuation. Only return the title, nothing else.

Generate a short title for this work session:

${summary}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 50,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (title && title.length > 0 && title.length <= 100) {
      return title;
    }

    // Fallback to first sentence
    return summary.split(/[.!?]/)[0]?.trim().slice(0, 100) || 'Work Session';
  } catch (error) {
    console.warn('⚠️ Failed to generate title with LLM:', error);
    // Fallback to first sentence
    const firstSentence = summary.split(/[.!?]/)[0]?.trim();
    return firstSentence?.slice(0, 100) || 'Work Session';
  }
}

async function backfillSessionTitles() {
  console.log('🔄 Starting session title backfill...\n');

  const client = await pool.connect();

  try {
    // Find all sessions that need titles using raw SQL
    const result = await client.query(`
      SELECT id, workflow_name, high_level_summary, generated_title
      FROM session_mappings
      WHERE (workflow_name IS NULL OR workflow_name = 'Untitled Session' OR LOWER(workflow_name) LIKE '%untitled%')
        AND generated_title IS NULL
        AND high_level_summary IS NOT NULL
    `);

    const untitledSessions = result.rows;
    console.log(`📋 Found ${untitledSessions.length} sessions needing titles\n`);

    if (untitledSessions.length === 0) {
      console.log('✅ No sessions need title backfill');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const session of untitledSessions) {
      console.log(`Processing session ${session.id}...`);

      if (!session.high_level_summary) {
        console.log(`  ⏭️ Skipping - no summary available`);
        continue;
      }

      try {
        const generatedTitle = await generateTitleWithLLM(session.high_level_summary);
        console.log(`  📝 Generated title: "${generatedTitle}"`);

        // Update the session with the generated title
        await client.query(
          `UPDATE session_mappings SET generated_title = $1 WHERE id = $2`,
          [generatedTitle, session.id]
        );

        console.log(`  ✅ Updated successfully`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ❌ Error:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Backfill complete:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the backfill
backfillSessionTitles();
