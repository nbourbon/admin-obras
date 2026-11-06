# Construccion - Expense Management System

A full-stack application for managing construction expenses among multiple participants. Each participant has a percentage of ownership, and all expenses are automatically split proportionally.

## Features

- **Multi-project support**: Manage multiple construction projects, each with its own participants, providers, and categories
- **Individual projects**: Simplified UX for single-user projects with auto-approved payments
- **Project-based participant management**: Each project has independent participation percentages
- **Automatic expense splitting**: When an expense is created, it's automatically split based on each project member's percentage
- **Flexible currency modes**: Each project can operate in ARS-only, USD-only, or Dual Currency (USD + ARS) mode
- **Blue dollar exchange rate**: Automatic fetching of the blue dollar rate from bluelytics.com.ar
- **Editable exchange rate**: Override the auto-fetched rate when creating expenses or payments (for historical data entry)
- **Payment exchange rate tracking**: In Dual mode, tracks the actual exchange rate at payment time vs the estimated rate at expense creation
- **Payment approval workflow**: Participants submit payments for admin approval
- **File uploads**: Attach invoices to expenses and receipts to payments with preview support
- **Dashboard**: Visual summary of total expenses, pending payments, and expense evolution per project
- **Category colors**: Assign colors to categories for visual identification
- **Project-based access**: Each project has its own admins; creating an account never grants global administration
- **Strict project isolation**: Expenses, contributions, payments, notes, files, comments, and votes require the selected project and cannot be accessed through an ID from another project
- **Secure account access**: Email verification, project invitations, and single-use password reset links sent with Resend
- **Meeting notes**: Record meeting minutes with a rich text editor; stored and legacy HTML is sanitized before display
- **Accounting guards**: Monetary operations reject non-positive amounts, contribution payments must cover the full remaining amount, and PostgreSQL row locks serialize balance changes
- **Weighted voting**: Create voting notes where each vote is weighted by the participant's ownership percentage
- **Auditable accounting corrections**: Deleting an expense or contribution records a reversal and keeps the original records; restoring an expense replays its linked payments and contributions atomically

## Tech Stack

### Backend
- Python 3.10+
- FastAPI
- SQLAlchemy ORM (supports SQLite for local dev, PostgreSQL for production)
- JWT Authentication

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts
- React Quill (rich text editor)

## Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd construccion-edificio
```

### 2. Set up the Backend

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Copy environment file for custom configuration
# If you skip this step, the app will use SQLite by default (recommended for local dev)
cp .env.example .env  # Edit if you want to use PostgreSQL locally

# Start the backend server
uvicorn app.main:app --reload
```

**Database Setup:**
- **By default**: Uses SQLite (`./data/construction.db`) - no configuration needed
- **For PostgreSQL**: Set `DATABASE_URL` in `.env` file
- The database and tables are created automatically on first run

The API will be available at http://localhost:8000

- API Documentation: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

### 3. Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at http://localhost:3000

## Getting Started

### 1. Create an account

Open `/register`, enter your name and email, and follow the verification link. The password is chosen only after proving access to the mailbox. Any authenticated user can create a project and becomes admin of that project only.

### 2. Log in to the frontend

Open http://localhost:3000 and log in with the admin credentials.

### 3. Set up the basics

1. **Create a Project**: Go to Projects and create your first construction project. Choose the currency mode:
   - **Solo Pesos (ARS)**: For projects that only use Argentine pesos
   - **Solo Dólares (USD)**: For projects that only use US dollars
   - **Doble Moneda (DUAL)**: For projects that track both currencies with exchange rate conversion (default)
2. **Add Participants**: Go to Participants and add users to the project with their ownership percentages (must sum to 100%)
3. **Add Categories**: Go to Categories and add expense categories (e.g., Materials, Salaries, Taxes)
4. **Add Providers**: Go to Providers and add your construction suppliers

### 4. Start tracking expenses

1. Go to Expenses and click "Nuevo Gasto"
2. Enter the expense details (amount, currency, provider, category)
   - In **ARS/USD mode**: Currency is fixed to the project's currency, no exchange rate needed
   - In **DUAL mode**: Choose currency (USD or ARS). The exchange rate is auto-fetched but can be manually overridden (useful for historical expenses)
3. The system will automatically split the expense among all participants

### 5. Track payments

Each participant can:
- View their pending payments in "Mis Pagos"
- Mark payments as paid (in DUAL mode, the exchange rate at payment time is recorded)
- Upload payment receipts
- In DUAL mode: view the difference between estimated and actual amounts paid (due to exchange rate fluctuations)

### 6. Meeting notes and voting

