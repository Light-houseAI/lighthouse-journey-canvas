const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'Lighthouse Journey Canvas API',
    description: 'Career journey timeline platform API with hierarchical timeline nodes and GraphRAG search capabilities',
    version: '2.0.0',
    contact: {
      name: 'Lighthouse API Support'
    }
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
      description: 'Bearer token for authentication'
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  definitions: {
    ApiSuccessResponse: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true
        },
        data: {
          type: 'object',
          description: 'Response data'
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    ApiErrorResponse: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: false
        },
        error: {
          type: 'object',
          properties: {
            code: {
              type: 'string'
            },
            message: {
              type: 'string'
            }
          }
        },
        meta: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    User: {
      type: 'object',
      properties: {
        id: {
          type: 'integer'
        },
        email: {
          type: 'string',
          format: 'email'
        },
        firstName: {
          type: 'string'
        },
        lastName: {
          type: 'string'
        },
        userName: {
          type: 'string'
        },
        interest: {
          type: 'string'
        },
        hasCompletedOnboarding: {
          type: 'boolean'
        }
      }
    },
    TimelineNode: {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        type: {
          type: 'string',
          enum: ['job', 'education', 'project', 'event', 'action', 'careerTransition']
        },
        parentId: {
          type: 'string',
          nullable: true
        },
        meta: {
          type: 'object'
        },
        createdAt: {
          type: 'string',
          format: 'date-time'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time'
        }
      }
    }
  }
};

const outputFile = '../openapi-schema.yaml';
const endpointsFiles = [
  '../app.ts',
  '../routes/*.ts'
];

// Generate the swagger file
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('✅ OpenAPI schema generated successfully!');
  console.log(`📄 File: ${outputFile}`);
}).catch((error) => {
  console.error('❌ Error generating OpenAPI schema:', error);
});