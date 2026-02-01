import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft,
  Vote,
  Users,
  Calendar,
  MessageSquare,
  Send,
  Trash2,
  Check,
  RotateCcw,
  Edit2,
  X,
  AlertCircle,
} from 'lucide-react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

function NoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [voting, setVoting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadNote()
  }, [id])

  const loadNote = async () => {
    try {
      const response = await notesAPI.get(id)
      setNote(response.data)
      setEditTitle(response.data.title)
      setEditContent(response.data.content || '')
    } catch (err) {
      console.error('Error loading note:', err)
      if (err.response?.status === 404) {
        navigate('/notes')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmittingComment(true)
    try {
      await notesAPI.addComment(id, { content: newComment })
      setNewComment('')
      loadNote()
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Eliminar este comentario?')) return

    try {
      await notesAPI.deleteComment(id, commentId)
      loadNote()
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  const handleVote = async (optionId) => {
    if (note.user_has_voted) return

    setVoting(true)
    try {
      await notesAPI.vote(id, { option_id: optionId })
      loadNote()
    } catch (err) {
      console.error('Error voting:', err)
      alert(err.response?.data?.detail || 'Error al votar')
    } finally {
      setVoting(false)
    }
  }

  const handleResetVote = async (userId, userName) => {
    if (!confirm(`Resetear el voto de ${userName}?`)) return

    try {
      await notesAPI.resetVote(id, userId)
      loadNote()
    } catch (err) {
      console.error('Error resetting vote:', err)
    }
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      await notesAPI.update(id, {
        title: editTitle,
        content: editContent,
      })
      setIsEditing(false)
      loadNote()
    } catch (err) {
      console.error('Error updating note:', err)
      alert(err.response?.data?.detail || 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Eliminar esta nota?')) return

    try {
      await notesAPI.delete(id)
      navigate('/notes')
    } catch (err) {
      console.error('Error deleting note:', err)
    }
  }

  const canEdit = note && (note.created_by === user?.id || user?.is_admin)
  const totalVotes = note?.vote_options?.reduce((sum, opt) => sum + opt.vote_count, 0) || 0
  const totalParticipation = note?.vote_options?.reduce((sum, opt) => sum + opt.participation_percentage, 0) || 0

  // Find winning option (by participation percentage)
  const maxParticipation = note?.vote_options?.reduce((max, opt) =>
    opt.participation_percentage > max ? opt.participation_percentage : max, 0) || 0

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
        <h3 className="text-lg font-medium text-red-800">Nota no encontrada</h3>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Header - Back button and title */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/notes')}
          className="p-2 hover:bg-gray-100 rounded-lg mt-1"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-2xl font-bold w-full px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>
                {note.note_type === 'voting' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                    <Vote size={12} />
                    Votacion
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(note.created_at)}
                </span>
                <span>· {note.creator_name}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Participants */}
      {note.participants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Users size={18} />
            Participantes de la Reunion
          </h3>
          <div className="flex flex-wrap gap-2">
            {note.participants.map((p) => (
              <span
                key={p.id}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {p.user_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        {isEditing ? (
          <ReactQuill
            theme="snow"
            value={editContent}
            onChange={setEditContent}
            modules={quillModules}
            className="bg-white [&_.ql-editor]:min-h-[150px]"
          />
        ) : (
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: note.content || '<p class="text-gray-500 italic">Sin contenido</p>' }}
          />
        )}
      </div>

      {/* Edit/Delete actions */}
      {canEdit && !isEditing && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Edit2 size={18} />
            <span>Editar</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={18} />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* Save/Cancel when editing */}
      {isEditing && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Voting Section */}
      {note.note_type === 'voting' && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Vote size={18} />
            Votacion
          </h3>
          {note.voting_description && (
            <p className="text-gray-600 mb-4">{note.voting_description}</p>
          )}

          <div className="space-y-3">
            {note.vote_options.map((option) => {
              const isSelected = option.id === note.user_vote_option_id
              const isWinning = option.participation_percentage === maxParticipation && maxParticipation > 0

              return (
                <div key={option.id} className="relative">
                  <button
                    onClick={() => handleVote(option.id)}
                    disabled={note.user_has_voted || voting}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : isWinning && note.user_has_voted
                        ? 'border-green-500 bg-green-50'
                        : note.user_has_voted
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    } ${!note.user_has_voted && !voting ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium flex items-center gap-2">
                        {isSelected && <Check size={16} className="text-blue-600" />}
                        {isWinning && !isSelected && totalVotes > 0 && (
                          <span className="text-green-600 text-xs font-semibold">GANADOR</span>
                        )}
                        {option.option_text}
                      </span>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${isWinning ? 'text-green-600' : 'text-gray-700'}`}>
                          {option.participation_percentage.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({option.vote_count} {option.vote_count === 1 ? 'voto' : 'votos'})
                        </span>
                      </div>
                    </div>
                    {/* Progress bar - based on participation percentage */}
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isWinning ? 'bg-green-500' : isSelected ? 'bg-blue-600' : 'bg-gray-400'
                        }`}
                        style={{ width: `${option.participation_percentage}%` }}
                      />
                    </div>
                    {/* Voters with their participation % */}
                    {option.voters.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {option.voters.map((voter, i) => (
                          <span key={voter.user_id}>
                            {voter.user_name} ({voter.participation_percentage}%)
                            {i < option.voters.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Admin: Reset vote buttons */}
                  {user?.is_admin && option.voters.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {option.voters.map((voter) => (
                        <button
                          key={voter.user_id}
                          onClick={() => handleResetVote(voter.user_id, voter.user_name)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <RotateCcw size={10} />
                          Resetear {voter.user_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!note.user_has_voted && (
            <p className="text-sm text-amber-600 mt-3 flex items-center gap-1">
              <AlertCircle size={14} />
              Tu voto es irreversible (solo admin puede resetearlo)
            </p>
          )}
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare size={18} />
          Comentarios ({note.comments.length})
        </h3>

        {/* Comment list */}
        <div className="space-y-4 mb-4">
          {note.comments.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay comentarios aun.</p>
          ) : (
            note.comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium text-gray-900">
                      {comment.user_name}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  {(comment.user_id === user?.id || user?.is_admin) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="text-gray-700 mt-1">{comment.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Add comment form */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submittingComment || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default NoteDetail
