# Plan Premium - Truco Uruguayo ($1/mes)

## Tier Gratis vs Premium

| Feature | Gratis | Premium ($1/mes) |
|---------|--------|-----------------|
| Jugar partidas normales | Si | Si |
| Modos 1v1, 2v2, 3v3 | Si | Si |
| Audio personalizado por acción | No | **Si** |
| Temas visuales (mesa, dorso cartas) | 1 default | **5+ temas** |
| Avatar personalizado | Inicial genérica | **Subir foto/imagen** |
| Estadísticas avanzadas | Básicas (W/L/elo) | **Gráficos de elo, historial detallado, rival más jugado** |
| Crear torneos privados | No | **Si** |
| Emojis/reacciones en partida | 3 básicos | **Set completo + custom** |
| Insignias de perfil | No | **Insignias por logros** |
| Badge dorado en lobby/ranking | No | **Si** |
| Partidas con apuestas de elo | No | **Doble elo si ganás, doble pérdida si perdés** |
| Replay de partidas | No | **Volver a ver partidas paso a paso** |
| Sin publicidad | Con ads | **Sin ads** |

## Feature Estrella: Audio Personalizado

### Concepto
El usuario premium puede subir audios cortos para cada acción del juego. Cuando canta truco, envido, flor, etc., todos los jugadores en la partida escuchan SU audio personalizado.

### Acciones personalizables
- Truco
- Retruco
- Vale 4
- Envido
- Real Envido
- Falta Envido
- Flor
- Contra Flor
- Quiero
- No quiero
- Me voy al mazo

### Implementación técnica
1. **Tabla nueva `audios_custom`**: `usuario_id, tipo_audio, url_archivo, creado_en`
2. **Upload**: MP3/OGG corto (max 5 segundos, max 500KB) desde perfil
3. **Almacenamiento**: S3 o Cloudflare R2 (~$0.015/GB/mes)
4. **En partida**: Server emite `{jugadorId, tipo}` → cliente descarga audio custom del cantante y lo reproduce
5. **Moderación**: Límite de duración + sistema de reporte de audio inapropiado
6. **Fallback**: Si no tiene audio custom → usa el sintetizado por defecto

### Flujo de usuario
1. Va a su perfil → sección "Mis Audios"
2. Selecciona acción (ej: "Truco")
3. Graba o sube un audio corto
4. Se guarda en storage y se asocia a su cuenta
5. En partida, cuando canta truco, todos escuchan su audio

## Otras Ideas Premium

### Temas Visuales
- Mesa de madera clara/oscura/verde
- Dorso de cartas con diseños exclusivos
- Colores de equipo personalizables
- Fondo animado (lluvia, estrellas, etc.)

### Torneos
- Crear torneo privado con código de invitación
- Bracket automático (4, 8, 16 jugadores)
- Tabla de posiciones del torneo
- Premios en elo bonus

### Estadísticas Avanzadas
- Gráfico de evolución de elo en el tiempo
- Porcentaje de victorias por modo (1v1, 2v2, 3v3)
- Rival más enfrentado y record contra él
- Racha más larga histórica
- Heatmap de horarios de juego

### Sistema de Logros/Insignias
- "Trucazo": Ganar 10 partidas seguidas
- "Florista": Cantar flor 50 veces
- "Perrero": Echar los perros y ganar 10 veces
- "Veterano": Jugar 100 partidas
- "Elo Master": Llegar a 1500 elo
- Se muestran en el perfil público

### Monetización adicional futura
- Packs de emojis temáticos ($0.50 one-time)
- Dorsos de cartas exclusivos ($0.50 one-time)
- Pase de temporada mensual con desafíos y recompensas
