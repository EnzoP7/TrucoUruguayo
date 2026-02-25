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

## FASE 3: Sistema de Monedas

> **Impacto:** Alto | **Esfuerzo:** Medio
> Pilar central de la monetización. La DB ya tiene soporte (`precio_monedas` en cosmeticos).

### 3.1 Definir economía de monedas

**Formas de ganar monedas:**

| Acción | Monedas | Límite |
|--------|---------|--------|
| Ganar partida 1v1 | 20 | Sin límite |
| Ganar partida 2v2 | 25 | Sin límite |
| Ganar partida 3v3 | 30 | Sin límite |
| Perder partida (participación) | 5 | Sin límite |
| Racha de 3 victorias | +15 bonus | Por racha |
| Racha de 5 victorias | +30 bonus | Por racha |
| Login diario | 10 (día 1) → 25 (día 7) | 1 por día |
| Logro desbloqueado | 50-200 según dificultad | 1 por logro |
| Video publicitario | 75 | 5 por día |

### 3.2 Implementar backend de monedas
- **Archivo:** `db.js`
- Agregar campo `monedas INTEGER DEFAULT 0` a tabla `usuarios` (si no existe)
- Funciones:
  - `agregarMonedas(userId, cantidad, motivo)`
  - `gastarMonedas(userId, cantidad)`
  - `getMonedas(userId)`
- **Tabla de historial** (opcional pero recomendado):
```sql
CREATE TABLE IF NOT EXISTS historial_monedas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  balance_despues INTEGER NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 3.3 Otorgar monedas al finalizar partida
- **Archivo:** `server.js` (en los handlers de `ronda-finalizada` y `juego-finalizado`)
- Al finalizar juego: llamar `agregarMonedas()` según resultado
- Emitir evento `monedas-ganadas` al cliente con la cantidad y nuevo balance
- Frontend: mostrar animación "+20 monedas" al terminar partida

### 3.4 Login diario con recompensa
- **Archivo:** `db.js` + `server.js`
- Tabla o campo: `ultimo_login_recompensa DATE`, `dias_consecutivos INTEGER`
- Al hacer login, verificar si ya reclamó hoy
- Si no: dar monedas según racha de días consecutivos
- Frontend: modal de "Recompensa diaria" al entrar al lobby

### 3.5 Integrar monedas en la tienda existente
- **Archivo:** `server.js` (handler `comprar-cosmetico`)
- La función `comprarCosmetico` ya existe en db.js (~línea 733)
- Verificar que descuente monedas correctamente
- Frontend: mostrar balance de monedas en header y en tienda

---

## FASE 4: Rewarded Video Ads

> **Impacto:** Medio-Alto | **Esfuerzo:** Medio
> Genera revenue de usuarios free y engagement con el sistema de monedas.

### 4.1 Elegir proveedor
- **Opción A: Google AdSense for Games** - Ya tenés AdSense integrado, es la extensión natural
- **Opción B: Google AdMob** - Mejor para apps móviles/PWA
- **Recomendación:** Empezar con AdSense Rewarded (ya tenés la cuenta `ca-pub-6217274251244633`)

### 4.2 Crear componente RewardedAd
- **Archivo nuevo:** `src/components/ads/RewardedAd.tsx`
- Props: `onRewardEarned`, `onAdClosed`, `onAdFailed`, `rewardAmount`
- Flujo:
  1. Usuario clickea "Ver video → +75 monedas"
  2. Se carga el ad rewarded
  3. Usuario ve el video completo (no se puede skipear)
  4. Al completar → callback `onRewardEarned`
  5. Backend verifica y acredita monedas (server-side validation)

### 4.3 Server-side verification
- **Archivo:** `server.js`
- Evento: `reclamar-recompensa-video`
- Validaciones:
  - Verificar que no exceda límite diario (5 videos)
  - Verificar cooldown mínimo entre videos (30 segundos)
  - Registrar en historial_monedas con motivo `'video_ad'`
- **Importante:** NUNCA confiar solo en el cliente para acreditar monedas

### 4.4 Puntos de integración en la UI
- **Lobby:** Botón "Ver video → +75 monedas" visible
- **Post-partida:** Ofrecer duplicar recompensa viendo un video
- **Tienda:** "No tenés suficientes monedas - Ver video para ganar más"
- **Perfil:** Contador de videos disponibles hoy

### 4.5 Premium skip
- Usuarios premium NO ven rewarded ads (ya tienen monedas bonus)
- O alternativamente: premium gana monedas sin ver video (reward automático diario)

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
