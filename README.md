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
- `PUT /:id` (manager, admin)
- `DELETE /:id` (admin)
- `GET /:id/reports` (protected)
- `PATCH /:id/status` (inspector, manager, admin)
- `PATCH /:id/location` (inspector, manager, admin)

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

## License

ISC

---
Developed for the Regional Council Dev Team.
