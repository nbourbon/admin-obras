import { useEffect, useState } from 'react'
import { projectsAPI } from '../api/client'

const localNow = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}
const money = (value, currency) => `${currency} ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const errorText = (err) => {
  const detail = err.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Revisá los datos ingresados. No se pudo completar la operación.'
}

export default function CompositionModal({ project, members, onClose, onSuccess }) {
  const [rows, setRows] = useState(() => members.map(m => ({ key: `user-${m.user_id}`, user_id: m.user_id, name: m.user_name, percentage: String(m.participation_percentage) })))
  const [effective, setEffective] = useState(localNow)
  const [reason, setReason] = useState('')
  const [rate, setRate] = useState('')
  const [settlements, setSettlements] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requestKey] = useState(() => crypto.randomUUID())
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy, onClose])
  const invalidate = () => { setResult(null); setError('') }
  const updateRow = (key, field, value) => { invalidate(); setSettlements([]); setRows(rows.map(r => r.key === key ? { ...r, [field]: value } : r)) }
  const total = rows.reduce((sum, r) => sum + Math.round(Number(r.percentage || 0) * 100), 0) / 100
  const currency = project.currency_mode === 'ARS' ? 'ARS' : 'USD'
  const payload = () => ({
    effective_at: new Date(effective).toISOString(), reason,
    exchange_rate: project.currency_mode === 'DUAL' ? rate : null,
    members: rows.map(r => ({ key: r.key, ...(r.user_id ? { user_id: r.user_id } : { email: r.email, full_name: r.name }), percentage: r.percentage || '0' })),
    settlements: settlements.map(s => ({ ...s, paid_at: new Date(s.paid_at).toISOString() })),
  })
  const calculate = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setResult(null)
    try { setResult((await projectsAPI.previewComposition(project.id, payload())).data) }
    catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }
  const confirm = async () => {
    setBusy(true); setError('')
    try {
      await projectsAPI.changeComposition(project.id, { ...payload(), preview_token: result.preview_token, request_key: requestKey })
      onSuccess(); onClose()
    } catch (err) { setError(errorText(err)); if (err.response?.status === 409) setResult(null) }
    finally { setBusy(false) }
  }
  const dilute = () => {
    const newcomers = rows.filter(r => !r.user_id)
    const remaining = 10000 - newcomers.reduce((sum, r) => sum + Math.round(Number(r.percentage || 0) * 100), 0)
    const originals = rows.filter(r => r.user_id)
    const base = originals.reduce((sum, r) => sum + Number(members.find(m => m.user_id === r.user_id)?.participation_percentage || 0), 0)
    if (remaining < 0 || !base) { setError('Revisá los porcentajes de ingreso'); return }
    let distributed = 0
    const values = originals.map((r, index) => {
      const cents = index === originals.length - 1 ? remaining - distributed : Math.round(remaining * Number(members.find(m => m.user_id === r.user_id).participation_percentage) / base)
      distributed += cents
      return { ...r, percentage: (cents / 100).toFixed(2) }
    })
    invalidate(); setSettlements([]); setRows([...values, ...newcomers])
  }
  const settleAll = () => {
    const debtors = result.rows.filter(r => Number(r.adjustment) < 0).map(r => ({ key: r.key, cents: Math.round(-Number(r.adjustment) * 100) }))
    const creditors = result.rows.filter(r => Number(r.adjustment) > 0).map(r => ({ key: r.key, cents: Math.round(Number(r.adjustment) * 100) }))
    const payments = []
    for (const d of debtors) for (const c of creditors) {
      const cents = Math.min(d.cents, c.cents)
      if (cents) payments.push({ payer_key: d.key, recipient_key: c.key, amount: (cents / 100).toFixed(2), paid_at: localNow(), reference: 'Compensación externa declarada al cambiar composición' })
      d.cents -= cents; c.cents -= cents
    }
    setSettlements(payments); invalidate()
  }
  return <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 flex items-center justify-center">
    <section role="dialog" aria-modal="true" aria-labelledby="composition-title" className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
      <div className="flex justify-between items-center gap-4 mb-3"><h2 id="composition-title" className="text-xl font-bold">Cambiar composición</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar cambio de composición" className="p-2">✕</button></div>
      <p className="text-sm text-gray-600 mb-4">La inversión acumulada se rebalancea automáticamente. Los gastos originales se conservan. Los ajustes y pagos externos entre miembros no modifican la caja.</p>
      <form onSubmit={calculate} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Fecha y hora del corte<input autoFocus required type="datetime-local" step="1" value={effective} onChange={e => { setEffective(e.target.value); invalidate() }} className="mt-1 border rounded-lg p-2 w-full" /></label>
            <label className="text-sm font-medium">Motivo<input required minLength={3} maxLength={1000} value={reason} onChange={e => { setReason(e.target.value); invalidate() }} className="mt-1 border rounded-lg p-2 w-full" placeholder="Ej.: incorporación de nuevo inversor" /></label>
          </div>
          <p className="text-xs text-gray-500">Incluye gastos anteriores al corte, pagados y pendientes. Elegí un corte posterior al último gasto cargado. Ese período queda cerrado para nuevas cargas y cambios contables.</p>
          {project.currency_mode === 'DUAL' && <div className="rounded-lg bg-amber-50 p-3 text-sm"><label>Cotización del ajuste (ARS por USD)<input required type="number" min="0.0001" step="0.0001" value={rate} onChange={e => { setRate(e.target.value); invalidate() }} className="block border rounded-lg p-2 mt-1" /></label><p className="mt-2">La inversión se calcula con los USD históricos de los gastos. El ajuste se incorpora a la cuenta en pesos a esta cotización; su equivalente futuro en USD puede variar.</p></div>}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Participante</th><th className="p-2">Nueva participación (%)</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.key} className="border-b"><td className="p-2">{r.user_id ? r.name : <div className="space-y-2"><input aria-label="Nombre del nuevo miembro" required value={r.name} onChange={e => updateRow(r.key, 'name', e.target.value)} placeholder="Nombre completo" className="border rounded p-2 w-full" /><input aria-label="Email del nuevo miembro" required type="email" value={r.email} onChange={e => updateRow(r.key, 'email', e.target.value)} placeholder="Email para invitar al confirmar" className="border rounded p-2 w-full" /></div>}</td><td className="p-2"><input aria-label={`Participación de ${r.name || 'nuevo miembro'}`} type="number" required min="0" max="100" step="0.01" value={r.percentage} onChange={e => updateRow(r.key, 'percentage', e.target.value)} className="border rounded p-2 w-28" /></td><td>{!r.user_id && <button type="button" onClick={() => { setRows(rows.filter(x => x.key !== r.key)); setSettlements([]); invalidate() }} className="text-red-600">Quitar</button>}</td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap gap-3 items-center"><button type="button" onClick={() => { setRows([...rows, { key: crypto.randomUUID(), name: '', email: '', percentage: '' }]); setSettlements([]); invalidate() }} className="text-blue-700 border rounded-lg px-3 py-2">Agregar nuevo miembro</button><button type="button" onClick={dilute} className="text-blue-700 border rounded-lg px-3 py-2">Reducir proporcionalmente a los actuales</button><strong className={total === 100 ? 'text-green-700' : 'text-red-700'}>Total: {total}%</strong></div>
          <p className="text-xs text-gray-500">Para una salida, dejá 0%: su cuenta y acceso se conservan para consultar y cancelar obligaciones.</p>
          <div className="border rounded-lg p-3 space-y-3"><h3 className="font-semibold">Pagos externos ya realizados (opcional)</h3><p className="text-sm text-gray-600">Si no hubo pagos, dejá esta sección vacía. Si los hubo, registrá quién pagó, quién recibió y el importe en {currency}. Solo queda pendiente la diferencia.</p>
            {settlements.map((s, index) => <div key={index} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 border-b pb-3">
              {['payer_key', 'recipient_key'].map(field => <label key={field} className="text-xs">{field === 'payer_key' ? 'Pagó' : 'Recibió'}<select required value={s[field]} onChange={e => { setSettlements(settlements.map((v, i) => i === index ? { ...v, [field]: e.target.value } : v)); invalidate() }} className="block border rounded p-2 w-full"><option value="">Seleccionar</option>{rows.map(r => <option key={r.key} value={r.key}>{r.name || 'Nuevo miembro'}</option>)}</select></label>)}
              <label className="text-xs">Importe ({currency})<input required type="number" min="0.01" step="0.01" value={s.amount} onChange={e => { setSettlements(settlements.map((v, i) => i === index ? { ...v, amount: e.target.value } : v)); invalidate() }} className="block border rounded p-2 w-full" /></label>
              <label className="text-xs">Fecha del pago<input required type="datetime-local" step="1" value={s.paid_at} onChange={e => { setSettlements(settlements.map((v, i) => i === index ? { ...v, paid_at: e.target.value } : v)); invalidate() }} className="block border rounded p-2 w-full" /></label>
              <label className="text-xs">Referencia o comprobante<input required maxLength={500} value={s.reference} onChange={e => { setSettlements(settlements.map((v, i) => i === index ? { ...v, reference: e.target.value } : v)); invalidate() }} className="block border rounded p-2 w-full" /></label>
              <button type="button" className="text-red-600 text-sm" onClick={() => { setSettlements(settlements.filter((_, i) => i !== index)); invalidate() }}>Quitar pago</button>
            </div>)}
            <div className="flex flex-wrap gap-4"><button type="button" className="text-blue-700 text-sm" onClick={() => { setSettlements([...settlements, { payer_key: '', recipient_key: '', amount: '', paid_at: localNow(), reference: '' }]); invalidate() }}>Registrar un pago externo</button>{result && <button type="button" onClick={settleAll} className="text-blue-700 text-sm">Completar compensación total</button>}</div>
          </div>
          <button type="submit" disabled={total !== 100} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Calculando…' : 'Calcular y revisar rebalanceo'}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg">{error}</p>}
      {result && <div className="mt-5 space-y-3 border-t pt-4"><h3 className="font-bold">Resultado antes de confirmar</h3><p className="text-sm">Inversión: <strong>{money(result.total_investment, result.currency)}</strong> · Incluye {money(result.unpaid_investment, result.currency)} pendientes de pago.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-gray-50"><th className="p-2">Miembro</th><th className="p-2">Rebalanceo ({result.currency})</th><th className="p-2">Compensación externa ({result.currency})</th><th className="p-2">Saldo previo ({result.balance_currency})</th><th className="p-2">Saldo final ({result.balance_currency})</th><th className="p-2">Gastos pendientes ({result.balance_currency})</th></tr></thead><tbody>{result.rows.map(r => <tr key={r.key} className="border-b"><td className="p-2">{r.name}</td>{['adjustment', 'external_settlement', 'balance_before', 'balance_after', 'pending_expenses'].map(field => <td key={field} className="p-2 whitespace-nowrap">{Number(r[field]).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>)}</tr>)}</tbody></table></div>
        <p className="text-sm text-gray-600">Positivo: a favor. Negativo: a integrar. Los gastos pendientes conservan sus importes originales y se muestran aparte del saldo de cuenta. Impacto en caja: <strong>0</strong>.</p>
        <button type="button" disabled={busy} onClick={confirm} className="bg-green-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Guardando…' : 'Confirmar cambio de composición'}</button>
      </div>}
    </section>
  </div>
}
