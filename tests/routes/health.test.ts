import { describe, it, expect } from 'vitest'
import { buildTestApp } from '../helpers/build-test-app'

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ status: 'healthy' })
    } finally {
      await app.close()
    }
  })
})
