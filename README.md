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
- Database: MongoDB (Mongoose)
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
|       |-- models/
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
- `MONGODB_URI`
- `JWT_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN` (example: `15m`)
- `REFRESH_TOKEN_TTL_DAYS` (example: `30`)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_ROLE` (`manager`, `editor`, `viewer`)
- Cloudinary keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) if image uploads are enabled

## Free Hosting Setup

Recommended free-friendly backend stack:
- Backend API: Render Free web service
- Database: MongoDB Atlas Free cluster (M0)
- Image uploads: Cloudinary free plan, optional

This repo includes `render.yaml` so Render can create the backend service from the repository root. Use these settings when Render prompts for secret environment variables:

- `MONGODB_URI`: your Atlas connection string, including the database name, for example `/autoworld`
- `CORS_ORIGIN`: your frontend URL, plus local dev if needed, comma-separated
- `ADMIN_USERNAME`: first admin username
- `ADMIN_PASSWORD`: first admin password
- Cloudinary keys: optional unless you need admin image upload

After the backend deploys, run the admin seed once from Render Shell or a one-off job:
```bash
npm run seed:admin
```

Then set the frontend `VITE_API_BASE_URL` to your Render API URL:
```bash
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
```

MongoDB Atlas access list note: free web hosts often do not provide a stable outbound IP. For a no-cost deployment, Atlas may need an access-list entry that allows your hosted backend to connect. Keep the Atlas database username/password strong and store them only as environment variables.

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

3) Seed initial admin
```bash
cd backend
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
