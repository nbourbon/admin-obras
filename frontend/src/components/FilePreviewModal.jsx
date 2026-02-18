import { useState, useEffect } from 'react'
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

function FilePreviewModal({ isOpen, onClose, fileUrl, fileName, onDownload }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Determine file type from name or URL
  const getFileType = () => {
    const name = (fileName || fileUrl || '').toLowerCase()
    if (name.endsWith('.pdf')) return 'pdf'
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp')) return 'image'
    // Default to image for unknown types from receipts/invoices
    return 'image'
  }

  const fileType = getFileType()

  useEffect(() => {
    if (isOpen) {
      // External PDFs show a static panel — no loading state needed
      const isExternalPdf = fileType === 'pdf' && fileUrl && !fileUrl.startsWith('blob:')
      setLoading(!isExternalPdf)
      setError(false)
      setZoom(1)
      setRotation(0)
    }
  }, [isOpen, fileUrl])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black bg-opacity-50">
        <h3 className="text-white font-medium truncate max-w-md">
          {fileName || 'Vista previa'}
        </h3>
        <div className="flex items-center gap-2">
          {fileType === 'image' && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title="Alejar"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title="Acercar"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title="Rotar"
              >
                <RotateCw size={20} />
              </button>
              <div className="w-px h-6 bg-white bg-opacity-30 mx-2" />
            </>
          )}
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              title="Descargar"
            >
              <Download size={20} />
              <span className="text-sm hidden sm:inline">Descargar</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {error && (
          <div className="text-center text-white">
            <p className="text-lg mb-2">No se pudo cargar el archivo</p>
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Descargar en su lugar
            </button>
          </div>
        )}

        {fileType === 'pdf' ? (
          // External URLs (Cloudinary) block iframe embedding — open in new tab instead
          fileUrl?.startsWith('blob:') ? (
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full bg-white rounded-lg"
              style={{ minHeight: '80vh', minWidth: '80vw' }}
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true) }}
              title="PDF Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 text-white" onClick={e => e.stopPropagation()}>
              <div className="bg-white bg-opacity-10 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><polyline points="9 9 10 9"/></svg>
                <p className="text-center text-sm text-white text-opacity-80">
                  El PDF no se puede previsualizar aquí directamente.
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors"
                  onClick={() => setLoading(false)}
                >
                  Abrir PDF
                </a>
              </div>
            </div>
          )
        ) : (
          <img
            src={fileUrl}
            alt={fileName || 'Preview'}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              opacity: loading ? 0 : 1,
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        )}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  )
}

export default FilePreviewModal
