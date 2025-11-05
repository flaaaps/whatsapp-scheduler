# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp message scheduler built with:
- **Backend**: @whiskeysockets/baileys v7, Express 5, PostgreSQL, node-cron
- **Frontend**: Remix 2 with Vite 6, React 19, Server-Side Rendering
- **Infrastructure**: Docker, TypeScript, ES Modules
- **Node Version**: 20+ (required by Baileys and other dependencies)

The application provides a modern web UI for scheduling WhatsApp messages (one-time or recurring CRON jobs) and managing contacts.

## Running the Application

**IMPORTANT**: Node.js 20 or higher is required.

### Local Development

```bash
# Start the development server with hot reload
npm run dev
```

The application will:
- Start on port 3000
- Initialize WhatsApp connection (QR code on first run)
- Serve Remix UI with Vite hot module replacement
- Connect to PostgreSQL database (if configured)
- Persist WhatsApp auth in the `auth/` directory

### Production Mode

```bash
# Build both Remix frontend and Express backend
npm run build

# Start the production server
npm start
```

### Docker (Recommended for Production)

```bash
# Build and start with docker-compose
docker-compose up -d

# View logs (to see QR code for first-time setup)
docker-compose logs -f

# Rebuild after code changes
docker-compose up -d --build

# Stop the container
docker-compose down
```

### Environment Variables

