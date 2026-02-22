import { useState, useEffect } from 'react'
import { rubrosAPI } from '../api/client'
import { Briefcase, Plus, Edit2, Trash2, X } from 'lucide-react'
import { useProject } from '../context/ProjectContext'

function RubroModal({ isOpen, onClose, onSuccess, rubro = null }) {
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (rubro) {
      setFormData({ name: rubro.name, description: rubro.description || '' })
    } else {
      setFormData({ name: '', description: '' })
    }
  }, [rubro])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (rubro) {
        await rubrosAPI.update(rubro.id, formData)
      } else {
        await rubrosAPI.create(formData)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar rubro')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{rubro ? 'Editar Rubro' : 'Nuevo Rubro'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Estructura, Terminaciones, Instalaciones"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripcion opcional"
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
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Rubros() {
  const { isProjectAdmin } = useProject()
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRubro, setEditingRubro] = useState(null)

  useEffect(() => { loadRubros() }, [])

  const loadRubros = async () => {
    try {
      const response = await rubrosAPI.list()
      setRubros(response.data)
    } catch (err) {
      console.error('Error loading rubros:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rubro) => { setEditingRubro(rubro); setShowModal(true) }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estas seguro de desactivar este rubro?')) return
    try {
      await rubrosAPI.delete(id)
      loadRubros()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al desactivar rubro')
    }
  }

  const handleModalClose = () => { setShowModal(false); setEditingRubro(null) }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Rubros</h1>
        {isProjectAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Nuevo Rubro
          </button>
        )}
      </div>

      {rubros.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin rubros</h3>
          <p className="mt-2 text-gray-500">
            {isProjectAdmin
              ? 'Comienza creando tu primer rubro para organizar los gastos.'
              : 'Todavia no hay rubros creados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rubros.map((rubro) => (
            <div key={rubro.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Briefcase className="text-blue-600" size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{rubro.name}</p>
                    {rubro.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{rubro.description}</p>
                    )}
                  </div>
                </div>
                {isProjectAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(rubro)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(rubro.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Desactivar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RubroModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={loadRubros}
        rubro={editingRubro}
      />
    </div>
  )
}

export default Rubros
