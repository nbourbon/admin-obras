import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { expensesAPI, providersAPI, categoriesAPI, rubrosAPI, paymentsAPI, dashboardAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Plus, FileText, X, Upload, RotateCcw, Eye, EyeOff, Edit2, Filter, ChevronDown, Check, CheckCircle2, Clock, Search, AlertCircle } from 'lucide-react'
import PayExpenseModal from '../components/PayExpenseModal'

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

function QuickCreateRubroModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await rubrosAPI.create({ name, description })
      onCreated(response.data)
      onClose()
      setName('')
      setDescription('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear rubro')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Nuevo Rubro</h2>
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
              placeholder="Ej: Infraestructura, Terminaciones"
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
              placeholder="Descripcion del rubro"
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

function QuickCreateCategoryModal({ isOpen, onClose, onCreated, selectedRubroId = null, rubros = [] }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedRubroName = rubros.find(r => r.id === selectedRubroId)?.name

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await categoriesAPI.create({
        name,
        description,
        color,
        rubro_ids: selectedRubroId ? [selectedRubroId] : [],
      })
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

        {selectedRubroId ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm mb-3">
            Se asignara al rubro: <strong>{selectedRubroName}</strong>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm mb-3">
            Sin rubro seleccionado — sera una categoria generica
          </div>
        )}

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

