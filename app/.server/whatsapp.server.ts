import qrcode from "qrcode-terminal";
import makeWASocket, {
   useMultiFileAuthState,
   DisconnectReason,
   fetchLatestBaileysVersion,
   Browsers,
   WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { AUTH_DIR, WHATSAPP_CONNECTION_NAME } from "./constants.server";
import fs from "fs/promises";

let sock: WASocket | null = null;
let currentQR: string | null = null;

export async function initializeWhatsApp(): Promise<void> {
   const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

   const { version } = await fetchLatestBaileysVersion();
   console.log("Using WhatsApp Web version", version);

   sock = makeWASocket({
      auth: state,
      version,
      browser: [WHATSAPP_CONNECTION_NAME, "Chrome", "1.0"], // 👈 your custom device name
   });

   sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
         currentQR = qr;
         console.log("New QR code generated (available in web UI)");
         qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
         currentQR = null; // Clear QR when connected
         console.log("✅ Connected to WhatsApp");
      }
      if (connection === "close") {
         const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
         console.log("Connection closed", code);
         if (code !== DisconnectReason.loggedOut) {
            initializeWhatsApp();
         } else {
            console.log("Logged out, delete auth folder to re-pair");
         }
      }
   });

   sock.ev.on("creds.update", saveCreds);
}

export function getWhatsAppSocket(): WASocket {
   if (!sock) {
      throw new Error("WhatsApp socket not initialized");
   }
   return sock;
}

export async function sendMessage(to: string, text: string): Promise<void> {
   const socket = getWhatsAppSocket();
   const jid = `${to}@s.whatsapp.net`;
   await socket.sendMessage(jid, { text });
}

export function getConnectionStatus(): string {
   if (!sock) return "not initialized";
   if (sock.user) return "connected";
   if ((sock.ws as any)?.readyState === 1) return "connecting";
   return "disconnected";
}

export function getCurrentUser() {
   return sock?.user || null;
}

export function getCurrentQR(): string | null {
   return currentQR;
}

export async function logoutWhatsApp(): Promise<void> {
   console.log("Logging out from WhatsApp...");

   // Close the socket if it exists
   if (sock) {
      try {
         await sock.logout();
      } catch (err) {
         console.error("Error during logout:", err);
      }
      sock = null;
   }

   currentQR = null;

   // Clear auth state
   try {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
      await fs.mkdir(AUTH_DIR, { recursive: true });
      console.log("Auth state cleared");
   } catch (err) {
      console.error("Error clearing auth state:", err);
   }

   // Reinitialize to generate new QR
   await initializeWhatsApp();
   console.log("Ready for new connection");
}
