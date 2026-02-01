import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { notesAPI, projectsAPI } from '../api/client'
import { useProject } from '../context/ProjectContext'
import { useAuth } from '../context/AuthContext'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import {
  FileText,
  Plus,
  X,
  Vote,
  MessageSquare,
  Users,
  Calendar,
  AlertCircle,
  Trash2,
} from 'lucide-react'

function CreateNoteModal({ isOpen, onClose, onSuccess, projectId }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState('regular')
  const [votingDescription, setVotingDescription] = useState('')
  const [voteOptions, setVoteOptions] = useState(['', ''])
  const [participantIds, setParticipantIds] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && projectId) {
      loadMembers()
    }
  }, [isOpen, projectId])

  const loadMembers = async () => {
    setLoadingMembers(true)
    try {
      const response = await projectsAPI.members(projectId)
      setMembers(response.data)
    } catch (err) {
      console.error('Error loading members:', err)
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = {
        title,
        content,
        note_type: noteType,
        participant_ids: participantIds,
      }

      if (noteType === 'voting') {
        data.voting_description = votingDescription
        data.vote_options = voteOptions.filter((opt) => opt.trim() !== '')
        if (data.vote_options.length < 2) {
          setError('Debes agregar al menos 2 opciones de votacion')
          setLoading(false)
          return
        }
      }

      await notesAPI.create(data)
      onSuccess()
      onClose()
      resetForm()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la nota')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setNoteType('regular')
    setVotingDescription('')
    setVoteOptions(['', ''])
    setParticipantIds([])
  }

  const handleAddOption = () => {
    setVoteOptions([...voteOptions, ''])
  }

  const handleRemoveOption = (index) => {
    if (voteOptions.length > 2) {
      setVoteOptions(voteOptions.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...voteOptions]
    newOptions[index] = value
    setVoteOptions(newOptions)
  }

  const toggleParticipant = (userId) => {
    if (participantIds.includes(userId)) {
      setParticipantIds(participantIds.filter((id) => id !== userId))
    } else {
      setParticipantIds([...participantIds, userId])
    }
  }

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Nueva Nota</h2>
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
              Titulo
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Titulo de la nota"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Nota
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  value="regular"
                  checked={noteType === 'regular'}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="text-blue-600"
                />
                <span>Regular</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  value="voting"
                  checked={noteType === 'voting'}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="text-blue-600"
                />
                <span>Votacion</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Participantes de la Reunion
            </label>
            {loadingMembers ? (
              <div className="text-gray-500 text-sm">Cargando...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => toggleParticipant(member.user_id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      participantIds.includes(member.user_id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {member.user_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contenido
            </label>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={quillModules}
              className="bg-white [&_.ql-editor]:min-h-[150px]"
              placeholder="Escribe el contenido de la nota..."
            />
          </div>

          {noteType === 'voting' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion de la Votacion
                </label>
                <textarea
                  value={votingDescription}
                  onChange={(e) => setVotingDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe la decision a tomar..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opciones de Votacion
                </label>
                <div className="space-y-2">
                  {voteOptions.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Opcion ${index + 1}`}
                      />
                      {voteOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  + Agregar opcion
                </button>
              </div>
            </>
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
              {loading ? 'Creando...' : 'Crear Nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Notes() {
  const { currentProject } = useProject()
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadNotes()
    }
  }, [currentProject])

  const loadNotes = async () => {
    try {
      const response = await notesAPI.list()
      setNotes(response.data)
    } catch (err) {
      console.error('Error loading notes:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (!currentProject) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-medium text-yellow-800">
          Selecciona un proyecto
        </h3>
        <p className="text-yellow-600 mt-2">
          Debes seleccionar un proyecto para ver las notas.
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

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas</h1>
          <p className="text-gray-500">Minutas de reuniones y votaciones</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span>Nueva Nota</span>
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Sin notas
          </h3>
          <p className="mt-2 text-gray-500">
            Crea tu primera nota para comenzar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {notes.map((note) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {note.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        note.note_type === 'voting'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {note.note_type === 'voting' ? (
                        <>
                          <Vote size={12} />
                          Votacion
                        </>
                      ) : (
                        'Regular'
                      )}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mb-2">
                    Por {note.creator_name}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(note.created_at)}
                    </span>
                    {note.participant_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {note.participant_count} participantes
                      </span>
                    )}
                    {note.comment_count > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {note.comment_count} comentarios
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateNoteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadNotes}
        projectId={currentProject.id}
      />
    </div>
  )
}

export default Notes
