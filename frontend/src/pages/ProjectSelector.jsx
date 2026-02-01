import { useState } from 'react'
import { useProject } from '../context/ProjectContext'
import { projectsAPI } from '../api/client'
import { Briefcase, Plus, Check, X, Settings } from 'lucide-react'

function CreateProjectModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await projectsAPI.create(formData)
      onCreated()
      onClose()
      setFormData({ name: '', description: '' })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear proyecto')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nuevo Proyecto</h2>
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
              {loading ? 'Creando...' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectSelector() {
  const {
    projects,
    currentProject,
    selectProject,
    closeProjectSelector,
    refreshProjects,
    getPreference,
    setPreference,
  } = useProject()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preference, setLocalPreference] = useState(getPreference())

  const handleSelectProject = (projectId) => {
    selectProject(projectId)
    closeProjectSelector()
    // Reload to refresh data with the new project context
    window.location.reload()
  }

  const handlePreferenceChange = (newPref) => {
    setPreference(newPref)
    setLocalPreference(newPref)
  }

  const handleProjectCreated = async () => {
    await refreshProjects()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100 mb-4">
            <Briefcase className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Selecciona un Proyecto</h1>
          <p className="mt-2 text-gray-600">
            Elige el proyecto en el que queres trabajar
          </p>
        </div>

        {/* Settings Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Settings size={18} />
            Preferencias
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Al iniciar sesion:</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="preference"
                  checked={preference === 'last'}
                  onChange={() => handlePreferenceChange('last')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium">Abrir ultimo proyecto</span>
                  <p className="text-sm text-gray-500">Ir directamente al ultimo proyecto usado</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="preference"
                  checked={preference === 'selector'}
                  onChange={() => handlePreferenceChange('selector')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium">Mostrar selector</span>
                  <p className="text-sm text-gray-500">Siempre mostrar esta pantalla para elegir</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Sin proyectos</h3>
            <p className="mt-2 text-gray-500">Crea tu primer proyecto para comenzar</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              Crear Proyecto
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={`text-left bg-white rounded-xl shadow-sm p-6 border-2 transition-all hover:shadow-md ${
                    currentProject?.id === project.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-transparent hover:border-blue-200'
                  }`}
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
                    {currentProject?.id === project.id && (
                      <div className="flex-shrink-0 p-1 bg-blue-500 rounded-full">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={20} />
                Crear nuevo proyecto
              </button>
            </div>
          </>
        )}

        {/* Close button if we have projects */}
        {projects.length > 0 && currentProject && (
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                closeProjectSelector()
                window.location.reload()
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Continuar con {currentProject.name}
            </button>
          </div>
        )}

        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleProjectCreated}
        />
      </div>
    </div>
  )
}

export default ProjectSelector
