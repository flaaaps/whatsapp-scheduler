# WhatsApp Scheduler

A WhatsApp message scheduler built with TypeScript, Baileys v7, Express, PostgreSQL, and node-cron. Schedule messages to be sent immediately, at a specific time, or on a recurring schedule using CRON expressions.

## Features

- 📱 WhatsApp Web API integration (Baileys v7)
- ⏰ Schedule one-time messages
- 🔄 Schedule recurring messages with CRON
- 📇 Contact management with PostgreSQL database
- 🌐 Web UI for easy management
- 🔐 HTTP Basic Authentication
- 🐳 Docker support with PostgreSQL
- 📦 TypeScript with full type safety

## Quick Start

### Using Docker (Recommended)

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` with your credentials
4. Start the container:
   ```bash
   docker-compose up -d
   ```
5. View logs to get QR code:
   ```bash
   docker-compose logs -f
   ```
6. Access the web UI at `http://localhost:3000`
7. Scan the QR code with your phone to link your whatsapp account.
8. Enjoy!

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── index.ts              # Main entry point
├── app.ts                # Express app configuration
├── types/
│   └── index.ts          # TypeScript interfaces
├── services/
│   ├── whatsapp.ts       # WhatsApp connection & messaging
│   ├── scheduler.ts      # Job scheduling logic
│   └── database.ts       # PostgreSQL database operations
├── routes/
│   └── api.ts            # API route handlers
├── utils/
│   └── constants.ts      # Configuration constants
├── public/
│   ├── index.html        # Main scheduler UI
│   └── contacts.html     # Contact management UI
└── database/
    └── init.sql          # Database schema
```

## API Endpoints

### Messaging

- `POST /send` - Send immediate message
- `POST /api/schedule` - Schedule new message (cron or timestamp)
- `DELETE /api/schedule/:id` - Cancel scheduled job
- `GET /api/status` - Connection status + scheduled jobs

### Contacts Management

- `GET /api/contacts` - Get all contacts
- `GET /api/contacts/:id` - Get single contact
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

## Scripts

```bash
npm run dev      # Development with hot-reload
npm run build    # Compile TypeScript
npm start        # Run production build
npm run clean    # Remove dist folder
```

## Environment Variables

| Variable      | Default              | Description                        |
| ------------- | -------------------- | ---------------------------------- |
| `ADMIN_USER`  | `admin`              | Username for web UI authentication |
| `ADMIN_PASS`  | `password`           | Password for web UI authentication |
| `PORT`        | `3000`               | Server port                        |
| `DB_HOST`     | `localhost`          | PostgreSQL host                    |
| `DB_PORT`     | `5432`               | PostgreSQL port                    |
| `DB_USER`     | `whatsapp`           | Database username                  |
| `DB_PASSWORD` | `whatsapp123`        | Database password                  |
| `DB_NAME`     | `whatsapp_scheduler` | Database name                      |

## Docker Commands

```bash
# Start
docker-compose up -d

# View logs (includes QR code)
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build

# Restart
docker-compose restart
```

## Authentication

The WhatsApp connection is authenticated via QR code on first run. The authentication state is persisted in the `auth/` directory.

To re-authenticate:

1. Stop the application
2. Delete the `auth/` directory
3. Restart and scan the new QR code

## Scheduling Messages

### One-time Message

Send a message at a specific date/time using the web UI datetime picker.

### Recurring Message (CRON)

Use CRON expressions for recurring schedules:

- `0 9 * * *` - Every day at 9:00 AM
- `0 */2 * * *` - Every 2 hours
- `0 9 * * 1` - Every Monday at 9:00 AM

## Contact Management

The application includes a full contact management system powered by PostgreSQL.

### Features

- ➕ Add new contacts with name and phone number
- ✏️ Edit existing contacts
- 🗑️ Delete contacts
- 📋 View all contacts in a sortable table
- 🔍 Phone number validation
- 💾 Persistent storage in PostgreSQL

### Access

Navigate to the contact management page via the "Manage Contacts" button on the main scheduler page, or directly at `/contacts.html`.

### Database

Contacts are stored in a PostgreSQL database with the following schema:

- `id` - Auto-incrementing primary key
- `name` - Contact name
- `phone` - Phone number (unique, digits only)
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

## Tech Stack

- **TypeScript** - Type-safe JavaScript
- **@whiskeysockets/baileys** - WhatsApp Web API
- **Express** - Web framework
- **PostgreSQL** - Contact database
- **node-cron** - CRON job scheduler
- **Docker** - Containerization

## License

ISC

## Contributing

See `CLAUDE.md` for detailed development guidelines.
