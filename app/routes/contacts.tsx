import {
   json,
   type LoaderFunctionArgs,
   type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import type { AppLoadContext } from "~/.server/context.server";
import {
   Contact,
   UserPlus,
   Users,
   Edit2,
   Trash2,
   Save,
   X,
   ArrowLeft,
   AlertCircle,
} from "lucide-react";
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
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "~/components/ui/table";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "~/components/ui/dialog";

interface Contact {
   id: number;
   name: string;
   phone: string;
   phoneDisplay?: string;
   created_at?: string;
   updated_at?: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
   try {
      const { services } = context as AppLoadContext;
      const contacts = await services.db.getAllContacts();

      // Add phoneDisplay formatting
      const formatted = contacts.map((c) => ({
         ...c,
         phoneDisplay: `+${c.phone.substring(0, 2)} ${c.phone.substring(2, 6)} ${c.phone.substring(6)}`,
      }));

      return json({ contacts: formatted });
   } catch (error) {
      console.error("Error fetching contacts:", error);
      return json({ contacts: [] }, { status: 500 });
   }
}

export async function action({ request, context }: ActionFunctionArgs) {
   const formData = await request.formData();
   const intent = formData.get("intent");
   const { services } = context as AppLoadContext;

   // Create contact
   if (intent === "create") {
      try {
         const name = formData.get("name") as string;
         const phone = formData.get("phone") as string;

         // Validate phone format
         if (!name || !phone) {
            return json(
               { error: "Name and phone are required", success: false },
               { status: 400 },
            );
         }

         if (!/^\d+$/.test(phone)) {
            return json(
               { error: "Phone must contain only digits", success: false },
               { status: 400 },
            );
         }

         await services.db.createContact({ name, phone });
         return json({ success: true, message: "Contact added successfully!" });
      } catch (error: any) {
         console.error("Error creating contact:", error);
         // Check for unique constraint violation
         if (error.code === "23505") {
            return json(
               {
                  error: "Contact with this phone number already exists",
                  success: false,
               },
               { status: 409 },
            );
         }
         return json(
            { error: "Failed to create contact", success: false },
            { status: 500 },
         );
      }
   }

   // Update contact
   if (intent === "update") {
      try {
         const id = parseInt(formData.get("id") as string);
         const name = formData.get("name") as string;
         const phone = formData.get("phone") as string;

         if (isNaN(id)) {
            return json(
               { error: "Invalid contact ID", success: false },
               { status: 400 },
            );
         }

         if (!name && !phone) {
            return json(
               {
                  error: "At least one field (name or phone) must be provided",
                  success: false,
               },
               { status: 400 },
            );
         }

         // Validate phone format if provided
         if (phone && !/^\d+$/.test(phone)) {
            return json(
               { error: "Phone must contain only digits", success: false },
               { status: 400 },
            );
         }

         const contact = await services.db.updateContact(id, { name, phone });
         if (!contact) {
            return json(
               { error: "Contact not found", success: false },
               { status: 404 },
            );
         }

         return json({
            success: true,
            message: "Contact updated successfully!",
         });
      } catch (error: any) {
         console.error("Error updating contact:", error);
         if (error.code === "23505") {
            return json(
               {
                  error: "Contact with this phone number already exists",
                  success: false,
               },
               { status: 409 },
            );
         }
         return json(
            { error: "Failed to update contact", success: false },
            { status: 500 },
         );
      }
   }

   // Delete contact
   if (intent === "delete") {
      try {
         const id = parseInt(formData.get("id") as string);

         if (isNaN(id)) {
            return json(
               { error: "Invalid contact ID", success: false },
               { status: 400 },
            );
         }

         const success = await services.db.deleteContact(id);
         if (!success) {
            return json(
               { error: "Contact not found", success: false },
               { status: 404 },
            );
         }

         return json({
            success: true,
            message: "Contact deleted successfully!",
         });
      } catch (error) {
         console.error("Error deleting contact:", error);
         return json(
            { error: "Failed to delete contact", success: false },
            { status: 500 },
         );
      }
   }

   return json({ error: "Invalid intent" }, { status: 400 });
}

export default function Contacts() {
   const { contacts } = useLoaderData<typeof loader>();
   const addFetcher = useFetcher<{
      success: boolean;
      error: string;
      message: string;
   }>();
   const editFetcher = useFetcher<{
      success: boolean;
      error: string;
      message: string;
   }>();
   const deleteFetcher = useFetcher<{
      success: boolean;
      error: string;
      message: string;
   }>();
   const [editingContact, setEditingContact] = useState<Contact | null>(null);
   const [addFormKey, setAddFormKey] = useState(0);
   const prevEditStateRef = useRef(editFetcher.state);

   // Close edit modal when successfully submitted
   // Fetcher state transitions: idle → submitting → loading → idle
   // So we need to check for transition from loading to idle with success
   useEffect(() => {
      if (
         prevEditStateRef.current === "loading" &&
         editFetcher.state === "idle" &&
         editFetcher.data?.success
      ) {
         setEditingContact(null);
      }
      prevEditStateRef.current = editFetcher.state;
   }, [editFetcher.state, editFetcher.data?.success]);

   // Reset add form after successful submission
   useEffect(() => {
      if (addFetcher.state === "idle" && addFetcher.data?.success) {
         setAddFormKey((prev) => prev + 1);
      }
   }, [addFetcher.state, addFetcher.data?.success]);

   return (
      <div className="container mx-auto max-w-5xl py-8 px-4">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h1 className="text-4xl font-bold flex items-center gap-3">
                  <Contact className="size-8" />
                  Manage Contacts
               </h1>
               <p className="text-muted-foreground mt-2">
                  Add, edit, and delete your WhatsApp contacts
               </p>
            </div>
            <Button asChild variant="outline">
               <Link to="/">
                  <ArrowLeft className="size-4" />
                  Back to Scheduler
               </Link>
            </Button>
         </div>

         {(addFetcher.data?.error ||
            editFetcher.data?.error ||
            deleteFetcher.data?.error) && (
            <Alert variant="destructive" className="mb-6">
               <AlertCircle className="size-4" />
               <AlertDescription>
                  {addFetcher.data?.error ||
                     editFetcher.data?.error ||
                     deleteFetcher.data?.error}
               </AlertDescription>
            </Alert>
         )}

         {(addFetcher.data?.success ||
            editFetcher.data?.success ||
            deleteFetcher.data?.success) && (
            <Alert className="mb-6 border-green-600 text-green-600">
               <AlertCircle className="size-4" />
               <AlertDescription>
                  {addFetcher.data?.message ||
                     editFetcher.data?.message ||
                     deleteFetcher.data?.message}
               </AlertDescription>
            </Alert>
         )}

         {/* Add Contact Form */}
         <Card>
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  <UserPlus className="size-5" />
                  Add New Contact
               </CardTitle>
               <CardDescription>
                  Add a new WhatsApp contact to your list
               </CardDescription>
            </CardHeader>
            <CardContent>
               <addFetcher.Form
                  key={addFormKey}
                  method="post"
                  className="space-y-4"
               >
                  <input type="hidden" name="intent" value="create" />

                  <div className="space-y-2">
                     <Label htmlFor="name">Name</Label>
                     <Input
                        id="name"
                        type="text"
                        name="name"
                        required
                        placeholder="John Doe"
                        disabled={addFetcher.state === "submitting"}
                     />
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="phone">Phone Number</Label>
                     <Input
                        id="phone"
                        type="text"
                        name="phone"
                        required
                        placeholder="4915758278556"
                        pattern="[0-9]+"
                        disabled={addFetcher.state === "submitting"}
                     />
                     <p className="text-xs text-muted-foreground">
                        Digits only, with country code (e.g., 4915758278556)
                     </p>
                  </div>

                  <Button
                     type="submit"
                     disabled={addFetcher.state === "submitting"}
                     className="w-full"
                  >
                     <UserPlus className="size-4" />
                     {addFetcher.state === "submitting"
                        ? "Adding..."
                        : "Add Contact"}
                  </Button>
               </addFetcher.Form>
            </CardContent>
         </Card>

         {/* Contacts List */}
         <Card className="mt-6">
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Your Contacts
               </CardTitle>
            </CardHeader>
            <CardContent>
               {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                     No contacts yet. Add your first contact above!
                  </p>
               ) : (
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>ID</TableHead>
                           <TableHead>Name</TableHead>
                           <TableHead>Phone</TableHead>
                           <TableHead>Actions</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {contacts.map((contact) => (
                           <TableRow key={contact.id}>
                              <TableCell className="font-medium">
                                 {contact.id}
                              </TableCell>
                              <TableCell>{contact.name}</TableCell>
                              <TableCell className="font-mono text-sm">
                                 {contact.phoneDisplay}
                              </TableCell>
                              <TableCell>
                                 <div className="flex gap-2">
                                    <Button
                                       onClick={() =>
                                          setEditingContact(contact)
                                       }
                                       variant="outline"
                                       size="sm"
                                    >
                                       <Edit2 className="size-4" />
                                       Edit
                                    </Button>
                                    <deleteFetcher.Form
                                       method="post"
                                       className="inline"
                                       onSubmit={(e) => {
                                          if (
                                             !confirm(
                                                "Are you sure you want to delete this contact?",
                                             )
                                          ) {
                                             e.preventDefault();
                                          }
                                       }}
                                    >
                                       <input
                                          type="hidden"
                                          name="intent"
                                          value="delete"
                                       />
                                       <input
                                          type="hidden"
                                          name="id"
                                          value={contact.id}
                                       />
                                       <Button
                                          type="submit"
                                          variant="destructive"
                                          size="sm"
                                       >
                                          <Trash2 className="size-4" />
                                          Delete
                                       </Button>
                                    </deleteFetcher.Form>
                                 </div>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               )}
            </CardContent>
         </Card>

         {/* Edit Modal */}
         <Dialog
            open={!!editingContact}
            onOpenChange={(open) => !open && setEditingContact(null)}
         >
            <DialogContent>
               <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                     <Edit2 className="size-5" />
                     Edit Contact
                  </DialogTitle>
                  <DialogDescription>
                     Update the contact information below
                  </DialogDescription>
               </DialogHeader>
               {editingContact && (
                  <editFetcher.Form
                     key={editingContact.id}
                     method="post"
                     className="space-y-4"
                  >
                     <input type="hidden" name="intent" value="update" />
                     <input type="hidden" name="id" value={editingContact.id} />

                     <div className="space-y-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                           id="edit-name"
                           type="text"
                           name="name"
                           required
                           defaultValue={editingContact.name}
                           disabled={editFetcher.state === "submitting"}
                        />
                     </div>

                     <div className="space-y-2">
                        <Label htmlFor="edit-phone">Phone Number</Label>
                        <Input
                           id="edit-phone"
                           type="text"
                           name="phone"
                           required
                           defaultValue={editingContact.phone}
                           pattern="[0-9]+"
                           disabled={editFetcher.state === "submitting"}
                        />
                     </div>

                     <div className="flex gap-2 justify-end">
                        <Button
                           type="button"
                           variant="outline"
                           onClick={() => setEditingContact(null)}
                        >
                           <X className="size-4" />
                           Cancel
                        </Button>
                        <Button
                           type="submit"
                           disabled={editFetcher.state === "submitting"}
                        >
                           <Save className="size-4" />
                           {editFetcher.state === "submitting"
                              ? "Saving..."
                              : "Save Changes"}
                        </Button>
                     </div>
                  </editFetcher.Form>
               )}
            </DialogContent>
         </Dialog>
      </div>
   );
}
