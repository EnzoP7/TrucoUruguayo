# Plan de Mejoras, Optimización y Monetización - Truco Uruguayo

> Generado a partir del análisis completo de la app.
> Cada fase es incremental: se puede implementar una sin depender de la siguiente.

---

## FASE 1: Correcciones Críticas y Seguridad

> **Impacto:** Alto | **Esfuerzo:** Bajo
> Prioridad máxima. Cosas que deberían resolverse antes de cualquier feature nueva.

### 1.1 Password mínimo de 8 caracteres
- **Archivo:** `auth.js` (~línea 22)
- **Cambio:** `password.length < 4` → `password.length < 8`
- **Frontend:** Actualizar validación en `src/app/login/page.tsx`

### 1.2 Verificar .env no está en git
- **Archivo:** `.gitignore`
- **Verificar:** Que `.env` esté listado y nunca se haya commiteado
- **Acción:** Si fue commiteado, rotar todas las credenciales (TURSO_AUTH_TOKEN, GOOGLE_CLIENT_SECRET, etc.)

### 1.3 Placeholder de verificación Google
- **Archivo:** `src/app/layout.tsx` (~línea 112)
- **Cambio:** Reemplazar `"tu-codigo-de-verificacion-google"` con el código real de Google Search Console

### 1.4 Rate limiting en Socket.IO
- **Archivo:** `server.js`
- **Cambio:** Agregar middleware simple de rate limiting para eventos críticos:
  - `crear-partida`: máx 3 por minuto
  - `chat-mensaje`: máx 10 por 10 segundos
  - `login` / `registrar`: máx 5 por minuto
- **Implementación:** Map de `socketId → { count, timestamp }` con reset periódico

### 1.5 Inconsistencia de dominio en SEO
- **Archivos:** `src/app/robots.ts`, `src/app/sitemap.ts`
- **Cambio:** Reemplazar `'https://trucouruguayo.com'` hardcodeado por `process.env.NEXT_PUBLIC_SITE_URL`

---

## FASE 2: Optimización de Rendimiento

> **Impacto:** Alto | **Esfuerzo:** Medio-Alto
> Mejora directa de la experiencia del usuario.

### 2.1 Dividir game/page.tsx (5,000+ líneas)
El componente monolítico causa re-renders innecesarios en cada evento Socket.IO.

**Subcomponentes a extraer:**

| Componente | Responsabilidad | Líneas aprox. |
|------------|----------------|---------------|
| `GameBoard.tsx` | Mesa central, cartas jugadas, muestra | ~400 |
| `PlayerHand.tsx` | Mano del jugador local (cartas clickeables) | ~300 |
| `PlayerIndicator.tsx` | Indicador de cada jugador (nombre, cartas, turno) | ~200 |
| `GameControls.tsx` | Botones de truco/envido/flor/mazo | ~300 |
| `ScoreBoard.tsx` | Marcador, puntos, estado de ronda | ~200 |
| `ChatPanel.tsx` | Chat lateral con mensajes y emojis | ~300 |
| `GameModals.tsx` | Modales (config, invitar, resultado) | ~400 |
| `GameAnimations.tsx` | Lógica de animaciones y transiciones | ~300 |

**Clave:** Envolver cada uno con `React.memo()` y usar `useMemo`/`useCallback` para props.

### 2.2 Agregar useMemo para cálculos pesados
- **Archivo:** `src/app/game/page.tsx`
- Posicionamiento de jugadores (`getSlotForPlayer`)
- Geometría de cartas en abanico
- Filtros de cartas jugables

### 2.3 Cleanup de setTimeout/setInterval
- **Archivo:** `src/app/game/page.tsx`
- Guardar refs de todos los timers en `useRef`
- Limpiar en `useEffect` cleanup function
- Evita memory leaks cuando el jugador sale de la partida

### 2.4 Reemplazar window.innerWidth por CSS
- **Archivo:** `src/app/game/page.tsx` (~línea 2136)
- Usar clases de Tailwind (`md:`, `lg:`) en vez de JS para layout responsive
- Elimina re-renders por resize

### 2.5 Modularizar server.js (6,900+ líneas)
**Estructura propuesta:**
```
server/
├── index.js              # Entry point, Socket.IO setup
├── handlers/
│   ├── lobby.js          # crear-partida, unirse-partida, etc.
│   ├── game.js           # jugar-carta, cantar-truco, etc.
│   ├── envido.js         # cantar-envido, responder-envido
│   ├── flor.js           # cantar-flor, responder-flor
│   ├── auth.js           # login, registro
│   └── chat.js           # mensajes de chat
├── services/
│   ├── gameEngine.js     # crearMesa, jugarCarta, determinarGanador
│   ├── envidoService.js  # resolverEnvido, calcularPuntos
│   ├── florService.js    # resolverFlor, resolverContienda
│   └── botService.js     # procesarTurnoBot, decisiones IA
├── utils/
│   ├── constants.js      # PODER_CARTAS, VALOR_ENVIDO, timings
│   ├── helpers.js        # getEstadoParaJugador, findRoom
│   └── validation.js     # Validaciones de input
└── middleware/
    └── rateLimiter.js    # Rate limiting
```

