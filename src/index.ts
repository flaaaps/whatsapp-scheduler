// WhatsApp Scheduler - Main Entry Point
// Compatible with @whiskeysockets/baileys v7

import { initializeWhatsApp } from "./services/whatsapp"
import { createApp } from "./app"
import { PORT } from "./utils/constants"

async function main() {
    // Initialize WhatsApp connection
    await initializeWhatsApp()

    // Create and start Express server
    const app = createApp()
    app.listen(PORT, () => {
        console.log(`🌐 Web UI + API running at http://localhost:${PORT}`)
    })
}

main().catch(err => {
    console.error("Failed to start application:", err)
    process.exit(1)
})
