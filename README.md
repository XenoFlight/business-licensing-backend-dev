# Business Licensing & Inspection System

Backend-first system for managing business licensing, inspections, and reporting workflows for regional council operations.

## Project Overview

This repository provides:
- JWT authentication and role-based access (`inspector`, `manager`, `admin`)
- Business registry and status lifecycle management
- Licensing catalog and defects catalog APIs
- Inspection reports with PDF generation
- Optional AI-assisted analysis for report insights
- Optional iCal feed ingestion for calendar events

## Latest Updates (Feb 2026)

### Inspection Workflow
- New inspections hub page with quick navigation:
	- `public/inspections.html`
	- `public/upcoming-inspections.html`
	- `public/inspection-archive.html`
- `inspection.html` upgraded with:
	- Existing business autofill by business name / owner ID
	- Auto-loading saved licensing items and regulator data from business file
	- Local draft save/restore
	- Offline report queue and auto-sync when connection returns
	- Inline status feedback and faster defect entry UX

### Business File Management
- New dedicated create/edit pages:
	- `public/business-create.html`
	- `public/business-edit.html`
- Business model expanded with operational and sanitation fields (local staff, contacts, trash handling).
- Business file now supports multi-item licensing persistence:
	- `licensingItemIds` (JSONB)
	- `regulatorApprovals` (JSONB)
- Business delete action moved to business details page (admin only).

### Calendar & Re-Inspection Flow
- Calendar now supports merged synced + local events with local CRUD behavior.
- Added quick filters (`all`, `pending`, `alert`, `done`, `redo`) and event-details modal.
- Reports history edit modal can schedule a redo inspection directly into local calendar (with findings notes).

### Map & Test Data
- Map page now includes area filter + live marker count.
- New utility script to enrich `data/businesses.json` with deterministic Yoav-area coordinates:
	- `utils/enrich-businesses-json.js`
- Import script improved to normalize duplicate/placeholder license values before insert:
	- `utils/import-businesses.js`

### Admin & User Management
- Admin dashboard expanded with full users table and active-state management.
- New admin endpoints:
	- `GET /api/admin/users`
	- `DELETE /api/admin/users/:id`
	- `PATCH /api/admin/users/:id/active`

### Dashboard, Filtering & UX Consistency
- Dashboard KPI upgraded for licensing pipeline visibility:
	- Main card breakdown for `היתר זמני`, `חידוש`, `נדחה`
	- Main KPI value now represents combined total of those three categories
	- Breakdown chips deep-link directly to filtered business management views
- `businesses.html` now supports advanced deep-link filtering and URL sync:
	- `status` / `statuses`, `q`, `trash`, `trashCare`, `showClosed`
	- Filter state is shareable/bookmarkable and restored on page load
- URL-synced filters were added for operational consistency across:
	- `public/reports-history.html` (`status`, `from`, `to`, `q`)
	- `public/upcoming-inspections.html` (`source`, `range`, `q`)
	- `public/inspection-archive.html` (`status`, `q`)
- Filter toolbars now include a unified active-filter indicator (`סינון פעיל`) and live results counters.

### Dark Mode Polish
- Expanded dark-theme token coverage for newly introduced utility classes and semantic accents.
- Improved dark readability for:
	- Dashboard chart legends (theme-aware re-render on toggle)
	- Leaflet controls/popup/attribution styles
	- New translucent cards, chips, and filter panels across updated pages

## Tech Stack

- Node.js + Express.js
- PostgreSQL + Sequelize ORM
- JWT + bcryptjs
- Puppeteer (PDF generation)
- Google Generative AI SDK (optional AI features)
- Docker/Render deployment support

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- Optional: Gemini API key for AI features

## Installation

1. Clone repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the repository root.

## Environment Variables

### Required

```env
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your_strong_secret
```

### Optional

```env
PORT=8080
NODE_ENV=development
JWT_EXPIRES_IN=12h
GEMINI_API_KEY=your_google_gemini_api_key
DEFAULT_ICAL_URL=https://example.com/calendar.ics
```

Notes:
- If `PORT` is not set, the server defaults to `8080`.
- `DEFAULT_ICAL_URL` is used by calendar API when no URL is provided in request body.

## Database Initialization

Seed baseline system data when needed:

```bash
node utils/seedDefects.js
node utils/seedBaselineSystem.js
```

Or use package scripts:

```bash
npm run seed:system
npm run seed:defects
npm run seed:all
```

For test-map datasets (Yoav area markers):

```bash
node utils/enrich-businesses-json.js
node utils/import-businesses.js
```

Notes:
- `enrich-businesses-json.js` updates `data/businesses.json` with normalized area text, fallback addresses, and bounded coordinates.
- `import-businesses.js` recreates tables (`sync({ force: true })`) and imports deduplicated data.

### Seeding Commands

- `npm run seed:system` — Full baseline reset (`sync({ force: true })`), recreates schema, creates default admin, and seeds licensing items.
- `npm run seed:defects` — Seeds the defects catalog only (safe to run independently for defects data).
- `npm run seed:all` — Runs baseline reset first, then defects seeding.

## Running Locally

Development mode (nodemon):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Health check endpoint:

```text
GET /
```

## Online Testing with GitHub Codespaces

Use this when you want to test online without Render.

### 1) Push repository to GitHub

