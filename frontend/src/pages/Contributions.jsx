import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expensesAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Coins, TrendingUp } from 'lucide-react'

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    partial: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
  }
  const labels = {
    pending: 'Pendiente',
    partial: 'Parcial',
    paid: 'Pagado',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function Contributions() {
  const { currentProject } = useProject()
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currencyMode = currentProject?.currency_mode || 'DUAL'

  useEffect(() => {
    loadContributions()
  }, [currentProject])

  const loadContributions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await expensesAPI.listContributions()
      setContributions(response.data || [])
    } catch (err) {
      console.error('Error loading contributions:', err)
      setError(err.response?.data?.detail || 'Error al cargar solicitudes de aporte')
    } finally {
      setLoading(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Coins size={48} className="mb-4 opacity-50" />
        <p className="text-lg">Selecciona un proyecto para ver las solicitudes de aporte</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-100 rounded-lg">
            <TrendingUp className="text-green-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Aporte</h1>
            <p className="text-sm text-gray-600">Aportes a la caja común del proyecto</p>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Coins className="text-blue-600 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">¿Cómo funcionan las solicitudes de aporte?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>El admin crea una solicitud que se divide entre participantes</li>
              <li>Cada participante paga su parte y el admin aprueba</li>
              <li>Al aprobar, el monto se acredita al saldo de cada participante</li>
              <li>Los gastos futuros se pagan automáticamente desde el saldo</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : contributions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Coins size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">No hay solicitudes de aporte todavía</p>
          <p className="text-sm text-gray-500">
            Crea un nuevo "gasto" y marca el checkbox "Es solicitud de aporte"
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descripción
                  </th>
                  {currencyMode === 'DUAL' && (
                    <>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Monto USD
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Monto ARS
                      </th>
                    </>
                  )}
                  {currencyMode === 'ARS' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto ARS
                    </th>
                  )}
                  {currencyMode === 'USD' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto USD
                    </th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contributions.map((contribution) => (
                  <tr key={contribution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(contribution.expense_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Coins size={16} className="text-green-600 flex-shrink-0" />
                        <span className="truncate">{contribution.description}</span>
                      </div>
                    </td>
                    {currencyMode === 'DUAL' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                          {formatCurrency(contribution.amount_usd, 'USD')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                          {formatCurrency(contribution.amount_ars, 'ARS')}
                        </td>
                      </>
                    )}
                    {currencyMode === 'ARS' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(contribution.amount_ars, 'ARS')}
                      </td>
                    )}
                    {currencyMode === 'USD' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(contribution.amount_usd, 'USD')}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={contribution.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Link
                        to={`/expenses/${contribution.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {contributions.map((contribution) => (
              <Link
                key={contribution.id}
                to={`/expenses/${contribution.id}`}
                className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins size={18} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {contribution.description}
                    </span>
                  </div>
                  <StatusBadge status={contribution.status} />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{formatDate(contribution.expense_date)}</span>
                  <div className="text-right">
                    {currencyMode === 'DUAL' && (
                      <>
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(contribution.amount_usd, 'USD')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(contribution.amount_ars, 'ARS')}
                        </div>
                      </>
                    )}
                    {currencyMode === 'ARS' && (
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(contribution.amount_ars, 'ARS')}
                      </div>
                    )}
                    {currencyMode === 'USD' && (
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(contribution.amount_usd, 'USD')}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Total de solicitudes:</span> {contributions.length}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
