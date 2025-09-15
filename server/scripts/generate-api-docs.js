#!/usr/bin/env node

/**
 * Generate API Documentation (OpenAPI Schema + Postman Collection)
 *
 * This script generates both OpenAPI schema and Postman collection in sequence:
 * 1. Generate fresh OpenAPI schema from actual routes using swagger-autogen
 * 2. Generate Postman collection from the OpenAPI schema
 *
 * Run with: node server/scripts/generate-api-docs.js
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import swagger-autogen for OpenAPI generation
const swaggerAutogen = (await import('swagger-autogen')).default();

// Paths
const OPENAPI_SCHEMA_PATH = path.join(__dirname, '..', 'openapi-schema.yaml');
const POSTMAN_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'lighthouse-api-generated.postman_collection.json'
);

console.log('🚀 Starting API documentation generation...\n');

// Step 1: Generate OpenAPI Schema
console.log('📝 Step 1: Generating OpenAPI schema from routes...');

const swaggerDoc = {
  info: {
    title: 'Lighthouse Journey Canvas API',
    description:
      'Career journey timeline platform API with hierarchical timeline nodes and GraphRAG search capabilities',
    version: '2.0.0',
    contact: {
      name: 'Lighthouse API Support',
    },
  },
  host: 'localhost:5000',
  basePath: '/api',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Bearer token for authentication',
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  definitions: {
    ApiSuccessResponse: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        data: {
          type: 'object',
          description: 'Response data',
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    ApiErrorResponse: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: false,
        },
        error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    User: {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        email: {
          type: 'string',
          format: 'email',
        },
        firstName: {
          type: 'string',
        },
        lastName: {
          type: 'string',
        },
        userName: {
          type: 'string',
        },
        interest: {
          type: 'string',
        },
        hasCompletedOnboarding: {
          type: 'boolean',
        },
      },
    },
    TimelineNode: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        type: {
          type: 'string',
          enum: [
            'job',
            'education',
            'project',
            'event',
            'action',
            'careerTransition',
          ],
        },
        parentId: {
          type: 'string',
          nullable: true,
        },
        meta: {
          type: 'object',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
  },
};

const outputFile = '../openapi-schema.yaml';
const endpointsFiles = ['../app.ts', '../routes/*.ts'];

try {
  await swaggerAutogen(outputFile, endpointsFiles, swaggerDoc);
  console.log('✅ OpenAPI schema generated successfully!');
  console.log(`📄 File: ${OPENAPI_SCHEMA_PATH}\n`);
} catch (error) {
  console.error('❌ Error generating OpenAPI schema:', error);
  process.exit(1);
}

// Step 2: Generate Postman Collection
console.log('📦 Step 2: Generating Postman collection from OpenAPI schema...');

// Ensure postman directory exists
const postmanDir = path.dirname(POSTMAN_OUTPUT_PATH);
if (!fs.existsSync(postmanDir)) {
  fs.mkdirSync(postmanDir, { recursive: true });
  console.log(`📁 Created directory: ${postmanDir}`);
}

// Generate the collection
const postmanCommand = `npx openapi-to-postmanv2 -s "${OPENAPI_SCHEMA_PATH}" -o "${POSTMAN_OUTPUT_PATH}" -p -O folderStrategy=Tags,includeAuthInfoInExample=false`;

exec(postmanCommand, (error, stdout, stderr) => {
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
    const collection = JSON.parse(fs.readFileSync(POSTMAN_OUTPUT_PATH, 'utf8'));
    console.log(`   Name: ${collection.info.name}`);
    console.log(`   Version: ${collection.info.version || 'undefined'}`);
    console.log(`   Items: ${collection.item?.length || 0}`);
    console.log(`📄 File: ${POSTMAN_OUTPUT_PATH}\n`);
  } catch (parseError) {
    console.warn(
      '⚠️ Could not parse generated collection for details',
      parseError
    );
  }

  console.log('🎯 Summary:');
  console.log('   ✅ OpenAPI schema generated');
  console.log('   ✅ Postman collection generated');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('   1. Import the collection into Postman');
  console.log('   2. Set up environment variables for API_BASE_URL');
  console.log('   3. Use SuperTest + Vitest for automated testing');
});
