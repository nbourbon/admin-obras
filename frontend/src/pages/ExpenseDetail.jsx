import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { expensesAPI, dashboardAPI, paymentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import { ArrowLeft, FileText, Upload, CheckCircle, Clock, Download, AlertCircle, XCircle, User, Eye, Trash2 } from 'lucide-react'
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
  const [markingPaid, setMarkingPaid] = useState(null) // { paymentId, userName }
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState('USD')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadExpense()
  }, [id])

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
      const response = await expensesAPI.downloadInvoice(id)
      // Determine MIME type from file extension
      const fileName = expense?.invoice_file_path?.split('/').pop() || ''
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
      setShowPreview(true)
    } catch (err) {
      console.error('Error loading invoice:', err)
    }
  }

  const handleDownloadInvoice = async () => {
    try {
      const response = await expensesAPI.downloadInvoice(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const fileName = expense?.invoice_file_path?.split('/').pop() || `invoice-${id}.pdf`
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
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
      })
      setMarkingPaid(null)
      setPaymentAmount('')
      setPaymentCurrency('USD')
      loadExpense()
    } catch (err) {
      console.error('Error marking payment as paid:', err)
      alert('Error al marcar el pago')
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 size={18} />
            <span>Eliminar Gasto</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Informacion del Gasto</h2>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Monto Original</dt>
                <dd className="text-lg font-semibold">
                  {formatCurrency(expense.amount_original, expense.currency_original)}
                </dd>
              </div>
              {currencyMode === 'DUAL' && (
                <div>
                  <dt className="text-sm text-gray-500">Tipo de Cambio</dt>
                  <dd className="text-lg font-semibold">
                    ${expense.exchange_rate_used}
                    {expense.exchange_rate_source && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        expense.exchange_rate_source === 'manual' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {expense.exchange_rate_source === 'manual' ? 'Manual' : 'Auto'}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {(currencyMode === 'USD' || currencyMode === 'DUAL') && (
                <div>
                  <dt className="text-sm text-gray-500">Monto USD</dt>
                  <dd className="text-lg font-semibold text-blue-600">
                    {formatCurrency(expense.amount_usd)}
                  </dd>
                </div>
              )}
              {(currencyMode === 'ARS' || currencyMode === 'DUAL') && (
                <div>
                  <dt className="text-sm text-gray-500">Monto ARS</dt>
                  <dd className="text-lg font-semibold text-green-600">
                    {formatCurrency(expense.amount_ars, 'ARS')}
                  </dd>
                </div>
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
                </dd>
              </div>
            </dl>

            {/* Pagos Reales vs Estimado (DUAL mode only) */}
            {currencyMode === 'DUAL' && expense.total_actual_paid_ars != null && parseFloat(expense.total_actual_paid_ars) > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Pagos Reales vs Estimado</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Estimado ARS</dt>
                    <dd className="font-medium">{formatCurrency(expense.amount_ars, 'ARS')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Pagado Real ARS</dt>
                    <dd className="font-medium">{formatCurrency(expense.total_actual_paid_ars, 'ARS')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Diferencia</dt>
                    <dd className={`font-medium ${parseFloat(expense.total_actual_paid_ars) - parseFloat(expense.amount_ars) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(parseFloat(expense.total_actual_paid_ars) - parseFloat(expense.amount_ars)), 'ARS')}
                      {parseFloat(expense.total_actual_paid_ars) > parseFloat(expense.amount_ars) ? ' (+)' : ' (-)'}
                    </dd>
                  </div>
                </div>
              </div>
            )}
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
                        <p className="text-2xl font-bold">{formatCurrency(myPayment.amount_due_usd)}</p>
                        <p className="text-sm text-gray-500">{formatCurrency(myPayment.amount_due_ars, 'ARS')}</p>
                      </>
                    )}
                  </div>
                </div>

                {!myPayment.is_paid && !myPayment.is_pending_approval && (
                  <Link
                    to="/my-payments"
                    className="mt-4 block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Ir a Mis Pagos
                  </Link>
                )}
              </div>
            )
          })()}

          {/* Participants Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Todos los Participantes</h2>

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
                    const showMarkPaidButton = isProjectAdmin && !p.is_paid && !isMe

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
                            <p className="font-semibold text-sm">
                              {currencyMode === 'ARS'
                                ? formatCurrency(p.amount_due_ars, 'ARS')
                                : formatCurrency(p.amount_due_usd)}
                            </p>
                            {currencyMode === 'DUAL' && p.exchange_rate_at_payment && (
                              <p className="text-xs text-gray-400">TC: ${p.exchange_rate_at_payment}</p>
                            )}
                          </div>
                          {showMarkPaidButton && (
                            <button
                              onClick={() => setMarkingPaid({ paymentId: p.payment_id, userName: p.user_name, amountDue: p.amount_due_usd })}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                            >
                              Marcar Pagado
                            </button>
                          )}
                        </div>

                        {/* Inline form for marking as paid */}
                        {markingPaid?.paymentId === p.payment_id && (
                          <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm font-medium mb-3">
                              Marcar pago de <span className="text-blue-600">{markingPaid.userName}</span> como pagado
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
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Moneda</label>
                                <select
                                  value={paymentCurrency}
                                  onChange={(e) => setPaymentCurrency(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="USD">USD</option>
                                  <option value="ARS">ARS</option>
                                </select>
                              </div>
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
              ¿Estas seguro que queres eliminar este gasto? Esta accion solo se puede realizar si no hay pagos activos asociados.
              {paymentStatus && paymentStatus.paid_count > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  Atención: Este gasto tiene {paymentStatus.paid_count} pago(s) asociado(s). Los participantes deben eliminar sus pagos primero.
                </span>
              )}
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
