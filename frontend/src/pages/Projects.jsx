import { useState, useEffect } from 'react'
import { projectsAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Briefcase, Plus, Edit2, Trash2, X, Shield } from 'lucide-react'

function ProjectModal({ isOpen, onClose, onSuccess, project = null }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
      })
    } else {
      setFormData({ name: '', description: '' })
    }
  }, [project])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (project) {
        await projectsAPI.update(project.id, formData)
      } else {
        await projectsAPI.create(formData)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar proyecto')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {project ? 'Editar Proyecto' : 'Nuevo Proyecto'}
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
              Nombre del Proyecto
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Edificio Centro, Casa Playa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Descripcion del proyecto"
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

function Projects() {
  const { refreshProjects } = useProject()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.list()
      setProjects(response.data)
    } catch (err) {
      console.error('Error loading projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (project) => {
    setSelectedProject(project)
    setShowModal(true)
  }

  const handleCreate = () => {
    setSelectedProject(null)
    setShowModal(true)
  }

  const handleDelete = async (projectId) => {
    if (!confirm('Desactivar este proyecto?')) return

    try {
      await projectsAPI.delete(projectId)
      loadProjects()
      refreshProjects()
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  const handleSuccess = () => {
    loadProjects()
    refreshProjects()
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
        <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
        <button
          onClick={handleCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nuevo Proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin proyectos</h3>
          <p className="mt-2 text-gray-500">Crea tu primer proyecto para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm p-6 border hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Briefcase className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                    )}
                  </div>
                </div>
                {project.current_user_is_admin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  project.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {project.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {project.current_user_is_admin && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    <Shield size={10} />
                    Admin
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        project={selectedProject}
      />
    </div>
  )
}

export default Projects
