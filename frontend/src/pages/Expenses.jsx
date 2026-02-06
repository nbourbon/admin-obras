import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { expensesAPI, providersAPI, categoriesAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Plus, FileText, CheckCircle, Clock, AlertCircle, X, Upload } from 'lucide-react'

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
    month: 'short',
    year: 'numeric',
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

function CreateExpenseModal({ isOpen, onClose, onCreated, providers, categories }) {
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
            <select
              required
              value={formData.provider_id}
              onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar proveedor</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [expensesRes, providersRes, categoriesRes] = await Promise.all([
        expensesAPI.list(),
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: expense.category?.color || '#ffffff' }}
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/expenses/${expense.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {expense.description}
                      </Link>
                      {expense.invoice_file_path && (
                        <FileText size={14} className="inline ml-2 text-gray-400" />
                      )}
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
