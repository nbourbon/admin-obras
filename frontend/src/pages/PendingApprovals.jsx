import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { paymentsAPI } from '../api/client'
import {
  CheckCircle,
  XCircle,
  Clock,
  Download,
  User,
  X,
  AlertCircle,
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RejectModal({ isOpen, onClose, onReject }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onReject(reason)
    setLoading(false)
    setReason('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Rechazar Pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: El comprobante no es legible, monto incorrecto, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
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
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Rechazando...' : 'Rechazar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PendingApprovals() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectModal, setRejectModal] = useState({ isOpen: false, paymentId: null })
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFileName, setPreviewFileName] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPaymentId, setPreviewPaymentId] = useState(null)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const response = await paymentsAPI.pendingApproval()
      setPayments(response.data)
    } catch (err) {
      console.error('Error loading pending payments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (paymentId) => {
    if (!confirm('Aprobar este pago?')) return

    try {
      setActionLoading(paymentId)
      await paymentsAPI.approve(paymentId, { approved: true })
      loadPayments()
    } catch (err) {
      console.error('Error approving payment:', err)
      alert(err.response?.data?.detail || 'Error al aprobar pago')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (paymentId, reason) => {
    try {
      setActionLoading(paymentId)
      await paymentsAPI.approve(paymentId, {
        approved: false,
        rejection_reason: reason || 'Rechazado por administrador'
      })
      loadPayments()
    } catch (err) {
      console.error('Error rejecting payment:', err)
      alert(err.response?.data?.detail || 'Error al rechazar pago')
    } finally {
      setActionLoading(null)
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
      alert('No hay comprobante disponible')
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
      alert('No hay comprobante disponible')
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Pagos Pendientes de Aprobacion</h1>
        <div className="flex items-center gap-2 text-blue-600">
          <AlertCircle size={20} />
          <span className="font-medium">{payments.length} pendientes</span>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Sin pagos pendientes de aprobacion
          </h3>
          <p className="mt-2 text-gray-500">
            Todos los pagos han sido revisados
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                      <User size={16} className="text-gray-600" />
                      <span className="font-medium text-gray-700">
                        {payment.user?.full_name || 'Usuario'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Enviado: {formatDate(payment.submitted_at)}
                    </span>
                  </div>

                  <Link
                    to={`/expenses/${payment.expense_id}`}
                    className="text-lg font-medium text-blue-600 hover:text-blue-800"
                  >
                    {payment.expense?.description}
                  </Link>

                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{payment.expense?.provider_name}</span>
                    <span>{payment.expense?.category_name}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-500">Monto informado:</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(payment.amount_paid, payment.currency_paid)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Correspondia: {formatCurrency(payment.amount_due_usd)} USD
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {payment.receipt_file_path ? (
                    <>
                      <button
                        onClick={() => handlePreviewReceipt(payment)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        <Eye size={18} />
                        Ver Comprobante
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(payment.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <Download size={18} />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400 italic">
                      Sin comprobante adjunto
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRejectModal({ isOpen: true, paymentId: payment.id })}
                    disabled={actionLoading === payment.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleApprove(payment.id)}
                    disabled={actionLoading === payment.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle size={18} />
                    {actionLoading === payment.id ? 'Procesando...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RejectModal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, paymentId: null })}
        onReject={(reason) => handleReject(rejectModal.paymentId, reason)}
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

export default PendingApprovals
