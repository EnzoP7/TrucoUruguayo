# Mejoras y Correcciones - Truco Uruguayo

## Estado: Completado

---

## Problemas de Reglas

### 1. [ALTA] Flor: Cálculo con múltiples piezas incorrecto
- **Archivo**: `server.js` - `calcularPuntosFlor()`
- **Problema**: Usa `% 10` para el último dígito de piezas secundarias. Para el 2 de la muestra (valor 30), `30 % 10 = 0` cuando debería ser 10.
- **Corrección**: Usar `valor - 20` en vez de `% 10` (30→10, 29→9, 28→8, 27→7)
- **Impacto**: Flor máxima real = 47 (2+4+5 muestra), con el bug = 39

### 2. [MEDIA] Pieza del 12: Verificar regla
- **Archivo**: `server.js` - `actualizarPoderConMuestra()`
- **Problema**: Si la muestra es pieza (2,4,5,10,11), el 12 del mismo palo debe tomar el valor de esa pieza
- **Verificar**: Que el 12 reciba el poder correcto en todos los casos

### 3. [MEDIA] Falta Envido: Verificar cálculo
- **Archivo**: `server.js` - `calcularPuntosEnvidoTipo()`
- **Problema**: Debe usar `puntosLimite - max(puntaje_equipo1, puntaje_equipo2)`
- **Verificar**: Que no use el puntaje del equipo que cantó

### 4. [MEDIA] Contra Flor al Resto rechazada
- **Archivo**: `server.js` - `responderFlor()`
- **Problema**: Rechazar contra flor al resto debe otorgar TODOS los puntos restantes al equipo que la cantó (ganan la partida)
- **Verificar**: Que `no_quiero` a `contra_flor` dé los puntos correctos

### 5. [BAJA] Piezas: Valores de envido
- **Archivo**: `server.js` - `calcularPuntosEnvidoJugador()`
- **Valores correctos**: 2 muestra=30, 4 muestra=29, 5 muestra=28, 10/11 muestra=27
- **Verificar**: Que use estos valores exactos

---

## Bugs de Lógica

### 6. [ALTA] Turno en modo Pico a Pico (3v3 → rondas 1v1)
- **Archivo**: `server.js` - `siguienteTurno()`
- **Problema**: Incrementa con `% jugadores.length` ciclando por los 6 jugadores. En rondas 1v1 de pico a pico, solo 2 participan (`participaRonda = true`). El turno puede saltar a jugadores sin cartas.
- **Nota**: Solo aplica a 3v3 con pico a pico. 1v1 y 2v2 NO tienen pico a pico.

### 7. [ALTA] Rotación de mano en Pico a Pico
- **Archivo**: `server.js` - rotación de `mesa.indiceMano`
- **Problema**: `indiceMano` se incrementa con `% jugadores.length`, puede quedar en un jugador que no participa en la siguiente ronda 1v1
- **Nota**: Solo aplica a 3v3 con pico a pico.

### 8. [MEDIA] Puntos al rechazar truco
- **Archivo**: `server.js` - `responderTruco()`
- **Problema**: Lógica de puntos redundante/incorrecta al decir "no quiero"
- **Verificar**: Que solo sume `puntosSiNoQuiere` al equipo contrario

---

## Mejoras de UX/UI

### 9. [BAJA] Indicador de conexión
- **Archivo**: `src/app/game/page.tsx`
- **Mejora**: Agregar indicador visual de estado de conexión (punto verde/rojo)

### 10. [BAJA] Race conditions con setTimeout
- **Archivo**: `src/app/game/page.tsx`
- **Mejora**: Agregar guardias `mounted` a todos los setTimeout

### 11. [BAJA] Funciones sin usar
- **Archivo**: `src/app/game/page.tsx`
- **Mejora**: Eliminar `mostrarBocadillo` y `mostrarMensaje` si no se usan

### 12. [BAJA] Mensajes de error claros
- **Archivo**: `server.js`
- **Mejora**: Retornar mensajes descriptivos cuando se intenta cantar envido en mano 2+, etc.

---

## Progreso

- [x] Fix #1 - Flor con múltiples piezas → Cambiado `% 10` a `valor - 20` en `calcularPuntosFlor()`
- [x] Fix #2 - Pieza del 12 → Ya estaba correcto (`actualizarPoderConMuestra`, `getValorEnvido`, `esPieza`)
- [x] Fix #3 - Falta Envido cálculo → Ya estaba correcto (`Math.min(max1, max2)`)
- [x] Fix #4 - Contra Flor rechazada → Corregido: `no_quiero` a `contra_flor` ahora da todos los puntos restantes
- [x] Fix #5 - Valores envido piezas → Ya estaba correcto (2=30, 4=29, 5=28, 10/11=27)
- [x] Fix #6 - Turno pico a pico → `siguienteTurno()` ahora salta jugadores con `participaRonda=false`
- [x] Fix #7 - Mano pico a pico → `indiceJugadorCorta` ahora busca un jugador participante
- [x] Fix #8 - Puntos rechazo truco → Eliminado workaround de `finalizarRonda` + resta, ahora suma directo `puntosSiNoQuiere`
- [x] Fix #11 - Funciones sin usar → Eliminada `mostrarBocadillo` (no se usaba)
- [x] Fix extra - `cantarEnvido` en pico a pico → Conteo de cartas de mano 1 usa `numParticipan` en vez de `jugadores.length`
