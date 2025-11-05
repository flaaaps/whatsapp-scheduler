import {
   json,
   type LoaderFunctionArgs,
   type ActionFunctionArgs,
} from "@remix-run/node";
import {
   useLoaderData,
   useFetcher,
   Link,
   useRevalidator,
} from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import type { AppLoadContext } from "~/.server/context.server";

interface Contact {
   id: number;
   name: string;
   phone: string;
   phoneDisplay?: string;
}

interface ScheduledJob {
   id: string;
   to: string;
   text: string;
   type: "once" | "cron";
   when?: string | null;
   cron?: string | null;
}

interface StatusData {
   status: string;
   me: any;
   scheduled: ScheduledJob[];
   qrCode?: string | null;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
   try {
      const { services } = context as AppLoadContext;

      // Fetch contacts from database service
      const contacts = await services.db.getAllContacts();

      // Add phoneDisplay formatting
      const formatted = contacts.map((c) => ({
         ...c,
         phoneDisplay: `+${c.phone.substring(0, 2)} ${c.phone.substring(2, 6)} ${c.phone.substring(6)}`,
      }));

      // Get WhatsApp status and scheduled jobs from services
      const connectionStatus = services.whatsapp.getConnectionStatus();
      const qrString = services.whatsapp.getCurrentQR();
      let qrCode: string | null = null;

      // Generate QR code data URL if QR string is available
      if (qrString) {
         // Import QRCode dynamically to avoid bundling issues
         const QRCode = await import("qrcode");
         try {
            qrCode = await QRCode.toDataURL(qrString);
         } catch (err) {
            console.error("Error generating QR code:", err);
         }
      }

      const status: StatusData = {
         status: connectionStatus,
         me: services.whatsapp.getCurrentUser(),
         scheduled: services.scheduler.getAllScheduledJobs(),
         qrCode,
      };

      return json({ status, contacts: formatted });
   } catch (error) {
      console.error("Error fetching data:", error);
      return json(
         {
            status: { status: "error", me: null, scheduled: [], qrCode: null },
            contacts: [],
         },
         { status: 500 },
      );
   }
}

export async function action({ request, context }: ActionFunctionArgs) {
   const formData = await request.formData();
   const intent = formData.get("intent");
   const { services } = context as AppLoadContext;

   // Handle schedule message
   if (intent === "schedule") {
      try {
         const to = formData.get("to") as string;
         const text = formData.get("text") as string;
         const mode = formData.get("mode") as string;

         if (!to || !text) {
            return json(
               {
                  error: "Phone number and message are required",
                  success: false,
               },
               { status: 400 },
            );
         }

         let id: string;

         if (mode === "once") {
            // Use the UTC timestamp sent from client (already converted from user's local time)
            const timestampUTC = formData.get("timestampUTC") as string;
            if (!timestampUTC) {
               return json(
                  {
                     error: "Timestamp is required for one-time messages",
                     success: false,
                  },
                  { status: 400 },
               );
            }
            const timestamp = parseInt(timestampUTC, 10);
            if (isNaN(timestamp)) {
               return json(
                  { error: "Invalid timestamp", success: false },
                  { status: 400 },
               );
            }
            id = services.scheduler.scheduleOnce(to, text, timestamp);
         } else {
            const cron = formData.get("cron") as string;
            if (!cron) {
               return json(
                  {
                     error: "CRON expression is required for recurring messages",
                     success: false,
                  },
                  { status: 400 },
               );
            }
            id = services.scheduler.scheduleCron(to, text, cron);
         }

         return json({
            success: true,
            id,
            message: "Message scheduled successfully!",
         });
      } catch (error: any) {
         console.error("Error scheduling message:", error);
         return json(
            {
               error: error.message || "Failed to schedule message",
               success: false,
            },
            { status: 400 },
         );
      }
   }

   // Handle cancel job
   if (intent === "cancel") {
      try {
         const jobId = formData.get("jobId") as string;

         if (!jobId) {
            return json(
               { error: "Job ID is required", success: false },
               { status: 400 },
            );
         }

         const success = services.scheduler.cancelScheduledJob(jobId);
         if (!success) {
            return json(
               { error: "Job not found", success: false },
               { status: 404 },
            );
         }

         return json({ success: true, message: "Job canceled successfully" });
      } catch (error) {
         console.error("Error canceling job:", error);
         return json(
            { error: "Failed to cancel job", success: false },
            { status: 500 },
         );
      }
   }

   // Handle logout
   if (intent === "logout") {
      try {
         await services.whatsapp.logoutWhatsApp();
         return json({ success: true, message: "Logged out successfully" });
      } catch (error) {
         console.error("Error logging out:", error);
         return json(
            { error: "Failed to logout", success: false },
            { status: 500 },
         );
      }
   }

   return json({ error: "Invalid intent" }, { status: 400 });
}

