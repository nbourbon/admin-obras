import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI, exchangeRateAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function StatCard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [myStatus, setMyStatus] = useState(null)
  const [evolution, setEvolution] = useState(null)
  const [exchangeRate, setExchangeRate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const [summaryRes, myStatusRes, evolutionRes, rateRes] = await Promise.all([
        dashboardAPI.summary(),
        dashboardAPI.myStatus(),
        dashboardAPI.evolution(),
        exchangeRateAPI.current().catch(() => null),
      ])

      setSummary(summaryRes.data)
      setMyStatus(myStatusRes.data)
      setEvolution(evolutionRes.data)
      if (rateRes) setExchangeRate(rateRes.data)
    } catch (err) {
      setError('Error al cargar datos del dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const chartData = evolution?.monthly_data?.map(item => ({
    name: `${monthNames[item.month - 1]} ${item.year}`,
    USD: parseFloat(item.total_usd),
    ARS: parseFloat(item.total_ars) / 1000, // Show in thousands for readability
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {exchangeRate && (
          <div className="text-sm text-gray-500">
            Dolar Blue: <span className="font-semibold text-green-600">${exchangeRate.rate}</span>
          </div>
        )}
      </div>

      {/* Personal Status Alert */}
      {myStatus && parseFloat(myStatus.pending_usd) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-medium text-yellow-800">
              Tenes {myStatus.pending_payments_count} pagos pendientes
            </p>
            <p className="text-sm text-yellow-600">
              Total: {formatCurrency(myStatus.pending_usd)} / {formatCurrency(myStatus.pending_ars, 'ARS')}
            </p>
          </div>
          <Link
            to="/my-payments"
            className="flex items-center gap-1 text-yellow-700 hover:text-yellow-800 font-medium"
          >
            Ver pagos <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Gastos (USD)"
          value={formatCurrency(summary?.total_expenses_usd || 0)}
          subtitle={`${summary?.expenses_count || 0} gastos`}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Total Pagado (USD)"
          value={formatCurrency(summary?.total_paid_usd || 0)}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pendiente (USD)"
          value={formatCurrency(summary?.total_pending_usd || 0)}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Participantes"
          value={summary?.participants_count || 0}
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* My Personal Status */}
      {myStatus && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Mi Estado ({myStatus.participation_percentage}%)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total que me corresponde</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(myStatus.total_due_usd)}
              </p>
              <p className="text-sm text-gray-400">
                {formatCurrency(myStatus.total_due_ars, 'ARS')}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">Ya pague</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(myStatus.total_paid_usd)}
              </p>
              <p className="text-sm text-gray-400">
                {formatCurrency(myStatus.total_paid_ars, 'ARS')}
              </p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-500">Me falta pagar</p>
              <p className="text-xl font-bold text-yellow-600">
                {formatCurrency(myStatus.pending_usd)}
              </p>
              <p className="text-sm text-gray-400">
                {formatCurrency(myStatus.pending_ars, 'ARS')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evolution Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Evolucion de Gastos</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'USD'
                      ? formatCurrency(value)
                      : `ARS ${(value * 1000).toLocaleString()}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="USD"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            Total acumulado: {formatCurrency(evolution?.cumulative_usd || 0)} / {formatCurrency(evolution?.cumulative_ars || 0, 'ARS')}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
