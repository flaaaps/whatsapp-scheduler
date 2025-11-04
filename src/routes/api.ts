import { Router, Request, Response } from "express"
import { sendMessage, getConnectionStatus, getCurrentUser } from "../services/whatsapp"
import {
    scheduleCron,
    scheduleOnce,
    cancelScheduledJob,
    getAllScheduledJobs,
} from "../services/scheduler"
import { Contact, SendRequest, ScheduleRequest } from "../types"

const router = Router()

// ✅ Immediate send endpoint
router.post("/send", async (req: Request<{}, {}, SendRequest>, res: Response) => {
    try {
        const { to, text } = req.body
        if (!to || !text) {
            return res.status(400).json({ error: "to and text required" })
        }
        await sendMessage(to, text)
        console.log(`📤 Sent immediate message to ${to}: ${text}`)
        res.json({ ok: true })
    } catch (err) {
        console.error("send error", err)
        res.status(500).json({ error: String(err) })
    }
})

// ⏰ Schedule endpoint
router.post("/api/schedule", (req: Request<{}, {}, ScheduleRequest>, res: Response) => {
    const { to, text, cron, timestamp } = req.body
    if (!to || !text) {
        return res.status(400).json({ error: "to and text required" })
    }
    try {
        let id: string
        if (cron) {
            id = scheduleCron(to, text, cron)
        } else if (timestamp) {
            id = scheduleOnce(to, text, timestamp)
        } else {
            throw new Error("Either cron or timestamp must be provided")
        }
        res.json({ ok: true, id })
    } catch (e) {
        res.status(400).json({ error: (e as Error).message })
    }
})

// 🗑️ Cancel a job
router.delete("/api/schedule/:id", (req: Request, res: Response) => {
    const id = req.params.id
    const success = cancelScheduledJob(id)
    if (!success) {
        return res.status(404).json({ error: "not found" })
    }
    res.json({ ok: true })
})

// 📡 Status endpoint
router.get("/api/status", (req: Request, res: Response) => {
    const status = getConnectionStatus()
    const scheduledJobs = getAllScheduledJobs()

    res.json({
        status,
        me: getCurrentUser(),
        scheduled: scheduledJobs,
    })
})

// 📇 Contacts endpoint
router.get("/api/contacts", (req: Request, res: Response) => {
    const contacts: Contact[] = [
        {
            name: "Big J",
            phone: "4915758278556",
        },
        {
            name: "Big M",
            phone: "4915206111635",
        },
    ].map(x => ({
        ...x,
        phoneDisplay: `+${x.phone.substring(0, 2)} ${x.phone.substring(2, 6)} ${x.phone.substring(6)}`,
    }))

    res.json(contacts)
})

export default router
