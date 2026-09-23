# Nexus CRM

A generic, multi-tenant business CRM: customers & leads, inventory & stock,
orders/sales, staff tasks, and a live dashboard — built so any business
(retail, catering, services, wholesale…) can start using it immediately and
tweak it later without touching the core architecture.

**Backend:** Django 5 + Django REST Framework, JWT auth, PostgreSQL (Supabase).
**Frontend:** React 19 + Vite + Tailwind CSS v4, Recharts, React Router.

---

## How multi-tenancy works

Every business that signs up gets a `Business` row. Every piece of data
(customers, products, orders, tasks…) has a `business` foreign key, and a
shared `BusinessScopedViewSet` base class (`backend/core/viewsets.py`)
automatically:

- filters every list/detail/update/delete to the logged-in user's own business
- stamps new records with that business on creation

So the same codebase and database safely serve any number of separate
businesses — nobody can see or modify another business's data. Roles
(`owner`, `admin`, `manager`, `staff`) control who can create/edit/delete
within a business.

This is what makes it "generic": there's no business-specific logic baked
into the models. To tailor it for a specific industry later, you'd extend
models (e.g. add a `weight` field to Product for a wholesale business, or a
`table_number` field to Order for a restaurant) rather than rebuild anything.

---

## Project layout

```
crm-platform/
├── backend/            # Django REST API
│   ├── crm_project/    # settings, root urls
│   ├── tenants/        # Business model (the tenant)
│   ├── accounts/       # custom User, roles, JWT auth, signup, team mgmt
│   ├── core/            # shared BusinessScopedViewSet base class
│   ├── customers/      # Customer, CustomerNote (CRM)
│   ├── inventory/      # Category, Product, StockMovement
│   ├── sales/          # Order, OrderItem
│   ├── tasks/          # Task
│   ├── dashboard/      # aggregated analytics endpoint
│   └── requirements.txt
└── frontend/           # React (Vite) SPA
    └── src/
        ├── api/         # axios client + endpoint wrappers
        ├── context/     # auth context
        ├── components/  # layout, UI primitives, StockPulse widget
        ├── pages/       # Dashboard, Customers, Inventory, Orders, Tasks, Settings
        └── utils/
```

---

## 1. Local development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # edit if needed — defaults to SQLite, which is fine locally
python manage.py migrate
python manage.py seed_demo   # optional: creates demo business + sample data
python manage.py runserver
```

API runs at `http://127.0.0.1:8000/api/`. Seeded login: `demo` / `demo12345`.

Admin panel (Django's built-in) is at `http://127.0.0.1:8000/admin/` — create
a superuser with `python manage.py createsuperuser` if you want to use it.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # VITE_API_URL defaults to the local API above
npm run dev
```

App runs at `http://127.0.0.1:5173`.

---

## 2. Push to GitHub

```bash
cd crm-platform
git add .
git commit -m "Initial commit: Nexus CRM"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## 3. Production database — Supabase (Postgres)

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → Database → Connection string → URI**. Use the
   **Session pooler** URI if your host only supports IPv4 egress (Render and
   most PaaS do) — the direct connection is IPv6-only.
3. You'll paste that URI as `DATABASE_URL` in the backend host's environment
   variables (step 4). Supabase's Postgres is *just the database* here — the
   Django app itself needs to live somewhere that runs a persistent Python
   process (see below).

## 4. Deploying the backend (Django API)

**Important:** Vercel does not run Django well — it's built for static
sites and short-lived serverless functions, not a WSGI app with migrations
and a persistent process. Use a proper Python host for the API:

**Option A — Render (recommended, has a free tier, and `render.yaml` is
already set up for you):**

1. Push this repo to GitHub (step 2).
2. In Render, **New → Blueprint**, point it at your repo — it will read
   `backend/render.yaml` automatically.
3. Set the environment variables it asks for: `DATABASE_URL` (from Supabase),
   `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` (your Vercel URL, added
   after step 5, e.g. `https://your-app.vercel.app`).
4. Deploy. Your API will be live at `https://nexus-crm-api.onrender.com`.

**Option B — Railway:** import the repo, set the root directory to
`backend`, add the same environment variables from `.env.example`, set the
start command to `gunicorn crm_project.wsgi:application`, and add a
pre-deploy/build command of `python manage.py migrate`.

Either way, once it's live, seed it if you want demo data:
`python manage.py seed_demo` via the host's shell/console.

## 5. Deploying the frontend — Vercel

1. In Vercel, **Add New → Project**, import your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable `VITE_API_URL` = your backend's API URL, e.g.
   `https://nexus-crm-api.onrender.com/api`.
4. Deploy. `vercel.json` is already set up with SPA rewrites so client-side
   routing (React Router) works correctly on refresh/deep links.
5. Go back to your Render/Railway env vars and set `CORS_ALLOWED_ORIGINS`
   and `CSRF_TRUSTED_ORIGINS` to your new Vercel domain, then redeploy the
   backend so it accepts requests from it.

---

## Extending it for a specific business

A few examples of the kind of "tweak later" this is designed for:

- **Catering:** add `event_date` / `guest_count` to `Order`, or a `Recipe`
  model linking `Product` ingredients to a menu item.
- **Services business:** add a `service_duration` field to `Product`, or a
  `Booking` model instead of/alongside `Order`.
- **Retail with barcodes:** add a `barcode` field to `Product` and hook up a
  barcode-scanning input in the Inventory page.

Because tenancy, auth, and permissions all live in the shared `core` and
`accounts` apps, none of these changes require touching how businesses are
isolated from each other.
