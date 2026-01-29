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
      setLoading(true)
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
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full bg-white rounded-lg"
            style={{ minHeight: '80vh', minWidth: '80vw' }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
            title="PDF Preview"
          />
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
