/**
 * Generate OpenAPI schema from express-jsdoc-swagger
 *
 * This script starts the Express app (which automatically generates
 * the OpenAPI schema via express-jsdoc-swagger), fetches the schema,
 * and saves it to openapi-schema.yaml
 */

import { createApp } from '../src/app.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateSwagger() {
  console.log('🔄 Generating OpenAPI schema from express-jsdoc-swagger...\n');

  try {
    // Create the app (this initializes express-jsdoc-swagger)
    const app = await createApp();

    // Start a temporary server
    const server = app.listen(0, async () => {
      const port = server.address().port;
      console.log(`✅ Temporary server started on port ${port}`);

      // Wait for express-jsdoc-swagger to finish generating the schema
      console.log('⏳ Waiting for schema generation...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Fetch the OpenAPI spec
        const response = await fetch(`http://localhost:${port}/api/docs.json`);
        const openApiSpec = await response.json();

        // Save to file
        const outputPath = join(__dirname, '..', 'openapi-schema.json');
        writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

        console.log('✅ OpenAPI schema generated successfully!');
        console.log(`📄 File: openapi-schema.json`);
        console.log(`\n📊 Schema Info:`);
        console.log(`   Title: ${openApiSpec.info?.title}`);
        console.log(`   Version: ${openApiSpec.info?.version}`);
        console.log(`   Endpoints: ${Object.keys(openApiSpec.paths || {}).length}`);

        // List endpoints
        if (openApiSpec.paths) {
          console.log('\n📋 Documented Endpoints:');
          Object.entries(openApiSpec.paths).forEach(([path, methods]) => {
            Object.keys(methods).forEach(method => {
              const endpoint = methods[method];
              console.log(`   ${method.toUpperCase().padEnd(7)} ${path.padEnd(30)} - ${endpoint.summary || 'No summary'}`);
            });
          });
        }

        server.close(async () => {
          console.log('\n✨ Schema generation complete!\n');

          // Generate Postman collection from the OpenAPI schema
          console.log('🔄 Generating Postman collection...\n');
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            const postmanScriptPath = join(__dirname, 'generate-postman-collection.js');
            await execAsync(`node ${postmanScriptPath}`);
            console.log('✅ Postman collection generated!\n');
          } catch (postmanError) {
            console.warn('⚠️  Postman collection generation failed:', postmanError.message);
            console.warn('   You can generate it manually with: pnpm generate:postman\n');
          }

          process.exit(0);
        });
      } catch (fetchError) {
        console.error('❌ Failed to fetch OpenAPI schema:', fetchError);
        server.close(() => process.exit(1));
      }
    });
  } catch (error) {
    console.error('❌ Failed to generate schema:', error);
    process.exit(1);
  }
}

generateSwagger();
