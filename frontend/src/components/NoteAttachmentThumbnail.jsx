import { useEffect, useRef, useState } from 'react'
import { FileText, ImageOff, Loader2 } from 'lucide-react'
import { notesAPI } from '../api/client'

export default function NoteAttachmentThumbnail({ noteId, file, disabled, onOpen }) {
  const button = useRef(null)
  const [preview, setPreview] = useState(null)
  const [failed, setFailed] = useState(false)
  const isImage = file.content_type?.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(file.filename)

  useEffect(() => {
    let disposed = false
    let url
    setPreview(null)
    setFailed(false)
    if (!isImage) return

    const load = async () => {
      try {
        const response = await notesAPI.downloadAttachment(noteId, file.id)
        if (disposed) return
        const blob = new Blob([response.data], { type: file.content_type || response.data.type })
        url = URL.createObjectURL(blob)
        setPreview({ url, blob })
      } catch {
        if (!disposed) setFailed(true)
      }
    }
    // Fetch private images only near the viewport, using the authenticated API.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        load()
      }
    }, { rootMargin: '200px' })
    observer.observe(button.current)
    return () => {
      disposed = true
      observer.disconnect()
      if (url) URL.revokeObjectURL(url)
    }
  }, [noteId, file.id, file.content_type, isImage])

  return (
    <button ref={button} type="button" disabled={disabled}
      onClick={() => onOpen(preview?.blob)}
      aria-label={`Abrir ${file.filename}`} title={file.filename}
      className="group w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
      <div className="aspect-[4/3] flex items-center justify-center overflow-hidden p-2">
        {isImage ? (
          failed ? <ImageOff className="text-gray-400" size={32} /> : preview ? (
            <img src={preview.url} alt={`Vista previa de ${file.filename}`} onError={() => setFailed(true)}
              className="h-full w-full object-contain" />
          ) : <Loader2 className="animate-spin text-gray-400" size={24} aria-label="Cargando miniatura" />
        ) : <div className="flex flex-col items-center gap-2 text-red-600"><FileText size={40} /><span className="text-sm font-medium">PDF</span></div>}
      </div>
      <div className="border-t bg-white px-3 py-2 text-sm text-blue-600 text-center">
        {failed ? 'Abrir archivo' : 'Tocá para abrir'}
      </div>
    </button>
  )
}
