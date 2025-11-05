import nodeCron from "node-cron"
import { ScheduledJob } from "../types.js"
import { sendMessage } from "./whatsapp.server.js"

const scheduled = new Map<string, ScheduledJob>()

export function scheduleCron(to: string, text: string, cron: string): string {
    console.log(`🕐 Scheduling CRON job: ${cron} to ${to}`)
    const job = nodeCron.schedule(cron, async () => {
        console.log(`⏰ CRON job triggered! Sending to ${to}`)
        try {
            await sendMessage(to, text)
            console.log(`📤 Sent CRON message to ${to}: ${text}`)
        } catch (err) {
            console.error("Failed to send CRON message:", err)
        }
    })
    job.start() // Explicitly start the cron job
    const id = Date.now().toString()
    scheduled.set(id, { id, to, text, type: "cron", cron, job })
    console.log(`✅ CRON job scheduled with ID: ${id}, Map size: ${scheduled.size}`)
    return id
}

export function scheduleOnce(to: string, text: string, timestamp: number): string {
    const delay = timestamp - Date.now()
    const scheduledTime = new Date(timestamp)
    const now = new Date()

    console.log(`🕐 Scheduling one-time message:`)
    console.log(`   To: ${to}`)
    console.log(`   Current time: ${now.toISOString()} (${Date.now()})`)
    console.log(`   Scheduled time: ${scheduledTime.toISOString()} (${timestamp})`)
    console.log(`   Delay: ${delay}ms (${(delay / 1000 / 60).toFixed(2)} minutes)`)

    if (delay <= 0) {
        console.error(`❌ Time is in the past! Delay: ${delay}ms`)
        throw new Error("Time must be in the future")
    }

    const id = Date.now().toString()
    const timeout = setTimeout(async () => {
        console.log(`⏰ One-time job triggered! Sending to ${to}`)
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
        when: scheduledTime.toISOString(),
        timeout,
    })

    console.log(`✅ One-time job scheduled with ID: ${id}, Map size: ${scheduled.size}`)
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
