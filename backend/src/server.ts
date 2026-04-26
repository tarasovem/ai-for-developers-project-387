import { createApp } from './app.js'

async function start(): Promise<void> {
  const app = createApp()
  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '0.0.0.0'

  try {
    await app.listen({ port, host })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
