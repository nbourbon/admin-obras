import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expensesAPI, categoriesAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Coins, TrendingUp, Plus, X, Upload } from 'lucide-react'

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

function QuickCreateCategoryModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await categoriesAPI.create({ name })
      onCreated(response.data)
      onClose()
      setName('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear categoria')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Nueva Categoria</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Materiales"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateContributionModal({ isOpen, onClose, onCreated, currencyMode }) {
  const [categories, setCategories] = useState([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    description: '',
    amount_original: '',
    currency_original: currencyMode === 'DUAL' ? 'USD' : currencyMode,
    category_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    exchange_rate_override: '',
  })

  useEffect(() => {
    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.list()
      setCategories(response.data || [])
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create contribution (expense with is_contribution=true)
      const expenseData = {
        ...formData,
        is_contribution: true, // Always true for contributions
        amount_original: parseFloat(formData.amount_original),
        exchange_rate_override: formData.exchange_rate_override
          ? parseFloat(formData.exchange_rate_override)
          : null,
        category_id: formData.category_id || null,
      }

      const response = await expensesAPI.create(expenseData)

      // Upload invoice if provided
      if (invoiceFile) {
        await expensesAPI.uploadInvoice(response.data.id, invoiceFile)
      }

      onCreated()
      onClose()
      // Reset form
      setFormData({
        description: '',
        amount_original: '',
        currency_original: currencyMode === 'DUAL' ? 'USD' : currencyMode,
        category_id: '',
        expense_date: new Date().toISOString().split('T')[0],
        exchange_rate_override: '',
      })
      setInvoiceFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear solicitud de aporte')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <QuickCreateCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCreated={(newCategory) => {
          setCategories([...categories, newCategory])
          setFormData({ ...formData, category_id: newCategory.id })
        }}
      />

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Nueva Solicitud de Aporte</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-xs mb-4">
            Los aportes se dividen entre participantes. Al aprobar los pagos, el monto se acredita al saldo de cada uno.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Aporte para caja común"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount_original}
                  onChange={(e) => setFormData({ ...formData, amount_original: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                {currencyMode === 'DUAL' ? (
                  <select
                    value={formData.currency_original}
                    onChange={(e) => setFormData({ ...formData, currency_original: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={currencyMode}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                  />
                )}
              </div>
            </div>

            {currencyMode === 'DUAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cambio (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exchange_rate_override}
                  onChange={(e) => setFormData({ ...formData, exchange_rate_override: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dejar vacio para usar TC automatico"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Si no se especifica, se usa el dolar blue actual
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria (opcional)
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin definir</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  title="Crear nueva categoria"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha del Aporte
              </label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comprobante (opcional)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload size={20} className="mr-2 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {invoiceFile ? invoiceFile.name : 'Seleccionar archivo'}
                  </span>
                  <input
                    type="file"
                    onChange={(e) => setInvoiceFile(e.target.files[0])}
                    className="hidden"
                    accept="image/*,.pdf"
                  />
                </label>
                {invoiceFile && (
                  <button
                    type="button"
                    onClick={() => setInvoiceFile(null)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Aporte'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default function Contributions() {
  const { currentProject, isProjectAdmin } = useProject()
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

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
      <CreateContributionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          loadContributions()
        }}
        currencyMode={currencyMode}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Aporte</h1>
              <p className="text-sm text-gray-600">Aportes a la caja común del proyecto</p>
            </div>
          </div>
          {isProjectAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Nueva Solicitud</span>
            </button>
          )}
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
          {isProjectAdmin ? (
            <p className="text-sm text-gray-500">
              Usa el botón "Nueva Solicitud" para crear la primera solicitud de aporte
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              El administrador del proyecto puede crear solicitudes de aporte
            </p>
          )}
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
