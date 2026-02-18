# Proyectos Compartidos — Shared Expense Management System

## Project Overview
Full-stack application for managing shared expenses among multiple participants across any type of project (construction, trips, events, etc.). Each participant has a % ownership, and expenses are automatically split proportionally.

## Tech Stack

### Backend (`/app`)
- **Framework**: FastAPI
- **Database**: PostgreSQL (production) / SQLite (development) with SQLAlchemy ORM
- **Auth**: JWT tokens (python-jose + passlib/bcrypt)
- **Exchange Rate**: Blue dollar from bluelytics.com.ar API
- **File Storage**: Cloudinary (production) / Local filesystem (development)

### Frontend (`/frontend`)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Icons**: Lucide React
- **Rich Text Editor**: React Quill (for notes)

## Project Structure
```
construccion-edificio/
├── app/                    # Backend (FastAPI)
│   ├── main.py            # Entry point
│   ├── config.py          # Settings (.env)
│   ├── database.py        # SQLAlchemy setup
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   └── utils/             # Auth dependencies
├── frontend/              # Frontend (React)
│   ├── src/
│   │   ├── api/           # API client (axios)
│   │   ├── context/       # AuthContext
│   │   ├── components/    # Reusable components
│   │   └── pages/         # Route pages
│   └── package.json
├── uploads/               # File storage
│   ├── invoices/
│   └── receipts/
└── data/                  # SQLite database
```

## Key Models
- **User**: System users (global `is_admin` flag is now legacy, unused)
- **Project**: With `is_individual` flag (defaults to True) and `currency_mode` (ARS/USD/DUAL, defaults to DUAL)
- **ProjectMember**: Links users to projects with `participation_percentage` and `is_admin` (per-project admin)
- **Provider**: Construction suppliers (per project)
- **Category**: Expense categories (per project)
- **Expense**: Records with dual currency (USD + ARS), `exchange_rate_source` tracks auto vs manual TC
- **ParticipantPayment**: Individual payment tracking per expense per user, with `exchange_rate_at_payment`, `amount_paid_usd`, `amount_paid_ars` for TC tracking
- **Note**: Meeting minutes with `note_type` (regular/voting)
- **NoteParticipant**: Users present in meeting
- **NoteComment**: Comments on notes
- **VoteOption**: Voting options for voting notes
- **UserVote**: Individual votes (irreversible, project admin can reset)
- **CurrencyMode** (enum): ARS (solo pesos), USD (solo dólares), DUAL (doble moneda con TC)

## Running the Project

### Backend
```bash
cd construccion-edificio
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
- API Docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
- App: http://localhost:3000

## Database Configuration

The application supports both SQLite and PostgreSQL through SQLAlchemy ORM.

### Configuration Priority (Pydantic Settings)
Configuration is loaded in this order (higher priority overwrites lower):
1. **Default values in `config.py`** - SQLite (fallback for local development)
2. **`.env` file** - PostgreSQL connection string (production)
3. **Environment variables** - Highest priority (if set in system)

### Development (Local)
**Default behavior** (no `.env` file):
- Uses SQLite: `sqlite:///./data/construction.db`
- Database file created automatically in `./data/` directory
- No setup required - perfect for:
  - New developers getting started
  - Quick local testing
  - Offline development
  - Portable demos

**With `.env` file**:
- Can configure PostgreSQL connection via `DATABASE_URL`
- Useful if you want to mirror production environment locally

### Production (Render)
- Uses PostgreSQL (Supabase)
- Configured via `.env` file with `DATABASE_URL=postgresql://...`
- The `database.py` automatically detects PostgreSQL and uses the `psycopg` driver

### Why Keep SQLite as Default?
1. **Zero-friction onboarding**: New developers can run the app immediately without configuring databases
2. **No external dependencies**: Don't need PostgreSQL installed locally
3. **Portable**: Can copy the SQLite file for backups or sharing
4. **Safe fallback**: If `.env` is missing or misconfigured, the app still works with SQLite

