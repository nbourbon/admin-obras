import { useState, useEffect } from 'react'
import { categoriesAPI, rubrosAPI } from '../api/client'
import { FolderOpen, Plus, Edit2, Trash2, X, Tag } from 'lucide-react'

// Predefined colors for categories
const CATEGORY_COLORS = [
  { name: 'Sin color', value: null, bg: 'bg-white', border: 'border-gray-200' },
  { name: 'Rojo', value: '#FEE2E2', bg: 'bg-red-100', border: 'border-red-300' },
  { name: 'Naranja', value: '#FFEDD5', bg: 'bg-orange-100', border: 'border-orange-300' },
  { name: 'Amarillo', value: '#FEF9C3', bg: 'bg-yellow-100', border: 'border-yellow-300' },
  { name: 'Verde', value: '#DCFCE7', bg: 'bg-green-100', border: 'border-green-300' },
  { name: 'Celeste', value: '#CFFAFE', bg: 'bg-cyan-100', border: 'border-cyan-300' },
  { name: 'Azul', value: '#DBEAFE', bg: 'bg-blue-100', border: 'border-blue-300' },
  { name: 'Violeta', value: '#EDE9FE', bg: 'bg-violet-100', border: 'border-violet-300' },
  { name: 'Rosa', value: '#FCE7F3', bg: 'bg-pink-100', border: 'border-pink-300' },
  { name: 'Gris', value: '#F3F4F6', bg: 'bg-gray-100', border: 'border-gray-300' },
]

function CategoryModal({ isOpen, onClose, onSuccess, category = null, rubros = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: null,
    rubroId: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        color: category.color || null,
        rubroId: category.rubro ? category.rubro.id : null,
      })
    } else {
      setFormData({ name: '', description: '', color: null, rubroId: null })
    }
  }, [category, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        rubro_id: formData.rubroId,
      }
      if (category) {
        await categoriesAPI.update(category.id, payload)
      } else {
        await categoriesAPI.create(payload)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar categoria')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {category ? 'Editar Categoria' : 'Nueva Categoria'}
          </h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Materiales, Salarios, Impuestos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripcion opcional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color (opcional)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`p-3 rounded-lg border-2 transition-all ${color.bg} ${
                    formData.color === color.value
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : color.border + ' hover:border-gray-400'
                  }`}
                  title={color.name}
                >
                  {formData.color === color.value && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mx-auto"></div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Seleccionado: {CATEGORY_COLORS.find(c => c.value === formData.color)?.name || 'Sin color'}
            </p>
          </div>

          {rubros.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rubro
              </label>
              <select
                value={formData.rubroId ?? ''}
                onChange={(e) => setFormData({ ...formData, rubroId: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sin rubro (genérica) —</option>
                {rubros.map(rubro => (
                  <option key={rubro.id} value={rubro.id}>{rubro.name}</option>
                ))}
              </select>
              {!formData.rubroId && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Tag size={12} />
                  Genérica (aparece en todos los rubros)
                </p>
              )}
            </div>
          )}

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

function Categories() {
  const [categories, setCategories] = useState([])
  const [rubros, setRubros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [filterRubro, setFilterRubro] = useState(null) // null = todos

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [categoriesRes, rubrosRes] = await Promise.all([
        categoriesAPI.list(),
        rubrosAPI.list(),
      ])
      setCategories(categoriesRes.data)
      setRubros(rubrosRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (category) => {
    setSelectedCategory(category)
    setShowModal(true)
  }

  const handleCreate = () => {
    setSelectedCategory(null)
    setShowModal(true)
  }

  const handleDelete = async (categoryId) => {
    if (!confirm('Desactivar esta categoria?')) return

    try {
      await categoriesAPI.delete(categoryId)
      loadData()
    } catch (err) {
      console.error('Error deleting category:', err)
    }
  }

  const filteredCategories = filterRubro === null
    ? categories
    : categories.filter(c => !c.rubro || c.rubro.id === filterRubro)

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
        <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Categorias</h1>
        <button
          onClick={handleCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nueva Categoria
        </button>
      </div>

      {rubros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterRubro(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterRubro === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Todos
          </button>
          {rubros.map(rubro => (
            <button
              key={rubro.id}
              onClick={() => setFilterRubro(filterRubro === rubro.id ? null : rubro.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterRubro === rubro.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {rubro.name}
            </button>
          ))}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin categorias</h3>
          <p className="mt-2 text-gray-500">Agrega categorias para clasificar los gastos.</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin categorias para este rubro</h3>
          <p className="mt-2 text-gray-500">
            No hay categorias asignadas a este rubro todavia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl shadow-sm p-6 border"
              style={{ backgroundColor: category.color || '#ffffff' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-80 rounded-lg">
                    <FolderOpen className="text-gray-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {category.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {category.rubro ? (
                        <span className="px-2 py-0.5 bg-white bg-opacity-70 border border-gray-300 text-gray-600 text-xs rounded-full">
                          {category.rubro.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-white bg-opacity-70 border border-blue-200 text-blue-600 text-xs rounded-full flex items-center gap-1">
                          <Tag size={10} />
                          Generica
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white hover:bg-opacity-50 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white hover:bg-opacity-50 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadData}
        category={selectedCategory}
        rubros={rubros}
      />
    </div>
  )
}

export default Categories
