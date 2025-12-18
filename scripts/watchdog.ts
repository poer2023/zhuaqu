import "dotenv/config"

import prisma from "../src/lib/prisma"
import { startWatchdog, stopWatchdog } from "../src/server/orchestrator/watchdog"

// ==================== Configuration ====================

const WATCHDOG_INTERVAL_MS = parseInt(process.env.WATCHDOG_INTERVAL_MS || "30000", 10)

// ==================== Graceful Shutdown ====================

let isShuttingDown = false

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`[watchdog] received ${signal}, shutting down gracefully...`)

  stopWatchdog()

  try {
    await prisma.$disconnect()
  } catch (e) {
    console.error("[watchdog] error disconnecting from database:", e)
  }

  console.log("[watchdog] shutdown complete")
  process.exit(0)
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

// ==================== Main ====================

async function main() {
  console.log(`[watchdog] starting...`)
  console.log(`  interval: ${WATCHDOG_INTERVAL_MS}ms`)

  await startWatchdog({
    intervalMs: WATCHDOG_INTERVAL_MS,
    onRecovered: (count, details) => {
      console.log(`[watchdog] recovered ${count} stale steps:`)
      for (const d of details) {
        console.log(`  - step=${d.stepId} job=${d.jobId} terminal=${d.terminal}`)
      }
    },
  })
}

main()
  .catch((e) => {
    console.error("[watchdog] fatal error:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    if (!isShuttingDown) {
      await prisma.$disconnect()
    }
  })

