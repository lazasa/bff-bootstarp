import {
  FastifyPluginAsync,
  FastifyError,
  FastifyReply,
  FastifyRequest
} from 'fastify'
import fp from 'fastify-plugin'
import { AppError, ErrorDetail } from '../utils/errors'

const SYSTEM_ERRORS: Record<
  string,
  { status: number; code: string; message: string }
> = {
  ECONNREFUSED: {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'External service is currently unavailable'
  },
  ENOTFOUND: {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'External service could not be reached'
  },
  UND_ERR_HEADERS_TIMEOUT: {
    status: 504,
    code: 'GATEWAY_TIMEOUT',
    message: 'Request to external service timed out'
  },
  UND_ERR_BODY_TIMEOUT: {
    status: 504,
    code: 'GATEWAY_TIMEOUT',
    message: 'Request to external service timed out'
  },
  ETIMEDOUT: {
    status: 504,
    code: 'GATEWAY_TIMEOUT',
    message: 'Request timed out'
  }
}

const FASTIFY_ERRORS: Record<string, { code: string; message: string }> = {
  FST_ERR_CTP_EMPTY_JSON_BODY: {
    code: 'BAD_REQUEST',
    message: 'Request body is required'
  },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: {
    code: 'BAD_REQUEST',
    message: 'Invalid content type'
  },
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: {
    code: 'BAD_REQUEST',
    message: 'Invalid content length'
  },
  FST_ERR_CTP_INVALID_JSON: {
    code: 'BAD_REQUEST',
    message: 'Invalid JSON in request body'
  },
  FST_ERR_VALIDATION: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed'
  }
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setNotFoundHandler((request, reply) => {
    const errorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `${request.url} not found`,
        status: 404
      }
    }

    return reply
      .status(404)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify(errorResponse))
  })

  fastify.setErrorHandler(
    (
      error: FastifyError | AppError | Error,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      request.log.error({
        err: error,
        request: { method: request.method, url: request.url }
      })

      if (error instanceof AppError) {
        const errorResponse = {
          error: {
            code: error.code,
            message: error.message,
            status: error.statusCode,
            ...(error.details && { details: error.details })
          }
        }
        return reply
          .status(error.statusCode)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(JSON.stringify(errorResponse))
      }

      if ('validation' in error && error.validation) {
        const seen = new Set<string>()

        const filteredValidation = error.validation.filter((v: any) => {
          if (v.keyword === 'if' || v.keyword === 'then') return false

          let field: string
          if (
            v.keyword === 'additionalProperties' &&
            v.params?.additionalProperty
          ) {
            field = v.params.additionalProperty
          } else {
            field =
              v.instancePath?.replace('/', '') ||
              v.params?.missingProperty ||
              'unknown'
          }

          const key = `${field}:${v.keyword}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        const details: ErrorDetail[] = filteredValidation.map((v: any) => {
          let field: string
          if (
            v.keyword === 'additionalProperties' &&
            v.params?.additionalProperty
          ) {
            field = v.params.additionalProperty
          } else {
            field =
              v.instancePath?.replace('/', '') ||
              v.params?.missingProperty ||
              'unknown'
          }

          let issue = v.message || 'validation failed'
          if (v.keyword === 'enum' && v.params?.allowedValues) {
            issue = `must be one of: ${v.params.allowedValues.join(', ')}`
          } else if (v.keyword === 'required') {
            issue = 'is required'
          } else if (v.keyword === 'type') {
            issue = `must be of type ${v.params.type}`
          } else if (v.keyword === 'minLength') {
            issue = `must be at least ${v.params.limit} characters long`
          } else if (v.keyword === 'additionalProperties') {
            issue = 'is not allowed'
          } else if (v.keyword === 'false schema') {
            issue = 'is not allowed for this action'
          }

          return { field, issue }
        })

        const errorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            status: 400,
            details
          }
        }
        return reply
          .status(400)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(JSON.stringify(errorResponse))
      }

      if (
        'code' in error &&
        typeof error.code === 'string' &&
        SYSTEM_ERRORS[error.code]
      ) {
        const { status, code, message } = SYSTEM_ERRORS[error.code]
        const errorResponse = { error: { code, message, status } }
        return reply
          .status(status)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(JSON.stringify(errorResponse))
      }

      if ('statusCode' in error && typeof error.statusCode === 'number') {
        const errorCode = typeof error.code === 'string' ? error.code : 'ERROR'
        const friendlyError = FASTIFY_ERRORS[errorCode]
        const errorResponse = {
          error: {
            code: friendlyError?.code || errorCode,
            message: friendlyError?.message || error.message,
            status: error.statusCode
          }
        }
        return reply
          .status(error.statusCode)
          .header('Content-Type', 'application/json; charset=utf-8')
          .send(JSON.stringify(errorResponse))
      }

      const isProduction = process.env.NODE_ENV === 'production'
      const errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: isProduction
            ? 'An unexpected error occurred'
            : error.message,
          status: 500
        }
      }
      return reply
        .status(500)
        .header('Content-Type', 'application/json; charset=utf-8')
        .send(JSON.stringify(errorResponse))
    }
  )
}

export default fp(errorHandlerPlugin, { name: 'error-handler' })
