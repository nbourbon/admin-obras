import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { paymentsAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import {
  CreditCard,
  CheckCircle,
  Clock,
  Upload,
  Download,
  X,
  AlertCircle,
  XCircle,
  Eye,
  Trash2,
  Filter,
  ChevronDown
} from 'lucide-react'
import FilePreviewModal from '../components/FilePreviewModal'

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

function PaymentStatusBadge({ payment }) {
  if (payment.is_paid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle size={14} />
        Pagado
      </span>
    )
  }
  if (payment.is_pending_approval) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <AlertCircle size={14} />
        En Revision
      </span>
    )
  }
  if (payment.rejection_reason) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={14} />
        Rechazado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
      <Clock size={14} />
      Pendiente
    </span>
  )
}

function SubmitPaymentModal({ isOpen, onClose, payment, onSuccess, isIndividual = false, currencyMode = 'DUAL' }) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0], // Default to today
    exchange_rate_override: '',
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (payment) {
      setFormData({
        payment_date: new Date().toISOString().split('T')[0],
        exchange_rate_override: '',
      })
      setReceiptFile(null)
    }
  }, [payment])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Determine amount and currency based on currency mode
      let amountPaid, currencyPaid
      if (currencyMode === 'ARS') {
        amountPaid = payment.amount_due_ars
        currencyPaid = 'ARS'
      } else {
        amountPaid = payment.amount_due_usd
        currencyPaid = 'USD'
      }

      const submitData = {
        amount_paid: amountPaid,
        currency_paid: currencyPaid,
        payment_date: formData.payment_date ? new Date(formData.payment_date).toISOString() : null,
      }

      // Include exchange rate override for DUAL mode
      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        submitData.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }

      // Submit payment
      await paymentsAPI.submitPayment(payment.id, submitData)

      // Upload receipt if provided
      if (receiptFile) {
        try {
          await paymentsAPI.uploadReceipt(payment.id, receiptFile)
        } catch (uploadErr) {
          console.error('Error uploading receipt:', uploadErr)
          // Don't fail the whole operation
        }
      }

      onSuccess()
      onClose()
      setReceiptFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar pago')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !payment) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Enviar Pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {!isIndividual && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-600 flex items-center gap-2">
              <AlertCircle size={16} />
              El pago sera revisado por un administrador antes de confirmarse
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
          <p className="text-xs sm:text-sm text-gray-500">Gasto</p>
          <p className="font-medium text-sm sm:text-base break-words">{payment.expense?.description}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Monto que te corresponde</p>
          <p className="font-semibold text-blue-600 text-sm sm:text-base">
            {currencyMode === 'ARS'
              ? formatCurrency(payment.amount_due_ars, 'ARS')
              : currencyMode === 'USD'
              ? formatCurrency(payment.amount_due_usd)
              : `${formatCurrency(payment.amount_due_usd)} / ${formatCurrency(payment.amount_due_ars, 'ARS')}`
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Fecha del Pago
            </label>
            <input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {currencyMode === 'DUAL' && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Tipo de Cambio al momento de pagar (opcional)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.exchange_rate_override}
                onChange={(e) => setFormData({ ...formData, exchange_rate_override: e.target.value })}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dejar vacio para usar TC automatico"
              />
              <p className="mt-1 text-xs text-gray-500">
                Si no se especifica, se registra el dolar blue actual
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Comprobante de pago (opcional)
            </label>
            {receiptFile ? (
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
                <span className="flex-1 text-xs sm:text-sm text-green-700 truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="text-red-500 hover:text-red-700 flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col sm:flex-row items-center justify-center gap-2 p-3 sm:p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="text-gray-400 flex-shrink-0" size={20} />
                <span className="text-gray-600 text-xs sm:text-sm text-center">Click para subir comprobante</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1">PDF, JPG o PNG</p>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar para Aprobacion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MyPayments() {
  const { currentProject, currencyMode } = useProject()
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'pending_approval', 'paid'
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFileName, setPreviewFileName] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPaymentId, setPreviewPaymentId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const isIndividual = currentProject?.is_individual || false

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      setLoading(true)
      // Load ALL payments at once
      const response = await paymentsAPI.myPayments(false)
      setAllPayments(response.data)
    } catch (err) {
      console.error('Error loading payments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = (payment) => {
    setSelectedPayment(payment)
    setShowModal(true)
  }

  const handleUnmarkPaid = async (paymentId) => {
    if (!confirm('Desmarcar este pago?')) return

    try {
      await paymentsAPI.unmarkPaid(paymentId)
      loadPayments()
    } catch (err) {
      console.error('Error unmarking payment:', err)
    }
  }

  const handleUploadReceipt = async (paymentId, file) => {
    try {
      await paymentsAPI.uploadReceipt(paymentId, file)
      loadPayments()
    } catch (err) {
      console.error('Error uploading receipt:', err)
    }
  }

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return

    setDeleting(true)
    try {
      await paymentsAPI.delete(paymentToDelete.id)
      setShowDeleteConfirm(false)
      setPaymentToDelete(null)
      loadPayments()
    } catch (err) {
      console.error('Error deleting payment:', err)
      const errorMsg = err.response?.data?.detail || 'Error al eliminar el pago'
      alert(errorMsg)
    } finally {
      setDeleting(false)
    }
  }

  const handlePreviewReceipt = async (payment) => {
    try {
      const filePath = payment.receipt_file_path || ''
      const fileName = filePath.split('/').pop() || `comprobante-${payment.id}`

      // Cloudinary URL — open directly without auth headers
      if (filePath.startsWith('http')) {
        setPreviewUrl(filePath)
        setPreviewFileName(fileName)
        setPreviewPaymentId(payment.id)
        setShowPreview(true)
        return
      }

      // Local file — download as blob
      const response = await paymentsAPI.downloadReceipt(payment.id)
      let mimeType = 'application/octet-stream'
      if (fileName.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf'
      else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/)) mimeType = 'image/jpeg'
      else if (fileName.toLowerCase().endsWith('.png')) mimeType = 'image/png'
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }))
      setPreviewUrl(url)
      setPreviewFileName(fileName)
      setPreviewPaymentId(payment.id)
      setShowPreview(true)
    } catch (err) {
      console.error('Error loading receipt:', err)
    }
  }

  const handleDownloadReceipt = async (paymentId, filePath) => {
    try {
      const fp = filePath || ''
      const fileName = fp.split('/').pop() || `comprobante-${paymentId}`

      // Cloudinary URL — open in new tab directly
      if (fp.startsWith('http')) {
        const link = document.createElement('a')
        link.href = fp
        link.setAttribute('download', fileName)
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        link.remove()
        return
      }

      // Local file — blob download
      const response = await paymentsAPI.downloadReceipt(paymentId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading receipt:', err)
    }
  }

  // Sort all payments by date (most recent first)
  const sortedPayments = useMemo(() => {
    return [...allPayments].sort((a, b) => {
      const dateA = new Date(a.expense?.expense_date || 0)
      const dateB = new Date(b.expense?.expense_date || 0)
      return dateB - dateA // Descending order
    })
  }, [allPayments])

  // Calculate filtered categories
  const pendingPayments = useMemo(() =>
    sortedPayments.filter(p => !p.is_paid && !p.is_pending_approval && !p.rejection_reason),
    [sortedPayments]
  )
  const pendingApprovalPayments = useMemo(() =>
    sortedPayments.filter(p => p.is_pending_approval),
    [sortedPayments]
  )
  const paidPayments = useMemo(() =>
    sortedPayments.filter(p => p.is_paid),
    [sortedPayments]
  )

  // Apply filter to display
  const displayPayments = useMemo(() => {
    let base = sortedPayments
    if (filter === 'pending') base = pendingPayments
    else if (filter === 'pending_approval') base = pendingApprovalPayments
    else if (filter === 'paid') base = paidPayments

    return base.filter((payment) => {
      const date = payment.expense?.expense_date
      if (filterDateFrom && date && date < filterDateFrom) return false
      if (filterDateTo && date && date > filterDateTo + 'T23:59:59') return false
      return true
    })
  }, [filter, sortedPayments, pendingPayments, pendingApprovalPayments, paidPayments, filterDateFrom, filterDateTo])

  const activeDateFilters = [filterDateFrom, filterDateTo].filter(Boolean).length

  const clearDateFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Todos ({sortedPayments.length})</option>
            <option value="pending">Pendientes ({pendingPayments.length})</option>
            {!isIndividual && <option value="pending_approval">En Revision ({pendingApprovalPayments.length})</option>}
            <option value="paid">Pagados ({paidPayments.length})</option>
          </select>

          {/* Date filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter size={16} />
            Fecha
            {activeDateFilters > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {activeDateFilters}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-2 gap-3">
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
          {activeDateFilters > 0 && (
            <button onClick={clearDateFilters} className="mt-2 text-sm text-red-600 hover:text-red-800">
              Limpiar fechas
            </button>
          )}
        </div>
      )}

      {/* Payments List */}
      {displayPayments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {filter === 'all' ? 'Sin pagos' :
             filter === 'pending' ? 'Sin pagos pendientes' :
             filter === 'pending_approval' ? 'Sin pagos en revision' :
             'Sin pagos realizados'}
          </h3>
        </div>
      ) : (
        <div className="space-y-4">
          {displayPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      to={`/expenses/${payment.expense_id}`}
                      className="text-lg font-medium text-blue-600 hover:text-blue-800"
                    >
                      {payment.expense?.description}
                    </Link>
                    <PaymentStatusBadge payment={payment} />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{payment.expense?.provider_name || 'Sin definir'}</span>
                    <span>{payment.expense?.category_name || 'Sin definir'}</span>
                    <span>{formatDate(payment.expense?.expense_date)}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {currencyMode === 'ARS' ? (
                    <p className="text-lg font-bold">{formatCurrency(payment.amount_due_ars, 'ARS')}</p>
                  ) : currencyMode === 'USD' ? (
                    <p className="text-lg font-bold">{formatCurrency(payment.amount_due_usd)}</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold">{formatCurrency(payment.amount_due_usd)}</p>
                      <p className="text-sm text-gray-500">{formatCurrency(payment.amount_due_ars, 'ARS')}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Status */}
              <div className="mt-4 flex items-center justify-between">
                {payment.is_paid ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={18} />
                      <span className="font-medium text-sm">
                        {formatDate(payment.approved_at || payment.paid_at)}
                      </span>
                    </div>
                  </>
                ) : payment.is_pending_approval ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-blue-600">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span className="font-medium text-sm">En revision</span>
                      </div>
                      <span className="text-xs sm:text-sm text-blue-500 ml-7 sm:ml-0">
                        {formatDate(payment.submitted_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {formatCurrency(payment.amount_paid, payment.currency_paid)}
                      </span>
                      <button
                        onClick={() => handleUnmarkPaid(payment.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          setPaymentToDelete(payment)
                          setShowDeleteConfirm(true)
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                        title="Eliminar pago"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                ) : payment.rejection_reason ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle size={20} />
                        <span className="font-medium">Rechazado</span>
                      </div>
                      <p className="text-sm text-red-500 ml-7">{payment.rejection_reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMarkPaid(payment)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Enviar nuevamente
                      </button>
                      <button
                        onClick={() => {
                          setPaymentToDelete(payment)
                          setShowDeleteConfirm(true)
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                        title="Eliminar pago"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-yellow-600">
                      <Clock size={20} />
                      <span className="font-medium">Pendiente de pago</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMarkPaid(payment)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Enviar pago
                      </button>
                      <button
                        onClick={() => {
                          setPaymentToDelete(payment)
                          setShowDeleteConfirm(true)
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                        title="Eliminar pago"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Receipt Section - visible for all states except pending */}
              {(payment.is_paid || payment.is_pending_approval) && (
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-sm text-gray-500">Comprobante:</span>
                  <div className="flex items-center gap-2">
                    {payment.receipt_file_path ? (
                      <>
                        <button
                          onClick={() => handlePreviewReceipt(payment)}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        >
                          <Eye size={16} />
                          Ver
                        </button>
                        <button
                          onClick={() => handleDownloadReceipt(payment.id, payment.receipt_file_path)}
                          className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          <Download size={16} />
                        </button>
                        <label className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer">
                          <Upload size={16} />
                          Cambiar
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUploadReceipt(payment.id, e.target.files[0])
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </>
                    ) : (
                      <label className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer">
                        <Upload size={16} />
                        Subir comprobante
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadReceipt(payment.id, e.target.files[0])
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <SubmitPaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        payment={selectedPayment}
        onSuccess={loadPayments}
        isIndividual={isIndividual}
        currencyMode={currencyMode}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && paymentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirmar Eliminacion de Pago</h2>
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Estas por eliminar el pago de <span className="font-semibold">{paymentToDelete.expense?.description}</span>.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm font-medium mb-2">⚠️ Importante:</p>
                <p className="text-yellow-700 text-sm">
                  Este pago se eliminara del registro de pagos. Esta accion solo se debe hacer si:
                </p>
                <ul className="list-disc list-inside text-yellow-700 text-sm mt-2 space-y-1">
                  <li>Se te asigno el pago por error</li>
                  <li>Ya coordinaste con el administrador la devolucion del pago</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePayment}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar Pago'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setPaymentToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <FilePreviewModal
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false)
          if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
          }
          setPreviewFileName(null)
          setPreviewPaymentId(null)
        }}
        fileUrl={previewUrl}
        fileName={previewFileName}
        onDownload={() => previewPaymentId && handleDownloadReceipt(previewPaymentId, previewUrl)}
      />
    </div>
  )
}

export default MyPayments
