import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI, exchangeRateAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { AlertCircle, ArrowRight } from 'lucide-react'
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

function StatCard({ title, value, subtitle, color = 'blue' }) {
  const colors = {
    blue: 'border-l-blue-500 bg-blue-50',
    green: 'border-l-green-500 bg-green-50',
    yellow: 'border-l-yellow-500 bg-yellow-50',
    red: 'border-l-red-500 bg-red-50',
  }

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
  }

  return (
    <div className={`rounded-lg shadow-sm p-4 border-l-4 ${colors[color]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
      <p className={`text-xl font-bold mt-1 ${textColors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Gastos"
          value={formatCurrency(summary?.total_expenses_usd || 0)}
          subtitle={`${summary?.expenses_count || 0} gastos`}
          color="blue"
        />
        <StatCard
          title="Pagado"
          value={formatCurrency(summary?.total_paid_usd || 0)}
          color="green"
        />
        <StatCard
          title="Pendiente"
          value={formatCurrency(summary?.total_pending_usd || 0)}
          color="yellow"
        />
        <StatCard
          title="Participantes"
          value={summary?.participants_count || 0}
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