### Database Migrations
The app uses a custom migration system in `database.py` (`_run_migrations()`) that:
- Automatically adds new columns to existing tables
- Works with both SQLite and PostgreSQL
- Runs on startup via `init_db()`
- Safe to run multiple times (checks if columns exist first)

## Key Conventions
- **Project-based permissions**: Admin status is per-project (`ProjectMember.is_admin`), not global
- Project admin endpoints use `get_project_admin_user` dependency
- Helper function `is_project_admin(db, user_id, project_id)` for checking admin status
- All monetary values stored as `Decimal(15,2)`
- Exchange rate fetched from bluelytics, cached for 60 min (only in DUAL mode; skipped for single-currency projects)
- Files stored with UUID names in `uploads/invoices/` and `uploads/receipts/`
- Soft deletes via `is_active` flag (preserve history)
- Frontend uses `/api` proxy to backend (configured in vite.config.js)

## Currency Mode System
Projects can operate in three currency modes:

| Mode | Description | Exchange Rate | Expense currencies | Payment tracking |
|------|-------------|---------------|-------------------|-----------------|
| **ARS** | Solo pesos | Not used | Only ARS | `amount_paid_ars` only |
| **USD** | Solo dólares | Not used | Only USD | `amount_paid_usd` only |
| **DUAL** | Doble moneda | Auto (bluelytics) or manual override | USD or ARS | Both + `exchange_rate_at_payment` |

- Default is DUAL (backwards compatible with existing projects)
- Cannot change currency_mode after project has expenses
- Single-currency modes skip exchange rate fetch (faster, simpler)

