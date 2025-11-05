import { Router } from "express";
import {
  getConnectionStatus,
  getCurrentUser,
} from "./whatsapp.server";
import {
  scheduleCron,
  scheduleOnce,
  cancelScheduledJob,
  getAllScheduledJobs,
} from "./scheduler.server";

const router = Router();

// Get WhatsApp status and scheduled jobs
router.get("/status", (req, res) => {
  try {
    const status = {
      status: getConnectionStatus(),
      me: getCurrentUser(),
      scheduled: getAllScheduledJobs(),
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
          .json({ error: "CRON expression is required for recurring messages" });
      }
      id = scheduleCron(to, text, cron);
    }

    res.json({ success: true, id });
  } catch (error: any) {
    console.error("Error scheduling message:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to schedule message" });
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

export default router;
