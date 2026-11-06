export default function NoteFilePicker({ files, onChange, disabled }) {
  return <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700">Adjuntos
      <input className="block mt-2 w-full text-sm" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={disabled}
        onChange={(e) => { onChange([...files, ...Array.from(e.target.files)]); e.target.value = '' }} />
    </label>
    <p className="text-xs text-gray-500">PDF, JPG o PNG. Hasta 10 archivos, 10 MB por archivo y 50 MB por nota. Si suman más de 10 MB, el correo incluirá el enlace a la nota.</p>
    {files.map((file, i) => <div key={i} className="flex justify-between gap-2 text-sm">
      <span className="break-all">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
      <button type="button" disabled={disabled} onClick={() => onChange(files.filter((_, index) => index !== i))} className="text-red-600">Quitar</button>
    </div>)}
  </div>
}

export function validateNoteFiles(files) {
  if (files.length > 10) throw new Error('Podés seleccionar hasta 10 archivos')
  if (files.some(f => f.size > 10 * 1024 * 1024)) throw new Error('Cada archivo puede pesar hasta 10 MB')
  if (files.reduce((sum, f) => sum + f.size, 0) > 50 * 1024 * 1024) throw new Error('Los adjuntos pueden sumar hasta 50 MB')
}
