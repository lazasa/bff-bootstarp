import { FastifyInstance } from 'fastify'
import { rootRoutes } from './api/index'
import { healthRoutes } from './api/health/health.routes'

export async function registerRoutes(server: FastifyInstance) {
  await server.register(rootRoutes)
  await server.register(healthRoutes, { prefix: '/health' })
}
