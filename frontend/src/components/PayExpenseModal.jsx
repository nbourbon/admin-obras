import { useState } from 'react'
import { paymentsAPI } from '../api/client'
import { X, CheckCircle2 } from 'lucide-react'

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function PayExpenseModal({ isOpen, onClose, expense, onSuccess, currencyMode }) {
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
      let currencyPaid = 'USD'
      if (currencyMode === 'ARS') {
        currencyPaid = 'ARS'
      } else if (currencyMode === 'USD') {
        currencyPaid = 'USD'
      } else {
        currencyPaid = expense.currency_original || 'USD'
      }

      const submitData = {
        amount_paid: expense.my_amount_due,
        currency_paid: currencyPaid,
        payment_date: formData.payment_date ? new Date(formData.payment_date).toISOString() : null,
      }

      if (currencyMode === 'DUAL' && formData.exchange_rate_override) {
        submitData.exchange_rate_override = parseFloat(formData.exchange_rate_override)
      }

      if (!expense.my_payment_id) {
        setError('No se encontró tu pago para este gasto')
        setLoading(false)
        return
      }

      await paymentsAPI.submitPayment(expense.my_payment_id, submitData)

      if (receiptFile) {
        try {
          await paymentsAPI.uploadReceipt(expense.my_payment_id, receiptFile)
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

  if (!isOpen || !expense) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Pagar Gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-500">Gasto</p>
          <p className="font-medium">{expense.description}</p>
          <p className="text-sm text-gray-500 mt-2">Monto que te corresponde</p>
          <p className="font-semibold text-blue-600">
            {formatCurrency(expense.my_amount_due || 0, currencyMode === 'ARS' ? 'ARS' : 'USD')}
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
