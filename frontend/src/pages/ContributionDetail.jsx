import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { contributionsAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Coins, ArrowLeft, User, Check, X, Users, CheckCircle2, FileText, Download, ArrowUpCircle, CheckSquare } from 'lucide-react'

function formatCurrency(amount, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

export default function ContributionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isProjectAdmin } = useProject()
  const [contribution, setContribution] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markingPaid, setMarkingPaid] = useState(null)

  useEffect(() => {
    loadContribution()
  }, [id])

  const loadContribution = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await contributionsAPI.get(id)
      setContribution(response.data)
    } catch (err) {
      console.error('Error loading contribution:', err)
      setError(err.response?.data?.detail || 'Error al cargar el aporte')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReceipt = async (paymentId) => {
    try {
      const response = await contributionsAPI.downloadReceipt(paymentId)
      // response.data is already a Blob with correct MIME type from backend
      let fileName = `recibo_aporte_${paymentId}`
      if (response.data.type === 'application/pdf') {
        fileName = `${fileName}.pdf`
      } else if (response.data.type?.startsWith('image/')) {
        const ext = response.data.type === 'image/png' ? '.png' : '.jpg'
        fileName = `${fileName}${ext}`
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
      alert('Error al descargar el comprobante')
    }
  }

  const handleMarkPaid = async (paymentId) => {
    if (!confirm('¿Marcar este aporte como pagado?')) return
    
    setMarkingPaid(paymentId)
    try {
      await contributionsAPI.markPaid(paymentId, {
        payment_date: new Date().toISOString(),
      })
      await loadContribution()
    } catch (err) {
      console.error('Error marking payment as paid:', err)
      alert(err.response?.data?.detail || 'Error al marcar como pagado')
    } finally {
      setMarkingPaid(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !contribution) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Aporte no encontrado'}
        </div>
        <button
          onClick={() => navigate('/contributions')}
          className="mt-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Volver a Aportes
        </button>
      </div>
    )
  }

  const totalPaid = contribution.paid_participants || 0
  const totalParticipants = contribution.total_participants || 0
  const percentagePaid = totalParticipants > 0 ? Math.round((totalPaid / totalParticipants) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link
        to="/contributions"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Volver a Aportes</span>
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${contribution.is_unilateral ? 'bg-emerald-100' : 'bg-green-100'}`}>
              {contribution.is_unilateral ? (
                <ArrowUpCircle className="text-emerald-600" size={24} />
              ) : (
                <Coins className="text-green-600" size={24} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{contribution.description}</h1>
                {contribution.is_unilateral && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                    Aporte Directo
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Creado por {contribution.created_by_name} el {formatDate(contribution.created_at)}
              </p>
            </div>
          </div>
          {contribution.is_complete ? (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              Completado
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
              Pendiente
            </span>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Monto Total</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(contribution.amount, contribution.currency)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Participantes</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-gray-900">
                {totalPaid} / {totalParticipants}
              </div>
              {contribution.is_complete && (
                <CheckCircle2 size={24} className="text-green-600" />
              )}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Progreso</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${percentagePaid}%` }}
                ></div>
              </div>
              <span className="text-lg font-bold text-gray-900">{percentagePaid}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Participants list */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={20} />
            Estado de Pagos por Participante
          </h2>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Participante
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Monto a Pagar
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Absorbido
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Pagado el
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Comprobante
                </th>
                {isProjectAdmin && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contribution.payments && contribution.payments.length > 0 ? (
                contribution.payments.map((payment) => (
                  <tr key={payment.payment_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <User size={20} className="text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.user_name}
                          </div>
                          <div className="text-xs text-gray-500">{payment.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(payment.amount_due, contribution.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {payment.amount_offset > 0 ? (
                        <div>
                          <span className="text-green-600 font-medium">
                            -{formatCurrency(payment.amount_offset, contribution.currency)}
                          </span>
                          <div className="text-xs text-gray-500">
                            Resta: {formatCurrency(payment.amount_remaining ?? (payment.amount_due - payment.amount_offset), contribution.currency)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {payment.is_paid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Check size={14} />
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          <X size={14} />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {payment.receipt_file_path ? (
                        <button
                          onClick={() => handleDownloadReceipt(payment.payment_id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Descargar comprobante"
                        >
                          <Download size={16} />
                          <span className="hidden lg:inline">Ver</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">Sin comprobante</span>
                      )}
                    </td>
                    {isProjectAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {!payment.is_paid ? (
                          <button
                            onClick={() => handleMarkPaid(payment.payment_id)}
                            disabled={markingPaid === payment.payment_id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Marcar como pagado"
                          >
                            <CheckSquare size={16} />
                            <span className="hidden lg:inline">
                              {markingPaid === payment.payment_id ? 'Marcando...' : 'Marcar Pagado'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isProjectAdmin ? "7" : "6"} className="px-6 py-12 text-center text-gray-500">
                    No hay pagos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {contribution.payments && contribution.payments.length > 0 ? (
            contribution.payments.map((payment) => (
              <div key={payment.payment_id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {payment.user_name}
                      </div>
                      <div className="text-xs text-gray-500">{payment.user_email}</div>
                    </div>
                  </div>
                  {payment.is_paid ? (
                    <Check size={20} className="text-green-600" />
                  ) : (
                    <X size={20} className="text-yellow-600" />
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(payment.amount_due, contribution.currency)}
                    </span>
                  </div>
                  {payment.amount_offset > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Absorbido:</span>
                      <span className="text-green-600 font-medium">
                        -{formatCurrency(payment.amount_offset, contribution.currency)}
                      </span>
                    </div>
                  )}
                  {payment.amount_offset > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resta:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(payment.amount_remaining ?? (payment.amount_due - payment.amount_offset), contribution.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className={payment.is_paid ? 'text-green-600' : 'text-yellow-600'}>
                      {payment.is_paid ? 'Pagado' : 'Pendiente'}
                    </span>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pagado el:</span>
                      <span className="text-gray-900">{formatDate(payment.paid_at)}</span>
                    </div>
                  )}
                  {payment.receipt_file_path && (
                    <div className="pt-2 border-t border-gray-100 mt-2">
                      <button
                        onClick={() => handleDownloadReceipt(payment.payment_id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <FileText size={16} />
                        Ver Comprobante
                      </button>
                    </div>
                  )}
                  {isProjectAdmin && !payment.is_paid && (
                    <div className="pt-2 border-t border-gray-100 mt-2">
                      <button
                        onClick={() => handleMarkPaid(payment.payment_id)}
                        disabled={markingPaid === payment.payment_id}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                      >
                        <CheckSquare size={16} />
                        {markingPaid === payment.payment_id ? 'Marcando...' : 'Marcar como Pagado'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-gray-500">
              No hay pagos registrados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
