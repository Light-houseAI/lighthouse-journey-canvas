/**
 * Contract Validator Utilities
 *
 * Provides OpenAPI contract validation for API endpoints during testing.
 * Validates both request and response payloads against OpenAPI schema definitions.
 */

import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import * as OpenAPIValidator from 'express-openapi-validate';
import yaml from 'js-yaml';
import { isExcluded } from '../config/contract-exclusions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parsed OpenAPI schema type
 */
export interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, any>;
  components?: Record<string, any>;
}

/**
 * Contract validator interface
 */
export interface ContractValidator {
  (): (req: Request, res: Response, next: NextFunction) => void;
  validateRequest: (req: Request) => string[];
  validateResponse: (req: Request, res: Response, data: any) => string[];
}

/**
 * Load and parse OpenAPI schema from file
 *
 * Looks for openapi-schema.yaml or openapi-schema.json in the server root.
 * Supports both YAML and JSON formats.
 *
 * @returns Parsed OpenAPI schema object
 * @throws Error if schema file not found or invalid
 */
export async function loadOpenAPISchema(): Promise<OpenAPISchema> {
  // Try to find schema file (check both yaml and json)
  const serverRoot = path.resolve(__dirname, '../..');
  const possiblePaths = [
    path.join(serverRoot, 'openapi-schema.yaml'),
    path.join(serverRoot, 'openapi-schema.yml'),
    path.join(serverRoot, 'openapi-schema.json'),
  ];

  let schemaContent: string | undefined;
  let schemaPath: string | undefined;

  for (const filePath of possiblePaths) {
    try {
      schemaContent = await fs.readFile(filePath, 'utf-8');
      schemaPath = filePath;
      break;
    } catch (error) {
      // Continue to next path
    }
  }

  if (!schemaContent || !schemaPath) {
    throw new Error(
      `OpenAPI schema not found. Looked in: ${possiblePaths.join(', ')}`
    );
  }

  // Parse schema based on file extension
  let schema: OpenAPISchema;
  if (schemaPath.endsWith('.yaml') || schemaPath.endsWith('.yml')) {
    schema = yaml.load(schemaContent) as OpenAPISchema;
  } else {
    schema = JSON.parse(schemaContent) as OpenAPISchema;
  }

  // Validate and dereference the schema using SwaggerParser
  const validatedSchema = await SwaggerParser.validate(schema as any);

  return validatedSchema as OpenAPISchema;
}

/**
 * Create a contract validator middleware for Express
 *
 * This validator checks API responses against the OpenAPI schema during tests.
 * It validates that all responses match the documented contract.
 *
 * @param schema - OpenAPI schema to validate against
 * @returns Express middleware that validates contracts
 *
 * @example
 * ```typescript
 * const schema = await loadOpenAPISchema();
 * const validator = createContractValidator(schema);
 *
 * app.use(validator());
 * ```
 */
