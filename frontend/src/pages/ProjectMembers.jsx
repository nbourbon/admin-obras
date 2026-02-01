import { useState, useEffect } from 'react'
import { projectsAPI, usersAPI, authAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Users as UsersIcon, Plus, Edit2, Trash2, X, AlertCircle, UserPlus, User, AlertTriangle } from 'lucide-react'

function AddMemberModal({ isOpen, onClose, onSuccess, projectId, existingMemberIds }) {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [percentage, setPercentage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('select') // 'select' or 'create'
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    is_admin: false,
  })

  useEffect(() => {
    if (isOpen) {
      loadUsers()
      setMode('select')
      setNewUser({ full_name: '', email: '', password: '', is_admin: false })
    }
  }, [isOpen])

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await usersAPI.list(false)
      // Filter out users who are already members
      const availableUsers = response.data.filter(
        (u) => !existingMemberIds.includes(u.id)
      )
      setUsers(availableUsers)
    } catch (err) {
      console.error('Error loading users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await projectsAPI.addMember(projectId, {
        user_id: parseInt(selectedUserId),
        participation_percentage: parseFloat(percentage) || 0,
      })
      onSuccess()
      onClose()
      setSelectedUserId('')
      setPercentage('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al agregar participante')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAndAdd = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First create the user
      const userResponse = await authAPI.register({
        ...newUser,
        participation_percentage: 0, // Will be set via project membership
      })
      const newUserId = userResponse.data.id

      // Then add to project
      await projectsAPI.addMember(projectId, {
        user_id: newUserId,
        participation_percentage: parseFloat(percentage) || 0,
      })

      onSuccess()
      onClose()
      setNewUser({ full_name: '', email: '', password: '', is_admin: false })
      setPercentage('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear usuario')
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {loadingUsers ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : mode === 'select' ? (
          <>
            {users.length > 0 ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario existente
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar usuario</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
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
                    {loading ? 'Agregando...' : 'Agregar'}
                  </button>
                </div>

                <div className="border-t pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className="w-full text-center text-blue-600 hover:text-blue-700 text-sm"
                  >
                    O crear un usuario nuevo
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-500 text-center py-4">
                  No hay usuarios disponibles para agregar.
                </p>
                <button
                  onClick={() => setMode('create')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear nuevo usuario
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrasena
              </label>
              <input
                type="password"
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                id="new_is_admin"
                checked={newUser.is_admin}
                onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="new_is_admin" className="text-sm text-gray-700">
                Es administrador
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setMode('select')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Volver
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
        )}
      </div>
    </div>
  )
}

function EditPercentageModal({ isOpen, onClose, onSuccess, projectId, member }) {
  const [percentage, setPercentage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (member) {
      setPercentage(member.participation_percentage.toString())
    }
  }, [member])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await projectsAPI.updateMember(projectId, member.user_id, {
        participation_percentage: parseFloat(percentage) || 0,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar porcentaje')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !member) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Editar Porcentaje</h2>
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
  const { currentProject, refreshProjects } = useProject()
  const [members, setMembers] = useState([])
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [isIndividual, setIsIndividual] = useState(false)
  const [updatingIndividual, setUpdatingIndividual] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadData()
      setIsIndividual(currentProject.is_individual || false)
    }
  }, [currentProject])

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
          <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
          <p className="text-gray-500">{currentProject.name}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full sm:w-auto"
        >
          <UserPlus size={20} />
          <span>Agregar</span>
        </button>
      </div>

      {/* Individual Project Toggle */}
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

      {/* Validation Alert */}
      {validation && !validation.is_valid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
          <div>
            <p className="font-medium text-yellow-800">
              Los porcentajes no suman 100%
            </p>
            <p className="text-sm text-yellow-600">
              Total actual: {totalPercentage}% - Deberia ser 100%
            </p>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Editar porcentaje"
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
              </tr>
            </tfoot>
          </table>
          </div>
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
