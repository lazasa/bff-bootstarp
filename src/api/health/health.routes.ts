import { FastifyInstance } from 'fastify'

export const healthRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/', {
    logLevel: 'silent',
    schema: {
      hide: true,
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string' } }
        }
      }
    },
    handler: async () => {
      return { status: 'healthy' }
    }
  })
}