Record meeting minutes and make decisions:
- **Regular notes**: Use the rich text editor to document meetings
- **Voting notes**: Create polls where votes are weighted by ownership percentage
  - Example: A 85% owner's vote outweighs a 15% owner's vote
  - Results show both vote count and total participation percentage
  - The percentage is captured when the vote is cast, so later membership changes do not rewrite historical results
  - Votes are irreversible (only admin can reset)

## Project Structure

```
construccion-edificio/
├── app/                    # Backend (FastAPI)
│   ├── main.py            # Application entry point
│   ├── config.py          # Configuration management
│   ├── database.py        # Database connection
│   ├── models/            # SQLAlchemy models
│   │   ├── project.py     # Project model
│   │   ├── project_member.py # Project membership
│   │   ├── user.py        # User model
│   │   ├── expense.py     # Expense model
│   │   ├── note.py        # Notes and participants
│   │   ├── note_comment.py # Note comments
│   │   ├── vote.py        # Vote options and user votes
│   │   └── ...
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # API endpoints
│   │   ├── projects.py    # Project management
│   │   └── ...
│   ├── services/          # Business logic
│   │   └── expense_splitter.py # Expense splitting logic
│   └── utils/             # Utilities and dependencies
├── frontend/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── context/      # React contexts
│   │   │   ├── AuthContext.jsx
│   │   │   └── ProjectContext.jsx
│   │   ├── components/   # Reusable components
│   │   └── pages/        # Page components
│   │       ├── Projects.jsx
│   │       ├── ProjectMembers.jsx
│   │       ├── Notes.jsx
│   │       ├── NoteDetail.jsx
│   │       └── ...
│   ├── package.json
│   └── vite.config.js
├── uploads/               # Uploaded files
│   ├── invoices/
│   └── receipts/
├── data/                  # SQLite database
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
└── README.md
```

## API Endpoints

Most endpoints require an `X-Project-ID` header to scope data to the current project.
Expense and contribution lists are fetched page by page by the frontend, so projects with more than 100 records remain complete.

### Authentication
- `POST /auth/self-register` - Start registration and send email verification
- `POST /auth/resend-verification` - Send a new account verification link
- `POST /auth/forgot-password` - Send a password recovery link
- `POST /auth/action-info` - Validate a verification, invitation, or recovery link
- `POST /auth/complete-action` - Complete a single-use account action
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Accounts and members
- Global `/users` administration endpoints are retired. Users manage their own credentials through verified email links.
- Project administrators manage only the members of their own projects through the project member endpoints below.

### Expenses
- `GET /expenses` - List all expenses
- `POST /expenses` - Create expense (admin only)
- `GET /expenses/{id}` - Get expense details
- `POST /expenses/{id}/invoice` - Upload invoice

### Payments
- `GET /payments/my` - Get current user's payments
- `PUT /payments/{id}/mark-paid` - Mark payment as paid
- `POST /payments/{id}/receipt` - Upload receipt

### Dashboard
- `GET /dashboard/summary` - Get overall statistics
- `GET /dashboard/evolution` - Get monthly expense evolution
- `GET /dashboard/my-status` - Get current user's payment status

### Projects
- `GET /projects` - List user's projects
- `POST /projects` - Create project (the creator becomes its project administrator)
- `GET /projects/{id}` - Get project with members
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Deactivate project
- `GET /projects/{id}/members` - List project members
- `POST /projects/{id}/members/by-email` - Invite a member by email
- `POST /projects/{id}/members/{user_id}/resend-invitation` - Resend a pending invitation
- `PUT /projects/{id}/members/{user_id}` - Update member percentage
- `DELETE /projects/{id}/members/{user_id}` - Remove member from project
- `GET /projects/{id}/participation-validation` - Validate percentages sum to 100%

### Exchange Rate
- `GET /exchange-rate/current` - Get current blue dollar rate

### Notes
- `GET /notes` - List project notes
- `POST /notes` - Create a notification, meeting note, or vote and email all active project members
- `GET /notes/{id}` - Get note with comments and votes
- `PUT /notes/{id}` - Update note
- `DELETE /notes/{id}` - Delete note
- `POST /notes/{id}/comments` - Add comment
- `DELETE /notes/{id}/comments/{comment_id}` - Delete comment
- `POST /notes/{id}/vote` - Cast vote (irreversible)
- `DELETE /notes/{id}/vote/{user_id}` - Reset user's vote (admin only)

## Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL` - Database connection string
  - **Default**: `sqlite:///./data/construction.db` (local development)
  - **Production**: `postgresql://user:pass@host:5432/dbname`
