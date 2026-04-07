# Pull Request: Eliminar Aportes de Forma Segura

## Descripción

Esta PR agrega la funcionalidad para que los administradores puedan eliminar aportes (contributions) de forma segura, ajustando automáticamente los saldos de la cuenta corriente cuando corresponda.

## Motivación

Anteriormente, una vez creado un aporte individual (unilateral), no existía forma de eliminarlo desde la interfaz. Esto generaba problemas cuando:

- Se creaba un aporte por error
- Se ingresaba un monto incorrecto
- Se necesitaba corregir el saldo de la cuenta corriente

## Cambios Realizados

### Backend

#### Nuevo Endpoint: `DELETE /contributions/{contribution_id}`

**Archivo:** `app/routers/contributions.py`

- Agrega endpoint para eliminar aportes (solo administradores)
- **Validaciones de seguridad:**
  - Verifica que el aporte exista y pertenezca al proyecto actual
  - Solo administradores pueden eliminar
  - Los aportes unilaterales solo se pueden eliminar si no fueron absorbidos por una solicitud de aporte grupal
  - Las solicitudes de aporte formales solo se pueden eliminar si no hay pagos realizados

- **Ajuste automático de saldos:**
  - Para aportes unilaterales aprobados: revierte el crédito del balance del miembro
  - Para ajustes de saldo: revierte el ajuste para todos los miembros
  - Compatible con los modos de moneda: DUAL, ARS y USD

- **Cascada de eliminación:**
  - Elimina primero los `ContributionPayment` asociados
  - Luego elimina el `Contribution`

### Frontend

#### API Client
**Archivo:** `frontend/src/api/client.js`

- Agrega método `delete(id)` al `contributionsAPI`

#### Lista de Aportes
**Archivo:** `frontend/src/pages/Contributions.jsx`

- Agrega botón de eliminar (🗑️) en la lista de aportes
- Solo visible para administradores
- Muestra el botón según las reglas de negocio:
  - ✅ Aportes individuales: siempre eliminables (si no fueron absorbidos)
  - ✅ Ajustes de saldo: siempre eliminables
  - ✅ Solicitudes formales: solo si `paid_participants === 0`
- Confirmación antes de eliminar
- Recarga la lista automáticamente después de eliminar

#### Detalle de Aporte
**Archivo:** `frontend/src/pages/ContributionDetail.jsx`

- Agrega botón de eliminar en el header del detalle
- Mismas reglas de visibilidad que en la lista
- Redirige a la lista de aportes después de eliminar

## Reglas de Negocio

| Tipo de Aporte | Puede Eliminar | Condición |
|----------------|----------------|-----------|
| Individual (Unilateral) | ✅ Sí | Si no fue absorbido por otra solicitud |
| Ajuste de Saldo | ✅ Sí | Siempre |
| Solicitud Formal | ⚠️ Solo si no hay pagos | `paid_participants === 0` |

## Flujo de Eliminación

```
┌─────────────────────────────────────────────────────────────┐
│  Admin hace clic en Eliminar                                │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Confirmación: "¿Eliminar este aporte? Esta acción no se    │
│  puede deshacer y el saldo se ajustará automáticamente."   │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend valida:                                            │
│  • ¿Es admin?                                               │
│  • ¿El aporte existe?                                       │
│  • ¿Fue absorbido? (solo unilaterales)                      │
│  • ¿Hay pagos? (solo solicitudes formales)                  │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Si es válido:                                              │
│  • Revierte el saldo acreditado (si aplica)                 │
│  • Elimina los pagos asociados                              │
│  • Elimina el aporte                                        │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend recarga la lista / redirige                       │
└─────────────────────────────────────────────────────────────┘
```

## Testing

Los tests existentes pasan correctamente:

```bash
pytest tests/ -v
# 3 passed in X.XXs
```

## Screenshots

### Lista de Aportes
En la lista de aportes, los administradores verán un ícono de 🗑️ junto a los aportes que pueden eliminar.

### Detalle de Aporte
En la página de detalle, el botón de eliminar aparece en el header junto al estado del aporte.

## Checklist

- [x] Endpoint DELETE implementado en backend
- [x] Validaciones de seguridad implementadas
- [x] Ajuste automático de saldos implementado
- [x] Botón de eliminar en lista de aportes
- [x] Botón de eliminar en detalle de aporte
- [x] Confirmación antes de eliminar
- [x] Tests existentes pasan
- [x] Código sigue el estilo del proyecto

## Breaking Changes

Ninguno. Esta PR solo agrega funcionalidad nueva sin modificar comportamientos existentes.

## Notas para el Revisor

1. El endpoint verifica que los aportes unilaterales no hayan sido absorbidos consultando la tabla `contribution_absorptions`
2. El ajuste de saldo se hace restando el monto del balance del miembro (o miembros en caso de ajustes)
3. Se respeta el modo de moneda del proyecto (DUAL, ARS, USD) al ajustar saldos
