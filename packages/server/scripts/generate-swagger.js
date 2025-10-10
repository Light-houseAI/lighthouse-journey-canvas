#!/usr/bin/env node

/**
 * Generate OpenAPI Schema from JSDoc comments
 *
 * This script starts a temporary Express app with express-jsdoc-swagger configured,
 * fetches the generated OpenAPI schema, and saves it to openapi-schema.yaml.
 *
 * Output: openapi-schema.yaml
 */

import express from 'express';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Generating OpenAPI schema from JSDoc comments...\n');

// Create temporary Express app
const app = express();

const swaggerOptions = {
  info: {
    title: 'Lighthouse Journey Canvas API',
    description: 'Career journey timeline platform API with hierarchical timeline nodes and GraphRAG search capabilities',
    version: '2.0.0',
  },
  baseDir: path.join(__dirname, '..', 'src'),
  filesPattern: [
    './controllers/**/*.ts',
    './routes/**/*.ts',
  ],
  swaggerUIPath: '/api/docs',
  exposeSwaggerUI: false,
  exposeApiDocs: true,
  apiDocsPath: '/api/docs.json',
  security: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
    },
  },
};

console.log('📂 Scanning files:');
console.log(`   ${path.join(swaggerOptions.baseDir, './controllers/**/*.ts')}`);
console.log(`   ${path.join(swaggerOptions.baseDir, './routes/**/*.ts')}\n`);

// Initialize express-jsdoc-swagger
const instance = expressJSDocSwagger(app)(swaggerOptions);

// Wait for swagger generation to complete
instance.on('finish', async (swaggerSpec) => {
  try {
    const outputFile = path.join(__dirname, '..', 'openapi-schema.yaml');

    // Convert JSON to YAML
    const yamlContent = yaml.dump(swaggerSpec, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true,
      sortKeys: false
    });

    // Write to file
    await fs.writeFile(outputFile, yamlContent, 'utf8');

    console.log('✅ OpenAPI schema generated successfully!');
    console.log(`📄 File: ${outputFile}`);
    console.log(`📊 Endpoints documented: ${Object.keys(swaggerSpec.paths || {}).length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error writing OpenAPI schema:', error);
    process.exit(1);
  }
});

instance.on('error', (error) => {
  console.error('❌ Error generating OpenAPI schema:', error);
  process.exit(1);
});