> **Nota:** Esta es la tarea más grande. Se puede hacer incrementalmente extrayendo un handler a la vez.

---

## FASE 3: Sistema de Monedas ✅ IMPLEMENTADO

> **Impacto:** Alto | **Esfuerzo:** Medio
> Modelo híbrido: partidas casuales gratis + partidas rankeadas con costo de monedas.

### 3.1 Economía de monedas (IMPLEMENTADO)

**Modelo híbrido:**
- Partidas casuales: siempre gratis, sin límite
- Partidas rankeadas: cuestan 10 monedas por jugador, recompensa mayor al ganar

| Acción | Monedas |
|--------|---------|
| **Registro nuevo (bienvenida)** | +100 |
| Ganar casual 1v1 | +15 |
| Ganar casual 2v2 | +20 |
| Ganar casual 3v3 | +25 |
| Ganar rankeada 1v1 | +30 |
| Ganar rankeada 2v2 | +40 |
| Ganar rankeada 3v3 | +50 |
| Perder partida (participación) | +5 |
| Racha de 3 victorias | +15 bonus |
| Racha de 5 victorias | +30 bonus |
| Login diario | 15 (día 1) → 50 (día 7) |
| Premium bonus | x1.5 en recompensas |
| Costo partida rankeada | -10 por jugador |

### 3.2 Backend de monedas (IMPLEMENTADO)
- **`db.js`**: tabla `historial_monedas`, columnas `monedas/ultimo_login_recompensa/dias_consecutivos_login` en usuarios
- Funciones: `obtenerMonedas`, `agregarMonedas`, `gastarMonedas`, `obtenerRecompensaDiaria`, `reclamarRecompensaDiaria`
- `comprarCosmetico()` ahora verifica y descuenta monedas reales

### 3.3 Monedas al finalizar partida (IMPLEMENTADO)
- `guardarResultadoPartida()` calcula y otorga monedas según modo, resultado, racha y premium
- Emite evento `monedas-ganadas` con cantidad y balance
- Frontend muestra toast dorado "+X monedas" al terminar

### 3.4 Login diario con recompensa (IMPLEMENTADO)
- Racha de 7 días: 15→20→25→30→35→40→50 monedas
- Modal de recompensa diaria al entrar al lobby
- Handler `reclamar-recompensa-diaria` en server.js

### 3.5 Partidas rankeadas (IMPLEMENTADO)
- Toggle "Partida Rankeada" en panel de crear partida (solo usuarios registrados)
- Cobra 10 monedas al crear y al unirse
- Devuelve monedas si la partida se cancela
- Badge "Rankeada" en lista de partidas del lobby

### 3.6 Integración con tienda (IMPLEMENTADO)
- `comprarCosmetico()` descuenta monedas del precio del cosmético
- Balance visible en header del lobby

---

## FASE 4: Rewarded Ads (Interstitial + Timer) ✅ IMPLEMENTADO

> **Impacto:** Medio-Alto | **Esfuerzo:** Medio
> Genera revenue de usuarios free y engagement con el sistema de monedas.

### 4.1 Enfoque: AdSense Interstitial + Timer (IMPLEMENTADO)
- Se usa el mismo AdSense ya integrado (cuenta `ca-pub-6217274251244633`)
- Interstitial con countdown de 15 segundos
- Al completar, el usuario reclama monedas vía server-side validation

### 4.2 Componente RewardedAd (IMPLEMENTADO)
- **Archivo:** `src/components/ads/RewardedAd.tsx`
- Countdown de 15s con barra de progreso
- Botón "Reclamar" aparece al completar el countdown
- Si cancela antes, no recibe recompensa
- Usuarios premium salteados automáticamente (useUserPremium hook)

### 4.3 Server-side verification (IMPLEMENTADO)
- **Archivo:** `server.js`
- Handler `reclamar-recompensa-video`: valida auth, premium, límite diario, cooldown
- Handler `obtener-estado-videos`: retorna estado actual de videos del día
- **Límites:** 5 videos/día, 30s cooldown entre videos, 75 monedas por video
- Tracking en memoria con Map por socketId, reset diario automático
- Registro en historial_monedas con motivo `'video_ad'`

### 4.4 Puntos de integración en la UI (IMPLEMENTADO)
- **Lobby:** Botón "+75 monedas" junto al balance, con cooldown visible
- **Post-partida:** Botón "Duplicar" en el toast de monedas ganadas
- Premium skip automático

---

## FASE 5: Premium con Pagos Reales

> **Impacto:** Alto | **Esfuerzo:** Alto
> Implementar cuando haya base de usuarios estable (+200-500 activos).

### 5.1 Elegir pasarela de pagos
- **MercadoPago** - Ideal para Argentina/Uruguay. API simple, bajas comisiones locales.
- **Stripe** - Ideal para mercado global. Más features pero comisiones más altas en LATAM.
- **Recomendación:** MercadoPago para MVP, Stripe después si escalás internacionalmente.

