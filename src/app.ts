import express from "express"
import basicAuth from "express-basic-auth"
import apiRouter from "./routes/api"
import { AUTH_CONFIG, PUBLIC_DIR } from "./utils/constants"

export function createApp(): express.Application {
    const app = express()

    // Middleware
    app.use(express.json())
    app.use(basicAuth(AUTH_CONFIG))
    app.use(express.static(PUBLIC_DIR))

    // Routes
    app.use(apiRouter)

    return app
}
