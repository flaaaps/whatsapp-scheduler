import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const ROOT_DIR = path.join(__dirname, "../..")
export const AUTH_DIR = path.join(ROOT_DIR, "auth")
export const PUBLIC_DIR = path.join(ROOT_DIR, "public")
export const PORT = Number(process.env.PORT) || 3000

export const AUTH_CONFIG = {
    users: {
        [process.env.ADMIN_USER || "admin"]: process.env.ADMIN_PASS || "password",
    },
    challenge: true,
    realm: "WhatsApp Scheduler",
} as const
