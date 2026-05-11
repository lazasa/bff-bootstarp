import { ErrorResponseSchema } from '../utils/errors'

// TODO: replace title/description for your BFF.
export const swaggerOptions = {
  openapi: {
    openapi: '3.1.0',
    info: {
      title: 'BFF Bootstrap API',
      description: 'Bootstrap template — replace with your BFF description.',
      version: '1.0.0'
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description:
          process.env.NODE_ENV === 'production' ? 'Production' : 'Development'
      }
    ],
    tags: [],
    components: {
      schemas: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ErrorResponse: (({ $id, ...rest }) => rest)(ErrorResponseSchema) as any
      }
    }
  }
}

export const swaggerUIOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'none' as const,
    deepLinking: true,
    displayRequestDuration: true
  },
  theme: {
    title: 'BFF Bootstrap API Documentation',
    css: [
      {
        filename: 'theme.css',
        content: '.topbar { display: none !important; }'
      }
    ]
  }
}
