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
  const { currentProject, currencyMode, loading: projectLoading } = useProject()
  const isIndividual = currentProject?.is_individual
  const [summary, setSummary] = useState(null)
  const [myStatus, setMyStatus] = useState(null)
  const [evolution, setEvolution] = useState(null)
  const [exchangeRate, setExchangeRate] = useState(null)
  const [byProvider, setByProvider] = useState([])
  const [byCategory, setByCategory] = useState([])
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

      const [summaryRes, myStatusRes, evolutionRes, rateRes, providerRes, categoryRes] = await Promise.all([
        dashboardAPI.summary(params),
        dashboardAPI.myStatus(),
        dashboardAPI.evolution(params),
        exchangeRateAPI.current().catch(() => null),
        dashboardAPI.expensesByProvider(params),
        dashboardAPI.expensesByCategory(params),
      ])

      setSummary(summaryRes.data)
      setMyStatus(myStatusRes.data)
      setEvolution(evolutionRes.data)
      setByProvider(providerRes.data)
      setByCategory(categoryRes.data)
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

      {/* Personal Status Alert - COMPACT single line */}
      {!isIndividual && myStatus && (currencyMode === 'ARS' ? parseFloat(myStatus.pending_ars) > 0 : parseFloat(myStatus.pending_usd) > 0) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={18} />
            <span className="font-medium text-yellow-800">
              {myStatus.pending_payments_count} {myStatus.pending_payments_count === 1 ? 'pago pendiente' : 'pagos pendientes'}
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
            to="/my-payments"
            className="flex items-center gap-1 text-yellow-700 hover:text-yellow-800 font-medium whitespace-nowrap"
          >
            Ver pagos <ArrowRight size={14} />
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
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Pagado</span>
          <span className="text-green-700 font-bold">
            {currencyMode === 'ARS'
              ? formatCurrency(summary?.total_paid_ars || 0, 'ARS')
              : formatCurrency(summary?.total_paid_usd || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Pendiente</span>
          <span className="text-yellow-700 font-bold">
            {currencyMode === 'ARS'
              ? formatCurrency(summary?.total_pending_ars || 0, 'ARS')
              : formatCurrency(summary?.total_pending_usd || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-gray-600">Participantes</span>
          <span className="text-blue-700 font-bold">{summary?.participants_count || 0}</span>
        </div>
      </div>

      {/* My Personal Status - compact (hide for individual projects) */}
      {!isIndividual && myStatus && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-900">Mi Estado <span className="text-blue-600">({myStatus.participation_percentage}%)</span></h2>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Me corresponde</span>
              <span className="font-bold text-gray-900">
                {currencyMode === 'ARS'
                  ? formatCurrency(myStatus.total_due_ars, 'ARS')
                  : formatCurrency(myStatus.total_due_usd)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Ya pague</span>
              <span className="font-bold text-green-600">
                {currencyMode === 'ARS'
                  ? formatCurrency(myStatus.total_paid_ars, 'ARS')
                  : formatCurrency(myStatus.total_paid_usd)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-600">Me falta</span>
              <span className="font-bold text-yellow-600">
                {currencyMode === 'ARS'
                  ? formatCurrency(myStatus.pending_ars, 'ARS')
                  : formatCurrency(myStatus.pending_usd)}
              </span>
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

      {/* Expenses by Provider and Category Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Provider */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gastos por Proveedor</h3>
          {byProvider.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay gastos en el período seleccionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b">
                    <th className="pb-2">Proveedor</th>
                    <th className="pb-2 text-right">Total USD</th>
                    <th className="pb-2 text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 text-gray-900">{item.provider_name}</td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.total_usd)}
                      </td>
                      <td className="py-3 text-right text-gray-600">{item.expenses_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Category */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gastos por Categoría</h3>
          {byCategory.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay gastos en el período seleccionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b">
                    <th className="pb-2">Categoría</th>
                    <th className="pb-2 text-right">Total USD</th>
                    <th className="pb-2 text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 text-gray-900">{item.category_name}</td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.total_usd)}
                      </td>
                      <td className="py-3 text-right text-gray-600">{item.expenses_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
