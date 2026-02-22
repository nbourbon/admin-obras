import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { contributionsAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Coins, TrendingUp, Plus, X, Check, CheckCircle2, Clock, Search } from 'lucide-react'

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
    month: '2-digit',
    year: '2-digit',
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
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}

function CreateContributionModal({ isOpen, onClose, onCreated, currencyMode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    description: '',
    amount_original: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Create contribution using the new Contribution API
      const contributionData = {
        description: formData.description,
        amount: parseFloat(formData.amount_original),
        currency: 'ARS', // Always ARS for now (model supports other currencies)
      }

      await contributionsAPI.create(contributionData)

      onCreated()
      onClose()
      // Reset form
      setFormData({
        description: '',
        amount_original: '',
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear solicitud de aporte')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nueva Solicitud de Aporte</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-xs mb-4">
          Los aportes se dividen entre participantes. Al aprobar los pagos, el monto se acredita al saldo de cada uno.
        </div>

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
              placeholder="Ej: Aporte para caja común"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto (ARS)
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
            <p className="mt-1 text-xs text-gray-500">
              Los aportes siempre se solicitan en pesos
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Aporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PayContributionModal({ isOpen, onClose, contribution, onSuccess, currencyMode }) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    exchange_rate_override: '',
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const submitData = {
        amount_paid: contribution.my_amount_due,
        currency_paid: contribution.currency,
        payment_date: formData.payment_date ? new Date(formData.payment_date).toISOString() : null,
      }

      // Include exchange rate override for DUAL mode
      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        submitData.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }

      // Use the user's payment ID
      if (!contribution.my_payment_id) {
        setError('No se encontró tu pago para este aporte')
        setLoading(false)
        return
      }

      await contributionsAPI.submitPayment(contribution.my_payment_id, submitData)

      // Upload receipt if provided
      if (receiptFile) {
        try {
          await contributionsAPI.uploadReceipt(paymentId, receiptFile)
        } catch (uploadErr) {
          console.error('Error uploading receipt:', uploadErr)
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar pago')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !contribution) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Pagar Aporte</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-500">Aporte</p>
          <p className="font-medium">{contribution.description}</p>
          <p className="text-sm text-gray-500 mt-2">Monto que te corresponde</p>
          <p className="font-semibold text-blue-600">
            {formatCurrency(contribution.my_amount_due || 0, contribution.currency)}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del Pago
            </label>
            <input
              type="date"
              required
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                placeholder="Dejar vacío para usar TC automático"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante (opcional)
            </label>
            {receiptFile ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="text-green-600" size={18} />
                <span className="text-sm text-green-700 flex-1 truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setReceiptFile(e.target.files[0])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Contributions() {
  const navigate = useNavigate()
  const { currentProject, isProjectAdmin } = useProject()
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedContribution, setSelectedContribution] = useState(null)
  const [infoDismissed, setInfoDismissed] = useState(
    () => localStorage.getItem('contributions_info_dismissed') === 'true'
  )

  const dismissInfo = () => {
    setInfoDismissed(true)
    localStorage.setItem('contributions_info_dismissed', 'true')
  }

  const currencyMode = currentProject?.currency_mode || 'DUAL'

  const handlePayClick = (contribution) => {
    setSelectedContribution(contribution)
    setShowPayModal(true)
  }

  useEffect(() => {
    loadContributions()
  }, [currentProject])

  const loadContributions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await contributionsAPI.list()
      setContributions(response.data || [])
    } catch (err) {
      console.error('Error loading contributions:', err)
      setError(err.response?.data?.detail || 'Error al cargar solicitudes de aporte')
    } finally {
      setLoading(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Coins size={48} className="mb-4 opacity-50" />
        <p className="text-lg">Selecciona un proyecto para ver las solicitudes de aporte</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreateContributionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          loadContributions()
        }}
        currencyMode={currencyMode}
      />

      <PayContributionModal
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setSelectedContribution(null)
        }}
        contribution={selectedContribution}
        onSuccess={() => {
          setShowPayModal(false)
          setSelectedContribution(null)
          loadContributions()
        }}
        currencyMode={currencyMode}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Aportes</h1>
          <p className="text-sm text-gray-600">Aportes a la caja común del proyecto</p>
        </div>
        {isProjectAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            title="Nueva Solicitud"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Nueva Solicitud</span>
          </button>
        )}
      </div>

      {/* Info box — dismissible */}
      {!infoDismissed && (
        <div className="relative bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <button
            onClick={dismissInfo}
            className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 p-0.5"
            title="Cerrar"
          >
            <X size={16} />
          </button>
          <div className="flex gap-3 pr-4">
            <Coins className="text-blue-600 flex-shrink-0" size={20} />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">¿Cómo funcionan las solicitudes de aporte?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>El admin crea una solicitud que se divide entre participantes</li>
                <li>Cada participante paga su parte y el admin aprueba</li>
                <li>Al aprobar, el monto se acredita al saldo de cada participante</li>
                <li>Los gastos futuros se pagan automáticamente desde el saldo</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : contributions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Coins size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">No hay solicitudes de aporte todavía</p>
          {isProjectAdmin ? (
            <p className="text-sm text-gray-500">
              Usa el botón "Nueva Solicitud" para crear la primera solicitud de aporte
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              El administrador del proyecto puede crear solicitudes de aporte
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Lista compacta unificada (mobile + desktop) */}
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {contributions.map((contribution) => (
              <div
                key={contribution.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/contributions/${contribution.id}`)}
              >
                {/* Fecha */}
                <div className="w-14 flex-shrink-0 text-xs text-gray-500 tabular-nums leading-tight">
                  {formatDate(contribution.created_at)}
                </div>

                {/* Descripción */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {contribution.description}
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">
                    Mi parte: {formatCurrency(contribution.my_amount_due || 0, contribution.currency)}
                  </div>
                </div>

                {/* Monto total */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-bold text-gray-900 tabular-nums">
                    {formatCurrency(contribution.amount, contribution.currency)}
                  </div>
                  <div className="text-xs text-gray-400 tabular-nums">
                    {contribution.paid_participants}/{contribution.total_participants} pagaron
                  </div>
                </div>

                {/* Estado + acciones */}
                <div
                  className="flex-shrink-0 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contribution.is_complete ? (
                    <CheckCircle2 size={20} className="text-green-500" title="Completo" />
                  ) : contribution.i_paid ? (
                    <div className="flex items-center gap-1" title={`Esperando: ${contribution.paid_participants}/${contribution.total_participants} pagaron`}>
                      <Check size={16} className="text-green-500" />
                      <span className="text-xs text-orange-400 font-medium tabular-nums">
                        {contribution.paid_participants}/{contribution.total_participants}
                      </span>
                    </div>
                  ) : contribution.is_pending_approval ? (
                    <Clock size={18} className="text-yellow-500" title="Pendiente de aprobación" />
                  ) : (
                    <button
                      onClick={() => handlePayClick(contribution)}
                      className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Pagar
                    </button>
                  )}
                  <Search size={13} className="hidden md:block text-gray-200 ml-0.5" />
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Total de solicitudes:</span> {contributions.length}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
