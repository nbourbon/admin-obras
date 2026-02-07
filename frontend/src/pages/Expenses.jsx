import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expensesAPI, providersAPI, categoriesAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Plus, FileText, CheckCircle, Clock, AlertCircle, X, Upload, Palette, RotateCcw, Eye, EyeOff } from 'lucide-react'

// Predefined colors for categories
const CATEGORY_COLORS = [
  { name: 'Sin color', value: null, bg: 'bg-white', border: 'border-gray-200' },
  { name: 'Rojo', value: '#FEE2E2', bg: 'bg-red-100', border: 'border-red-300' },
  { name: 'Naranja', value: '#FFEDD5', bg: 'bg-orange-100', border: 'border-orange-300' },
  { name: 'Amarillo', value: '#FEF9C3', bg: 'bg-yellow-100', border: 'border-yellow-300' },
  { name: 'Verde', value: '#DCFCE7', bg: 'bg-green-100', border: 'border-green-300' },
  { name: 'Celeste', value: '#CFFAFE', bg: 'bg-cyan-100', border: 'border-cyan-300' },
  { name: 'Azul', value: '#DBEAFE', bg: 'bg-blue-100', border: 'border-blue-300' },
  { name: 'Violeta', value: '#EDE9FE', bg: 'bg-violet-100', border: 'border-violet-300' },
  { name: 'Rosa', value: '#FCE7F3', bg: 'bg-pink-100', border: 'border-pink-300' },
  { name: 'Gris', value: '#F3F4F6', bg: 'bg-gray-100', border: 'border-gray-300' },
]

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString) {
  // Compact numeric format for mobile: dd/mm/yy
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

function QuickCreateProviderModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await providersAPI.create({ name, contact_info: contactInfo })
      onCreated(response.data)
      onClose()
      setName('')
      setContactInfo('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear proveedor')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Nuevo Proveedor</h2>
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
              placeholder="Nombre del proveedor"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Informacion de Contacto (opcional)
            </label>
            <textarea
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Telefono, email, etc."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuickCreateCategoryModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await categoriesAPI.create({ name, description, color })
      onCreated(response.data)
      onClose()
      setName('')
      setDescription('')
      setColor(null)
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
              placeholder="Ej: Materiales, Salarios"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Descripcion de la categoria"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color (opcional)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-10 rounded-lg border-2 transition-all ${c.bg} ${
                    color === c.value ? 'ring-2 ring-blue-500 border-blue-500' : c.border
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateExpenseModal({ isOpen, onClose, onCreated, providers: initialProviders, categories: initialCategories }) {
  const [formData, setFormData] = useState({
    description: '',
    amount_original: '',
    currency_original: 'USD',
    provider_id: '',
    category_id: '',
  })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [providers, setProviders] = useState(initialProviders)
  const [categories, setCategories] = useState(initialCategories)

  useEffect(() => {
    setProviders(initialProviders)
    setCategories(initialCategories)
  }, [initialProviders, initialCategories])

  const handleProviderCreated = (newProvider) => {
    setProviders([...providers, newProvider])
    setFormData({ ...formData, provider_id: newProvider.id.toString() })
  }

  const handleCategoryCreated = (newCategory) => {
    setCategories([...categories, newCategory])
    setFormData({ ...formData, category_id: newCategory.id.toString() })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create expense first
      const response = await expensesAPI.create({
        ...formData,
        amount_original: parseFloat(formData.amount_original),
        provider_id: parseInt(formData.provider_id),
        category_id: parseInt(formData.category_id),
      })

      // Upload invoice if selected
      if (invoiceFile && response.data?.id) {
        try {
          await expensesAPI.uploadInvoice(response.data.id, invoiceFile)
        } catch (uploadErr) {
          console.error('Error uploading invoice:', uploadErr)
          // Don't fail the whole operation, expense was created
        }
      }

      onCreated()
      onClose()
      setFormData({
        description: '',
        amount_original: '',
        currency_original: 'USD',
        provider_id: '',
        category_id: '',
      })
      setInvoiceFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear gasto')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nuevo Gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

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
              placeholder="Ej: Materiales para estructura"
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
              <select
                value={formData.currency_original}
                onChange={(e) => setFormData({ ...formData, currency_original: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            <div className="flex gap-2">
              <select
                required
                value={formData.provider_id}
                onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar proveedor</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowProviderModal(true)}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Crear nuevo proveedor"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <div className="flex gap-2">
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar categoria</option>
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
              Factura (opcional)
            </label>
            {invoiceFile ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <FileText className="text-blue-600" size={20} />
                <span className="flex-1 text-sm text-blue-700 truncate">{invoiceFile.name}</span>
                <button
                  type="button"
                  onClick={() => setInvoiceFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                <Upload className="text-gray-400" size={20} />
                <span className="text-gray-600 text-sm">Click para subir factura</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Gasto'}
            </button>
          </div>
        </form>

        {/* Quick create modals */}
        <QuickCreateProviderModal
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          onCreated={handleProviderCreated}
        />
        <QuickCreateCategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCreated={handleCategoryCreated}
        />
      </div>
    </div>
  )
}

function Expenses() {
  const { isProjectAdmin } = useProject()
  const [expenses, setExpenses] = useState([])
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    loadData()
  }, [showDeleted])

  const loadData = async () => {
    try {
      const [expensesRes, providersRes, categoriesRes] = await Promise.all([
        expensesAPI.list({ include_deleted: showDeleted }),
        providersAPI.list(),
        categoriesAPI.list(),
      ])
      setExpenses(expensesRes.data)
      setProviders(providersRes.data)
      setCategories(categoriesRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreExpense = async (expenseId) => {
    try {
      await expensesAPI.restore(expenseId)
      loadData()
    } catch (err) {
      console.error('Error restoring expense:', err)
      alert('Error al restaurar el gasto')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          {isProjectAdmin && (
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {showDeleted ? <EyeOff size={20} /> : <Eye size={20} />}
              {showDeleted ? 'Ocultar eliminados' : 'Ver eliminados'}
            </button>
          )}
          {isProjectAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              Nuevo Gasto
            </button>
          )}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin gastos</h3>
          <p className="mt-2 text-gray-500">Todavia no hay gastos registrados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripcion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  {showDeleted && isProjectAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className={`hover:opacity-80 transition-opacity ${expense.is_deleted ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: expense.is_deleted ? '#fee' : (expense.category?.color || '#ffffff') }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/expenses/${expense.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {expense.description}
                        </Link>
                        {expense.invoice_file_path && (
                          <FileText size={14} className="text-gray-400" />
                        )}
                        {expense.is_deleted && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                            ELIMINADO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{formatCurrency(expense.amount_usd)}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(expense.amount_ars, 'ARS')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {expense.provider?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-700">
                        {expense.category?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={expense.status} />
                    </td>
                    {showDeleted && isProjectAdmin && (
                      <td className="px-6 py-4">
                        {expense.is_deleted && (
                          <button
                            onClick={() => handleRestoreExpense(expense.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            <RotateCcw size={14} />
                            Restaurar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={loadData}
        providers={providers}
        categories={categories}
      />
    </div>
  )
}

export default Expenses
