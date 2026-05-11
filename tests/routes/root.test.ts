import { describe, it, expect } from 'vitest'
import { buildTestApp } from '../helpers/build-test-app'

describe('GET /', () => {
  it('returns 200 with service identifier', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveProperty('message')
    } finally {
      await app.close()
    }
  })
})