function EditExpenseModal({ isOpen, onClose, onUpdated, expense, providers: initialProviders, categories: initialCategories, rubros: initialRubros, currencyMode = 'DUAL' }) {
  const [formData, setFormData] = useState({
    description: '',
    amount_original: '',
    currency_original: 'USD',
    provider_id: '',
    category_id: '',
    rubro_id: '',
    expense_date: '',
    exchange_rate_override: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [providers, setProviders] = useState(initialProviders)
  const [categories, setCategories] = useState(initialCategories)
  const [rubros, setRubros] = useState(initialRubros)
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showRubroModal, setShowRubroModal] = useState(false)

  useEffect(() => {
    setProviders(initialProviders)
    setCategories(initialCategories)
    setRubros(initialRubros)
  }, [initialProviders, initialCategories, initialRubros])

  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description || '',
        amount_original: expense.amount_original || '',
        currency_original: expense.currency_original || 'USD',
        provider_id: expense.provider_id || '',
        category_id: expense.category_id || '',
        rubro_id: expense.rubro_id || '',
        expense_date: expense.expense_date ? new Date(expense.expense_date).toISOString().split('T')[0] : '',
        exchange_rate_override: '',
      })
    }
  }, [expense])

  const selectedRubroId = formData.rubro_id ? parseInt(formData.rubro_id) : null
  const filteredCategories = selectedRubroId
    ? categories.filter(c => !c.rubro || c.rubro.id === selectedRubroId)
    : categories

  const handleRubroChange = (e) => {
    const newRubroId = e.target.value
    const newRubroIdInt = newRubroId ? parseInt(newRubroId) : null
    const newFiltered = newRubroIdInt
      ? categories.filter(c => !c.rubro || c.rubro.id === newRubroIdInt)
      : categories
    const categoryStillValid = !formData.category_id || newFiltered.some(c => c.id === parseInt(formData.category_id))
    setFormData({ ...formData, rubro_id: newRubroId, category_id: categoryStillValid ? formData.category_id : '' })
  }

  const handleProviderCreated = (newProvider) => {
    setProviders([...providers, newProvider])
    setFormData({ ...formData, provider_id: newProvider.id.toString() })
  }

  const handleCategoryCreated = (newCategory) => {
    setCategories([...categories, newCategory])
    setFormData({ ...formData, category_id: newCategory.id.toString() })
  }

  const handleRubroCreated = (newRubro) => {
    setRubros([...rubros, newRubro])
    setFormData({ ...formData, rubro_id: newRubro.id.toString() })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        description: formData.description,
        amount_original: parseFloat(formData.amount_original),
        currency_original: formData.currency_original,
        provider_id: formData.provider_id ? parseInt(formData.provider_id) : null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        rubro_id: formData.rubro_id ? parseInt(formData.rubro_id) : null,
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : null,
      }
      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        payload.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }
      await expensesAPI.update(expense.id, payload)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar gasto')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !expense) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Editar Gasto</h2>
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
              Proveedor (opcional)
            </label>
            <div className="flex gap-2">
              <select
                value={formData.provider_id}
                onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
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
              Rubro (opcional)
            </label>
            <div className="flex gap-2">
              <select
                value={formData.rubro_id}
                onChange={handleRubroChange}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {rubros?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowRubroModal(true)}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Crear nuevo rubro"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria (opcional)
              {selectedRubroId && (
                <span className="ml-2 text-xs font-normal text-blue-600">filtrada por rubro</span>
              )}
            </label>
            <div className="flex gap-2">
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {filteredCategories.map((c) => (
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
              Fecha del Gasto
            </label>
            <input
              type="date"
              required
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>

        <QuickCreateProviderModal
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          onCreated={handleProviderCreated}
        />

        <QuickCreateCategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCreated={handleCategoryCreated}
          selectedRubroId={selectedRubroId}
          rubros={rubros}
        />

        <QuickCreateRubroModal
          isOpen={showRubroModal}
          onClose={() => setShowRubroModal(false)}
          onCreated={handleRubroCreated}
        />
      </div>
    </div>
  )
}

function CreateExpenseModal({ isOpen, onClose, onCreated, providers: initialProviders, categories: initialCategories, rubros: initialRubros, currencyMode = 'DUAL' }) {
  const defaultCurrency = currencyMode === 'ARS' ? 'ARS' : 'USD'
  const [formData, setFormData] = useState({
    description: '',
    amount_original: '',
    currency_original: defaultCurrency,
    provider_id: '',
    category_id: '',
    rubro_id: '',
    expense_date: new Date().toISOString().split('T')[0], // Default to today
    exchange_rate_override: '',
  })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showRubroModal, setShowRubroModal] = useState(false)
  const [providers, setProviders] = useState(initialProviders)
  const [categories, setCategories] = useState(initialCategories)
  const [rubros, setRubros] = useState(initialRubros)

  useEffect(() => {
    setProviders(initialProviders)
    setCategories(initialCategories)
    setRubros(initialRubros)
  }, [initialProviders, initialCategories, initialRubros])

  const selectedRubroId = formData.rubro_id ? parseInt(formData.rubro_id) : null
  const filteredCategories = selectedRubroId
    ? categories.filter(c => !c.rubro || c.rubro.id === selectedRubroId)
    : categories

  const handleRubroChange = (e) => {
    const newRubroId = e.target.value
    const newRubroIdInt = newRubroId ? parseInt(newRubroId) : null
    const newFiltered = newRubroIdInt
      ? categories.filter(c => !c.rubro || c.rubro.id === newRubroIdInt)
      : categories
    const categoryStillValid = !formData.category_id || newFiltered.some(c => c.id === parseInt(formData.category_id))
    setFormData({ ...formData, rubro_id: newRubroId, category_id: categoryStillValid ? formData.category_id : '' })
  }

  const handleProviderCreated = (newProvider) => {
    setProviders([...providers, newProvider])
    setFormData({ ...formData, provider_id: newProvider.id.toString() })
  }

  const handleCategoryCreated = (newCategory) => {
    setCategories([...categories, newCategory])
    setFormData({ ...formData, category_id: newCategory.id.toString() })
  }

  const handleRubroCreated = (newRubro) => {
    setRubros([...rubros, newRubro])
    setFormData({ ...formData, rubro_id: newRubro.id.toString() })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create expense first
      const payload = {
        description: formData.description,
        amount_original: parseFloat(formData.amount_original),
        currency_original: formData.currency_original,
        provider_id: formData.provider_id ? parseInt(formData.provider_id) : null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        rubro_id: formData.rubro_id ? parseInt(formData.rubro_id) : null,
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : null,
        is_contribution: false, // Regular expense, not a contribution
      }
      // Only send exchange_rate_override if user entered a value (DUAL mode)
      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        payload.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }
      const response = await expensesAPI.create(payload)

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
        currency_original: defaultCurrency,
        provider_id: '',
        category_id: '',
        rubro_id: '',
        expense_date: new Date().toISOString().split('T')[0],
        exchange_rate_override: '',
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
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
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
              Proveedor (opcional)
            </label>
            <div className="flex gap-2">
              <select
                value={formData.provider_id}
                onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
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
              Rubro (opcional)
            </label>
            <div className="flex gap-2">
              <select
                value={formData.rubro_id}
                onChange={handleRubroChange}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {rubros?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowRubroModal(true)}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Crear nuevo rubro"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria (opcional)
              {selectedRubroId && (
                <span className="ml-2 text-xs font-normal text-blue-600">filtrada por rubro</span>
              )}
            </label>
            <div className="flex gap-2">
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {filteredCategories.map((c) => (
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
              Fecha del Gasto
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
          selectedRubroId={selectedRubroId}
          rubros={rubros}
        />
        <QuickCreateRubroModal
          isOpen={showRubroModal}
          onClose={() => setShowRubroModal(false)}
          onCreated={handleRubroCreated}
        />
      </div>
    </div>
  )
}

function Expenses() {
  const navigate = useNavigate()
  const { isProjectAdmin, currencyMode, currentProject } = useProject()
  const isIndividual = currentProject?.is_individual
  const [expenses, setExpenses] = useState([])
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterProvider, setFilterProvider] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRubro, setFilterRubro] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [contributionMode, setContributionMode] = useState('both')

  useEffect(() => {
    loadData()
    loadContributionMode()
  }, [showDeleted])

  const loadContributionMode = async () => {
    try {
      const response = await dashboardAPI.summary()
      setContributionMode(response.data.contribution_mode || 'both')
    } catch (err) {
      console.error('Error loading contribution mode:', err)
    }
  }

  const handlePayClick = (expense) => {
    setSelectedExpense(expense)
    setShowPaymentModal(true)
  }

  const loadData = async () => {
    try {
      const [expensesRes, providersRes, categoriesRes, rubrosRes] = await Promise.all([
        expensesAPI.list({ include_deleted: showDeleted }),
        providersAPI.list(),
        categoriesAPI.list(),
        rubrosAPI.list(),
      ])
      setExpenses(expensesRes.data)
      setProviders(providersRes.data)
      setCategories(categoriesRes.data)
      setRubros(rubrosRes.data)
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

  const handleEditExpense = (expense) => {
    setExpenseToEdit(expense)
    setShowEditModal(true)
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (filterProvider && String(expense.provider?.id ?? '') !== filterProvider) return false
      if (filterCategory && String(expense.category?.id ?? '') !== filterCategory) return false
      if (filterRubro && String(expense.rubro?.id ?? '') !== filterRubro) return false
      if (filterDateFrom && expense.expense_date < filterDateFrom) return false
      if (filterDateTo && expense.expense_date > filterDateTo + 'T23:59:59') return false
      return true
    })
  }, [expenses, filterProvider, filterCategory, filterRubro, filterDateFrom, filterDateTo])

  const activeFilterCount = [filterProvider, filterCategory, filterRubro, filterDateFrom, filterDateTo, showDeleted ? '1' : ''].filter(Boolean).length

  const clearFilters = () => {
    setFilterProvider('')
    setFilterCategory('')
    setFilterRubro('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setShowDeleted(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Gastos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {isProjectAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              title="Nuevo Gasto"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rubro</label>
              <select
                value={filterRubro}
                onChange={(e) => setFilterRubro(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            {isProjectAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  {showDeleted ? <EyeOff size={15} /> : <Eye size={15} />}
                  Ver eliminados
                </span>
              </label>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-800 ml-auto"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin gastos</h3>
          <p className="mt-2 text-gray-500">Todavia no hay gastos registrados.</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Filter className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin resultados</h3>
          <p className="mt-2 text-gray-500">Ningun gasto coincide con los filtros aplicados.</p>
          <button onClick={clearFilters} className="mt-4 text-blue-600 hover:underline text-sm">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${expense.is_deleted ? 'opacity-50' : ''}`}
              onClick={() => navigate(`/expenses/${expense.id}`)}
            >
              {/* Fecha */}
              <div className="w-14 flex-shrink-0 text-xs text-gray-500 tabular-nums leading-tight">
                {formatDate(expense.expense_date)}
              </div>

              {/* Descripción + subtítulo */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                  {expense.description}
                  {expense.is_deleted && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                      ELIMINADO
                    </span>
                  )}
                </div>
                {(expense.category?.name || expense.provider?.name) && (
                  <div className="text-xs text-gray-400 truncate mt-0.5">
                    {[expense.category?.name, expense.provider?.name].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>

              {/* Monto */}
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-bold text-gray-900 tabular-nums">
                  {currencyMode === 'ARS'
                    ? formatCurrency(expense.amount_ars, 'ARS')
                    : formatCurrency(expense.amount_usd)}
                </div>
                {!isIndividual && (
                  <div className="text-xs text-gray-500 tabular-nums">
                    {formatCurrency(expense.my_amount_due || 0, currencyMode === 'ARS' ? 'ARS' : 'USD')}
                  </div>
                )}
              </div>

              {/* Estado + acciones */}
              <div
                className="flex-shrink-0 flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {expense.is_complete ? (
                  <CheckCircle2 size={20} className="text-green-500" title="Completo" />
                ) : expense.i_paid ? (
                  <div className="flex items-center gap-1" title={`Esperando: ${expense.paid_participants}/${expense.total_participants} pagaron`}>
                    <Check size={16} className="text-green-500" />
                    <span className="text-xs text-orange-400 font-medium tabular-nums">
                      {expense.paid_participants}/{expense.total_participants}
                    </span>
                  </div>
                ) : expense.is_pending_approval ? (
                  <Clock size={18} className="text-yellow-500" title="Pendiente de aprobación" />
                ) : contributionMode === 'current_account' ? (
                  <AlertCircle size={18} className="text-amber-400" title="Sin saldo suficiente para pagar" />
                ) : (
                  <button
                    onClick={() => handlePayClick(expense)}
                    className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Pagar
                  </button>
                )}
                {isProjectAdmin && !expense.is_deleted && (
                  <button
                    onClick={() => handleEditExpense(expense)}
                    className="hidden md:flex p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                <Search size={13} className="hidden md:block text-gray-200 ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={loadData}
        providers={providers}
        categories={categories}
        rubros={rubros}
        currencyMode={currencyMode}
      />

      <EditExpenseModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setExpenseToEdit(null)
        }}
        onUpdated={loadData}
        expense={expenseToEdit}
        providers={providers}
        categories={categories}
        rubros={rubros}
        currencyMode={currencyMode}
      />

      <PayExpenseModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedExpense(null)
        }}
        expense={selectedExpense}
        onSuccess={() => {
          setShowPaymentModal(false)
          setSelectedExpense(null)
          loadData()
        }}
        currencyMode={currencyMode}
      />
    </div>
  )
}

export default Expenses
