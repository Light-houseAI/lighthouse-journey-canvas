#!/usr/bin/env node

/**
 * Generate API Documentation (OpenAPI Schema + Postman Collection)
 *
 * This script orchestrates the generation of both:
 * 1. OpenAPI schema (via generate-swagger.js)
 * 2. Postman collection (via generate-postman-collection.js)
 *
 * Run with: node scripts/generate-api-docs.js
 */

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting API documentation generation...\n');

/**
 * Execute a script and handle output
 */
async function runScript(scriptName, description) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`📝 ${description}...`);

  try {
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr) console.warn('⚠️  Warning:', stderr);

    console.log(`✅ ${description} completed!\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error during ${description}:`, error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    throw error;
  }
}

// Main execution flow
(async () => {
  try {
    // Step 1: Generate OpenAPI Schema
    await runScript(
      'generate-swagger.js',
      'Step 1: Generate OpenAPI schema from routes'
    );

    // Step 2: Generate Postman Collection
    await runScript(
      'generate-postman-collection.js',
      'Step 2: Generate Postman collection from OpenAPI'
    );

    // Summary
    console.log('🎉 API documentation generation complete!\n');
    console.log('📊 Generated files:');
    console.log('   ✅ openapi-schema.yaml');
    console.log('   ✅ lighthouse-api-generated.postman_collection.json\n');
    console.log('🔧 Next steps:');
    console.log('   1. View OpenAPI docs at /api/docs (when server is running)');
    console.log('   2. Import Postman collection for API testing');
    console.log('   3. Use generated schema for client SDK generation');

  } catch (error) {
    console.error('\n❌ API documentation generation failed!');
    process.exit(1);
  }
})();
