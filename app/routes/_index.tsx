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
import {
   Calendar,
   MessageSquare,
   RefreshCw,
   Contact,
   LogOut,
   Clock,
   Repeat,
   X,
   Send,
} from "lucide-react";

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

      const contacts = await services.db.getAllContacts();

      const formatted = contacts.map((c) => ({
         ...c,
         phoneDisplay: `+${c.phone.substring(0, 2)} ${c.phone.substring(2, 6)} ${c.phone.substring(6)}`,
      }));

      const connectionStatus = services.whatsapp.getConnectionStatus();
      const qrString = services.whatsapp.getCurrentQR();
      let qrCode: string | null = null;

      if (qrString) {
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

   if (intent === "schedule") {
      try {
         // Check if WhatsApp is connected
         const connectionStatus = services.whatsapp.getConnectionStatus();
         if (connectionStatus !== "connected") {
            return json(
               {
                  error: "WhatsApp is not connected. Please connect before scheduling messages.",
                  success: false,
               },
               { status: 400 },
            );
         }

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
   const [formKey, setFormKey] = useState(0);

   const isSubmitting = fetcher.state === "submitting";
   const isConnected = status.status === "connected";
   const canSchedule = isConnected && !isSubmitting;

   useEffect(() => {
      if (
         fetcher.data?.success &&
         fetcher.data?.message === "Message scheduled successfully!"
      ) {
         setFormKey((prev) => prev + 1);
         setMode("once");
      }
   }, [fetcher.data?.success, fetcher.data?.message]);

   useEffect(() => {
      if (prevStatusRef.current !== status.status) {
         prevStatusRef.current = status.status;
         revalidator.revalidate();
      }
   }, [status.status]);

   useEffect(() => {
      const shouldPoll =
         status.status !== "connected" || status.qrCode !== null;

      if (shouldPoll) {
         const interval = setInterval(() => {
            revalidator.revalidate();
         }, 1500); // Poll every 1.5 seconds for smoother UX

         return () => clearInterval(interval);
      }
   }, [status.status, status.qrCode]);

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
         <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={28} />
            WhatsApp Message Scheduler
         </h1>

         <div style={{ marginBottom: "1rem" }}>
            <Link to="/contacts" className="nav-link">
               <Contact size={18} style={{ display: "inline", marginRight: "0.5rem", verticalAlign: "middle" }} />
               Manage Contacts
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
                        style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                     >
                        <LogOut size={16} />
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

         <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
               <MessageSquare size={22} />
               Schedule a Message
            </h2>

            {!isConnected && (
               <div style={{
                  padding: "0.75rem",
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                  border: "1px solid #fbbf24"
               }}>
                  <strong>⚠️ WhatsApp Not Connected</strong>
                  <div style={{ marginTop: "0.25rem" }}>
                     Please connect to WhatsApp before scheduling messages. {status.qrCode ? "Scan the QR code above to connect." : "Reconnect to continue."}
                  </div>
               </div>
            )}

         <fetcher.Form
            key={formKey}
            method="post"
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
            <input type="hidden" name="intent" value="schedule" />

            <label>
               Contact
               <select name="to" required disabled={!isConnected}>
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
                  disabled={!isConnected}
               />
            </label>

            <label>
               Send Type
               <select
                  name="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "once" | "cron")}
                  disabled={!isConnected}
               >
                  <option value="once">Send once at specific time</option>
                  <option value="cron">Repeat using CRON pattern</option>
               </select>
            </label>

            {mode === "once" ? (
               <label>
                  Date & Time
                  <input
                     key="datetime"
                     type="datetime-local"
                     name="timestamp"
                     required
                     disabled={!isConnected}
                  />
               </label>
            ) : (
               <label>
                  CRON Expression
                  <input
                     key="cron"
                     type="text"
                     name="cron"
                     placeholder="0 9 * * *"
                     required
                     pattern="^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$"
                     disabled={!isConnected}
                  />
                  <small className="small">
                     Examples: "0 9 * * *" (daily at 9am), "0 */2 * * *" (every
                     2 hours)
                  </small>
               </label>
            )}

            <button type="submit" disabled={!canSchedule} style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
               <Send size={18} />
               {isSubmitting ? "Scheduling..." : isConnected ? "Schedule Message" : "Connect WhatsApp to Schedule"}
            </button>
         </fetcher.Form>
         </div>

         {status.scheduled.length > 0 && (
            <div className="card">
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                     <Clock size={22} />
                     Scheduled Messages
                  </h2>
                  <button
                     onClick={() => revalidator.revalidate()}
                     style={{
                        background: "#3b82f6",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.85rem",
                        marginTop: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                     }}
                     disabled={revalidator.state === "loading"}
                  >
                     <RefreshCw size={16} className={revalidator.state === "loading" ? "spinning" : ""} />
                     {revalidator.state === "loading" ? "Refreshing..." : "Refresh"}
                  </button>
               </div>
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
                           <td>
                              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                 {job.type === "once" ? <Clock size={14} /> : <Repeat size={14} />}
                                 {job.type}
                              </span>
                           </td>
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
                                 <button type="submit" className="btn-cancel" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                    <X size={14} />
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
