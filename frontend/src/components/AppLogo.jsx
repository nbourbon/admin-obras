/**
 * AppLogo — "Proyectos Compartidos"
 * Tres nodos conectados entre sí, representando colaboración y participación compartida.
 */
function AppLogo({ size = 64, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Fondo cuadrado redondeado azul */}
      <rect width="100" height="100" rx="22" fill="#2563EB" />

      {/* Líneas de conexión entre los tres nodos */}
      <line x1="50" y1="26" x2="24" y2="70" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
      <line x1="50" y1="26" x2="76" y2="70" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
      <line x1="24" y1="70" x2="76" y2="70" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />

      {/* Nodo superior (más grande — nodo principal / proyecto) */}
      <circle cx="50" cy="26" r="10" fill="white" />

      {/* Nodo inferior izquierdo */}
      <circle cx="24" cy="70" r="8.5" fill="white" opacity="0.9" />

      {/* Nodo inferior derecho */}
      <circle cx="76" cy="70" r="8.5" fill="white" opacity="0.9" />
    </svg>
  )
}

export default AppLogo
