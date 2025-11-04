// WhatsApp Scheduler - Main Entry Point
// Compatible with @whiskeysockets/baileys v7

import { initializeWhatsApp } from "./services/whatsapp"
import { initializeDatabase, closeDatabase } from "./services/database"
import { createApp } from "./app"
import { PORT } from "./utils/constants"

async function main() {
    // Initialize database connection
    initializeDatabase()

    // Initialize WhatsApp connection
    await initializeWhatsApp()

    // Create and start Express server
    const app = createApp()
    app.listen(PORT, () => {
        console.log(`🌐 Web UI + API running at http://localhost:${PORT}`)
    })
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing connections...")
    await closeDatabase()
    process.exit(0)
})

process.on("SIGINT", async () => {
    console.log("SIGINT received, closing connections...")
    await closeDatabase()
    process.exit(0)
})

main().catch(err => {
    console.error("Failed to start application:", err)
    process.exit(1)
})
