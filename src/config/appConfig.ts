// Flat config — read env once at module load. Add one entry per upstream
// service. Required vars throw in prod and warn in dev so local development
// still boots without a fully populated .env.
const isProd = process.env.NODE_ENV === 'production'

function required(name: string): string {
  const value = process.env[name]
  if (value) return value
  if (isProd) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  console.warn(
    `[appConfig] ${name} is not set — using empty string for local dev`
  )
  return ''
}

export const config = {
  IDENTITY_SERVICE_URL:
    process.env.IDENTITY_SERVICE_URL || 'http://127.0.0.1:5000',
  IDENTITY_SERVICE_TIMEOUT: 30000
}

void required
