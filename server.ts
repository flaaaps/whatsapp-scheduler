// WhatsApp Scheduler - Server Entry Point
// Express + Remix integration with WhatsApp & Database services

import express from "express";
import { createRequestHandler } from "@remix-run/express";
import basicAuth from "express-basic-auth";
import { initializeWhatsApp } from "./app/.server/whatsapp.server";
import { initializeDatabase, closeDatabase } from "./app/.server/db.server";
import { AUTH_CONFIG, PUBLIC_DIR, PORT } from "./app/.server/constants.server";
import apiRouter from "./app/.server/api.server";
import * as whatsappService from "./app/.server/whatsapp.server";
import * as schedulerService from "./app/.server/scheduler.server";
import * as databaseService from "./app/.server/db.server";
import type { AppServices } from "./app/.server/context.server";

async function createServer() {
  const app = express();

  // Apply authentication globally
  app.use(basicAuth(AUTH_CONFIG));

  // JSON body parsing for API routes
  app.use(express.json());

  // Create services object for dependency injection
  const services: AppServices = {
    whatsapp: {
      getConnectionStatus: whatsappService.getConnectionStatus,
      getCurrentUser: whatsappService.getCurrentUser,
      sendMessage: whatsappService.sendMessage,
    },
    scheduler: {
      scheduleCron: schedulerService.scheduleCron,
      scheduleOnce: schedulerService.scheduleOnce,
      cancelScheduledJob: schedulerService.cancelScheduledJob,
      getAllScheduledJobs: schedulerService.getAllScheduledJobs,
    },
    db: {
      getAllContacts: databaseService.getAllContacts,
      createContact: databaseService.createContact,
      updateContact: databaseService.updateContact,
      deleteContact: databaseService.deleteContact,
    },
  };

  // Remix integration
  const viteDevServer =
    process.env.NODE_ENV === "production"
      ? undefined
      : await import("vite").then((vite) =>
          vite.createServer({
            server: { middlewareMode: true },
          })
        );

  if (viteDevServer) {
    app.use(viteDevServer.middlewares);
  } else {
    // Production: serve static assets from Remix build
    app.use(
      "/assets",
      express.static("build/client/assets", {
        immutable: true,
        maxAge: "1y",
      })
    );
    app.use(express.static("build/client", { maxAge: "1h" }));
  }

  // Static assets from public/ (for non-HTML files like favicon, images, etc.)
  app.use(express.static(PUBLIC_DIR));

  // Silently handle .well-known requests (Chrome DevTools, etc.)
  app.use("/.well-known", (req, res) => {
    res.status(404).end();
  });

  // API routes (for WhatsApp/Scheduler shared state)
  app.use("/api", apiRouter);

  // Remix request handler for all routes
  const build = viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : // @ts-ignore - This will exist after build
      await import("./build/server/index.js");

  // Remix handles all routes (Express 5 compatible)
  app.use(
    createRequestHandler({
      build,
      getLoadContext: (req, res) => ({
        // Pass authenticated user info to Remix routes
        user: (req as any).auth?.user || null,
        // Pass services for dependency injection
        services,
      }),
    })
  );

  return app;
}

async function main() {
  // Initialize database connection
  initializeDatabase();

  // Initialize WhatsApp connection
  await initializeWhatsApp();

  // Create Express + Remix server
  const app = await createServer();

  app.listen(PORT, () => {
    console.log(`🌐 Web UI + API running at http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing connections...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing connections...");
  await closeDatabase();
  process.exit(0);
});

main().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});
