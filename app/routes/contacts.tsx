import {
   json,
   type LoaderFunctionArgs,
   type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import type { AppLoadContext } from "~/.server/context.server";
import { Contact, UserPlus, Users, Edit2, Trash2, Save, X, ArrowLeft } from "lucide-react";

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
      <div>
         <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Contact size={28} />
            Manage Contacts
         </h1>
         <p>Add, edit, and delete your WhatsApp contacts</p>

         <div style={{ marginBottom: "1rem" }}>
            <Link to="/" className="nav-link">
               <ArrowLeft size={18} style={{ display: "inline", marginRight: "0.5rem", verticalAlign: "middle" }} />
               Back to Scheduler
            </Link>
         </div>

         {(addFetcher.data?.error || editFetcher.data?.error || deleteFetcher.data?.error) && (
            <div className="error-message">
               {addFetcher.data?.error || editFetcher.data?.error || deleteFetcher.data?.error}
            </div>
         )}

         {(addFetcher.data?.success || editFetcher.data?.success || deleteFetcher.data?.success) && (
            <div className="success-message">
               {addFetcher.data?.message || editFetcher.data?.message || deleteFetcher.data?.message}
            </div>
         )}

         {/* Add Contact Form */}
         <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
               <UserPlus size={22} />
               Add New Contact
            </h2>
            <addFetcher.Form key={addFormKey} method="post">
               <input type="hidden" name="intent" value="create" />

               <label>
                  Name
                  <input
                     type="text"
                     name="name"
                     required
                     placeholder="John Doe"
                     disabled={addFetcher.state === "submitting"}
                  />
               </label>

               <label>
                  Phone Number (digits only, with country code)
                  <input
                     type="text"
                     name="phone"
                     required
                     placeholder="4915758278556"
                     pattern="[0-9]+"
                     disabled={addFetcher.state === "submitting"}
                  />
               </label>

               <button type="submit" disabled={addFetcher.state === "submitting"} style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                  <UserPlus size={18} />
                  {addFetcher.state === "submitting" ? "Adding..." : "Add Contact"}
               </button>
            </addFetcher.Form>
         </div>

         {/* Contacts List */}
         <div className="card">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
               <Users size={22} />
               Your Contacts
            </h2>
            {contacts.length === 0 ? (
               <p className="small">
                  No contacts yet. Add your first contact above!
               </p>
            ) : (
               <table>
                  <thead>
                     <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {contacts.map((contact) => (
                        <tr key={contact.id}>
                           <td>{contact.id}</td>
                           <td>{contact.name}</td>
                           <td>{contact.phoneDisplay}</td>
                           <td>
                              <button
                                 onClick={() => setEditingContact(contact)}
                                 style={{
                                    background: "#fbbf24",
                                    padding: "0.3rem 0.6rem",
                                    fontSize: "0.85rem",
                                    marginTop: 0,
                                    marginRight: "0.5rem",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.3rem",
                                 }}
                              >
                                 <Edit2 size={14} />
                                 Edit
                              </button>
                              <deleteFetcher.Form
                                 method="post"
                                 style={{ display: "inline" }}
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
                                 <button type="submit" className="btn-cancel" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                    <Trash2 size={14} />
                                    Delete
                                 </button>
                              </deleteFetcher.Form>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
         </div>

         {/* Edit Modal */}
         {editingContact && (
            <div
               style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
               }}
               onClick={() => setEditingContact(null)}
            >
               <div
                  className="card"
                  style={{
                     maxWidth: "500px",
                     width: "90%",
                     margin: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
               >
                  <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                     <Edit2 size={22} />
                     Edit Contact
                  </h2>
                  <editFetcher.Form key={editingContact.id} method="post">
                     <input type="hidden" name="intent" value="update" />
                     <input type="hidden" name="id" value={editingContact.id} />

                     <label>
                        Name
                        <input
                           type="text"
                           name="name"
                           required
                           defaultValue={editingContact.name}
                           disabled={editFetcher.state === "submitting"}
                        />
                     </label>

                     <label>
                        Phone Number
                        <input
                           type="text"
                           name="phone"
                           required
                           defaultValue={editingContact.phone}
                           pattern="[0-9]+"
                           disabled={editFetcher.state === "submitting"}
                        />
                     </label>

                     <button type="submit" disabled={editFetcher.state === "submitting"} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
                        <Save size={16} />
                        {editFetcher.state === "submitting" ? "Saving..." : "Save Changes"}
                     </button>
                     <button
                        type="button"
                        onClick={() => setEditingContact(null)}
                        style={{
                           background: "#6b7280",
                           marginLeft: "0.5rem",
                           display: "inline-flex",
                           alignItems: "center",
                           gap: "0.4rem",
                        }}
                     >
                        <X size={16} />
                        Cancel
                     </button>
                  </editFetcher.Form>
               </div>
            </div>
         )}
      </div>
   );
}
