import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { expensesAPI, dashboardAPI, paymentsAPI, providersAPI, categoriesAPI, rubrosAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { ArrowLeft, FileText, Upload, CheckCircle, Clock, Download, AlertCircle, XCircle, User, Eye, Trash2, Edit2, X } from 'lucide-react'
import FilePreviewModal from '../components/FilePreviewModal'
import PayExpenseModal from '../components/PayExpenseModal'

function EditExpenseInlineModal({ isOpen, onClose, onSaved, expense, currencyMode }) {
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
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && expense) {
      setFormData({
        description: expense.description || '',
        amount_original: expense.amount_original || '',
        currency_original: expense.currency_original || 'USD',
        provider_id: expense.provider_id ? String(expense.provider_id) : '',
        category_id: expense.category_id ? String(expense.category_id) : '',
        rubro_id: expense.rubro_id ? String(expense.rubro_id) : '',
        expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
        exchange_rate_override: '',
      })
      setError('')
      setFetching(true)
      Promise.all([providersAPI.list(), categoriesAPI.list(), rubrosAPI.list()])
        .then(([pRes, cRes, rRes]) => {
          setProviders(pRes.data)
          setCategories(cRes.data)
          setRubros(rRes.data)
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    }
  }, [isOpen, expense])

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
        expense_date: formData.expense_date ? formData.expense_date + 'T00:00:00' : null,
      }
      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        payload.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }
      await expensesAPI.update(expense.id, payload)
      onSaved()
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
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        {fetching ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cambio (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exchange_rate_override}
                  onChange={(e) => setFormData({ ...formData, exchange_rate_override: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dejar vacio para usar TC automatico"
                />
                <p className="mt-1 text-xs text-gray-500">Si no se especifica, se usa el dolar blue actual</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
              <select
                value={formData.provider_id}
                onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rubro (opcional)</label>
              <select
                value={formData.rubro_id}
                onChange={handleRubroChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria (opcional)
                {selectedRubroId && <span className="ml-2 text-xs font-normal text-blue-600">filtrada por rubro</span>}
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin definir</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Gasto</label>
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
        )}
      </div>
    </div>
  )
}

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
    month: 'long',
    year: 'numeric',
  })
}

function ExpenseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isProjectAdmin, currencyMode } = useProject()
  const [expense, setExpense] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(null) // { paymentId, userName, amountDue }
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState('USD')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentTC, setPaymentTC] = useState('')
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [allPaidDate, setAllPaidDate] = useState('')
  const [allPaidTC, setAllPaidTC] = useState('')
  const [allPaidCurrency, setAllPaidCurrency] = useState('USD')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contributionMode, setContributionMode] = useState('both')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadExpense()
    loadContributionMode()
  }, [id])

  const loadContributionMode = async () => {
    try {
      const response = await dashboardAPI.summary()
      setContributionMode(response.data.contribution_mode || 'both')
    } catch (err) {
      console.error('Error loading contribution mode:', err)
    }
  }

  const loadExpense = async () => {
    try {
      const [expenseRes, statusRes] = await Promise.all([
        expensesAPI.get(id),
        dashboardAPI.expenseStatus(id),
      ])
      setExpense(expenseRes.data)
      setPaymentStatus(statusRes.data)
    } catch (err) {
      console.error('Error loading expense:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await expensesAPI.uploadInvoice(id, file)
      loadExpense()
    } catch (err) {
      console.error('Error uploading invoice:', err)
    } finally {
      setUploading(false)
    }
  }

  const handlePreviewInvoice = async () => {
    try {
      const fileName = expense?.invoice_file_path?.split('/').pop() || `invoice-${id}`
      const response = await expensesAPI.downloadInvoice(id)
      let mimeType = 'application/octet-stream'
      if (fileName.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf'
      else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/)) mimeType = 'image/jpeg'
      else if (fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png'
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }))
      setPreviewUrl(url)
      setShowPreview(true)
    } catch (err) {
      console.error('Error loading invoice:', err)
    }
  }

  const handleDownloadInvoice = async () => {
    try {
      const fileName = expense?.invoice_file_path?.split('/').pop() || `invoice-${id}.pdf`
      const response = await expensesAPI.downloadInvoice(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading invoice:', err)
    }
  }

  const handleMarkAsPaid = async (paymentId) => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Ingrese un monto valido')
      return
    }

    try {
      await paymentsAPI.markPaid(paymentId, {
        amount_paid: parseFloat(paymentAmount),
        currency_paid: paymentCurrency,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        exchange_rate_override: paymentTC ? parseFloat(paymentTC) : undefined,
      })
      setMarkingPaid(null)
      setPaymentAmount('')
      setPaymentCurrency('USD')
      setPaymentDate('')
      setPaymentTC('')
      loadExpense()
    } catch (err) {
      console.error('Error marking payment as paid:', err)
      alert(err.response?.data?.detail || 'Error al marcar el pago')
    }
  }

  const handleMarkAllPaid = async () => {
    try {
      await expensesAPI.markAllPaid(id, {
        payment_date: allPaidDate ? new Date(allPaidDate).toISOString() : undefined,
        exchange_rate_override: allPaidTC ? parseFloat(allPaidTC) : undefined,
        currency: currencyMode === 'DUAL' ? allPaidCurrency : undefined,
      })
      setMarkingAllPaid(false)
      setAllPaidDate('')
      setAllPaidTC('')
      setAllPaidCurrency('USD')
      loadExpense()
    } catch (err) {
      console.error('Error marking all payments as paid:', err)
      alert(err.response?.data?.detail || 'Error al marcar los pagos')
    }
  }

  const handleDeleteExpense = async () => {
    setDeleting(true)
    try {
      await expensesAPI.delete(id)
      navigate('/expenses')
    } catch (err) {
      console.error('Error deleting expense:', err)
      const errorMsg = err.response?.data?.detail || 'Error al eliminar el gasto'
      alert(errorMsg)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Gasto no encontrado</p>
        <Link to="/expenses" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a gastos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/expenses"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{expense.description}</h1>
        </div>
        {isProjectAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 size={18} />
              <span className="hidden sm:inline">Editar Gasto</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">Eliminar Gasto</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Informacion del Gasto</h2>

            <dl className="grid grid-cols-2 gap-4">
              {currencyMode === 'ARS' && (
                <div>
                  <dt className="text-sm text-gray-500">Monto ARS</dt>
                  <dd className="text-lg font-semibold text-green-600">
                    {formatCurrency(expense.amount_ars, 'ARS')}
                  </dd>
                </div>
              )}
              {currencyMode === 'USD' && (
                <div>
                  <dt className="text-sm text-gray-500">Monto USD</dt>
                  <dd className="text-lg font-semibold text-blue-600">
                    {formatCurrency(expense.amount_usd)}
                  </dd>
                </div>
              )}
              {currencyMode === 'DUAL' && (
                <>
                  <div>
                    <dt className="text-sm text-gray-500">Monto ARS</dt>
                    <dd className={`text-lg font-semibold ${expense.currency_original === 'ARS' ? 'text-green-600' : 'text-gray-500'}`}>
                      {formatCurrency(expense.amount_ars, 'ARS')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Monto USD</dt>
                    <dd className={`text-lg font-semibold ${expense.currency_original === 'USD' ? 'text-blue-600' : 'text-gray-500'}`}>
                      {formatCurrency(expense.amount_usd)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500 mb-1">Pagado en</dt>
                    <dd>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                        expense.currency_original === 'ARS'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {expense.currency_original === 'ARS' ? '🟢 ARS' : '🔵 USD'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        El monto en {expense.currency_original} es exacto. El otro es su equivalente al TC del momento.
                      </p>
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm text-gray-500">Proveedor</dt>
                <dd className="font-medium">{expense.provider?.name || 'Sin definir'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Categoria</dt>
                <dd className="font-medium">{expense.category?.name || 'Sin definir'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Rubro</dt>
                <dd className="font-medium">{expense.rubro?.name || 'Sin definir'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Fecha</dt>
                <dd className="font-medium">{formatDate(expense.expense_date)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Estado</dt>
                <dd>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    expense.status === 'paid' ? 'bg-green-100 text-green-700' :
                    expense.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {expense.status === 'paid' ? 'Pagado' :
                     expense.status === 'partial' ? 'Parcial' : 'Pendiente'}
                  </span>
                  {expense.status === 'paid' && paymentStatus?.participants && (() => {
                    // Check if all payments were auto-paid from balance (no receipts)
                    const allPaid = paymentStatus.participants.every(p => p.is_paid)
                    const anyReceipt = paymentStatus.participants.some(p => p.receipt_file_path)
                    if (allPaid && !anyReceipt) {
                      return (
                        <div className="mt-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          💰 Pagado desde Saldo Cta Corriente
                        </div>
                      )
                    }
                  })()}
                </dd>
              </div>
            </dl>

          </div>

          {/* Invoice */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Factura</h2>

            {expense.invoice_file_path ? (
              <div className="flex items-center gap-4">
                <FileText className="text-gray-400" size={40} />
                <div className="flex-1">
                  <p className="font-medium">Factura adjunta</p>
                  <p className="text-sm text-gray-500">{expense.invoice_file_path.split('/').pop()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviewInvoice}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Eye size={20} />
                    Ver
                  </button>
                  <button
                    onClick={handleDownloadInvoice}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            ) : user?.is_admin ? (
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                <Upload className="text-gray-400 mb-2" size={32} />
                <span className="text-gray-600">
                  {uploading ? 'Subiendo...' : 'Click para subir factura'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInvoiceUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            ) : (
              <p className="text-gray-500 text-center py-4">
                Sin factura adjunta
              </p>
            )}
          </div>
        </div>

        {/* My Payment Status */}
        <div className="space-y-6">
          {paymentStatus && (() => {
            const myPayment = paymentStatus.participants?.find(p => p.user_id === user?.id)
            if (!myPayment) return null

            const getStatusConfig = () => {
              if (myPayment.is_paid) {
                return {
                  bg: 'bg-green-50 border-green-200',
                  icon: <CheckCircle className="text-green-600" size={24} />,
                  title: 'Pagado',
                  subtitle: `Aprobado el ${formatDate(myPayment.paid_at)}`,
                  textColor: 'text-green-700'
                }
              }
              if (myPayment.is_pending_approval) {
                return {
                  bg: 'bg-blue-50 border-blue-200',
                  icon: <AlertCircle className="text-blue-600" size={24} />,
                  title: 'En Revision',
                  subtitle: `Enviado el ${formatDate(myPayment.submitted_at)}`,
                  textColor: 'text-blue-700'
                }
              }
              if (myPayment.rejection_reason) {
                return {
                  bg: 'bg-red-50 border-red-200',
                  icon: <XCircle className="text-red-600" size={24} />,
                  title: 'Rechazado',
                  subtitle: myPayment.rejection_reason,
                  textColor: 'text-red-700'
                }
              }
              return {
                bg: 'bg-yellow-50 border-yellow-200',
                icon: <Clock className="text-yellow-600" size={24} />,
                title: 'Pendiente',
                subtitle: 'Aun no has enviado tu pago',
                textColor: 'text-yellow-700'
              }
            }

            const status = getStatusConfig()

            return (
              <div className={`rounded-xl border-2 p-6 ${status.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <User size={18} className="text-gray-600" />
                  <h2 className="text-lg font-semibold">Mi Parte</h2>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {status.icon}
                    <div>
                      <p className={`font-semibold ${status.textColor}`}>{status.title}</p>
                      <p className="text-sm text-gray-600">{status.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {currencyMode === 'ARS' ? (
                      <p className="text-2xl font-bold">{formatCurrency(myPayment.amount_due_ars, 'ARS')}</p>
                    ) : currencyMode === 'USD' ? (
                      <p className="text-2xl font-bold">{formatCurrency(myPayment.amount_due_usd)}</p>
                    ) : (
                      <>
                        <p className={`text-2xl font-bold ${expense.currency_original === 'ARS' ? 'text-green-600' : 'text-gray-400 text-lg'}`}>
                          {formatCurrency(myPayment.amount_due_ars, 'ARS')}
                        </p>
                        <p className={`${expense.currency_original === 'USD' ? 'text-blue-600 font-bold text-xl' : 'text-sm text-gray-400'}`}>
                          {formatCurrency(myPayment.amount_due_usd)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {!myPayment.is_paid && !myPayment.is_pending_approval && (
                  contributionMode === 'current_account' ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>Se pagará automáticamente cuando haya saldo suficiente de aportes</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowPayModal(true)}
                      className="mt-4 block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Pagar
                    </button>
                  )
                )}
              </div>
            )
          })()}

          {/* Participants Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Todos los Participantes</h2>
              {/* Hide "Mark all paid" button in current_account mode */}
              {isProjectAdmin && paymentStatus?.pending_count > 0 && !markingAllPaid && contributionMode !== 'current_account' && (
                <button
                  onClick={() => {
                    setMarkingAllPaid(true)
                    setAllPaidDate(new Date().toISOString().split('T')[0])
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Marcar todos pagados
                </button>
              )}
            </div>

            {/* Mark all paid form */}
            {markingAllPaid && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800 mb-3">
                  Registrar todos los pagos pendientes
                </p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Fecha de Pago</label>
                    <input
                      type="date"
                      value={allPaidDate}
                      onChange={(e) => setAllPaidDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  {currencyMode === 'DUAL' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Moneda</label>
                      <select
                        value={allPaidCurrency}
                        onChange={(e) => setAllPaidCurrency(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </div>
                  )}
                  {currencyMode === 'DUAL' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">TC manual (opcional)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={allPaidTC}
                        onChange={(e) => setAllPaidTC(e.target.value)}
                        placeholder="Auto (bluelytics)"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Se usará el monto adeudado de cada participante como monto pagado.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkAllPaid}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setMarkingAllPaid(false)
                      setAllPaidDate('')
                      setAllPaidTC('')
                      setAllPaidCurrency('USD')
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {paymentStatus && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Completados</span>
                  <span className="font-medium text-green-600">
                    {paymentStatus.paid_count} de {paymentStatus.paid_count + paymentStatus.pending_count}
                  </span>
                </div>

                <div className="space-y-2">
                  {paymentStatus.participants?.map((p) => {
                    const isMe = p.user_id === user?.id

                    const getParticipantStyle = () => {
                      if (p.is_paid) {
                        return {
                          bg: 'bg-green-50',
                          icon: <CheckCircle className="text-green-600 flex-shrink-0" size={18} />,
                          status: 'Pagado'
                        }
                      }
                      if (p.is_pending_approval) {
                        return {
                          bg: 'bg-blue-50',
                          icon: <AlertCircle className="text-blue-600 flex-shrink-0" size={18} />,
                          status: 'En revision'
                        }
                      }
                      if (p.rejection_reason) {
                        return {
                          bg: 'bg-red-50',
                          icon: <XCircle className="text-red-600 flex-shrink-0" size={18} />,
                          status: 'Rechazado'
                        }
                      }
                      return {
                        bg: 'bg-yellow-50',
                        icon: <Clock className="text-yellow-600 flex-shrink-0" size={18} />,
                        status: 'Pendiente'
                      }
                    }

                    const style = getParticipantStyle()
                    // Hide mark paid button in current_account mode (payments must come from balance)
                    const showMarkPaidButton = isProjectAdmin && !p.is_paid && !p.is_pending_approval && contributionMode !== 'current_account'

                    return (
                      <div key={p.user_id}>
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg ${style.bg} ${isMe ? 'ring-2 ring-blue-400' : ''}`}
                        >
                          {style.icon}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {p.user_name}
                              {isMe && <span className="ml-2 text-xs text-blue-600">(Tu)</span>}
                            </p>
                            <p className="text-xs text-gray-500">{style.status}</p>
                          </div>
                          <div className="text-right">
                            {currencyMode === 'ARS' ? (
                              <p className="font-semibold text-sm">{formatCurrency(p.amount_due_ars, 'ARS')}</p>
                            ) : currencyMode === 'USD' ? (
                              <p className="font-semibold text-sm">{formatCurrency(p.amount_due_usd)}</p>
                            ) : (
                              <>
                                <p className={`font-semibold text-sm ${expense.currency_original === 'ARS' ? 'text-green-600' : 'text-gray-400'}`}>
                                  {formatCurrency(p.amount_due_ars, 'ARS')}
                                </p>
                                <p className={`text-xs ${expense.currency_original === 'USD' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                                  {formatCurrency(p.amount_due_usd)}
                                </p>
                              </>
                            )}
                          </div>
                          {showMarkPaidButton && (
                            <button
                              onClick={() => {
                                const amountDue = currencyMode === 'ARS' ? p.amount_due_ars : p.amount_due_usd
                                const defaultCurrency = currencyMode === 'ARS' ? 'ARS' : 'USD'
                                setMarkingPaid({ paymentId: p.payment_id, userName: p.user_name, amountDue })
                                setPaymentAmount(amountDue?.toString() || '')
                                setPaymentCurrency(defaultCurrency)
                                setPaymentDate(new Date().toISOString().split('T')[0])
                                setPaymentTC('')
                              }}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                            >
                              Registrar pago
                            </button>
                          )}
                        </div>

                        {/* Inline form for marking as paid */}
                        {markingPaid?.paymentId === p.payment_id && (
                          <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm font-medium mb-3">
                              Registrar pago de <span className="text-green-700">{markingPaid.userName}</span>
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Monto Pagado</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                  placeholder={markingPaid.amountDue?.toString()}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                              {currencyMode !== 'ARS' && currencyMode !== 'USD' && (
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Moneda</label>
                                  <select
                                    value={paymentCurrency}
                                    onChange={(e) => setPaymentCurrency(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                  >
                                    <option value="USD">USD</option>
                                    <option value="ARS">ARS</option>
                                  </select>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Fecha de Pago</label>
                                <input
                                  type="date"
                                  value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                              {currencyMode === 'DUAL' && (
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">TC manual (opcional)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={paymentTC}
                                    onChange={(e) => setPaymentTC(e.target.value)}
                                    placeholder="Auto (bluelytics)"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleMarkAsPaid(markingPaid.paymentId)}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                              >
                                Confirmar Pago
                              </button>
                              <button
                                onClick={() => {
                                  setMarkingPaid(null)
                                  setPaymentAmount('')
                                  setPaymentCurrency('USD')
                                  setPaymentDate('')
                                  setPaymentTC('')
                                }}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Eliminacion</h2>
            <p className="text-gray-600 mb-6">
              ¿Estas seguro que queres eliminar este gasto? Los pagos sin comprobante se eliminaran automaticamente. Solo bloqueara si algun participante subio un comprobante propio.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteExpense}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <EditExpenseInlineModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={loadExpense}
        expense={expense}
        currencyMode={currencyMode}
      />

      <PayExpenseModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        expense={expense}
        onSuccess={loadExpense}
        currencyMode={currencyMode}
      />

      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false)
          if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
          }
        }}
        fileUrl={previewUrl}
        fileName={expense?.invoice_file_path?.split('/').pop()}
        onDownload={handleDownloadInvoice}
      />
    </div>
  )
}

export default ExpenseDetail
