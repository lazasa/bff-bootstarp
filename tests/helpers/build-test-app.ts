import { buildApp, BuildAppOptions } from '../../src/app'

export function buildTestApp(opts: BuildAppOptions = {}) {
  return buildApp({ logger: false, ...opts })
}
