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
  Eye
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
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

function SubmitPaymentModal({ isOpen, onClose, payment, onSuccess, isIndividual = false }) {
  const [formData, setFormData] = useState({
    amount_paid: '',
    currency_paid: 'USD',
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (payment) {
      setFormData({
        amount_paid: payment.amount_due_usd,
        currency_paid: 'USD',
      })
      setReceiptFile(null)
    }
  }, [payment])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Submit payment first
      await paymentsAPI.submitPayment(payment.id, {
        amount_paid: parseFloat(formData.amount_paid),
        currency_paid: formData.currency_paid,
      })

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
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

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-500">Gasto</p>
          <p className="font-medium">{payment.expense?.description}</p>
          <p className="text-sm text-gray-500 mt-2">Monto que te corresponde</p>
          <p className="font-semibold text-blue-600">
            {formatCurrency(payment.amount_due_usd)} / {formatCurrency(payment.amount_due_ars, 'ARS')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto Pagado
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount_paid}
                onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moneda
              </label>
              <select
                value={formData.currency_paid}
                onChange={(e) => setFormData({ ...formData, currency_paid: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante de pago (opcional)
            </label>
            {receiptFile ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <span className="flex-1 text-sm text-green-700 truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="text-gray-400" size={20} />
                <span className="text-gray-600 text-sm">Click para subir comprobante</span>
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
              {loading ? 'Enviando...' : 'Enviar para Aprobacion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MyPayments() {
  const { currentProject } = useProject()
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'pending', 'pending_approval', 'paid'
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFileName, setPreviewFileName] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPaymentId, setPreviewPaymentId] = useState(null)

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

  const handlePreviewReceipt = async (payment) => {
    try {
      const response = await paymentsAPI.downloadReceipt(payment.id)
      // Determine MIME type from file extension
      const fileName = payment.receipt_file_path?.split('/').pop() || ''
      let mimeType = 'application/octet-stream'
      if (fileName.toLowerCase().endsWith('.pdf')) {
        mimeType = 'application/pdf'
      } else if (fileName.toLowerCase().match(/\.(jpg|jpeg)$/)) {
        mimeType = 'image/jpeg'
      } else if (fileName.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png'
      }
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }))
      setPreviewUrl(url)
      setPreviewFileName(fileName || `comprobante-${payment.id}`)
      setPreviewPaymentId(payment.id)
      setShowPreview(true)
    } catch (err) {
      console.error('Error loading receipt:', err)
    }
  }

  const handleDownloadReceipt = async (paymentId) => {
    try {
      const response = await paymentsAPI.downloadReceipt(paymentId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `comprobante-${paymentId}`)
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
    if (filter === 'pending') return pendingPayments
    if (filter === 'pending_approval') return pendingApprovalPayments
    if (filter === 'paid') return paidPayments
    return sortedPayments // 'all' - show everything
  }, [filter, sortedPayments, pendingPayments, pendingApprovalPayments, paidPayments])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Mis Pagos</h1>

        {/* Simple filter dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Filtrar:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Todos ({sortedPayments.length})</option>
            <option value="pending">Pendientes ({pendingPayments.length})</option>
            {!isIndividual && <option value="pending_approval">En Revision ({pendingApprovalPayments.length})</option>}
            <option value="paid">Pagados ({paidPayments.length})</option>
          </select>
        </div>
      </div>

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
                    <span>{payment.expense?.provider_name}</span>
                    <span>{payment.expense?.category_name}</span>
                    <span>{formatDate(payment.expense?.expense_date)}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold">
                    {formatCurrency(payment.amount_due_usd)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(payment.amount_due_ars, 'ARS')}
                  </p>
                </div>
              </div>

              {/* Payment Status */}
              <div className="mt-4 flex items-center justify-between">
                {payment.is_paid ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={20} />
                      <span className="font-medium">
                        Aprobado el {formatDate(payment.approved_at || payment.paid_at)}
                      </span>
                    </div>
                  </>
                ) : payment.is_pending_approval ? (
                  <>
                    <div className="flex items-center gap-2 text-blue-600">
                      <AlertCircle size={20} />
                      <span className="font-medium">
                        Enviado el {formatDate(payment.submitted_at)} - En revision
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
                    <button
                      onClick={() => handleMarkPaid(payment)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Enviar nuevamente
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-yellow-600">
                      <Clock size={20} />
                      <span className="font-medium">Pendiente de pago</span>
                    </div>
                    <button
                      onClick={() => handleMarkPaid(payment)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Enviar pago
                    </button>
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
                          onClick={() => handleDownloadReceipt(payment.id)}
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
      />

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
        onDownload={() => previewPaymentId && handleDownloadReceipt(previewPaymentId)}
      />
    </div>
  )
}

export default MyPayments
