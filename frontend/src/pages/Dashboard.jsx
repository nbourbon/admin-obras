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

      {/* Summary Stats - compact inline */}
      <div className="bg-white rounded-xl shadow-sm divide-y">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Total Gastos ({summary?.expenses_count || 0})</span>
          <span className="text-blue-700 font-bold">{formatCurrency(summary?.total_expenses_usd || 0)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Pagado</span>
          <span className="text-green-700 font-bold">{formatCurrency(summary?.total_paid_usd || 0)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Pendiente</span>
          <span className="text-yellow-700 font-bold">{formatCurrency(summary?.total_pending_usd || 0)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Participantes</span>
          <span className="text-blue-700 font-bold">{summary?.participants_count || 0}</span>
        </div>
      </div>

      {/* My Personal Status - compact */}
      {myStatus && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-900">Mi Estado <span className="text-blue-600">({myStatus.participation_percentage}%)</span></h2>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Me corresponde</span>
              <span className="font-bold text-gray-900">{formatCurrency(myStatus.total_due_usd)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Ya pague</span>
              <span className="font-bold text-green-600">{formatCurrency(myStatus.total_paid_usd)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Me falta</span>
              <span className="font-bold text-yellow-600">{formatCurrency(myStatus.pending_usd)}</span>
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
