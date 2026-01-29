# Construccion - Expense Management System

A full-stack application for managing construction expenses among multiple participants. Each participant has a percentage of ownership, and all expenses are automatically split proportionally.

## Features

- **Multi-participant expense tracking**: Assign ownership percentages to participants
- **Automatic expense splitting**: When an expense is created, it's automatically split based on each participant's percentage
- **Dual currency support**: All amounts stored in both USD and ARS
- **Blue dollar exchange rate**: Automatic fetching of the blue dollar rate from bluelytics.com.ar
- **Payment tracking**: Each participant can mark their portion as paid
- **File uploads**: Attach invoices to expenses and receipts to payments
- **Dashboard**: Visual summary of total expenses, pending payments, and expense evolution
- **Role-based access**: Admin users can create expenses and manage participants

## Tech Stack

### Backend
- Python 3.10+
- FastAPI
- SQLAlchemy + SQLite
- JWT Authentication

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts

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

# Copy environment file
cp .env.example .env

# Start the backend server
uvicorn app.main:app --reload
```

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

1. **Add Categories**: Go to Categories and add expense categories (e.g., Materials, Salaries, Taxes)
2. **Add Providers**: Go to Providers and add your construction suppliers
3. **Add Participants**: Go to Participants and add all construction participants with their ownership percentages (must sum to 100%)

### 4. Start tracking expenses

1. Go to Expenses and click "Nuevo Gasto"
2. Enter the expense details (amount, currency, provider, category)
3. The system will automatically split the expense among all participants

### 5. Track payments

Each participant can:
- View their pending payments in "Mis Pagos"
- Mark payments as paid
- Upload payment receipts

## Project Structure

```
construccion-edificio/
├── app/                    # Backend (FastAPI)
│   ├── main.py            # Application entry point
│   ├── config.py          # Configuration management
│   ├── database.py        # Database connection
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   └── utils/             # Utilities and dependencies
├── frontend/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── context/      # React contexts
│   │   ├── components/   # Reusable components
│   │   └── pages/        # Page components
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

### Exchange Rate
- `GET /exchange-rate/current` - Get current blue dollar rate

## Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - JWT signing key (change in production!)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time
- `MAX_FILE_SIZE_MB` - Maximum upload file size
- `EXCHANGE_RATE_CACHE_MINUTES` - Exchange rate cache duration

## License

MIT
