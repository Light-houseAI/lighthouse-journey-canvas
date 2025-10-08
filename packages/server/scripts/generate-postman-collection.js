#!/usr/bin/env node

/**
 * Generate Postman Collection from OpenAPI Schema
 *
 * This script automatically generates a Postman collection from our OpenAPI schema.
 * Run with: node scripts/generate-postman-collection.js
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAPI_SCHEMA_PATH = path.join(__dirname, '..', 'openapi-schema.json');
const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'lighthouse-api.postman_collection.json'
);

console.log('🚀 Generating Postman collection from OpenAPI schema...');
console.log(`📄 Source: ${OPENAPI_SCHEMA_PATH}`);
console.log(`💾 Output: ${OUTPUT_PATH}`);

// Ensure postman directory exists
const postmanDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(postmanDir)) {
  fs.mkdirSync(postmanDir, { recursive: true });
  console.log(`📁 Created directory: ${postmanDir}`);
}

// Generate the collection
const command = `npx openapi-to-postmanv2 -s "${OPENAPI_SCHEMA_PATH}" -o "${OUTPUT_PATH}" -p -O folderStrategy=Tags,includeAuthInfoInExample=false`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error generating Postman collection:', error);
    process.exit(1);
  }

  if (stderr) {
    console.warn('⚠️ Warning:', stderr);
  }

  console.log('✅ Postman collection generated successfully!');
  console.log('📊 Collection details:');

  try {
    const collection = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    console.log(`   Name: ${collection.info.name}`);
    console.log(`   Version: ${collection.info.version}`);
    console.log(`   Items: ${collection.item?.length || 0}`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('   1. Import the collection into Postman');
    console.log('   2. Set up environment variables for API_BASE_URL');
    console.log('   3. Use SuperTest + Vitest for automated testing');
  } catch (parseError) {
    console.warn(
      '⚠️ Could not parse generated collection for details',
      parseError
    );
  }
});
