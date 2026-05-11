import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify'
import { IncomingMessage } from 'http'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { swaggerOptions, swaggerUIOptions } from './plugins/swagger'
import { registerRoutes } from './routes'
import errorHandler from './plugins/errorHandler'

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger']
  genReqId?: (req: IncomingMessage) => string
}

function defaultGenReqId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'] ?? req.headers['x-correlation-id']
  if (header) return Array.isArray(header) ? header[0] : header
  return crypto.randomUUID()
}

function defaultLogger(): FastifyServerOptions['logger'] {
  const base = {
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization'],
  }
  if (process.env.NODE_ENV === 'production') return base
  return {
    ...base,
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
  }
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: opts.logger ?? defaultLogger(),
    genReqId: opts.genReqId ?? defaultGenReqId,
    ajv: {
      customOptions: {
        removeAdditional: false,
        allErrors: true,
      },
      plugins: [(ajv: any) => ajv.addKeyword({ keyword: 'example' })],
    },
  })

  // Plugin order is load-bearing — see CLAUDE.md Rule 1.
  await app.register(errorHandler)
  await app.register(swagger, swaggerOptions)
  await registerRoutes(app)
  await app.register(swaggerUI, swaggerUIOptions)

  return app
}