export async function createContractValidator(
  schema: OpenAPISchema
): Promise<ContractValidator> {
  // Parse and prepare the OpenAPI schema
  const dereferencedSchema = await SwaggerParser.dereference(schema as any);

  // Create validators for each endpoint
  const validators = new Map<string, any>();

  // Build validators for each path/method combination
  for (const [pathPattern, pathItem] of Object.entries(dereferencedSchema.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        const key = `${method.toUpperCase()} ${pathPattern}`;
        validators.set(key, {
          pathPattern,
          method: method.toUpperCase(),
          operation,
          parameters: operation.parameters || [],
          requestBody: operation.requestBody,
          responses: operation.responses || {},
        });
      }
    }
  }

  /**
   * Find matching validator for a request
   */
  const findValidator = (method: string, path: string) => {
    // Try exact match first
    let validator = validators.get(`${method} ${path}`);
    if (validator) return validator;

    // Try to match against patterns
    for (const [key, val] of validators.entries()) {
      if (key.startsWith(method)) {
        const pattern = val.pathPattern;
        // Convert OpenAPI path pattern to regex
        const regex = new RegExp(
          '^' + pattern.replace(/{([^}]+)}/g, '([^/]+)') + '$'
        );
        if (regex.test(path)) {
          return val;
        }
      }
    }

    return null;
  };

  /**
   * Validate request against schema
   */
  const validateRequest = (req: Request): string[] => {
    const errors: string[] = [];

    // Skip validation for excluded endpoints
    if (isExcluded(req.method, req.path)) {
      return errors;
    }

    // Find matching validator
    const validator = findValidator(req.method, req.path);

    if (!validator) {
      // No schema defined for this endpoint
      return errors;
    }

    // Validate path parameters
    if (validator.parameters) {
      for (const param of validator.parameters) {
        if (param.in === 'path' && param.required) {
          const value = req.params[param.name];
          if (!value) {
            errors.push(`Missing required path parameter: ${param.name}`);
          } else if (param.schema) {
            // Basic type validation
            const paramErrors = validateValue(value, param.schema, `params.${param.name}`);
            errors.push(...paramErrors);
          }
        }
      }
    }

    // Validate request body
    if (validator.requestBody && validator.requestBody.required) {
      const contentType = req.headers['content-type'] || 'application/json';
      const mediaType = contentType.split(';')[0];
      const bodySchema = validator.requestBody.content?.[mediaType]?.schema;

      if (bodySchema) {
        const bodyErrors = validateValue(req.body, bodySchema, 'body');
        errors.push(...bodyErrors);
      }
    }

    return errors;
  };

  /**
   * Validate response against schema
   */
  const validateResponse = (req: Request, res: Response, data: any): string[] => {
    const errors: string[] = [];

    // Skip validation for excluded endpoints
    if (isExcluded(req.method, req.path)) {
      return errors;
    }

    // Find matching validator
    const validator = findValidator(req.method, req.path);

    if (!validator) {
      return errors;
    }

    // Get response schema for status code
    const statusCode = res.statusCode || 200;
    const responseSpec = validator.responses[statusCode] || validator.responses.default;

    if (!responseSpec) {
      return errors;
    }

    // Validate response body
    const contentType = (typeof res.getHeader === 'function' ? res.getHeader('content-type') : null) || 'application/json';
    const mediaType = String(contentType).split(';')[0];
    const responseSchema = responseSpec.content?.[mediaType]?.schema;

    if (responseSchema) {
      const responseErrors = validateValue(data, responseSchema, 'response');
      errors.push(...responseErrors);
    }

    return errors;
  };

  /**
   * Validate a value against a schema
   */
  const validateValue = (value: any, schema: any, path: string): string[] => {
    const errors: string[] = [];

    if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null) {
        errors.push(`${path} must be an object`);
        return errors;
      }

      // Check required properties
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in value)) {
            errors.push(`${path}.${requiredProp} is required but missing`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in value) {
            const propErrors = validateValue(
              value[propName],
              propSchema,
              `${path}.${propName}`
            );
            errors.push(...propErrors);
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
        return errors;
      }

      if (schema.items) {
        value.forEach((item, index) => {
          const itemErrors = validateValue(item, schema.items, `${path}[${index}]`);
          errors.push(...itemErrors);
        });
      }
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${path} must be a string, got ${typeof value}`);
      } else if (schema.format) {
        // Basic format validation
        if (schema.format === 'email' && !value.includes('@')) {
          errors.push(`${path} must be a valid email`);
        } else if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          errors.push(`${path} must be a valid UUID`);
        }
      } else if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters`);
      }
    } else if (schema.type === 'number' || schema.type === 'integer') {
      if (typeof value !== 'number') {
        errors.push(`${path} must be a number`);
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${path} must be a boolean, got ${typeof value}`);
      }
    }

    return errors;
  };

  /**
   * Middleware function
   */
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    // Check if req is properly initialized
    if (!req || !req.method || !req.path) {
      return next();
    }

    // Skip validation for excluded endpoints
    if (isExcluded(req.method, req.path)) {
      return next();
    }

    // Validate request
    const requestErrors = validateRequest(req);
    if (requestErrors.length > 0) {
      console.error('Request validation errors:', requestErrors);
      // In test mode, we log but don't block the request
      // This allows us to test error responses
    }

    // Intercept response to validate
    const originalJson = res.json;
    res.json = function(data: any) {
      // Validate response
      const responseErrors = validateResponse(req, res, data);
      if (responseErrors.length > 0) {
        console.error(
          `Response validation failed for ${req.method} ${req.path}:`,
          responseErrors
        );

        // In test environment, throw to fail the test
        if (process.env.NODE_ENV === 'test') {
          throw new Error(
            `Contract validation failed: ${responseErrors.join(', ')}`
          );
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };

  // Attach validation methods to middleware for direct testing
  (middleware as any).validateRequest = validateRequest;
  (middleware as any).validateResponse = validateResponse;

  return middleware as ContractValidator;
}

/**
 * Install YAML support if not already available
 */
function installYamlSupport() {
  try {
    require('js-yaml');
  } catch {
    throw new Error(
      'js-yaml is required for YAML schema support. Install with: pnpm add -D js-yaml'
    );
  }
}