Create a `.env` file in the project root:
```
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
PORT=3000

# PostgreSQL (used when running locally, auto-configured in Docker)
POSTGRES_USER=whatsapp
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=whatsapp_scheduler
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

## Project Structure

```
whatsapp-scheduler/
├── src/                      # Backend source (TypeScript)
│   ├── index.ts              # Main entry point
│   ├── server.ts             # Express + Remix server integration
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces and types
│   ├── services/
│   │   ├── whatsapp.ts       # WhatsApp connection & messaging
│   │   ├── scheduler.ts      # Job scheduling logic
│   │   └── database.ts       # PostgreSQL operations
│   ├── routes/
│   │   └── api.ts            # REST API route handlers
│   └── utils/
│       └── constants.ts      # Configuration constants
├── app/                      # Remix frontend source (TypeScript + React)
│   ├── root.tsx              # Root Remix layout
│   ├── entry.client.tsx      # Client-side hydration entry
│   ├── entry.server.tsx      # Server-side rendering entry
│   ├── styles/
│   │   └── global.css        # Global styles
│   └── routes/
│       ├── _index.tsx        # Main scheduler page (/)
│       └── contacts.tsx      # Contacts management page (/contacts)
├── public/                   # Static assets (images, favicon, etc.)
├── dist/                     # Compiled backend JavaScript (generated)
├── build/                    # Compiled Remix frontend (generated)
├── auth/                     # WhatsApp auth state (generated/mounted)
├── vite.config.ts            # Vite + Remix configuration
├── tsconfig.json             # TypeScript config (shared)
├── tsconfig.server.json      # TypeScript config (backend only)
├── Dockerfile                # Multi-stage Docker build
└── docker-compose.yml        # Docker orchestration
```

## Development

### Build System
- **Backend**: TypeScript → ES Modules (`src/` → `dist/`)
- **Frontend**: Remix + Vite → Server + Client bundles (`app/` → `build/`)
- **Dev Mode**:
  - Uses `tsx` to run backend with hot-reload
  - Vite middleware integrated into Express for frontend HMR
- **Prod Mode**: Pre-built bundles served by Express

### Architecture: Hybrid Remix + Express

The application uses a **hybrid architecture**:
1. **Remix handles all UI routes** (`/`, `/contacts`, etc.)
2. **Express handles all API routes** (`/api/*`, `/send`)
3. **Vite is integrated into Express** via middleware in development
4. **Authentication** (Basic Auth) is applied globally to both Remix and API routes

**Key Integration Points:**
- `src/server.ts` - Creates Express app with Remix request handler
- API routes take precedence over Remix routes
- Remix loaders/actions call Express API endpoints internally
- Both share the same authentication context

### Scripts
- `npm run dev` - Development mode with hot-reload (runs `tsx src/index.ts`)
- `npm run build` - Build both Remix (`build:remix`) and backend (`build:server`)
- `npm run build:remix` - Build Remix app only
- `npm run build:server` - Compile TypeScript backend only
- `npm start` - Run the production build
- `npm run clean` - Remove dist/ and build/ folders
- `npm run typecheck` - Type-check without building

## Authentication

The app uses HTTP Basic Auth:
- Credentials are stored in `.env` file
- Default: `ADMIN_USER` and `ADMIN_PASS`
- All web UI and API endpoints require authentication
- Configuration in `src/utils/constants.ts`
- Passed to Remix via `getLoadContext()` in server.ts

## Architecture

### Backend Services

#### 1. Entry Point (`src/index.ts`)
- Initializes database connection
- Initializes WhatsApp connection
- Creates and starts Express server (with Remix integration)
- Graceful shutdown handlers

#### 2. Server (`src/server.ts`)
- Express application setup
- Vite dev server integration (development mode)
- Basic Auth middleware
- API routes mounting
- Remix request handler
- Static file serving

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

### Frontend (Remix)

#### Routes

**Main Scheduler** (`app/routes/_index.tsx`):
- Loader: Fetches status and contacts from API
- Action: Handles schedule creation and job cancellation
- UI Features:
  - Contact dropdown selector
  - Message textarea
  - Mode selector (once/cron)
  - Dynamic fields based on mode
  - Scheduled jobs table
  - Real-time status badge

**Contacts Management** (`app/routes/contacts.tsx`):
- Loader: Fetches all contacts from API
- Action: Handles create/update/delete operations
- UI Features:
  - Add contact form
  - Contacts table
  - Edit modal with overlay
  - Delete confirmation
  - Success/error messages
  - Optimistic UI updates via useFetcher

#### Data Flow
1. User interacts with Remix UI
2. Form submission → Remix action
3. Action calls Express API endpoint (internal fetch)
4. API interacts with database/services
5. Response returned to action
6. Loader revalidates data
7. UI updates

### WhatsApp Message Format

All messages use Baileys JID format:
- Phone numbers are formatted as `${phoneNumber}@s.whatsapp.net`
- Example: `491701234567@s.whatsapp.net`

### Contacts System

Contacts are stored in PostgreSQL and accessed via:
- **Database**: `src/services/database.ts` - CRUD operations
- **API**: `src/routes/api.ts` - RESTful endpoints
- **UI**: `app/routes/contacts.tsx` - Remix route with forms

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
- `@remix-run/node`, `@remix-run/express`, `@remix-run/react` - Remix framework
- `react`, `react-dom` - React 19
- `isbot` - Bot detection for SSR

**Development:**
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution with hot-reload
- `vite` - Build tool and dev server
- `@remix-run/dev` - Remix Vite plugin
- `vite-tsconfig-paths` - Path resolution for Vite
- `@types/*` - Type definitions

## Adding New Features

### Adding a new Remix route:
1. Create route file in `app/routes/`
2. Export `loader` function for data fetching
3. Export `action` function for mutations
4. Export default React component
5. Add navigation link in other routes

### Adding a new API endpoint:
1. Add route handler in `src/routes/api.ts`
2. Add request/response types in `src/types/index.ts` if needed
3. Import and use services from `src/services/`

### Adding new scheduler functionality:
1. Add function in `src/services/scheduler.ts`
2. Export the function
3. Use in route handlers in `src/routes/api.ts`

## Docker Deployment

The project includes Docker support for production deployment.

### Docker Files
- **Dockerfile** - Multi-stage build using Node.js 20 Alpine
- **docker-compose.yml** - Orchestration with PostgreSQL
- **.dockerignore** - Excludes build artifacts and node_modules

### Build Process
1. **Stage 1 (Builder)**: Install all deps → Build Remix + Backend
2. **Stage 2 (Production)**: Install prod deps → Copy build artifacts

### Key Features
- **Persistent Auth**: `auth/` directory mounted as volume
- **Database**: PostgreSQL service with persistent volume
- **Environment Variables**: Configurable via docker-compose
- **Auto-restart**: Both containers restart unless manually stopped
- **Healthchecks**: Database healthcheck for reliable startup
- **Internal Networking**: App connects to DB without port exposure

### Volume Mounts
- `./auth:/app/auth` - WhatsApp authentication persistence
- `postgres_data:/var/lib/postgresql/data` - Database persistence

## Common Issues

**Node Version Error**: Ensure you're using Node.js 20 or higher. Check with `node -v`.

**QR Code Not Scanning**: The QR code appears in the terminal. Scan it with WhatsApp's "Linked Devices" feature.

**Connection Lost**: Application auto-reconnects unless explicitly logged out. If logged out, delete `auth/` folder and restart.

**Scheduled Jobs Lost**: Jobs are in-memory only. Server restart clears all schedules.

**TypeScript Errors**: Run `npm run typecheck` to check for type errors before deployment.

**Import Errors**: Remember to use `.js` extension in imports even though source files are `.ts` (ES modules requirement).

**Vite Compatibility**: The project uses Vite 6 for compatibility with Remix 2.17. Vite 7 is not yet supported.

**Database Connection**: When running locally (not Docker), ensure PostgreSQL is running and environment variables are set in `.env`.

## Module System

Uses ES modules with TypeScript:
- `type: "module"` in package.json
- All backend imports use `.js` extensions (required by Node.js ES modules)
- Frontend (Remix) uses standard TypeScript imports
- Backend compiled to ES2020 modules
- Module resolution: "bundler" for Remix, standard ES module resolution for backend