Make sure latest changes are pushed to your GitHub branch.

### 2) Open in Codespaces

In GitHub repository page:
- Click `Code`
- Open `Codespaces` tab
- Click `Create codespace on <branch>`

This repo includes a ready-to-use devcontainer in `.devcontainer/`.

### 3) Configure environment variables in Codespaces

Inside the Codespace terminal:

```bash
cp .env.example .env
```

Then edit `.env` and set at minimum:
- `DATABASE_URL`
- `JWT_SECRET`

Optional:
- `GEMINI_API_KEY`
- `DEFAULT_ICAL_URL`

### 4) Start app in Codespaces

```bash
npm run dev
```

When port `8080` is forwarded, open the generated public URL.

### 5) Verify app online

- Open `/login.html`
- Login with seeded/admin user
- Open dashboard and business pages
- Create/edit a report and verify PDF output

### Notes

- Do not commit your `.env` file.
- You can use GitHub Codespaces Secrets for sensitive values and write them into `.env` during setup.
- Chromium dependencies are preinstalled in the devcontainer for Puppeteer PDF generation.

## API Routes

All routes are mounted in `app.js`.

### Authentication (`/api/auth`)
- `POST /register`
- `POST /login`
- `GET /me` (protected)

### Licensing Items (`/api/licensing-items`)
- `GET /`
- `POST /` (admin, manager)
- `GET /:id`
- `PUT /:id` (admin, manager)
- `DELETE /:id` (admin)

### Businesses (`/api/businesses`)
- `GET /` (protected)
- `POST /` (inspector, manager, admin)
- `GET /:id` (protected)
- `PUT /:id` (inspector, manager, admin)
- `DELETE /:id` (admin)
- `GET /:id/reports` (protected)
- `PATCH /:id/status` (inspector, manager, admin)
- `PATCH /:id/location` (inspector, manager, admin)

Business payload supports extended optional fields including:
- Local contacts/staff (`localStaffCount`, `localManagerName`, `localContactName`, etc.)
- Sanitation/trash management (`hasTrashCans`, `trashCanType`, `trashCareOwner`, etc.)
- Multi licensing and regulator state (`licensingItemIds`, `regulatorApprovals`)

### Defects (`/api/defects`)
- `GET /` (protected)
- `GET /:id` (protected)

### Reports (`/api/reports`)
- `POST /` (inspector, manager, admin)
- `GET /` (inspector, manager, admin)
- `GET /business/:businessId` (protected)
- `GET /:id` (protected)
- `PUT /:id` (inspector, manager, admin)

### Calendar (`/api/calendar`)
- `POST /ical` (protected)

### Admin (`/api/admin`)
- `GET /pending-users` (admin)
- `PUT /approve/:id` (admin)
- `DELETE /deny/:id` (admin)
- `GET /users` (admin)
- `DELETE /users/:id` (admin)
- `PATCH /users/:id/active` (admin)

## Runtime Behavior Notes

- On startup, the server validates critical config (for example `JWT_SECRET`).
- Database connection is initialized before HTTP listen.
- Startup includes business status enum normalization/migration logic before `sequelize.sync({ alter: true })`.
- Graceful shutdown handlers close HTTP server and DB connection on `SIGTERM`/`SIGINT`.

## Project Structure

```text
config/        Database and infrastructure configuration
controllers/   Request handlers and business logic
middlewares/   Auth/authorization and request middleware
models/        Sequelize models and associations
routes/        API route definitions
services/      External/service integrations (PDF, etc.)
scripts/       Data/build utility scripts
utils/         Seeding/import/backfill utilities
public/        Frontend static pages and browser JS modules
```

## Deployment (Render)

This repo includes:
- `Dockerfile`
- `render.yaml`

For Render, set at minimum:
- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`

Optional:
- `JWT_EXPIRES_IN`
- `GEMINI_API_KEY`
- `DEFAULT_ICAL_URL`

### Render Troubleshooting

- **Startup fails with `FATAL ERROR: JWT_SECRET is not defined`**  
	Add `JWT_SECRET` in Render service environment variables.

- **Startup fails with `DATABASE_URL environment variable is not set in production`**  
	Set `DATABASE_URL` to a valid PostgreSQL connection string in Render.

- **Service deploys but health check fails**  
	Ensure health check path is `/` and confirm app logs include `Server running on port`.

- **DB connection/auth errors during boot**  
	Recheck DB credentials, SSL requirements in the connection string, and network access from Render to your DB provider.

- **PDF generation errors in logs**  
	Confirm Docker build completed with Chromium installation and that runtime uses the provided container image (not native Node environment).

- **Unexpected schema changes or boot delays**  
	Current startup runs `sequelize.sync({ alter: true })`; this can be slower on large databases. Review logs until `Database tables synced successfully` appears.

### Post-Deploy Verification Checklist

1. Open the service root URL (`GET /`) and confirm HTTP `200` response.
2. Check Render logs for startup milestones:
	- `Database connection established successfully.`
	- `Database tables synced successfully.`
	- `Server running on port ...`
3. Verify authentication works (`POST /api/auth/login` with a valid user).
4. Verify business listing works (`GET /api/businesses` with a valid token).
5. Create a test report and confirm PDF path is populated (if report generation is enabled).

## License

ISC

---
Developed for the Regional Council Dev Team.
