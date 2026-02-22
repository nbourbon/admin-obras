import { useState, useEffect } from 'react'
import { rubrosAPI, categoriesAPI, avanceObraAPI } from '../api/client'
import { HardHat, Save, ChevronDown, ChevronRight } from 'lucide-react'

function AvanceObra() {
  const [rubros, setRubros] = useState([])
  const [categories, setCategories] = useState([])
  const [entries, setEntries] = useState({}) // { "r-{id}": {checked, value, notes}, "c-{rubroId}-{catId}": {...} }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [rubrosRes, catsRes, avanceRes] = await Promise.all([
        rubrosAPI.list(),
        categoriesAPI.list(),
        avanceObraAPI.list(),
      ])

      setRubros(rubrosRes.data)
      setCategories(catsRes.data)

      // Pre-fill state from existing avance data
      const initial = {}
      for (const e of avanceRes.data) {
        if (e.category === null) {
          initial[`r-${e.rubro.id}`] = { checked: true, value: String(e.percentage), notes: e.notes || '' }
        } else {
          initial[`c-${e.rubro.id}-${e.category.id}`] = { checked: true, value: String(e.percentage), notes: e.notes || '' }
        }
      }
      setEntries(initial)
    } catch (err) {
      setError('Error al cargar los datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getEntry = (key) => entries[key] || { checked: false, value: '', notes: '' }

  const setEntryField = (key, field, value) => {
    setEntries(prev => ({
      ...prev,
      [key]: { ...getEntry(key), ...prev[key], [field]: value },
    }))
  }

  const toggleCheck = (key) => {
    const current = getEntry(key)
    setEntries(prev => ({
      ...prev,
      [key]: { ...current, checked: !current.checked },
    }))
  }

  const toggleCollapse = (rubroId) => {
    setCollapsed(prev => ({ ...prev, [rubroId]: !prev[rubroId] }))
  }

  const handleSave = async () => {
    const payload = []

    for (const [key, entry] of Object.entries(entries)) {
      if (!entry.checked) continue
      const val = parseFloat(entry.value)
      if (isNaN(val) || val < 0 || val > 100) continue

      if (key.startsWith('r-')) {
        const rubroId = parseInt(key.slice(2))
        payload.push({ rubro_id: rubroId, category_id: null, percentage: val, notes: entry.notes || null })
      } else if (key.startsWith('c-')) {
        const parts = key.slice(2).split('-')
        const rubroId = parseInt(parts[0])
        const catId = parseInt(parts[1])
        if (rubroId === 0) continue // skip generic categories (no rubro assigned)
        payload.push({ rubro_id: rubroId, category_id: catId, percentage: val, notes: entry.notes || null })
      }
    }

    try {
      setSaving(true)
      setError(null)
      await avanceObraAPI.save(payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Error al guardar los cambios')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Build map: rubroId -> categories of that rubro
  const catsByRubro = {}
  for (const cat of categories) {
    if (!cat.is_active) continue
    if (cat.rubro) {
      if (!catsByRubro[cat.rubro.id]) catsByRubro[cat.rubro.id] = []
      catsByRubro[cat.rubro.id].push(cat)
    }
  }

  // Categories with no rubro assigned
  const genericCats = categories.filter(c => c.is_active && !c.rubro)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <HardHat size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Avance de Obra</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">Cambios guardados correctamente</div>
      )}

      <p className="text-sm text-gray-500">
        Tilde las filas que quieras registrar e ingresa el porcentaje de avance (0-100).
      </p>

      {rubros.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          No hay rubros configurados para este proyecto. Agregá rubros primero.
        </div>
      )}

      {/* Rubro sections */}
      {rubros.map(rubro => {
        const rubroKey = `r-${rubro.id}`
        const rubroEntry = getEntry(rubroKey)
        const rubroCats = catsByRubro[rubro.id] || []
        const isCollapsed = collapsed[rubro.id]

        return (
          <div key={rubro.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Rubro header */}
            <button
              onClick={() => toggleCollapse(rubro.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {isCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              <span className="font-semibold text-gray-800 uppercase tracking-wide text-sm flex-1">{rubro.name}</span>
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-gray-100">
                {/* Rubro-level row */}
                <EntryRow
                  label="Avance del rubro (general)"
                  keyName={rubroKey}
                  entry={rubroEntry}
                  onToggle={() => toggleCheck(rubroKey)}
                  onChange={(field, val) => setEntryField(rubroKey, field, val)}
                  isRubroLevel
                />

                {/* Category rows */}
                {rubroCats.map(cat => {
                  const catKey = `c-${rubro.id}-${cat.id}`
                  const catEntry = getEntry(catKey)
                  return (
                    <EntryRow
                      key={catKey}
                      label={cat.name}
                      keyName={catKey}
                      entry={catEntry}
                      onToggle={() => toggleCheck(catKey)}
                      onChange={(field, val) => setEntryField(catKey, field, val)}
                    />
                  )
                })}

                {rubroCats.length === 0 && (
                  <p className="px-6 py-3 text-sm text-gray-400 italic">Sin categorías asignadas a este rubro</p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Generic categories (no rubro) */}
      {genericCats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleCollapse('__generic')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            {collapsed['__generic'] ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            <span className="font-semibold text-gray-800 uppercase tracking-wide text-sm flex-1">Categorías Generales</span>
            <span className="text-xs text-gray-400 italic mr-2">sin rubro — no se guardan</span>
          </button>

          {!collapsed['__generic'] && (
            <div className="divide-y divide-gray-100">
              {genericCats.map(cat => {
                const catKey = `c-0-${cat.id}`
                const catEntry = getEntry(catKey)
                return (
                  <EntryRow
                    key={catKey}
                    label={cat.name}
                    keyName={catKey}
                    entry={catEntry}
                    onToggle={() => toggleCheck(catKey)}
                    onChange={(field, val) => setEntryField(catKey, field, val)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EntryRow({ label, entry, onToggle, onChange, isRubroLevel }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isRubroLevel ? 'bg-blue-50' : ''}`}>
      <input
        type="checkbox"
        checked={entry.checked}
        onChange={onToggle}
        className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
      />
      <span className={`flex-1 text-sm ${entry.checked ? 'text-gray-900 font-medium' : 'text-gray-400'} ${isRubroLevel ? 'italic' : ''}`}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={entry.value}
          onChange={(e) => onChange('value', e.target.value)}
          disabled={!entry.checked}
          placeholder="—"
          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg text-center disabled:bg-gray-50 disabled:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  )
}

export default AvanceObra
