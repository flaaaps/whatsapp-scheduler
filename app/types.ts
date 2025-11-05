import { ScheduledTask } from "node-cron";

export interface ScheduledCronJob {
   id: string;
   to: string;
   text: string;
   type: "cron";
   cron: string;
   job: ScheduledTask;
}

export interface ScheduledOnceJob {
   id: string;
   to: string;
   text: string;
   type: "once";
   when: string;
   timeout: NodeJS.Timeout;
}

export type ScheduledJob = ScheduledCronJob | ScheduledOnceJob;

export interface Contact {
   id: number;
   name: string;
   phone: string;
   phoneDisplay?: string;
   created_at?: Date;
   updated_at?: Date;
}

export interface CreateContactRequest {
   name: string;
   phone: string;
}

export interface UpdateContactRequest {
   name?: string;
   phone?: string;
}

export interface ScheduleRequest {
   to: string;
   text: string;
   cron?: string;
   timestamp?: number;
}

export interface SendRequest {
   to: string;
   text: string;
}

export interface StatusData {
   status: string;
   me: any;
   scheduled: Array<{
      id: string;
      to: string;
      text: string;
      type: "once" | "cron";
      cron: string | null;
      when: string | null;
   }>;
   qrCode?: string | null;
}