- `SECRET_KEY` - JWT signing key (change in production!)
- `RESEND_API_KEY` - Resend API key used by the backend for account emails
- `EMAIL_FROM` - Verified sender, e.g. `Proyectos Compartidos <no-reply@notificaciones.obrador.xyz>`
- `FRONTEND_URL` - HTTPS frontend origin used to build account links
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time (default: 1440 = 24 hours)
- `MAX_FILE_SIZE_MB` - Maximum upload file size (default: 10)
- `EXCHANGE_RATE_CACHE_MINUTES` - Exchange rate cache duration (default: 60)
- `CLOUDINARY_*` - Cloud file storage credentials (production only)

## License

MIT

## Changes to project participation

Administrators use **Participantes → Cambiar composición** to submit the entire
new allocation (exactly 100%) in one transaction. The preview calculates a
mandatory rebalance of accumulated investment, including unpaid expenses. It
preserves original expense/payment allocations and records separate, zero-sum
balance movements. New members can be entered by name and email; invitations are
issued after confirmation. A member leaving the economic composition remains at
0% with their account and access intact.

External payments between members may be recorded in full or in part at the
cutover, with payer, recipient, amount, date and reference. They cancel the
corresponding rebalance credit/debt without increasing or reducing project cash.
Historical receipts remain visible on the participants page. Repeated confirmation
is idempotent; an outdated preview must be recalculated.

ARS projects use historical ARS amounts; USD and DUAL projects use historical USD
amounts. DUAL adjustments are converted to the existing ARS account at an explicit
cutover exchange rate. This does not introduce a separate USD-denominated debt
account: subsequent USD dashboard equivalents can fluctuate. Expenses and earlier
rebalance adjustments, rather than total deposits or cash on hand, determine the
investment basis. Original pending expense obligations remain payable separately.

Cutovers must be at or before the present, after the previous cutover and after
all recorded non-deleted investment expenses. The cutover closes the earlier
period to new expenses, date changes, deletions and restorations that would alter
the investment basis; payments of original obligations remain possible. Reconcile
existing differences between expenses and participant allocations before changing
composition. Future scheduling and reopening closed periods are not implemented.
This feature does not introduce a separate supplier-invoice/payment lifecycle.

API (project administrator, matching `X-Project-ID`):
- `POST /projects/{id}/compositions/preview`
- `POST /projects/{id}/compositions`
- `GET /projects/{id}/compositions`

`composition_changes` is created by the existing startup schema initialization;
PostgreSQL startup enables RLS on this backend-only table. No production data is
rewritten or automatically rebalanced during migration.


### Archivos adjuntos en notas

Las notas de reunión, notificación y votación admiten PDF, JPG y PNG: hasta
10 archivos, 10 MB por archivo (configurable en el backend) y 50 MB en total.
La creación con archivos valida y guarda todo antes de publicar y programar
los correos. El autor y los administradores pueden agregar o quitar adjuntos;
los miembros con acceso al proyecto pueden abrirlos y descargarlos.

- `POST /notes` conserva la creación JSON existente sin archivos.
- `POST /notes/with-attachments`: multipart con `data` (JSON de NoteCreate),
  `files` (repetido) e `include_attachments` (booleano, por defecto true).
- `GET /notes/{id}` incluye `attachments`: id, filename, content_type y size.
- `POST /notes/{id}/attachments`: multipart con `files`; no envía emails.
- `GET /notes/{id}/attachments/{attachment_id}`: descarga autenticada.
- `DELETE /notes/{id}/attachments/{attachment_id}`: baja lógica del adjunto.
- `POST /notes/{id}/notify`: JSON `{"include_attachments": true}`; programa
  una notificación de actualización a los mismos destinatarios que la creación.

Todos estos endpoints requieren autenticación y `X-Project-ID`. Los archivos
se guardan como recursos autenticados en Cloudinary o en `uploads/notes` en
modo local; la API no entrega las direcciones del proveedor. La tabla
`note_attachments` se crea al iniciar el backend, con RLS en PostgreSQL.
Quitar un adjunto impide nuevas descargas desde la app, pero conserva el archivo
para mantener el historial. No revoca copias ya descargadas o enviadas por email.

Si los adjuntos suman hasta 10 MB y la opción está activada, se incluyen como
archivos en el correo. Si superan ese total o se desactiva la opción, el email
lista sus nombres e indica que están disponibles desde el enlace a la nota.
Agregar archivos a una nota existente requiere pulsar **Guardar adjuntos** y,
para avisar a los miembros, **Notificar actualización**. Las notificaciones usan
las tareas en segundo plano existentes; “programada” no confirma la entrega.
