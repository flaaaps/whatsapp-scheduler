import { Router, Request, Response } from "express"
import { sendMessage, getConnectionStatus, getCurrentUser } from "../services/whatsapp"
import {
    scheduleCron,
    scheduleOnce,
    cancelScheduledJob,
    getAllScheduledJobs,
} from "../services/scheduler"
import {
    getAllContacts,
    getContactById,
    createContact,
    updateContact,
    deleteContact as deleteContactFromDb,
} from "../services/database"
import { Contact, SendRequest, ScheduleRequest, CreateContactRequest, UpdateContactRequest } from "../types"

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

// 📇 Contacts endpoints

// Get all contacts
router.get("/api/contacts", async (req: Request, res: Response) => {
    try {
        const contacts = await getAllContacts()
        // Add phoneDisplay formatting
        const formatted = contacts.map(c => ({
            ...c,
            phoneDisplay: `+${c.phone.substring(0, 2)} ${c.phone.substring(2, 6)} ${c.phone.substring(6)}`,
        }))
        res.json(formatted)
    } catch (err) {
        console.error("Error fetching contacts:", err)
        res.status(500).json({ error: String(err) })
    }
})

// Get single contact
router.get("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid contact ID" })
        }
        const contact = await getContactById(id)
        if (!contact) {
            return res.status(404).json({ error: "Contact not found" })
        }
        res.json({
            ...contact,
            phoneDisplay: `+${contact.phone.substring(0, 2)} ${contact.phone.substring(2, 6)} ${contact.phone.substring(6)}`,
        })
    } catch (err) {
        console.error("Error fetching contact:", err)
        res.status(500).json({ error: String(err) })
    }
})

// Create new contact
router.post("/api/contacts", async (req: Request<{}, {}, CreateContactRequest>, res: Response) => {
    try {
        const { name, phone } = req.body
        if (!name || !phone) {
            return res.status(400).json({ error: "Name and phone are required" })
        }
        // Validate phone format (simple check)
        if (!/^\d+$/.test(phone)) {
            return res.status(400).json({ error: "Phone must contain only digits" })
        }
        const contact = await createContact({ name, phone })
        res.status(201).json({
            ...contact,
            phoneDisplay: `+${contact.phone.substring(0, 2)} ${contact.phone.substring(2, 6)} ${contact.phone.substring(6)}`,
        })
    } catch (err: any) {
        console.error("Error creating contact:", err)
        // Check for unique constraint violation
        if (err.code === "23505") {
            return res.status(409).json({ error: "Contact with this phone number already exists" })
        }
        res.status(500).json({ error: String(err) })
    }
})

// Update contact
router.put("/api/contacts/:id", async (req: Request<{ id: string }, {}, UpdateContactRequest>, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid contact ID" })
        }
        const { name, phone } = req.body
        if (!name && !phone) {
            return res.status(400).json({ error: "At least one field (name or phone) must be provided" })
        }
        // Validate phone format if provided
        if (phone && !/^\d+$/.test(phone)) {
            return res.status(400).json({ error: "Phone must contain only digits" })
        }
        const contact = await updateContact(id, { name, phone })
        if (!contact) {
            return res.status(404).json({ error: "Contact not found" })
        }
        res.json({
            ...contact,
            phoneDisplay: `+${contact.phone.substring(0, 2)} ${contact.phone.substring(2, 6)} ${contact.phone.substring(6)}`,
        })
    } catch (err: any) {
        console.error("Error updating contact:", err)
        if (err.code === "23505") {
            return res.status(409).json({ error: "Contact with this phone number already exists" })
        }
        res.status(500).json({ error: String(err) })
    }
})

// Delete contact
router.delete("/api/contacts/:id", async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid contact ID" })
        }
        const success = await deleteContactFromDb(id)
        if (!success) {
            return res.status(404).json({ error: "Contact not found" })
        }
        res.json({ ok: true })
    } catch (err) {
        console.error("Error deleting contact:", err)
        res.status(500).json({ error: String(err) })
    }
})

export default router