### 5.2 Implementar suscripción premium ($1/mes)
- **Archivos nuevos:**
  - `src/app/api/payments/route.ts` - Endpoint para crear preferencia de pago
  - `src/app/api/webhooks/mercadopago/route.ts` - Webhook para confirmar pagos
  - `src/app/premium/page.tsx` - Página de planes y checkout
- **DB:** Agregar campos:
  - `premium_inicio DATETIME`
  - `premium_expira DATETIME`
  - `mercadopago_subscription_id TEXT`
- **Flujo:**
  1. Usuario va a `/premium`
  2. Clickea "Suscribirse"
  3. Redirect a MercadoPago checkout
  4. Webhook confirma pago → activar premium
  5. Cron job diario verifica expiración

### 5.3 Features premium (resumen)
- Sin ads (banners ni interstitials)
- Audios custom (ya implementado)
- Cosméticos exclusivos (ya en DB)
- Badge premium en perfil y partidas
- Bonus XP x1.5
- Bonus monedas x1.5 por partida

### 5.4 Página de gestión de suscripción
- Ver estado actual (activo/expirado)
- Fecha de renovación
- Cancelar suscripción
- Historial de pagos

---

## FASE 6: Tienda de Monedas (Compra con Dinero Real)

> **Impacto:** Medio | **Esfuerzo:** Medio
> Implementar DESPUÉS de validar que los usuarios valoran las monedas.

### 6.1 Packs de monedas

| Pack | Monedas | Precio | Bonus |
|------|---------|--------|-------|
| Básico | 500 | $0.99 | - |
| Popular | 1,200 | $1.99 | +20% |
| Mejor valor | 3,000 | $3.99 | +50% |
| Mega pack | 7,500 | $7.99 | +87% |

### 6.2 Implementación
- Misma pasarela que premium (MercadoPago/Stripe)
- Pagos únicos (no suscripción)
- Webhook acredita monedas al confirmar pago
- Registro en historial_monedas con motivo `'compra'`

### 6.3 Consideraciones legales
- Términos de servicio claros sobre monedas virtuales
- Política de reembolso
- Las monedas NO son canjeables por dinero real
- Cumplir regulaciones locales (Uruguay/Argentina)

---

## FASE 7: Mejoras de Accesibilidad y UX

> **Impacto:** Medio | **Esfuerzo:** Bajo-Medio
> Mejora la nota de Lighthouse y la inclusividad.

### 7.1 ARIA labels en elementos interactivos
- Botones de cartas: `aria-label="Jugar 3 de espada"`
- Botones de canto: `aria-label="Cantar envido"`
- Modales: `role="dialog"` + `aria-modal="true"`

### 7.2 Keyboard navigation en cartas
- `tabIndex={0}` en cada carta jugable
- `onKeyDown` para Enter/Space = jugar carta
- Orden de foco lógico: cartas → controles → chat

### 7.3 Skip navigation link
- En `src/app/layout.tsx`: link oculto "Saltar al contenido principal"
- Visible solo con foco de teclado

### 7.4 Respetar prefers-reduced-motion
- En `globals.css` o `tailwind.config.js`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.5 Labels en formularios
- Reemplazar placeholders por `<label>` en login, chat, configuración
- Mantener placeholder como hint visual adicional

### 7.6 Metadata por página
- Agregar `export const metadata` en: lobby, tutorial, ranking, perfil, premium

---

## FASE 8: Código Muerto y Limpieza

> **Impacto:** Bajo | **Esfuerzo:** Bajo
> Reduce confusión y tamaño del bundle.

### 8.1 Evaluar TrucoEngine.ts
- `src/truco/engine/TrucoEngine.ts` NO se usa (toda la lógica está en `server.js`)
- **Decisión:** Eliminarlo o marcarlo como deprecated
- También revisar: `src/truco/models/Mazo.ts`, `src/types/truco.ts` si solo los usa TrucoEngine

### 8.2 Auditar dependencias
- Ejecutar `npx depcheck` para encontrar paquetes no usados
- Revisar si `@uploadthing/react` sigue siendo necesario
- Verificar versiones desactualizadas con `npm outdated`

### 8.3 Error boundaries
- Crear `src/app/error.tsx` para errores globales
- Crear `src/app/game/error.tsx` para errores en partida
- Crear `src/app/not-found.tsx` para 404

---

## Resumen de Prioridades

| Fase | Nombre | Prioridad | Dependencias |
|------|--------|-----------|--------------|
| 1 | Seguridad | **URGENTE** | Ninguna |
| 2 | Rendimiento | **ALTA** | Ninguna |
| 3 | Monedas | **ALTA** | Ninguna |
| 4 | Rewarded Ads | **MEDIA** | Fase 3 |
| 5 | Premium con pagos | **MEDIA** | Fase 3 |
| 6 | Tienda de monedas | **BAJA** | Fase 3 + 5 |
| 7 | Accesibilidad | **MEDIA** | Ninguna |
| 8 | Limpieza | **BAJA** | Ninguna |

> **Nota:** Las fases 1, 2, 3 y 7 son independientes y se pueden trabajar en paralelo.
> Las fases 4 y 5 requieren que el sistema de monedas (Fase 3) esté implementado.
> La fase 6 requiere validación del mercado (que los usuarios usen las monedas).
