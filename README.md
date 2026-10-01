# AutoWorld Marketplace

Production-style full-stack vehicle marketplace scaffold with:
- Public listings, filters, details page
- Secure admin auth (access + refresh token flow)
- Role-based dashboard (`manager`, `editor`, `viewer`)
- Inventory CRUD, sold/available toggling, image uploads
- Bulk CSV import, audit logs, team user management

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT access tokens + rotating refresh tokens
- Uploads: Cloudinary (optional, recommended)

## Roles and Permissions
- `manager`: full access (inventory delete, user management, audit view)
- `editor`: inventory create/update/sold, uploads, bulk import, audit view
- `viewer`: read-only inventory and stats

## Project Structure
```text
AutoWorld/
|-- backend/
|   |-- scripts/
|   |   `-- seedAdmin.js
|   `-- src/
|       |-- constants/
|       |-- middleware/
|       |-- repositories/
|       |-- routes/
|       `-- utils/
`-- frontend/
    `-- src/
        |-- components/
        |-- pages/
        `-- services/
```

## Setup

1) Configure environment

Backend:
```bash
cd backend
copy .env.example .env
```

Frontend:
```bash
cd frontend
copy .env.example .env
```

Frontend `.env` key:
- `VITE_ADMIN_BASE_PATH` (private admin route prefix, example: `/control-room-2026-portal`)

Backend `.env` keys to set:
- `DATABASE_URL` (local dev example: `postgresql://postgres:postgres@localhost:5432/autoworld`)
- `PGSSL=false` for local PostgreSQL
- `JWT_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (example: `15m`)
- `REFRESH_TOKEN_TTL_DAYS` (example: `30`)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_ROLE` (`manager`, `editor`, `viewer`)
- Cloudinary keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) if image uploads are enabled

## Local PostgreSQL Setup

For local development, use the PostgreSQL server installed on your computer.

Create the `autoworld` database once, then run migrations and seed the admin user:
```bash
npm run db:create
npm run db:migrate
npm run seed:admin
```

Hosted deployment can be configured later by replacing `DATABASE_URL` with a hosted PostgreSQL connection string and setting `PGSSL` as required by that provider.

## Vercel URLs

Recommended Vercel project names:
- Frontend: `autoworld-marketplace` -> `https://autoworld-marketplace.vercel.app`
- Backend API: `autoworld-api` -> `https://autoworld-api.vercel.app/api`

Admin uses the same frontend Vercel domain:
- Login: `https://autoworld-marketplace.vercel.app/control-room-2026-portal/login`
- Dashboard: `https://autoworld-marketplace.vercel.app/control-room-2026-portal/dashboard`

For production, set frontend `VITE_API_BASE_URL=https://autoworld-api.vercel.app/api` and include `https://autoworld-marketplace.vercel.app` in backend `CORS_ORIGIN`.

2) Install dependencies

Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

3) Create database tables and seed initial admin
```bash
cd backend
npm run db:migrate
npm run seed:admin
```

4) Run the app

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

Admin UI is intentionally hidden from public navigation.  
Use your private route:
- Login: `<VITE_ADMIN_BASE_PATH>/login`
- Dashboard: `<VITE_ADMIN_BASE_PATH>/dashboard`

## API Snapshot

Public:
- `GET /api/cars`
- `GET /api/cars/:id`

Auth:
- `POST /api/admin/login`
- `POST /api/admin/refresh`
- `POST /api/admin/logout`
- `GET /api/admin/me`

Admin operations:
- `GET /api/admin/stats`
- `POST /api/admin/upload-image` (form-data key: `image`)
- `POST /api/admin/bulk-import` (form-data key: `file`)
- `GET /api/admin/audit-logs`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`

Inventory management:
- `GET /api/cars/admin/all`
- `POST /api/cars`
- `PUT /api/cars/:id`
- `PATCH /api/cars/:id/sold`
- `PATCH /api/cars/:id/unsold`
- `DELETE /api/cars/:id`

## CSV Import Format
Required headers:
- `title`
- `brand`
- `price`
- `mileage`

Optional headers:
- `model`, `year`, `fueltype`, `transmission`, `location`, `description`
- `imageurls` (multiple URLs separated by `|` or `;`)
- `issold` (values like `true`, `yes`, `sold`)
- `isauction`, `isspecialoffer` (values like `true`, `yes`)

## Current Dashboard Capabilities
- Inventory search/filter/sort/pagination (server-side)
- Role-aware action buttons
- Create/edit/delete listings
- Mark sold / available
- Upload image to Cloudinary and attach to listing
- Bulk CSV import with success/failure summary
- Recent audit log panel
- Admin team management panel (manager only)
