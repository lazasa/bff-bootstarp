import 'dotenv/config'
import { buildApp } from './app'

const SHUTDOWN_TIMEOUT_MS = 10_000

async function main() {
  const app = await buildApp()
  const port = Number(process.env.PORT) || 3000
  const host = process.env.HOST || '0.0.0.0'

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    app.log.info({ signal }, 'shutdown signal received, closing server')

    const forceExit = setTimeout(() => {
      app.log.error(
        `shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`
      )
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceExit.unref()

    try {
      await app.close()
      clearTimeout(forceExit)
      process.exit(0)
    } catch (err) {
      app.log.error({ err }, 'error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('unhandledRejection', (err: unknown) => {
    app.log.error(err, 'Unhandled rejection')
    process.exit(1)
  })

  try {
    await app.listen({ port, host })
    app.log.info(`Swagger UI available at http://${host}:${port}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