export default function Index() {
   const { status, contacts } = useLoaderData<typeof loader>();
   const fetcher = useFetcher<{
      success: boolean;
      error: string;
      message: string;
   }>();
   const revalidator = useRevalidator();
   const [mode, setMode] = useState<"once" | "cron">("once");
   const prevStatusRef = useRef(status.status);

   const isSubmitting = fetcher.state === "submitting";

   // Immediately revalidate when connection status changes
   useEffect(() => {
      if (prevStatusRef.current !== status.status) {
         prevStatusRef.current = status.status;
         // Revalidate immediately to sync QR state
         revalidator.revalidate();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [status.status]);

   // Poll for status updates when not connected OR when QR code is still visible
   // This ensures we keep polling until the UI is fully in sync
   useEffect(() => {
      const shouldPoll =
         status.status !== "connected" || status.qrCode !== null;

      if (shouldPoll) {
         const interval = setInterval(() => {
            revalidator.revalidate();
         }, 1500); // Poll every 1.5 seconds for smoother UX

         return () => clearInterval(interval);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [status.status, status.qrCode]); // Poll until connected AND QR is cleared

   // Revalidate immediately after successful logout to show new QR code
   useEffect(() => {
      if (
         fetcher.data?.success &&
         fetcher.data?.message === "Logged out successfully"
      ) {
         revalidator.revalidate();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [fetcher.data?.success, fetcher.data?.message]); // Only depend on the specific data fields

   return (
      <div>
         <h1>📅 WhatsApp Message Scheduler</h1>

         <div style={{ marginBottom: "1rem" }}>
            <Link to="/contacts" className="nav-link">
               📇 Manage Contacts
            </Link>
         </div>

         <div className="card">
            <strong>Status:</strong>{" "}
            <span className={`badge ${status.status}`}>{status.status}</span>
            {status.me && (
               <>
                  <div className="small">Logged in as: {status.me.id}</div>
                  <fetcher.Form method="post" style={{ marginTop: "0.5rem" }}>
                     <input type="hidden" name="intent" value="logout" />
                     <button
                        type="submit"
                        className="btn-cancel"
                        disabled={fetcher.state === "submitting"}
                     >
                        {fetcher.state === "submitting"
                           ? "Logging out..."
                           : "Logout from WhatsApp"}
                     </button>
                  </fetcher.Form>
               </>
            )}
         </div>

         {status.qrCode && (
            <div className="card qr-container">
               <h3>Scan to Connect WhatsApp</h3>
               <img
                  src={status.qrCode}
                  alt="WhatsApp QR Code"
                  className="qr-code"
               />
               <p className="small">
                  Open WhatsApp on your phone → <strong>Linked Devices</strong>{" "}
                  → <strong>Link a Device</strong> → Scan this QR code
               </p>
            </div>
         )}

         {fetcher.data?.error && (
            <div className="error-message">{fetcher.data.error}</div>
         )}

         {fetcher.data?.success && (
            <div className="success-message">
               {fetcher.data?.message ?? "That worked!!"}
            </div>
         )}

         <fetcher.Form
            method="post"
            className="card"
            onSubmit={(e) => {
               // Convert datetime-local to UTC timestamp
               if (mode === "once") {
                  const datetimeInput = e.currentTarget.querySelector(
                     'input[name="timestamp"]',
                  ) as HTMLInputElement;
                  if (datetimeInput?.value) {
                     // Parse the datetime-local value (which is in user's local timezone)
                     const localDate = new Date(datetimeInput.value);
                     // Get UTC timestamp
                     const utcTimestamp = localDate.getTime();

                     // Create a hidden input with the UTC timestamp
                     const hiddenInput = document.createElement("input");
                     hiddenInput.type = "hidden";
                     hiddenInput.name = "timestampUTC";
                     hiddenInput.value = utcTimestamp.toString();
                     e.currentTarget.appendChild(hiddenInput);

                     console.log("User selected (local):", datetimeInput.value);
                     console.log("Converted to UTC timestamp:", utcTimestamp);
                     console.log(
                        "UTC time:",
                        new Date(utcTimestamp).toISOString(),
                     );
                  }
               }
            }}
         >
            <h2>Schedule a Message</h2>
            <input type="hidden" name="intent" value="schedule" />

            <label>
               Contact
               <select name="to" required>
                  <option value="">Select a contact</option>
                  {contacts.map((contact) => (
                     <option key={contact.id} value={contact.phone}>
                        {contact.name} | {contact.phoneDisplay}
                     </option>
                  ))}
               </select>
            </label>

            <label>
               Message
               <textarea
                  name="text"
                  required
                  placeholder="Type your message here"
               />
            </label>

            <label>
               Send Type
               <select
                  name="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "once" | "cron")}
               >
                  <option value="once">Send once at specific time</option>
                  <option value="cron">Repeat using CRON pattern</option>
               </select>
            </label>

            {mode === "once" ? (
               <label>
                  Date & Time
                  <input type="datetime-local" name="timestamp" required />
               </label>
            ) : (
               <label>
                  CRON Expression
                  <input
                     type="text"
                     name="cron"
                     placeholder="0 9 * * *"
                     required
                     pattern="^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$"
                  />
                  <small className="small">
                     Examples: "0 9 * * *" (daily at 9am), "0 */2 * * *" (every
                     2 hours)
                  </small>
               </label>
            )}

            <button type="submit" disabled={isSubmitting}>
               {isSubmitting ? "Scheduling..." : "Schedule Message"}
            </button>
         </fetcher.Form>

         {status.scheduled.length > 0 && (
            <div className="card">
               <h2>📋 Scheduled Messages</h2>
               <table>
                  <thead>
                     <tr>
                        <th>To</th>
                        <th>Message</th>
                        <th>Type</th>
                        <th>When/Pattern</th>
                        <th>Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {status.scheduled.map((job) => (
                        <tr key={job.id}>
                           <td>{job.to}</td>
                           <td>{job.text.substring(0, 30)}...</td>
                           <td>{job.type}</td>
                           <td>{job.type === "once" ? job.when : job.cron}</td>
                           <td>
                              <fetcher.Form
                                 method="post"
                                 style={{ display: "inline" }}
                              >
                                 <input
                                    type="hidden"
                                    name="intent"
                                    value="cancel"
                                 />
                                 <input
                                    type="hidden"
                                    name="jobId"
                                    value={job.id}
                                 />
                                 <button type="submit" className="btn-cancel">
                                    Cancel
                                 </button>
                              </fetcher.Form>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </div>
   );
}
