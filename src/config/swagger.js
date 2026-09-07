const swaggerUi = require('swagger-ui-express');

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'DocMind-AI API Documentation',
    version: '1.0.0',
    description: 'Interactive OpenAPI 3.0 specification for DocMind-AI: RAG-powered document Q&A, summarization, JWT authentication, and role-based access control.',
    contact: {
      name: 'DocMind-AI Engineering Team',
      url: 'https://github.com/Hammadzafar64/DocMind-AI'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT token obtained from /api/auth/login or /api/auth/register'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65f123abc456' },
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          role: { type: 'string', enum: ['user', 'admin'], example: 'user' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error description message' },
          code: { type: 'string', example: 'AUTH_REQUIRED' }
        }
      }
    }
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        description: 'Creates a user account. Optional adminSecret will assign admin role if valid.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  email: { type: 'string', example: 'jane@example.com' },
                  password: { type: 'string', example: 'SecurePassword123' },
                  adminSecret: { type: 'string', example: 'docmind_admin_key_2026', description: 'Optional secret to grant admin privileges' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'User registered successfully with signed JWT',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          400: { description: 'Missing required fields or email already exists' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login with email and password',
        description: 'Authenticates credentials using bcrypt and issues a 7-day JWT token with role claims.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'jane@example.com' },
                  password: { type: 'string', example: 'SecurePassword123' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Login successful, returns JWT token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          401: { description: 'Invalid email or password' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile data' },
          401: { description: 'Missing, invalid, or expired JWT token' }
        }
      }
    },
    '/api/auth/admin/dashboard': {
      get: {
        tags: ['Administration (RBAC)'],
        summary: 'Admin Dashboard Stats (Requires admin role)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Admin statistics and system status' },
          401: { description: 'Authentication required' },
          403: { description: 'Access forbidden: Current user role is not admin' }
        }
      }
    },
    '/api/auth/admin/users': {
      get: {
        tags: ['Administration (RBAC)'],
        summary: 'List all registered users (Requires admin role)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of registered users' },
          401: { description: 'Authentication required' },
          403: { description: 'Access forbidden: Insufficient role' }
        }
      }
    },
    '/api/upload': {
      post: {
        tags: ['Documents & Ingestion'],
        summary: 'Upload document (PDF or DOCX) for parsing & vector embedding',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Document parsed, chunked, and vector embedded successfully' }
        }
      }
    },
    '/api/documents': {
      get: {
        tags: ['Documents & Ingestion'],
        summary: 'Get all ingested documents',
        responses: {
          200: { description: 'List of uploaded documents with chunk counts' }
        }
      }
    },
    '/api/chat': {
      post: {
        tags: ['AI Document Q&A (RAG)'],
        summary: 'Ask question over ingested documents',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'What are the main findings in the document?' },
                  docId: { type: 'string', example: 'all' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'AI generated response with source chunks' }
        }
      }
    },
    '/api/summarize': {
      post: {
        tags: ['AI Document Q&A (RAG)'],
        summary: 'Generate summary of document',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  docId: { type: 'string', example: 'all' },
                  type: { type: 'string', enum: ['executive', 'bullet', 'detailed'], example: 'executive' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Document summary generated' }
        }
      }
    },
    '/api/settings': {
      get: {
        tags: ['Settings & Health'],
        summary: 'Get system LLM configuration (API keys masked)',
        responses: {
          200: { description: 'System configuration settings' }
        }
      }
    }
  }
};

function setupSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'DocMind-AI API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1e293b; }'
  }));

  // Endpoint to return raw OpenAPI specification in JSON format
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = { setupSwagger, swaggerSpec };
