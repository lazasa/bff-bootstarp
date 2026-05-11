// Single HTTP client for the identity-service upstream.
// One client per upstream service — never wrap this with per-domain
// helpers. Domain code (resource routes) calls these verbs directly.
import { config } from '../config/appConfig'
import {
  AppError,
  NotFoundError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  UnauthorizedError,
  ForbiddenError
} from '../utils/errors'

const BASE_URL = config.IDENTITY_SERVICE_URL
const TIMEOUT = config.IDENTITY_SERVICE_TIMEOUT

async function request(
  method: string,
  path: string,
  options: {
    body?: unknown
    authorization?: string
    queryString?: string
    reqId?: string
  } = {}
): Promise<unknown> {
  const { body, authorization, queryString, reqId } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`

  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    ...(authorization ? { authorization } : {}),
    ...(reqId ? { 'x-request-id': reqId } : {})
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearTimeout(timer)

    if (response.ok) {
      if (response.status === 204) return null
      return response.json()
    }

    if (response.status === 404) throw new NotFoundError()
    if (response.status >= 500) throw new ServiceUnavailableError()

    let errorBody: any
    try {
      errorBody = await response.json()
    } catch {
      throw new AppError(response.status, 'BAD_REQUEST', response.statusText)
    }

    if (errorBody?.error?.code) {
      const { code, message, status, details } = errorBody.error
      throw new AppError(status ?? response.status, code, message, details)
    }

    if (response.status === 401) throw new UnauthorizedError()
    if (response.status === 403) throw new ForbiddenError()

    throw new AppError(
      response.status,
      'BAD_REQUEST',
      errorBody?.message ?? 'Bad Request'
    )
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof AppError) throw err
    if (err instanceof Error) {
      if (err.name === 'AbortError') throw new GatewayTimeoutError()
      if (err.message.includes('fetch failed'))
        throw new ServiceUnavailableError()
    }
    throw err
  }
}

export const identityServiceGet = (
  path: string,
  authorization?: string,
  queryString?: string,
  reqId?: string
) => request('GET', path, { authorization, queryString, reqId })

export const identityServicePost = (
  path: string,
  body?: unknown,
  authorization?: string,
  reqId?: string
) => request('POST', path, { body, authorization, reqId })

export const identityServicePatch = (
  path: string,
  body: unknown,
  authorization?: string,
  reqId?: string
) => request('PATCH', path, { body, authorization, reqId })

export const identityServicePut = (
  path: string,
  body: unknown,
  authorization?: string,
  reqId?: string
) => request('PUT', path, { body, authorization, reqId })

export const identityServiceDelete = (
  path: string,
  authorization?: string,
  reqId?: string
) => request('DELETE', path, { authorization, reqId })
