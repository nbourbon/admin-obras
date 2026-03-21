import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { paymentsAPI, contributionsAPI } from '../api/client'
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
  const [rejectModal, setRejectModal] = useState({ isOpen: false, paymentId: null, isContribution: false })
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFileName, setPreviewFileName] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewPaymentId, setPreviewPaymentId] = useState(null)
  const [previewIsContribution, setPreviewIsContribution] = useState(false)

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

  const handleApprove = async (payment) => {
    if (!confirm('Aprobar este pago?')) return

    const isContribution = !payment.expense_id
    try {
      setActionLoading(payment.id)
      if (isContribution) {
        await contributionsAPI.approvePayment(payment.id, { approved: true })
      } else {
        await paymentsAPI.approve(payment.id, { approved: true })
      }
      loadPayments()
    } catch (err) {
      console.error('Error approving payment:', err)
      alert(err.response?.data?.detail || 'Error al aprobar pago')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (paymentId, isContribution, reason) => {
    try {
      setActionLoading(paymentId)
      const data = { approved: false, rejection_reason: reason || 'Rechazado por administrador' }
      if (isContribution) {
        await contributionsAPI.approvePayment(paymentId, data)
      } else {
        await paymentsAPI.approve(paymentId, data)
      }
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
      const isContribution = !payment.expense_id
      const response = isContribution
        ? await contributionsAPI.downloadReceipt(payment.id)
        : await paymentsAPI.downloadReceipt(payment.id)
      // response.data is already a Blob with correct MIME type from backend
      let fileName = payment.receipt_file_path?.split('/').pop() || `comprobante-${payment.id}`
      if (response.data.type === 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
        fileName = `${fileName}.pdf`
      }
      const url = window.URL.createObjectURL(response.data)
      setPreviewUrl(url)
      setPreviewFileName(fileName)
      setPreviewPaymentId(payment.id)
      setPreviewIsContribution(!payment.expense_id)
      setShowPreview(true)
    } catch (err) {
      console.error('Error loading receipt:', err)
      alert('No hay comprobante disponible')
    }
  }

  const handleDownloadReceipt = async (paymentId, isContribution = false) => {
    try {
      const response = isContribution
        ? await contributionsAPI.downloadReceipt(paymentId)
        : await paymentsAPI.downloadReceipt(paymentId)
      // response.data is already a Blob with correct MIME type from backend
      let fileName = `comprobante-${paymentId}`
      if (response.data.type === 'application/pdf') {
        fileName = `${fileName}.pdf`
      }
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
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
              className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border-l-4 border-blue-500"
            >
              {/* Layout: Mobile = vertical, Desktop = horizontal with amount on right */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                {/* Left side: User, Date, Description */}
                <div className="flex-1 flex flex-col gap-3">
                  {/* Header: User + Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full w-fit">
                      <User size={16} className="text-gray-600" />
                      <span className="font-medium text-gray-700 text-sm">
                        {payment.user?.full_name || 'Usuario'}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">
                      Enviado: {formatDate(payment.submitted_at)}
                    </span>
                  </div>

                  {/* Description */}
                  <div>
                    {payment.expense_id ? (
                      <Link
                        to={`/expenses/${payment.expense_id}`}
                        className="text-base sm:text-lg font-medium text-blue-600 hover:text-blue-800"
                      >
                        {payment.expense?.description}
                      </Link>
                    ) : (
                      <span className="text-base sm:text-lg font-medium text-purple-700">
                        {payment.expense?.description || '[APORTE]'}
                      </span>
                    )}
                    {(payment.expense?.provider_name || payment.expense?.category_name) && (
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-gray-500">
                        {payment.expense?.provider_name && <span>{payment.expense.provider_name}</span>}
                        {payment.expense?.category_name && <span>• {payment.expense.category_name}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Amount (inline on desktop, below on mobile) */}
                <div className="bg-gray-50 rounded-lg p-3 lg:bg-transparent lg:p-0 lg:text-right lg:min-w-[200px]">
                  <p className="text-xs text-gray-500 lg:text-gray-400">Monto informado:</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">
                    {formatCurrency(payment.amount_paid, payment.currency_paid)}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Correspondia: {formatCurrency(payment.amount_due_usd)} USD
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-4 border-t flex flex-col gap-3">
                {/* Receipt buttons */}
                <div className="flex items-center gap-2">
                  {payment.receipt_file_path ? (
                    <>
                      <button
                        onClick={() => handlePreviewReceipt(payment)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                      >
                        <Eye size={18} />
                        Ver Comprobante
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(payment.id, !payment.expense_id)}
                        className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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

                {/* Approve/Reject buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRejectModal({ isOpen: true, paymentId: payment.id, isContribution: !payment.expense_id })}
                    disabled={actionLoading === payment.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm"
                  >
                    <XCircle size={18} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleApprove(payment)}
                    disabled={actionLoading === payment.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
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
        onClose={() => setRejectModal({ isOpen: false, paymentId: null, isContribution: false })}
        onReject={(reason) => handleReject(rejectModal.paymentId, rejectModal.isContribution, reason)}
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
          setPreviewIsContribution(false)
        }}
        fileUrl={previewUrl}
        fileName={previewFileName}
        onDownload={() => previewPaymentId && handleDownloadReceipt(previewPaymentId, previewIsContribution)}
      />
    </div>
  )
}

export default PendingApprovals
