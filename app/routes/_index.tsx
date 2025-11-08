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
import { useState, useEffect, useRef, useMemo } from "react";
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
   CheckCircle,
   XCircle,
   AlertCircle,
} from "lucide-react";
import { Cron } from "croner";
import cronstrue from "cronstrue";
import { Button } from "~/components/ui/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "~/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

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
   const [cronInput, setCronInput] = useState("");

   const isSubmitting = fetcher.state === "submitting";
   const isConnected = status.status === "connected";
   const canSchedule = isConnected && !isSubmitting;

   // Validate and parse CRON expression
   const cronInfo = useMemo(() => {
      if (!cronInput || mode !== "cron") {
         return null;
      }

      try {
         const job = new Cron(cronInput, { paused: true });
         const nextExecutions = job
            .nextRuns(3)
            .map((date) => date.toLocaleString());
         const description = cronstrue.toString(cronInput);

         return {
            isValid: true,
            description,
            nextExecutions,
         };
      } catch (error) {
         return {
            isValid: false,
            description: "Invalid CRON expression",
            nextExecutions: [],
         };
      }
   }, [cronInput, mode]);

   useEffect(() => {
      if (
         fetcher.data?.success &&
         fetcher.data?.message === "Message scheduled successfully!"
      ) {
         setFormKey((prev) => prev + 1);
         setMode("once");
         setCronInput("");
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
      <div className="container mx-auto max-w-5xl py-8 px-4">
         <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold flex items-center gap-3">
               <Calendar className="size-8" />
               WhatsApp Message Scheduler
            </h1>
            <Button asChild variant="outline">
               <Link to="/contacts">
                  <Contact className="size-4" />
                  Manage Contacts
               </Link>
            </Button>
         </div>

         <Card>
            <CardContent>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <span className="font-semibold">Status:</span>
                        <Badge
                           variant={
                              status.status === "connected"
                                 ? "default"
                                 : "secondary"
                           }
                        >
                           {status.status}
                        </Badge>
                     </div>
                     {status.me && (
                        <p className="text-sm text-muted-foreground">
                           Logged in as: {status.me.id}
                        </p>
                     )}
                  </div>
                  {status.me && (
                     <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="logout" />
                        <Button
                           type="submit"
                           variant="destructive"
                           disabled={fetcher.state === "submitting"}
                        >
                           <LogOut className="size-4" />
                           {fetcher.state === "submitting"
                              ? "Logging out..."
                              : "Logout"}
                        </Button>
                     </fetcher.Form>
                  )}
               </div>
            </CardContent>
         </Card>

         {status.qrCode && (
            <Card className="mt-6">
               <CardHeader>
                  <CardTitle>Scan to Connect WhatsApp</CardTitle>
                  <CardDescription>
                     Open WhatsApp on your phone →{" "}
                     <strong>Linked Devices</strong> →{" "}
                     <strong>Link a Device</strong> → Scan this QR code
                  </CardDescription>
               </CardHeader>
               <CardContent className="flex justify-center">
                  <img
                     src={status.qrCode}
                     alt="WhatsApp QR Code"
                     className="rounded-lg border p-4 bg-white"
                  />
               </CardContent>
            </Card>
         )}

         {fetcher.data?.error && (
            <Alert variant="destructive" className="mt-6">
               <XCircle className="size-4" />
               <AlertDescription>{fetcher.data.error}</AlertDescription>
            </Alert>
         )}

         {fetcher.data?.success && (
            <Alert className="mt-6 border-green-600 text-green-600">
               <CheckCircle className="size-4" />
               <AlertDescription>
                  {fetcher.data?.message ?? "That worked!!"}
               </AlertDescription>
            </Alert>
         )}

         <Card className="mt-6">
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="size-5" />
                  Schedule a Message
               </CardTitle>
               {!isConnected && (
                  <Alert variant="warning" className="mt-4">
                     <AlertCircle className="size-4" />
                     <AlertTitle>WhatsApp Not Connected</AlertTitle>
                     <AlertDescription>
                        Please connect to WhatsApp before scheduling messages.{" "}
                        {status.qrCode
                           ? "Scan the QR code above to connect."
                           : "Reconnect to continue."}
                     </AlertDescription>
                  </Alert>
               )}
            </CardHeader>
            <CardContent>
               <fetcher.Form
                  key={formKey}
                  method="post"
                  className="space-y-4"
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

                           console.log(
                              "User selected (local):",
                              datetimeInput.value,
                           );
                           console.log(
                              "Converted to UTC timestamp:",
                              utcTimestamp,
                           );
                           console.log(
                              "UTC time:",
                              new Date(utcTimestamp).toISOString(),
                           );
                        }
                     }
                  }}
               >
                  <input type="hidden" name="intent" value="schedule" />

                  <div className="space-y-2">
                     <Label htmlFor="contact">Contact</Label>
                     <select
                        id="contact"
                        name="to"
                        required
                        disabled={!isConnected}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                     >
                        <option value="">Select a contact</option>
                        {contacts.map((contact) => (
                           <option key={contact.id} value={contact.phone}>
                              {contact.name} | {contact.phoneDisplay}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="message">Message</Label>
                     <Textarea
                        id="message"
                        name="text"
                        required
                        placeholder="Type your message here"
                        disabled={!isConnected}
                        rows={4}
                     />
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="mode">Send Type</Label>
                     <select
                        id="mode"
                        name="mode"
                        value={mode}
                        onChange={(e) => {
                           setMode(e.target.value as "once" | "cron");
                           setCronInput("");
                        }}
                        disabled={!isConnected}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                     >
                        <option value="once">Send once at specific time</option>
                        <option value="cron">Repeat using CRON pattern</option>
                     </select>
                  </div>

                  {mode === "once" ? (
                     <div className="space-y-2">
                        <Label htmlFor="datetime">Date & Time</Label>
                        <Input
                           key="datetime"
                           id="datetime"
                           type="datetime-local"
                           name="timestamp"
                           required
                           disabled={!isConnected}
                        />
                     </div>
                  ) : (
                     <>
                        <div className="space-y-2">
                           <Label htmlFor="cron">CRON Expression</Label>
                           <Input
                              key="cron"
                              id="cron"
                              type="text"
                              name="cron"
                              placeholder="0 9 * * *"
                              required
                              pattern="^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$"
                              disabled={!isConnected}
                              value={cronInput}
                              onChange={(e) => setCronInput(e.target.value)}
                           />
                           <p className="text-xs text-muted-foreground">
                              Examples: "0 9 * * *" (daily at 9am), "0 */2 * *
                              *" (every 2 hours)
                           </p>
                        </div>

                        {cronInfo && cronInput && (
                           <Alert
                              variant={
                                 cronInfo.isValid ? "default" : "destructive"
                              }
                              className="mt-4"
                           >
                              <div className="flex items-start gap-3">
                                 {cronInfo.isValid ? (
                                    <CheckCircle className="size-5 mt-0.5" />
                                 ) : (
                                    <XCircle className="size-5 mt-0.5" />
                                 )}
                                 <div className="flex-1 space-y-2">
                                    <p className="font-semibold">
                                       {cronInfo.description}
                                    </p>
                                    {cronInfo.isValid &&
                                       cronInfo.nextExecutions.length > 0 && (
                                          <div className="text-sm">
                                             <p className="font-medium mb-1">
                                                Next executions:
                                             </p>
                                             <ul className="list-disc list-inside space-y-0.5">
                                                {cronInfo.nextExecutions.map(
                                                   (time, i) => (
                                                      <li key={i}>{time}</li>
                                                   ),
                                                )}
                                             </ul>
                                          </div>
                                       )}
                                 </div>
                              </div>
                           </Alert>
                        )}
                     </>
                  )}

                  <Button
                     type="submit"
                     disabled={!canSchedule}
                     className="w-full"
                  >
                     <Send className="size-4" />
                     {isSubmitting
                        ? "Scheduling..."
                        : isConnected
                          ? "Schedule Message"
                          : "Connect WhatsApp to Schedule"}
                  </Button>
               </fetcher.Form>
            </CardContent>
         </Card>

         {status.scheduled.length > 0 && (
            <Card className="mt-6">
               <CardHeader>
                  <div className="flex justify-between items-center">
                     <CardTitle className="flex items-center gap-2">
                        <Clock className="size-5" />
                        Scheduled Messages
                     </CardTitle>
                     <Button
                        onClick={() => revalidator.revalidate()}
                        disabled={revalidator.state === "loading"}
                        variant="outline"
                        size="sm"
                     >
                        <RefreshCw
                           className={`size-4 ${revalidator.state === "loading" ? "animate-spin" : ""}`}
                        />
                        {revalidator.state === "loading"
                           ? "Refreshing..."
                           : "Refresh"}
                     </Button>
                  </div>
               </CardHeader>
               <CardContent>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>To</TableHead>
                           <TableHead>Message</TableHead>
                           <TableHead>Type</TableHead>
                           <TableHead>When/Pattern</TableHead>
                           <TableHead>Actions</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {status.scheduled.map((job) => (
                           <TableRow key={job.id}>
                              <TableCell>{job.to}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                 {job.text.substring(0, 30)}...
                              </TableCell>
                              <TableCell>
                                 <div className="flex items-center gap-2">
                                    {job.type === "once" ? (
                                       <Clock className="size-4" />
                                    ) : (
                                       <Repeat className="size-4" />
                                    )}
                                    <Badge variant="outline">{job.type}</Badge>
                                 </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                 {job.type === "once" ? job.when : job.cron}
                              </TableCell>
                              <TableCell>
                                 <fetcher.Form method="post" className="inline">
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
                                    <Button
                                       type="submit"
                                       variant="destructive"
                                       size="sm"
                                    >
                                       <X className="size-4" />
                                       Cancel
                                    </Button>
                                 </fetcher.Form>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         )}
      </div>
   );
}
