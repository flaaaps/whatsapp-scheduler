# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp message scheduler built with TypeScript, @whiskeysockets/baileys v7, Express, and node-cron. The application provides a web UI for scheduling WhatsApp messages either as one-time sends or recurring CRON jobs.

## Running the Application

### Local Development

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build

# Run production build
npm start
```

### Docker

```bash
# Build and start the container
docker-compose up -d

# View logs (to see QR code for first-time setup)
docker-compose logs -f

# Stop the container
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Environment Variables

Create a `.env` file in the project root:
```
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
PORT=3000
```

The application will:
- Start on port 3000
- Display a QR code in the terminal for WhatsApp authentication (on first run)
- Serve the web UI at http://localhost:3000
- Persist authentication in the `auth/` directory

## Project Structure

```
whatsapp-scheduler/
├── src/
│   ├── index.ts              # Main entry point
│   ├── app.ts                # Express app configuration
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces and types
│   ├── services/
│   │   ├── whatsapp.ts       # WhatsApp connection & messaging
│   │   └── scheduler.ts      # Job scheduling logic
│   ├── routes/
│   │   └── api.ts            # API route handlers
│   └── utils/
│       └── constants.ts      # Configuration constants
├── public/                   # Static web UI files
├── dist/                     # Compiled JavaScript (generated)
├── auth/                     # WhatsApp auth state (generated)
└── tsconfig.json            # TypeScript configuration
```

## Development

### Build System
- **TypeScript**: Source files in `src/` directory
- **Compiler**: TypeScript compiles to ES modules in `dist/` directory
- **Dev Mode**: Uses `tsx` for hot-reloading during development
- **Source**: `src/` → **Output**: `dist/`

### Scripts
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript
- `npm run clean` - Remove dist folder

## Authentication

The app uses HTTP Basic Auth:
- Credentials are stored in `.env` file
- Default: `ADMIN_USER` and `ADMIN_PASS`
- All web UI and API endpoints require authentication
- Configuration in `src/utils/constants.ts`

## Architecture

### Core Modules

#### 1. Entry Point (`src/index.ts`)
- Initializes database connection
- Initializes WhatsApp connection
- Starts Express server
- Graceful shutdown handlers
- Main application orchestration

#### 2. Express App (`src/app.ts`)
- Express application setup
- Middleware configuration (JSON parsing, auth, static files)
- Route mounting

#### 3. Database Service (`src/services/database.ts`)
**Exports:**
- `initializeDatabase()` - Initialize PostgreSQL connection pool
- `getAllContacts()` - Get all contacts from database
- `getContactById(id)` - Get single contact
- `getContactByPhone(phone)` - Find contact by phone number
- `createContact(data)` - Create new contact
- `updateContact(id, data)` - Update existing contact
- `deleteContact(id)` - Delete contact
- `closeDatabase()` - Close connection pool

**Features:**
- PostgreSQL connection pooling
- Full CRUD operations for contacts
- Dynamic query building for updates
- Error handling for constraint violations

#### 4. WhatsApp Service (`src/services/whatsapp.ts`)
**Exports:**
- `initializeWhatsApp()` - Initialize Baileys connection
- `getWhatsAppSocket()` - Get current socket instance
- `sendMessage(to, text)` - Send a message
- `getConnectionStatus()` - Get connection state
- `getCurrentUser()` - Get logged-in user info

**Features:**
- Multi-file auth state (persisted in `auth/` directory)
- Auto-reconnection on disconnect (unless logged out)
- QR code generation for pairing
- Connection state management

#### 5. Scheduler Service (`src/services/scheduler.ts`)
**Exports:**
- `scheduleCron(to, text, cron)` - Schedule recurring message
- `scheduleOnce(to, text, timestamp)` - Schedule one-time message
- `cancelScheduledJob(id)` - Cancel a scheduled job
- `getAllScheduledJobs()` - Get all active jobs

**Features:**
- In-memory Map for job storage
- Unique timestamp-based job IDs
- Support for both cron and one-time schedules

#### 6. API Routes (`src/routes/api.ts`)
**Messaging Endpoints:**
- `POST /send` - Send immediate message
- `POST /api/schedule` - Schedule new message (cron or timestamp)
- `DELETE /api/schedule/:id` - Cancel scheduled job
- `GET /api/status` - Connection status + scheduled jobs

**Contact Management Endpoints:**
- `GET /api/contacts` - Get all contacts from database
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

**Features:**
- Fully typed request/response handlers
- Error handling and validation
- Duplicate phone number detection
- Phone format validation

#### 7. Types (`src/types/index.ts`)
**Interfaces:**
- `ScheduledCronJob` - Recurring job type
- `ScheduledOnceJob` - One-time job type
- `ScheduledJob` - Union type
- `Contact` - Contact information with database fields
- `CreateContactRequest` - Request body for creating contacts
- `UpdateContactRequest` - Request body for updating contacts
- `ScheduleRequest` - API request types
- `SendRequest` - API request types

