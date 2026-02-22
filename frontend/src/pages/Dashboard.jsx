import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI, exchangeRateAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { AlertCircle, ArrowRight, Download, Calendar } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
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
  const { currentProject, currencyMode, loading: projectLoading } = useProject()
  const isIndividual = currentProject?.is_individual
  const [summary, setSummary] = useState(null)
  const [myStatus, setMyStatus] = useState(null)
  const [evolution, setEvolution] = useState(null)
  const [exchangeRate, setExchangeRate] = useState(null)
  const [byCategory, setByCategory] = useState([])
  const [balances, setBalances] = useState([])
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [dateFilter, setDateFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    // Wait until ProjectContext has finished loading and has a project selected
    if (!projectLoading && currentProject) {
      loadDashboardData()
    }
  }, [projectLoading, currentProject?.id, dateFilter, startDate, endDate])

  const getDateParams = () => {
    const params = {}
    const now = new Date()

    if (dateFilter === 'today') {
      const today = now.toISOString().split('T')[0]
      params.start_date = today
      params.end_date = today
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      params.start_date = weekAgo.toISOString().split('T')[0]
      params.end_date = now.toISOString().split('T')[0]
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      params.start_date = monthAgo.toISOString().split('T')[0]
      params.end_date = now.toISOString().split('T')[0]
    } else if (dateFilter === 'custom' && startDate && endDate) {
      params.start_date = startDate
      params.end_date = endDate
    }

    return params
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const params = getDateParams()

      const [summaryRes, myStatusRes, evolutionRes, rateRes, categoryRes, balancesRes, contributionsRes] = await Promise.all([
        dashboardAPI.summary(params),
        dashboardAPI.myStatus(),
        dashboardAPI.evolution(params),
        exchangeRateAPI.current().catch(() => null),
        dashboardAPI.expensesByCategory(params),
        dashboardAPI.balances().catch(() => ({ data: [] })),
        dashboardAPI.contributionsByParticipant().catch(() => ({ data: [] })),
      ])

      setSummary(summaryRes.data)
      setMyStatus(myStatusRes.data)
      setEvolution(evolutionRes.data)
      setByCategory(categoryRes.data)
      setBalances(balancesRes.data || [])
      setContributions(contributionsRes.data || [])
      if (rateRes) setExchangeRate(rateRes.data)
    } catch (err) {
      setError('Error al cargar datos del dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true)
      const response = await dashboardAPI.exportExcel()

      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url

      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers['content-disposition']
      let filename = `Reporte_${currentProject?.name || 'Proyecto'}_${new Date().toISOString().split('T')[0]}.xlsx`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading Excel:', err)
      alert('Error al descargar el reporte')
    } finally {
      setDownloadingExcel(false)
    }
  }

  if (projectLoading || (loading && !error)) {
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
    amount: currencyMode === 'ARS'
      ? parseFloat(item.total_ars) / 1000
      : parseFloat(item.total_usd),
  })) || []

  return (
    <div className="space-y-6">
      {/* Header with compact filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {currencyMode === 'DUAL' && exchangeRate && (
            <div className="text-sm text-gray-500">
              Dolar Blue: <span className="font-semibold text-green-600">${exchangeRate.rate}</span>
            </div>
          )}
          {/* Compact Date Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-600" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todo</option>
              <option value="today">Hoy</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
          >
            <Download size={18} />
            <span className="hidden sm:inline">{downloadingExcel ? 'Descargando...' : 'Descargar Reporte Excel'}</span>
            <span className="sm:hidden">Excel</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range (only when selected) */}
      {dateFilter === 'custom' && (
        <div className="flex flex-wrap gap-3 items-center bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Personal Status Alerts - Gastos pendientes */}
      {!isIndividual && myStatus && myStatus.pending_payments_count > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={18} />
            <span className="font-medium text-yellow-800">
              Tenés Gastos Pendientes
            </span>
            <span className="text-yellow-700 font-semibold">
              {currencyMode === 'ARS'
                ? formatCurrency(myStatus.pending_ars, 'ARS')
                : currencyMode === 'USD'
                ? formatCurrency(myStatus.pending_usd)
                : `${formatCurrency(myStatus.pending_usd)}`
              }
            </span>
          </div>
          <Link
            to="/expenses"
            className="flex items-center gap-1 text-yellow-700 hover:text-yellow-800 font-medium whitespace-nowrap"
          >
            Ver Gastos <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {/* Aportes pendientes */}
      {!isIndividual && myStatus?.has_pending_contribution && (
        <div className="bg-orange-50 border-l-4 border-orange-400 px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertCircle className="text-orange-600 flex-shrink-0" size={18} />
            <span className="font-medium text-orange-800">Tenés Aportes Pendientes</span>
          </div>
          <Link
            to="/contributions"
            className="flex items-center gap-1 text-orange-700 hover:text-orange-800 font-medium whitespace-nowrap"
          >
            Ver Aportes <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Summary Stats - compact inline */}
      <div className="bg-white rounded-xl shadow-sm divide-y">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Total Gastos ({summary?.expenses_count || 0})</span>
          <span className="text-blue-700 font-bold">
            {currencyMode === 'ARS'
              ? formatCurrency(summary?.total_expenses_ars || 0, 'ARS')
              : formatCurrency(summary?.total_expenses_usd || 0)}
          </span>
        </div>
        {summary?.project_type === 'construccion' && summary?.square_meters > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
            <span className="text-gray-600">Total x Metro² ({summary?.square_meters} m²)</span>
            <span className="text-blue-700 font-bold">
              {currencyMode === 'ARS'
                ? formatCurrency(summary?.cost_per_square_meter_ars || 0, 'ARS')
                : formatCurrency(summary?.cost_per_square_meter_usd || 0)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Pendiente</span>
          <span className="text-yellow-700 font-bold">
            {currencyMode === 'ARS'
              ? formatCurrency(summary?.total_pending_ars || 0, 'ARS')
              : formatCurrency(summary?.total_pending_usd || 0)}
          </span>
        </div>
        {/* Hide Saldo Cta Corriente for direct_payment mode */}
        {summary?.contribution_mode !== 'direct_payment' && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-gray-600">Saldo Cta Corriente</span>
            <span className="text-green-700 font-bold">
              {currencyMode === 'ARS'
                ? formatCurrency(summary?.total_balance_ars || 0, 'ARS')
                : formatCurrency(summary?.total_balance_usd || 0)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Participantes</span>
          <span className="text-blue-700 font-bold">{summary?.participants_count || 0}</span>
        </div>
      </div>

      {/* My Personal Status - compact (hidden for individual projects) */}
      {myStatus && !isIndividual && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-900">Mi Estado <span className="text-blue-600">({myStatus.participation_percentage}%)</span></h2>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Gastado</span>
              <span className="font-bold text-gray-900">
                {currencyMode === 'ARS'
                  ? formatCurrency(myStatus.total_due_ars, 'ARS')
                  : formatCurrency(myStatus.total_due_usd)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Pendiente</span>
              <span className="font-bold text-yellow-600">
                {currencyMode === 'ARS'
                  ? formatCurrency(myStatus.pending_ars, 'ARS')
                  : formatCurrency(myStatus.pending_usd)}
              </span>
            </div>
            {/* Hide Saldo Aportes for direct_payment mode */}
            {summary?.contribution_mode !== 'direct_payment' && (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Saldo Aportes</span>
                  {myStatus.has_pending_contribution && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                      Pendiente
                    </span>
                  )}
                </div>
                <span className="font-bold text-green-600">
                  {currencyMode === 'ARS'
                    ? formatCurrency(myStatus.balance_aportes_ars || 0, 'ARS')
                    : formatCurrency(myStatus.balance_aportes_usd || 0)}
                </span>
              </div>
            )}
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
                  formatter={(value, name) => {
                    if (currencyMode === 'ARS') return `ARS ${(value * 1000).toLocaleString()}`
                    if (currencyMode === 'USD') return formatCurrency(value)
                    return name === 'USD' ? formatCurrency(value) : `ARS ${(value * 1000).toLocaleString()}`
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={currencyMode === 'ARS' ? 'amount' : 'USD'}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: '#2563eb' }}
                  name={currencyMode === 'ARS' ? 'ARS (miles)' : 'USD'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            Total acumulado: {currencyMode === 'ARS'
              ? formatCurrency(evolution?.cumulative_ars || 0, 'ARS')
              : currencyMode === 'USD'
              ? formatCurrency(evolution?.cumulative_usd || 0)
              : `${formatCurrency(evolution?.cumulative_usd || 0)} / ${formatCurrency(evolution?.cumulative_ars || 0, 'ARS')}`
            }
          </div>
        </div>
      )}

      {/* Expenses by Category - Pie Chart */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Gastos por Categoría</h3>
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory.map(cat => ({
                    name: cat.category_name,
                    value: parseFloat(cat.total_usd),
                    count: cat.expenses_count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {byCategory.map((entry, index) => {
                    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                    return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  })}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry) => {
                    const total = byCategory.reduce((sum, cat) => sum + parseFloat(cat.total_usd), 0)
                    const percent = ((parseFloat(entry.payload.value) / total) * 100).toFixed(1)
                    return `${value} (${percent}%)`
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {/* Contributions by Participant - Pie Chart (hide for direct_payment mode) */}
      {summary?.contribution_mode !== 'direct_payment' && contributions.length > 0 && contributions.some(c => c.contributions_count > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aportes Totales por Participante</h3>
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contributions.filter(c => c.contributions_count > 0).map(contrib => ({
                    name: contrib.user_name,
                    value: parseFloat(currencyMode === 'ARS' ? contrib.total_ars : contrib.total_usd),
                    count: contrib.contributions_count,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {contributions.map((entry, index) => {
                    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                    return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  })}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value, currencyMode === 'ARS' ? 'ARS' : 'USD')}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry) => {
                    const total = contributions.reduce((sum, c) => sum + parseFloat(currencyMode === 'ARS' ? c.total_ars : c.total_usd), 0)
                    const percent = ((parseFloat(entry.payload.value) / total) * 100).toFixed(1)
                    return `${value} (${percent}%) - ${entry.payload.count} aportes`
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
