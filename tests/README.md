# Tests — Proyectos Compartidos

## Estrategia

Los tests están organizados en tres capas:

1. **Escenarios** (`scenarios/`): documentación paso a paso de qué se hace y qué se espera ver.
   Son la fuente de verdad. Se escriben primero, se automatizan después.

2. **Fixtures** (`fixtures/`): datos base reutilizables (usuarios, proyectos, configuración).

3. **E2E automáticos** (`e2e/`): tests en `pytest` que ejecutan los escenarios contra la API real
   con una base de datos de prueba (SQLite en memoria).

---

## Cómo correr los tests automáticos

```bash
# Desde la raíz del proyecto (con el venv activado)
pip install pytest

# Correr todos los e2e
pytest tests/e2e/ -v

# Correr un escenario específico
pytest tests/e2e/test_01_construccion_dual_current_account.py -v
```

El backend usa SQLite en una BD temporal (`tests/test_e2e.db`) que se destruye al
terminar la sesión. No toca la base de datos real ni de producción.

---

## Convención de escenarios

Cada archivo en `scenarios/` describe:
- **Setup**: participantes, porcentajes, configuración del proyecto
- **Pasos**: acción → estado esperado del dashboard / saldos
- **Estado esperado**: tabla con el balance de cada participante tras cada paso

### Formato de tabla de estado esperado

| Paso | Acción | Saldo Nicolás (ARS) | Saldo María (ARS) | Caja General (ARS) |
|------|--------|--------------------:|------------------:|-------------------:|
| 1    | ...    | +500.000            | 0                 | +500.000           |

- **Saldo positivo** = la persona tiene crédito a favor (puso más de lo que le corresponde)
- **Saldo negativo** = la persona tiene deuda (se gastó más de lo que aportó)
- **Caja General** = suma de todos los saldos

---

## Escenarios definidos

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `01_construccion_dual_current_account.md` | Proyecto construcción, moneda DUAL, solo aportes a caja | ✅ Implementado |
| `02_construccion_ars_current_account.md` | Proyecto construcción, moneda ARS, solo aportes a caja | ✅ Implementado |
| `03_construccion_usd_current_account.md` | Proyecto construcción, moneda USD, solo aportes a caja | ✅ Implementado |
