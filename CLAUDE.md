# Construction Expense Management System

## Project Overview
Full-stack application for managing construction expenses among multiple participants. Each participant has a % ownership, and expenses are automatically split proportionally.

## Tech Stack

### Backend (`/app`)
- **Framework**: FastAPI
- **Database**: SQLite with SQLAlchemy ORM
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
- **User**: Participants with `participation_percentage` (must sum to 100%)
- **Provider**: Construction suppliers
- **Category**: Expense categories (materials, salaries, taxes, etc.)
- **Expense**: Records with dual currency (USD + ARS)
- **ParticipantPayment**: Individual payment tracking per expense per user
- **Project**: With `is_individual` flag for simplified single-user UX
- **Note**: Meeting minutes with `note_type` (regular/voting)
- **NoteParticipant**: Users present in meeting
- **NoteComment**: Comments on notes
- **VoteOption**: Voting options for voting notes
- **UserVote**: Individual votes (irreversible, admin can reset)

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

## Key Conventions
- Admin-only endpoints use `get_current_admin_user` dependency
- All monetary values stored as `Decimal(15,2)`
- Exchange rate fetched from bluelytics, cached for 60 min
- Files stored with UUID names in `uploads/invoices/` and `uploads/receipts/`
- Soft deletes via `is_active` flag (preserve history)
- Frontend uses `/api` proxy to backend (configured in vite.config.js)

## Expense Flow
1. Admin creates expense with amount + currency (USD or ARS)
2. System fetches current blue dollar rate
3. Converts amount to both USD and ARS
4. Creates `ParticipantPayment` for each active user (amount × their %)
5. Users mark their payments as paid + upload receipts

## API Authentication
- First admin: `POST /auth/register-first-admin` (only works if no users exist)
- Login: `POST /auth/login` returns JWT token
- Use `Authorization: Bearer <token>` header for protected endpoints
- Frontend stores token in localStorage

## Frontend Pages
- `/login` - User authentication
- `/dashboard` - Summary stats, expense evolution chart, personal status
- `/expenses` - List/create expenses (admin can create)
- `/expenses/:id` - Expense detail with payment status
- `/my-payments` - User's pending/paid payments, mark as paid, upload receipts
- `/notes` - Meeting notes list (regular and voting)
- `/notes/:id` - Note detail with comments and voting
- `/users` - Admin: manage participants and percentages
- `/providers` - Admin: manage providers
- `/categories` - Admin: manage categories
- `/register` - Self-registration for new admin users
- `/projects` - Admin: manage projects

## Individual Projects
Projects marked as `is_individual=True` have simplified UX:
- Payments are auto-approved when expense is created
- "Mis Pagos" and "Por Aprobar" navigation items are hidden
- Toggle available in Participantes page

## Notes System
- **Regular notes**: Meeting minutes with rich text content
- **Voting notes**: Include vote options with weighted voting
- Participants: Track who attended the meeting
- Comments: Discussion thread on each note
- Admin can reset votes if needed

### Weighted Voting
Votes are weighted by each participant's ownership percentage:
- Each vote carries the weight of the voter's `participation_percentage`
- Example: If user A (85%) votes for Option 1 and user B (15%) votes for Option 2, Option 1 wins with 85%
- Results show both vote count AND total participation percentage per option
- The option with the highest accumulated percentage is marked as "GANADOR"

## Deployment Setup
- **Frontend**: Vercel (auto-deploys on push to main)
- **Backend**: Render (may need manual redeploy or auto-deploys on push)
- **File Storage**: Cloudinary
- **Database**: SQLite on Render (or PostgreSQL if configured)

After pushing changes:
- Frontend changes → Vercel deploys automatically
- Backend changes → Check Render for deployment status, redeploy if needed

## Workflow Preferences
- **Always offer commit + push**: After completing any task, always offer to commit and push the changes so deployment can happen.
- **Language**: Communicate in Spanish with the user.
- **Keep CLAUDE.md updated**: Always update this file with relevant project information, architectural decisions, and setup changes.
- **Keep README.md updated**: When adding new relevant modules or features, update the project README to reflect the current state of the project.
