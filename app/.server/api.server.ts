import { Router } from "express";
import {
   getConnectionStatus,
   getCurrentUser,
   getCurrentQR,
   logoutWhatsApp,
} from "./whatsapp.server";
import {
   scheduleCron,
   scheduleOnce,
   cancelScheduledJob,
   getAllScheduledJobs,
} from "./scheduler.server";
import QRCode from "qrcode";

const router = Router();

// Get WhatsApp status and scheduled jobs
router.get("/status", async (req, res) => {
   try {
      const qrString = getCurrentQR();
      let qrCode: string | null = null;

      // Generate QR code data URL if QR string is available
      if (qrString) {
         try {
            qrCode = await QRCode.toDataURL(qrString);
         } catch (err) {
            console.error("Error generating QR code:", err);
         }
      }

      const status = {
         status: getConnectionStatus(),
         me: getCurrentUser(),
         scheduled: getAllScheduledJobs(),
         qrCode,
      };
      res.json(status);
   } catch (error) {
      console.error("Error getting status:", error);
      res.status(500).json({ error: "Failed to get status" });
   }
});

// Schedule a message
router.post("/schedule", (req, res) => {
   try {
      const { to, text, mode, timestamp, cron } = req.body;

      if (!to || !text) {
         return res
            .status(400)
            .json({ error: "Phone number and message are required" });
      }

      let id: string;

      if (mode === "once") {
         if (!timestamp) {
            return res
               .status(400)
               .json({ error: "Timestamp is required for one-time messages" });
         }
         id = scheduleOnce(to, text, timestamp);
      } else {
         if (!cron) {
            return res
               .status(400)
               .json({
                  error: "CRON expression is required for recurring messages",
               });
         }
         id = scheduleCron(to, text, cron);
      }

      res.json({ success: true, id });
   } catch (error: any) {
      console.error("Error scheduling message:", error);
      res.status(400).json({
         error: error.message || "Failed to schedule message",
      });
   }
});

// Cancel a scheduled job
router.delete("/schedule/:id", (req, res) => {
   try {
      const { id } = req.params;

      if (!id) {
         return res.status(400).json({ error: "Job ID is required" });
      }

      const success = cancelScheduledJob(id);
      if (!success) {
         return res.status(404).json({ error: "Job not found" });
      }

      res.json({ success: true });
   } catch (error) {
      console.error("Error canceling job:", error);
      res.status(500).json({ error: "Failed to cancel job" });
   }
});

// Logout from WhatsApp
router.post("/logout", async (req, res) => {
   try {
      await logoutWhatsApp();
      res.json({ success: true, message: "Logged out successfully" });
   } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ error: "Failed to logout" });
   }
});

export default router;
