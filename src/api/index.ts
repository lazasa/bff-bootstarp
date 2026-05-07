import { FastifyInstance } from 'fastify'

export const rootRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/', {
    schema: { hide: true },
    handler: async () => {
      return { message: 'BFF Bootstrap API' }
    }
  })
}
