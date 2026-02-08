# Construccion - Expense Management System

A full-stack application for managing construction expenses among multiple participants. Each participant has a percentage of ownership, and all expenses are automatically split proportionally.

## Features

- **Multi-project support**: Manage multiple construction projects, each with its own participants, providers, and categories
- **Individual projects**: Simplified UX for single-user projects with auto-approved payments
- **Project-based participant management**: Each project has independent participation percentages
- **Automatic expense splitting**: When an expense is created, it's automatically split based on each project member's percentage
- **Dual currency support**: All amounts stored in both USD and ARS
- **Blue dollar exchange rate**: Automatic fetching of the blue dollar rate from bluelytics.com.ar
- **Payment approval workflow**: Participants submit payments for admin approval
- **File uploads**: Attach invoices to expenses and receipts to payments with preview support
- **Dashboard**: Visual summary of total expenses, pending payments, and expense evolution per project
- **Category colors**: Assign colors to categories for visual identification
- **Role-based access**: Admin users can create expenses, manage participants, and approve payments
- **Meeting notes**: Record meeting minutes with rich text editor
- **Weighted voting**: Create voting notes where each vote is weighted by the participant's ownership percentage

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

### 1. Create the first admin user

Since there are no users initially, you can create the first admin via the API:

```bash
curl -X POST "http://localhost:8000/auth/register-first-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password",
    "full_name": "Admin User",
    "participation_percentage": 25
  }'
```

### 2. Log in to the frontend

Open http://localhost:3000 and log in with the admin credentials.

### 3. Set up the basics

1. **Create a Project**: Go to Projects and create your first construction project
2. **Add Participants**: Go to Participants and add users to the project with their ownership percentages (must sum to 100%)
3. **Add Categories**: Go to Categories and add expense categories (e.g., Materials, Salaries, Taxes)
4. **Add Providers**: Go to Providers and add your construction suppliers

### 4. Start tracking expenses

1. Go to Expenses and click "Nuevo Gasto"
2. Enter the expense details (amount, currency, provider, category)
3. The system will automatically split the expense among all participants

### 5. Track payments

Each participant can:
- View their pending payments in "Mis Pagos"
- Mark payments as paid
- Upload payment receipts

### 6. Meeting notes and voting

Record meeting minutes and make decisions:
- **Regular notes**: Use the rich text editor to document meetings
- **Voting notes**: Create polls where votes are weighted by ownership percentage
  - Example: A 85% owner's vote outweighs a 15% owner's vote
  - Results show both vote count and total participation percentage
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

### Authentication
- `POST /auth/register-first-admin` - Create first admin (only works once)
- `POST /auth/register` - Register new user (admin only)
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Users
- `GET /users` - List all participants
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Deactivate user

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
- `POST /projects` - Create project (admin only)
- `GET /projects/{id}` - Get project with members
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Deactivate project
- `GET /projects/{id}/members` - List project members
- `POST /projects/{id}/members` - Add member to project
- `PUT /projects/{id}/members/{user_id}` - Update member percentage
- `DELETE /projects/{id}/members/{user_id}` - Remove member from project
- `GET /projects/{id}/participation-validation` - Validate percentages sum to 100%

### Exchange Rate
- `GET /exchange-rate/current` - Get current blue dollar rate

### Notes
- `GET /notes` - List project notes
- `POST /notes` - Create note (regular or voting)
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
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time (default: 1440 = 24 hours)
- `MAX_FILE_SIZE_MB` - Maximum upload file size (default: 10)
- `EXCHANGE_RATE_CACHE_MINUTES` - Exchange rate cache duration (default: 60)
- `CLOUDINARY_*` - Cloud file storage credentials (production only)

## License

MIT
