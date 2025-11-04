import { ScheduledTask } from "node-cron"

export interface ScheduledCronJob {
    id: string
    to: string
    text: string
    type: "cron"
    cron: string
    job: ScheduledTask
}

export interface ScheduledOnceJob {
    id: string
    to: string
    text: string
    type: "once"
    when: string
    timeout: NodeJS.Timeout
}

export type ScheduledJob = ScheduledCronJob | ScheduledOnceJob

export interface Contact {
    name: string
    phone: string
    phoneDisplay?: string
}

export interface ScheduleRequest {
    to: string
    text: string
    cron?: string
    timestamp?: number
}

export interface SendRequest {
    to: string
    text: string
}
