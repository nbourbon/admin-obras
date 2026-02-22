import { useState } from 'react'
import { contributionsAPI } from '../api/client'
import { X, Scale } from 'lucide-react'

export default function AdjustBalanceModal({ isOpen, onClose, onCreated, currencyMode }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currency = currencyMode === 'USD' ? 'USD' : 'ARS'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed === 0) {
      setError('Ingresá un monto distinto de cero (puede ser negativo)')
      return
    }
    setLoading(true)
    try {
      await contributionsAPI.adjustBalance({
        description,
        amount: parsed,
        currency,
      })
      setDescription('')
      setAmount('')
      onCreated()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el ajuste')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale size={20} className="text-indigo-600" />
            <h2 className="text-xl font-bold">Ajuste de Saldo</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Ingresa un monto <strong>positivo</strong> para acreditar saldo o <strong>negativo</strong> para debitarlo.
          Se distribuirá proporcionalmente entre todos los participantes y quedará registrado en la lista de aportes.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Comisión bancaria, devolución de gasto, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto ({currency}) — negativo para debitar
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 5000 o -1200"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) !== 0 && (
              <p className={`text-xs mt-1 ${parseFloat(amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(amount) > 0 ? '↑ Acredita saldo a todos los participantes' : '↓ Debita saldo a todos los participantes'}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Aplicando...' : 'Aplicar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
