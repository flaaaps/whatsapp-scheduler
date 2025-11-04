import nodeCron from "node-cron"
import { ScheduledJob } from "../types"
import { sendMessage } from "./whatsapp"

const scheduled = new Map<string, ScheduledJob>()

export function scheduleCron(to: string, text: string, cron: string): string {
    const job = nodeCron.schedule(cron, async () => {
        try {
            await sendMessage(to, text)
            console.log(`📤 Sent CRON message to ${to}: ${text}`)
        } catch (err) {
            console.error("Failed to send CRON message:", err)
        }
    })
    const id = Date.now().toString()
    scheduled.set(id, { id, to, text, type: "cron", cron, job })
    return id
}

export function scheduleOnce(to: string, text: string, timestamp: number): string {
    const delay = timestamp - Date.now()
    if (delay <= 0) throw new Error("Time must be in the future")

    const id = Date.now().toString()
    const timeout = setTimeout(async () => {
        try {
            await sendMessage(to, text)
            console.log(`📤 Sent one-time message to ${to}: ${text}`)
            scheduled.delete(id)
        } catch (err) {
            console.error("Failed to send one-time message:", err)
        }
    }, delay)

    scheduled.set(id, {
        id,
        to,
        text,
        type: "once",
        when: new Date(timestamp).toISOString(),
        timeout,
    })
    return id
}

export function cancelScheduledJob(id: string): boolean {
    const job = scheduled.get(id)
    if (!job) return false

    if (job.type === "cron") {
        job.job.stop()
    } else if (job.type === "once") {
        clearTimeout(job.timeout)
    }

    scheduled.delete(id)
    return true
}

export function getAllScheduledJobs() {
    return Array.from(scheduled.values()).map(s => ({
        id: s.id,
        to: s.to,
        text: s.text,
        type: s.type,
        cron: s.type === "cron" ? s.cron : null,
        when: s.type === "once" ? s.when : null,
    }))
}
