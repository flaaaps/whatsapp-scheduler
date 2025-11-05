import type { AppLoadContext as RemixAppLoadContext } from "@remix-run/node";

// WhatsApp service interface
export interface WhatsAppService {
  getConnectionStatus: () => string;
  getCurrentUser: () => any;
  sendMessage: (to: string, text: string) => Promise<void>;
}

// Scheduler service interface
export interface SchedulerService {
  scheduleCron: (to: string, text: string, cron: string) => string;
  scheduleOnce: (to: string, text: string, timestamp: number) => string;
  cancelScheduledJob: (id: string) => boolean;
  getAllScheduledJobs: () => Array<{
    id: string;
    to: string;
    text: string;
    type: "once" | "cron";
    cron: string | null;
    when: string | null;
  }>;
}

// Database service interface
export interface DatabaseService {
  getAllContacts: () => Promise<Array<{
    id: number;
    name: string;
    phone: string;
    created_at?: Date;
    updated_at?: Date;
  }>>;
  createContact: (data: { name: string; phone: string }) => Promise<any>;
  updateContact: (id: number, data: { name?: string; phone?: string }) => Promise<any>;
  deleteContact: (id: number) => Promise<boolean>;
}

// Combined services interface
export interface AppServices {
  whatsapp: WhatsAppService;
  scheduler: SchedulerService;
  db: DatabaseService;
}

// Extend Remix's AppLoadContext with our services
export interface AppLoadContext extends RemixAppLoadContext {
  user: string | null;
  services: AppServices;
}
