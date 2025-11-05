import { Pool } from "pg";
import { DB_CONFIG } from "./constants.server";
import { Contact, CreateContactRequest, UpdateContactRequest } from "../types";

let pool: Pool | null = null;

export function initializeDatabase(): void {
   pool = new Pool(DB_CONFIG);

   pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
   });

   console.log("✅ Database connection pool initialized");
}

function getPool(): Pool {
   if (!pool) {
      throw new Error(
         "Database not initialized. Call initializeDatabase() first.",
      );
   }
   return pool;
}

export async function getAllContacts(): Promise<Contact[]> {
   const db = getPool();
   const result = await db.query(
      "SELECT id, name, phone, created_at, updated_at FROM contacts ORDER BY name ASC",
   );
   return result.rows;
}

export async function getContactById(id: number): Promise<Contact | null> {
   const db = getPool();
   const result = await db.query(
      "SELECT id, name, phone, created_at, updated_at FROM contacts WHERE id = $1",
      [id],
   );
   return result.rows[0] || null;
}

export async function getContactByPhone(
   phone: string,
): Promise<Contact | null> {
   const db = getPool();
   const result = await db.query(
      "SELECT id, name, phone, created_at, updated_at FROM contacts WHERE phone = $1",
      [phone],
   );
   return result.rows[0] || null;
}

export async function createContact(
   data: CreateContactRequest,
): Promise<Contact> {
   const db = getPool();
   const result = await db.query(
      "INSERT INTO contacts (name, phone) VALUES ($1, $2) RETURNING id, name, phone, created_at, updated_at",
      [data.name, data.phone],
   );
   return result.rows[0];
}

export async function updateContact(
   id: number,
   data: UpdateContactRequest,
): Promise<Contact | null> {
   const db = getPool();

   // Build dynamic update query
   const updates: string[] = [];
   const values: any[] = [];
   let paramIndex = 1;

   if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(data.name);
      paramIndex++;
   }

   if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(data.phone);
      paramIndex++;
   }

   if (updates.length === 0) {
      return getContactById(id);
   }

   values.push(id);
   const query = `
        UPDATE contacts
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, phone, created_at, updated_at
    `;

   const result = await db.query(query, values);
   return result.rows[0] || null;
}

export async function deleteContact(id: number): Promise<boolean> {
   const db = getPool();
   const result = await db.query("DELETE FROM contacts WHERE id = $1", [id]);
   return result.rowCount !== null && result.rowCount > 0;
}

export async function closeDatabase(): Promise<void> {
   if (pool) {
      await pool.end();
      pool = null;
      console.log("Database connection pool closed");
   }
}
