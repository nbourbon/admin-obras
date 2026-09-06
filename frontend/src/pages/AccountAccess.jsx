import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AppLogo from '../components/AppLogo'

const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500'

export default function AccountAccess({ mode }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '')
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(mode === 'action')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { logout } = useAuth()

  useEffect(() => {
    if (mode !== 'action') return
    // Remove the bearer link from the address bar/history before interacting with the page.
    window.history.replaceState(null, '', window.location.pathname)
    let active = true
    if (!token) {
      setError('Falta el enlace del correo. Abrilo nuevamente o solicitá uno nuevo.')
      setLoading(false)
      return
    }
    authAPI.actionInfo(token)
      .then(({ data }) => { if (active) setInfo(data) })
      .catch(err => { if (active) setError(err.response?.data?.detail || 'No se pudo verificar el enlace. Volvé a abrirlo desde el correo.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mode, token])

  const title = mode === 'register' ? 'Crear cuenta' : mode === 'forgot' ? 'Recuperar contraseña'
    : mode === 'verify' ? 'Reenviar verificación' : info?.purpose === 'invite' ? 'Aceptar invitación'
    : info?.purpose === 'reset' ? 'Elegí una contraseña nueva' : 'Confirmar correo y activar cuenta'

  const submit = async event => {
    event.preventDefault()
    setError('')
    if (mode === 'action' && info?.requires_password && password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      let response
      if (mode === 'register') response = await authAPI.selfRegister({ email, full_name: fullName })
      else if (mode === 'forgot') response = await authAPI.forgotPassword(email)
      else if (mode === 'verify') response = await authAPI.resendVerification(email)
      else {
        response = await authAPI.completeAction(token, info?.requires_password ? password : undefined)
        if (info?.requires_password) logout()
      }
      setMessage(response.data.message)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'No se pudo completar. Revisá los datos y volvé a intentar.')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-white p-7 shadow-sm space-y-6">
        <div className="flex justify-center"><AppLogo size={64} /></div>
        <h1 className="text-center text-2xl font-bold text-gray-900">{title}</h1>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message ? <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p> : (
          <form onSubmit={submit} className="space-y-4">
            {mode !== 'action' && <>
              <p className="text-sm text-gray-600">{mode === 'register'
                ? 'Te enviaremos un enlace para confirmar tu correo y elegir tu contraseña.'
                : 'Ingresá tu correo. Si corresponde, te enviaremos los pasos para continuar.'}</p>
              {mode === 'register' && <label className="block text-sm font-medium" htmlFor="full-name">Nombre completo
                <input id="full-name" autoComplete="name" required maxLength={255} value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
              </label>}
              <label className="block text-sm font-medium" htmlFor="email">Correo electrónico
                <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
              </label>
            </>}
            {mode === 'action' && info?.requires_password && <>
              <p className="text-sm text-gray-600">Usá una contraseña de al menos 10 caracteres.</p>
              <label className="block text-sm font-medium" htmlFor="new-password">Nueva contraseña
                <input id="new-password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm font-medium" htmlFor="confirm-password">Repetir contraseña
                <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} />
              </label>
            </>}
            {mode === 'action' && info && !info.requires_password && <p className="text-gray-600 text-sm">
              Confirmá la invitación y después ingresá con tu cuenta habitual{info.google_only ? ' de Google' : ''}.
            </p>}
            {(mode !== 'action' || info) && <button disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Procesando…' : mode === 'action' ? 'Confirmar' : 'Enviar enlace'}
            </button>}
            {mode === 'action' && loading && !info && <p role="status">Verificando enlace…</p>}
          </form>
        )}
        <div className="text-center text-sm space-y-2">
          <Link className="block text-blue-600 hover:underline" to="/login">Volver al inicio de sesión</Link>
          {mode !== 'verify' && <Link className="block text-gray-600 hover:underline" to="/resend-verification">Reenviar correo de activación</Link>}
          {mode === 'action' && <Link className="block text-gray-600 hover:underline" to="/forgot-password">Solicitar otro enlace de recuperación</Link>}
        </div>
      </div>
    </main>
  )
}
