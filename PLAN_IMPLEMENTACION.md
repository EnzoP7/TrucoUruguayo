# Plan de Implementación - Funcionalidades Faltantes Truco Uruguayo

## Orden de Ejecución Optimizado

El orden está pensado para minimizar retrabajos y aprovechar dependencias entre funcionalidades.

---

## FASE 1: Correcciones Críticas (Base para el resto)

### 1.1 ✅ Puntos cuando se rechaza Contra Flor en Perros
- **Archivo:** `server.js` (handler `responder-perros`)
- **Cambio:** Cuando `tieneFlor && !quiereContraFlor`, sumar 3 puntos al equipo que echó los perros
- **Tiempo estimado:** 5 min

### 1.2 Verificar cálculo de Flor con múltiples piezas
- **Archivo:** `server.js` (función `calcularPuntosFlor`)
- **Verificar:** Si hay 2+ piezas, valor completo de la mayor + último dígito del resto
- **Ejemplo:** 2 muestra (30) + 5 muestra (28) = 30 + 8 = 38
- **Tiempo estimado:** 15 min

### 1.3 Verificar que el 12 del palo muestra tenga valor correcto en Envido/Flor
- **Archivo:** `server.js` (funciones de cálculo de puntos)
- **Verificar:** Si muestra es pieza (2,4,5,10,11), el 12 de ese palo toma su valor
- **Tiempo estimado:** 10 min

---

## FASE 2: Sistema de Revire del Envido

### 2.1 Modificar estructura de `envidoActivo`
- **Archivo:** `server.js`
- **Cambios:**
  - Agregar campo `cadenaEnvidos: []` para tracking de envidos cantados
  - Modificar `puntosAcumulados` para sumar correctamente
  - Agregar `puntosSiNoQuiere` dinámico según cadena

### 2.2 Modificar `cantarEnvido` para permitir revire
- **Reglas:**
  - Envido (2pts) → puede revirar con Envido, Real Envido, Falta Envido
  - Real Envido (3pts) → puede revirar con Real Envido, Falta Envido
  - Falta Envido → no se puede revirar
- **Puntos si no quiere:** suma de todos los anteriores menos el último + 1

### 2.3 Actualizar UI para mostrar opción de revirar
- **Archivo:** `src/app/game/page.tsx`
- **Cambio:** Cuando me cantan envido, mostrar opciones de aceptar, rechazar O revirar

---

## FASE 3: Sistema de Flor Completo

### 3.1 Flor cuando ambos equipos tienen
- **Archivo:** `server.js` (función `cantarFlorAutomatica` y resolución)
- **Cambios:**
  - Detectar si ambos equipos tienen flor
  - Comparar puntajes de flor
  - El mayor gana 3 puntos (o 6 si hay múltiples flores)

### 3.2 Implementar Contra Flor al Resto
- **Archivo:** `server.js`
- **Nuevo handler:** `responder-flor` con opciones:
  - Aceptar flor (3 pts al ganador)
  - Contra Flor al Resto (gana el partido quien tenga mejor flor)
  - Con Flor Envido (se juega flor + envido)
- **UI:** Modal con opciones cuando el rival canta flor y yo tengo flor

### 3.3 Implementar Con Flor Envido
- **Lógica:**
  - Se comparan las flores primero
  - Luego se comparan los envidos
  - Puntos = puntos de flor + puntos de envido
- **Requiere:** Que el sistema de flor esté completo

---

## FASE 4: Mejoras a los Perros

### 4.1 Validar flor del equipo echador después de respuesta
- **Lógica actual:** El equipo que echa no ve sus cartas hasta respuesta ✅
- **Faltante:** Después de respuesta, verificar si echador tiene flor y aplicar contra flor
- **Cambio:** En `responder-perros`, después de revelar cartas, ejecutar lógica de flor

### 4.2 Botón "Cancelar Perros" persistente
- **Verificar:** Si ya existe y funciona correctamente
- **Si no:** Agregar estado `perrosPersistentes` que mantiene los perros entre rondas

---

## FASE 5: Reglas de Empate (Verificación)

### 5.1 Auditar lógica de empates en manos
- **Archivo:** `server.js` (función `evaluarEstadoRonda` o similar)
- **Reglas a verificar:**
  1. Empate en 1ra → 2da define
  2. Empate en 1ra y 2da → 3ra define
  3. Si equipo A ganó 1ra, equipo B debe ganar 2da para continuar
  4. Empate en 2da o 3ra → gana quien hizo la 1ra

---

## FASE 6: Modo 6 Jugadores Especial (Baja Prioridad)

### 6.1 Alternancia 3v3 / 1v1 en malas
- **Lógica:** Cuando ambos equipos están en "malas" (< 15 pts), alternar entre:
  - Rondas normales 3v3
  - Rondas individuales donde cada jugador enfrenta al de enfrente
- **Complejidad:** Alta - requiere reestructurar el flujo del juego

---

## Resumen de Archivos a Modificar

| Archivo | Fases |
|---------|-------|
| `server.js` | 1, 2, 3, 4, 5 |
| `src/app/game/page.tsx` | 2, 3 |
| `src/types/truco.ts` | 2, 3 |
| `src/types/socket.ts` | 2, 3 |

---

## Progreso

- [x] **FASE 1.1** - Puntos rechazo contra flor en perros (3 pts al echador)
- [x] **FASE 1.2** - Verificar cálculo flor múltiples piezas (YA IMPLEMENTADO)
- [x] **FASE 1.3** - Verificar 12 del palo muestra en envido/flor (YA IMPLEMENTADO)
- [x] **FASE 2** - Sistema de Revire del Envido (YA IMPLEMENTADO + UI mejorada)
- [x] **FASE 3.1** - Flor ambos equipos (YA IMPLEMENTADO - se comparan y gana el mayor)
- [x] **FASE 3.2** - Contra Flor al Resto (IMPLEMENTADO - backend + UI)
- [x] **FASE 3.3** - Con Flor Envido (IMPLEMENTADO)
- [x] **FASE 4.1** - Validar flor echador post-respuesta (IMPLEMENTADO)
- [x] **FASE 4.2** - Cancelar perros persistente (VERIFICADO + BOTÓN AGREGADO)
- [x] **FASE 5.1** - Auditar empates (CORRECTO)
- [ ] **FASE 6.1** - Modo 3v3/1v1 alternado (opcional, baja prioridad)
