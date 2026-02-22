import { useState, useEffect } from 'react'
import { projectsAPI, authAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Users as UsersIcon, Edit2, Trash2, X, AlertCircle, UserPlus, User, AlertTriangle, Shield, History, ChevronDown, ChevronUp } from 'lucide-react'

function AddMemberModal({ isOpen, onClose, onSuccess, projectId, existingMemberIds }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [percentage, setPercentage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isProjectAdmin, setIsProjectAdmin] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setFullName('')
      setPercentage('')
      setIsProjectAdmin(false)
      setError('')
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Add member by email - backend will create user if needed
      await projectsAPI.addMemberByEmail(
        projectId,
        email,
        parseFloat(percentage) || 0,
        isProjectAdmin,
        fullName || undefined
      )

      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al agregar participante')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Agregar Participante</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-3">
          Ingresa el email del participante. Si ya existe como usuario, se agregara al proyecto. Si no existe, se creara un usuario nuevo que debera configurar su contrasena en el primer inicio de sesion.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-4 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            Una vez agregado, asegurate de que los porcentajes de todos los participantes sumen exactamente 100%.
            Mientras no sumen 100%, los nuevos gastos no se distribuiran correctamente.
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@ejemplo.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo (opcional)
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Solo para usuarios nuevos"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si el email ya existe, este campo se ignora
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Porcentaje de Participacion (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new_is_project_admin"
              checked={isProjectAdmin}
              onChange={(e) => setIsProjectAdmin(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="new_is_project_admin" className="text-sm text-gray-700">
              Es admin del proyecto
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Los admins pueden crear gastos, proveedores, categorias y gestionar miembros.
          </p>

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
              {loading ? 'Creando...' : 'Crear y Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditPercentageModal({ isOpen, onClose, onSuccess, projectId, member }) {
  const [percentage, setPercentage] = useState('')
  const [memberIsAdmin, setMemberIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (member) {
      setPercentage(member.participation_percentage.toString())
      setMemberIsAdmin(member.is_admin || false)
    }
  }, [member])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await projectsAPI.updateMember(projectId, member.user_id, {
        participation_percentage: parseFloat(percentage) || 0,
        is_admin: memberIsAdmin,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar miembro')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !member) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Editar Miembro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-600 mb-4">
          Participante: <span className="font-semibold">{member.user_name}</span>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Porcentaje de Participacion (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="member_is_admin"
              checked={memberIsAdmin}
              onChange={(e) => setMemberIsAdmin(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="member_is_admin" className="text-sm text-gray-700">
              Es admin del proyecto
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Los admins pueden crear gastos, proveedores, categorias y gestionar miembros.
          </p>

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

function ProjectMembers() {
  const { currentProject, isProjectAdmin, refreshProjects } = useProject()
  const [members, setMembers] = useState([])
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [isIndividual, setIsIndividual] = useState(false)
  const [updatingIndividual, setUpdatingIndividual] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadData()
      setIsIndividual(currentProject.is_individual || false)
    }
  }, [currentProject])

  useEffect(() => {
    if (showHistory) loadHistory()
  }, [showHistory])

  const loadData = async () => {
    if (!currentProject) return

    try {
      const [membersRes, validationRes] = await Promise.all([
        projectsAPI.members(currentProject.id),
        projectsAPI.validateParticipation(currentProject.id),
      ])
      setMembers(membersRes.data)
      setValidation(validationRes.data)
    } catch (err) {
      console.error('Error loading members:', err)
    } finally {
      setLoading(false)
    }
    if (showHistory) loadHistory()
  }

  const loadHistory = async () => {
    if (!currentProject || !isProjectAdmin) return
    try {
      const res = await projectsAPI.memberHistory(currentProject.id)
      setHistory(res.data)
    } catch (err) {
      console.error('Error loading history:', err)
    }
  }

  const handleEdit = (member) => {
    setSelectedMember(member)
    setShowEditModal(true)
  }

  const handleRemove = async (userId) => {
    if (!confirm('Quitar este participante del proyecto?')) return

    try {
      await projectsAPI.removeMember(currentProject.id, userId)
      loadData()
    } catch (err) {
      console.error('Error removing member:', err)
    }
  }

  const handleToggleIndividual = async () => {
    const newValue = !isIndividual
    const confirmMsg = newValue
      ? 'Al marcar como proyecto individual, los pagos se aprobarán automáticamente. ¿Continuar?'
      : '¿Desmarcar como proyecto individual?'

    if (!confirm(confirmMsg)) return

    setUpdatingIndividual(true)
    try {
      await projectsAPI.update(currentProject.id, { is_individual: newValue })
      setIsIndividual(newValue)
      await refreshProjects()
      // Reload page to update navigation
      window.location.reload()
    } catch (err) {
      console.error('Error updating project:', err)
    } finally {
      setUpdatingIndividual(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-medium text-yellow-800">
          Selecciona un proyecto
        </h3>
        <p className="text-yellow-600 mt-2">
          Debes seleccionar un proyecto para ver sus participantes.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const totalPercentage = members.reduce(
    (sum, m) => sum + parseFloat(m.participation_percentage),
    0
  )

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 hidden sm:block">Participantes</h1>
          <p className="text-gray-500">{currentProject.name}</p>
        </div>
        {isProjectAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full sm:w-auto"
          >
            <UserPlus size={20} />
            <span>Agregar</span>
          </button>
        )}
      </div>

      {/* Individual Project Toggle - only show if 1 or fewer members AND user is project admin */}
      {members.length <= 1 && isProjectAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <User className="text-gray-400" size={20} />
              <div>
                <p className="font-medium text-gray-900">Proyecto Individual</p>
                <p className="text-sm text-gray-500">
                  Los pagos se aprueban automáticamente (sin flujo de aprobación)
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleIndividual}
              disabled={updatingIndividual}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isIndividual ? 'bg-blue-600' : 'bg-gray-200'
              } ${updatingIndividual ? 'opacity-50' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isIndividual ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {isIndividual && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-2">
              <AlertTriangle size={16} />
              <span>Los nuevos gastos se marcarán como pagados automáticamente</span>
            </div>
          )}
        </div>
      )}

      {/* Validation Alert */}
      {validation && !validation.is_valid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-4">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={24} />
          <div>
            <p className="font-medium text-yellow-800">
              Los porcentajes no suman 100% (total actual: {totalPercentage}%)
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Los nuevos gastos no se distribuiran correctamente hasta que los porcentajes sumen exactamente 100%.
              Los participantes con porcentaje incorrecto podrian recibir cuotas equivocadas.
            </p>
            {isProjectAdmin && (
              <p className="text-sm text-yellow-600 mt-1 font-medium">
                Edita los porcentajes usando el boton de edicion en cada fila hasta llegar a 100%.
              </p>
            )}
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Sin participantes
          </h3>
          <p className="mt-2 text-gray-500">
            Agrega participantes a este proyecto.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Participacion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rol
                </th>
                {isProjectAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 font-medium">{member.user_name}</td>
                  <td className="px-6 py-4 text-gray-500">{member.user_email}</td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-blue-600">
                      {member.participation_percentage}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.is_admin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        <Shield size={12} />
                        Admin
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Miembro</span>
                    )}
                  </td>
                  {isProjectAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleRemove(member.user_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Quitar del proyecto"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="2" className="px-6 py-3 font-medium">
                  Total
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`font-bold ${
                      totalPercentage === 100 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {totalPercentage}%
                  </span>
                </td>
                <td></td>
                {isProjectAdmin && <td></td>}
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}

      {/* Participation History - admin only */}
      {isProjectAdmin && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <History size={18} />
              Historial de cambios de participacion
            </div>
            {showHistory ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-gray-100 overflow-x-auto">
              {history.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-6">No hay cambios registrados aun.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Participante</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accion</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Anterior</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Nuevo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Realizado por</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(h.changed_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {h.user_name}
                          <span className="block text-xs text-gray-400 font-normal">{h.user_email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            h.action === 'added' ? 'bg-green-100 text-green-700' :
                            h.action === 'removed' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {h.action === 'added' ? 'Agregado' : h.action === 'removed' ? 'Quitado' : 'Modificado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {h.old_percentage != null ? `${parseFloat(h.old_percentage).toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {h.new_percentage != null ? (
                            <span className="font-semibold text-blue-600">{parseFloat(h.new_percentage).toFixed(2)}%</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{h.changed_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadData}
        projectId={currentProject.id}
        existingMemberIds={members.map((m) => m.user_id)}
      />

      <EditPercentageModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={loadData}
        projectId={currentProject.id}
        member={selectedMember}
      />
    </div>
  )
}

export default ProjectMembers
