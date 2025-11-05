import path from "path"
import { fileURLToPath } from "url"

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ROOT_DIR = path.join(__dirname, "../..")
export const AUTH_DIR = path.join(ROOT_DIR, "auth")
export const PUBLIC_DIR = path.join(ROOT_DIR, "public")
export const PORT = Number(process.env.PORT) || 3000

export const WHATSAPP_CONNECTION_NAME = process.env.WHATSAPP_CONNECTION_NAME || "Message scheduler"

export const AUTH_CONFIG = {
    users: {
        [process.env.ADMIN_USER || "admin"]: process.env.ADMIN_PASS || "password",
    },
    challenge: true,
    realm: "WhatsApp Scheduler",
} as const

export const DB_CONFIG = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "whatsapp",
    password: process.env.DB_PASSWORD || "whatsapp123",
    database: process.env.DB_NAME || "whatsapp_scheduler",
}
