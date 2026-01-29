import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import ExpenseDetail from './pages/ExpenseDetail'
import MyPayments from './pages/MyPayments'
import PendingApprovals from './pages/PendingApprovals'
import Users from './pages/Users'
import Providers from './pages/Providers'
import Categories from './pages/Categories'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user } = useAuth()

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/:id" element={<ExpenseDetail />} />
        <Route path="my-payments" element={<MyPayments />} />

        {/* Admin routes */}
        <Route path="pending-approvals" element={<AdminRoute><PendingApprovals /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="providers" element={<AdminRoute><Providers /></AdminRoute>} />
        <Route path="categories" element={<AdminRoute><Categories /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default App