#### 8. Constants (`src/utils/constants.ts`)
**Exports:**
- `ROOT_DIR` - Project root directory
- `AUTH_DIR` - WhatsApp auth directory
- `PUBLIC_DIR` - Static files directory
- `PORT` - Server port (default: 3000)
- `AUTH_CONFIG` - Basic auth configuration
- `DB_CONFIG` - PostgreSQL database configuration

### WhatsApp Message Format

All messages use Baileys JID format:
- Phone numbers are formatted as `${phoneNumber}@s.whatsapp.net`
- Example: `491701234567@s.whatsapp.net`

### Contacts System

Contacts are stored in a PostgreSQL database and managed through:
- **Database**: `src/services/database.ts` - CRUD operations
- **API**: `src/routes/api.ts` - RESTful endpoints
- **UI**: `public/contacts.html` - Management interface

#### Database Schema
```sql
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Contact Fields
- `id`: Auto-incrementing primary key
- `name`: Display name
- `phone`: Full phone number (country code + number, no plus sign, digits only)
- `phoneDisplay`: Auto-formatted display version (generated on API response)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp (auto-updated via trigger)

#### Adding/Modifying Contacts
Use the web UI at `/contacts.html` or interact with the API endpoints directly:
- POST `/api/contacts` - Create new contact
- PUT `/api/contacts/:id` - Update contact
- DELETE `/api/contacts/:id` - Delete contact

## Web UI

**Main Scheduler** (`public/index.html`):
- Link to contact management page
- Contact picker (dropdown) or manual phone number input
- Message textarea
- Mode selector: one-time or CRON
- DateTime picker for one-time sends
- CRON expression input for recurring sends
- Real-time status display (connected/disconnected)
- Scheduled jobs table with cancel buttons
- Auto-refreshes status every 5 seconds

**Contact Management** (`public/contacts.html`):
- Add new contacts form
- Contacts table with edit/delete actions
- Modal for editing contacts
- Real-time success/error messages
- Phone number validation
- Duplicate detection

## State Management

**Scheduled Jobs**: In-memory only. Restarting the application will clear all scheduled messages.

**Contacts**: Persisted in PostgreSQL database. Survives application restarts.

**WhatsApp Auth**: Persisted to disk in `auth/` directory. Delete this folder to re-pair with WhatsApp.

## Dependencies

**Runtime:**
- `@whiskeysockets/baileys` - WhatsApp Web API client
- `express` - Web server
- `express-basic-auth` - HTTP Basic Auth middleware
- `node-cron` - CRON job scheduler
- `qrcode-terminal` - QR code display for WhatsApp pairing
- `pg` - PostgreSQL client

**Development:**
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution with hot-reload
- `@types/*` - Type definitions for all dependencies (node, express, pg, node-cron, qrcode-terminal)

## Adding New Features

### Adding a new API endpoint:
1. Add route handler in `src/routes/api.ts`
2. Add request/response types in `src/types/index.ts` if needed
3. Import and use services from `src/services/`

### Adding new scheduler functionality:
1. Add function in `src/services/scheduler.ts`
2. Export the function
3. Use in route handlers in `src/routes/api.ts`

### Adding new WhatsApp features:
1. Add function in `src/services/whatsapp.ts`
2. Export the function
3. Use in services or routes as needed

## Docker Deployment

The project includes Docker support for easy deployment.

### Docker Files
- **Dockerfile** - Multi-stage build using Node.js 20 Alpine
- **docker-compose.yml** - Orchestration with volume mounts
- **.dockerignore** - Excludes unnecessary files from build

### Key Features
- **Persistent Auth**: `auth/` directory mounted as volume
- **Environment Variables**: Configurable via `.env` or docker-compose
- **Auto-restart**: Container restarts unless manually stopped
- **QR Code Access**: Use `docker-compose logs -f` to view QR code

### Volume Mounts
- `./auth:/app/auth` - WhatsApp authentication persistence
- `./public:/app/public` - Static web UI files

### First-Time Setup with Docker
1. Create `.env` file with credentials
2. Run `docker-compose up -d`
3. View logs: `docker-compose logs -f`
4. Scan QR code with WhatsApp
5. Access UI at `http://localhost:3000`

## Common Issues

**QR Code Not Scanning**: The QR code appears in the terminal. Scan it with WhatsApp's "Linked Devices" feature.

**Connection Lost**: Application auto-reconnects unless explicitly logged out. If logged out, delete `auth/` folder and restart.

**Scheduled Jobs Lost**: Jobs are in-memory only. Server restart clears all schedules.

**TypeScript Errors**: Run `npm run build` to check for type errors before deployment.

**Import Errors**: Remember to use `.js` extension in imports even though source files are `.ts` (ES modules requirement).

## Module System

Uses ES modules with TypeScript:
- Source files use `.ts` extension in `src/` directory
- Compiled to ESM in `dist/` directory preserving folder structure
- `type: "module"` in package.json
- All imports use ESM syntax with `.js` extensions
- Module resolution: Node.js style
