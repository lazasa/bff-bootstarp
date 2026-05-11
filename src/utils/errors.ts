export const ErrorResponseSchema = {
  $id: 'ErrorResponse',
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'status'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        status: { type: 'integer' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            required: ['field', 'issue'],
            additionalProperties: true,
            properties: {
              field: { type: 'string' },
              issue: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

export type ErrorResponse = {
  error: {
    code: string
    message: string
    status: number
    details?: Array<{ field: string; issue: string; [key: string]: unknown }>
  }
}

export interface ErrorDetail {
  field: string
  issue: string
  [key: string]: any
}

export interface ExternalErrorResponse {
  message?: string
  code?: string
  error?: string
  details?: ErrorDetail[]
  [key: string]: any
}

export class AppError extends Error {
  public details?: ErrorDetail[]

  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    details?: ErrorDetail[]
  ) {
    super(message)
    this.name = 'AppError'
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(400, 'BAD_REQUEST', message, details)
    this.name = 'BadRequestError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'External service is currently unavailable') {
    super(503, 'SERVICE_UNAVAILABLE', message)
    this.name = 'ServiceUnavailableError'
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Request to external service timed out') {
    super(504, 'GATEWAY_TIMEOUT', message)
    this.name = 'GatewayTimeoutError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, 'NOT_FOUND', message)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, 'FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(409, 'CONFLICT', message, details)
    this.name = 'ConflictError'
  }
}
