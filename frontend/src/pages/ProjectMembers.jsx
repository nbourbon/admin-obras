import { useState, useEffect } from 'react'
import { projectsAPI, usersAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { Users as UsersIcon, Plus, Edit2, Trash2, X, AlertCircle, UserPlus } from 'lucide-react'

function AddMemberModal({ isOpen, onClose, onSuccess, projectId, existingMemberIds }) {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [percentage, setPercentage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const loadUsers = async () => {
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
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay usuarios disponibles para agregar.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario
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
  const { currentProject } = useProject()
  const [members, setMembers] = useState([])
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  useEffect(() => {
    if (currentProject) {
      loadData()
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
          <p className="text-gray-500">{currentProject.name}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus size={20} />
          Agregar Participante
        </button>
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