## Expense Flow
1. Project admin creates expense with amount + currency (validated against project's `currency_mode`)
2. **DUAL mode**: System fetches current blue dollar rate (or uses admin's manual override via `exchange_rate_override`)
3. **DUAL mode**: Converts amount to both USD and ARS. **Single-currency mode**: stores amount in the project's currency, 0 in the other
4. Creates `ParticipantPayment` for each active project member (amount × their %)
5. Users mark their payments as paid + upload receipts, optionally specifying payment date
6. **DUAL mode**: At payment time, system records `exchange_rate_at_payment` and calculates `amount_paid_usd`/`amount_paid_ars` equivalents
7. For non-individual projects, payments require project admin approval
8. `exchange_rate_source` field tracks whether TC was "auto" (API) or "manual" (admin override) for both expenses and payments

## Date Tracking
The system distinguishes between **event dates** (when something actually happened) and **audit timestamps** (when it was recorded in the system):

### Expense Dates
- **`expense_date`**: The actual date when the expense occurred (user-editable, defaults to today)
- **`created_at`**: When the expense was created in the system (auto-generated)
- **`updated_at`**: When the expense was last modified (auto-generated)

### Payment Dates
- **`payment_date`**: The actual date when the user made the payment (user-editable, defaults to today)
- **`submitted_at`**: When the payment was submitted for approval in the system (auto-generated)
- **`paid_at`**: When the payment was marked as paid in the system (auto-generated)
- **`approved_at`**: When the payment was approved by admin (auto-generated)

This separation allows users to backfill historical expenses and payments with correct dates while maintaining full audit trails.

## API Authentication
- First admin: `POST /auth/register-first-admin` (only works if no users exist)
- Login: `POST /auth/login` returns JWT token
- Use `Authorization: Bearer <token>` header for protected endpoints
- Frontend stores token in localStorage

## Frontend Pages
- `/login` - User authentication
- `/dashboard` - Summary stats, expense evolution chart, personal status
- `/expenses` - List/create expenses (project admin can create)
- `/expenses/:id` - Expense detail with payment status
- `/my-payments` - User's pending/paid payments, mark as paid, upload receipts
- `/notes` - Meeting notes list (regular and voting)
- `/notes/:id` - Note detail with comments and voting
- `/projects` - Create/manage projects (any user can create, admin per project)
- `/project-members` - Project Admin: manage members and percentages
- `/providers` - Project Admin: manage providers
- `/categories` - Project Admin: manage categories
- `/pending-approvals` - Project Admin: approve/reject payments
- `/register` - Self-registration for new users

## Project Permissions (Per-Project Admin)
- **Any user can create a project** and becomes its admin automatically
- **Project admins** can: create expenses, manage providers/categories, add/remove members, approve payments
- **Regular members** can: view expenses, submit payments, view notes, vote on voting notes
- Users only see projects where they are members (no global admin access)
- Project admins can grant admin privileges to other members via the Participantes page

## Project Creation Flow
**New projects are individual (single-user) by default:**
- `is_individual=True` by default
- `currency_mode=DUAL` by default (user can choose ARS, USD, or DUAL at creation)
- Creator gets 100% participation automatically
- Payments are auto-approved (no admin review needed)
- "Por Aprobar" navigation item is hidden

**Converting to multi-participant:**
- Project admin can add members in Participantes page
- Must recalculate percentages to sum to 100%
- Can toggle `is_individual` flag off to require payment approvals
- Toggle available in Participantes page (only for project admins)

**Currency mode restrictions:**
- Cannot change `currency_mode` once the project has expenses
- ARS/USD modes: simpler UI, no exchange rate fields, single currency display
- DUAL mode: full dual-currency support with editable exchange rate

This approach simplifies onboarding - users start simple and grow complexity as needed.

## Notes System
- **Regular notes**: Meeting minutes with rich text content
- **Voting notes**: Include vote options with weighted voting
- Participants: Track who attended the meeting
- Comments: Discussion thread on each note
- Project admin can reset votes if needed

### Weighted Voting
Votes are weighted by each participant's ownership percentage:
- Each vote carries the weight of the voter's `participation_percentage`
- Example: If user A (85%) votes for Option 1 and user B (15%) votes for Option 2, Option 1 wins with 85%
- Results show both vote count AND total participation percentage per option
- The option with the highest accumulated percentage is marked as "GANADOR"

## Deployment Setup

### Current (Render)
- **Frontend**: Vercel (auto-deploys on push to main)
- **Backend**: Render (may need manual redeploy or auto-deploys on push)
- **File Storage**: Cloudinary
- **Database**: Supabase PostgreSQL

### Recommended (Fly.io migration available)
- **Frontend**: Vercel (no changes, keep as-is)
- **Backend**: Fly.io → `https://proyectos-compartidos.fly.dev` (auto-deploys on push to main via GitHub Actions)
- **File Storage**: Cloudinary (no changes, keep as-is)
- **Database**: Supabase PostgreSQL (no changes, keep as-is)

**Migration files ready:**
- `Dockerfile` - Python 3.12 image, ready to build
- `fly.toml` - Fly.io configuration (region: gru/São Paulo)
- `.github/workflows/fly-deploy.yml` - Automatic GitHub Actions deployment
- `FLY_SETUP.md` - Complete step-by-step migration guide

**To migrate to Fly.io:**
1. Create account at fly.io (free tier includes $5/month credit)
2. Follow `FLY_SETUP.md` for detailed steps
3. Cost: ~$0/month (512MB VM fits in free tier)

After pushing changes (either Render or Fly.io):
- Frontend changes → Vercel deploys automatically
- Backend changes → Auto-deploys via GitHub Actions (if Fly.io) or manual `flyctl deploy`

## Workflow Preferences
- **Always offer commit + push**: After completing any task, always offer to commit and push the changes so deployment can happen.
- **Language**: Communicate in Spanish with the user.
- **Keep CLAUDE.md updated**: Always update this file with relevant project information, architectural decisions, and setup changes.
- **Keep README.md updated**: When adding new relevant modules or features, update the project README to reflect the current state of the project.
- **Atomic commits**: When the user requests multiple unrelated tasks in a single prompt (e.g., "add notes module AND add individual projects"), ask if they want separate commits for each feature. This keeps git history clean and makes it easier to revert specific changes if needed.
