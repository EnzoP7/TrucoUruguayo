# Integración de Turso (SQLite Cloud) - Truco Uruguayo

## Qué es Turso
- SQLite en la nube, serverless
- No se apaga por inactividad (siempre disponible)
- Tier gratis: 9GB storage, 500M lecturas/mes, 25M escrituras/mes
- Se conecta por HTTP desde Node.js con `@libsql/client`
- Sin cold start, sin servidor que mantener

---

## Beneficios para la App

### 1. Usuarios (registro simple)
- Login con apodo + contraseña (sin email, sin OAuth)
- El jugador mantiene su identidad entre sesiones
- Hoy: cada vez que entrás sos "anónimo" con un nombre temporal
- Con BD: tu nombre, tu historial, tus amigos persisten

### 2. Ranking
- Tabla de posiciones por victorias o sistema ELO
- Visible desde el lobby o una página dedicada `/ranking`
- Motivación para seguir jugando

### 3. Estadísticas por jugador
- Partidas jugadas, ganadas, perdidas
- % de victoria
- Racha actual (victorias consecutivas)
- Modo favorito (1v1, 2v2, 3v3)

### 4. Historial de partidas
- Últimas N partidas jugadas
- Contra quién, resultado, puntos
- Fecha y duración

### 5. Amigos
- Lista de amigos por apodo
- Ver si están online (cruzar con Socket.IO)
- Invitar a partida

---

## Estructura de la BD

### Tablas

```sql
-- Usuarios
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apodo TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_login DATETIME
);

-- Estadísticas
CREATE TABLE estadisticas (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
  partidas_jugadas INTEGER DEFAULT 0,
  partidas_ganadas INTEGER DEFAULT 0,
  partidas_perdidas INTEGER DEFAULT 0,
  racha_actual INTEGER DEFAULT 0,
  mejor_racha INTEGER DEFAULT 0,
  elo INTEGER DEFAULT 1000
);

-- Historial de partidas
CREATE TABLE partidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modo TEXT NOT NULL,              -- '1v1', '2v2', '3v3'
  equipo_ganador INTEGER NOT NULL, -- 1 o 2
  puntaje_eq1 INTEGER NOT NULL,
  puntaje_eq2 INTEGER NOT NULL,
  duracion_seg INTEGER,
  jugada_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jugadores en cada partida
CREATE TABLE partida_jugadores (
  partida_id INTEGER REFERENCES partidas(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  equipo INTEGER NOT NULL,
  PRIMARY KEY (partida_id, usuario_id)
);

-- Amigos
CREATE TABLE amigos (
  usuario_id INTEGER REFERENCES usuarios(id),
  amigo_id INTEGER REFERENCES usuarios(id),
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, amigo_id)
);
```

---

## Archivos a crear/modificar

### Nuevos archivos

```
db.js                  -- Conexión a Turso + helpers de queries
auth.js                -- Registro, login, hash de passwords
src/app/ranking/page.tsx   -- Página de ranking
src/app/perfil/page.tsx    -- Página de perfil/estadísticas
```

### Archivos a modificar

```
server.js              -- Agregar:
                          - Login/registro via Socket.IO
                          - Guardar resultado al terminar partida
                          - Actualizar estadísticas y ELO
                          - Consultar ranking
                          - Sistema de amigos

src/app/lobby/page.tsx -- Agregar:
                          - Login antes de entrar al lobby
                          - Mostrar apodo persistente
                          - Botón de ranking
                          - Lista de amigos online

package.json           -- Agregar dependencias:
                          - @libsql/client
                          - bcryptjs (hash de passwords)
```

---

## Setup de Turso

### 1. Crear cuenta y BD
```bash
# Instalar CLI de Turso
npm install -g turso

# Login
turso auth login

# Crear base de datos
turso db create truco-uruguayo

# Obtener URL
turso db show truco-uruguayo --url

# Crear token de acceso
turso db tokens create truco-uruguayo
```

### 2. Variables de entorno
```env
TURSO_DATABASE_URL=libsql://truco-uruguayo-tuusuario.turso.io
TURSO_AUTH_TOKEN=tu-token-aqui
```

En Render: agregar estas 2 variables en Dashboard > Environment.

### 3. Archivo db.js
```javascript
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Inicializar tablas (se ejecuta al arrancar el server)
async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apodo TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultimo_login DATETIME
    );
    CREATE TABLE IF NOT EXISTS estadisticas (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
      partidas_jugadas INTEGER DEFAULT 0,
      partidas_ganadas INTEGER DEFAULT 0,
      partidas_perdidas INTEGER DEFAULT 0,
      racha_actual INTEGER DEFAULT 0,
      mejor_racha INTEGER DEFAULT 0,
      elo INTEGER DEFAULT 1000
    );
    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modo TEXT NOT NULL,
      equipo_ganador INTEGER NOT NULL,
      puntaje_eq1 INTEGER NOT NULL,
      puntaje_eq2 INTEGER NOT NULL,
      duracion_seg INTEGER,
      jugada_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS partida_jugadores (
      partida_id INTEGER REFERENCES partidas(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      equipo INTEGER NOT NULL,
      PRIMARY KEY (partida_id, usuario_id)
    );
    CREATE TABLE IF NOT EXISTS amigos (
      usuario_id INTEGER REFERENCES usuarios(id),
      amigo_id INTEGER REFERENCES usuarios(id),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (usuario_id, amigo_id)
    );
  `);
  console.log('Base de datos inicializada');
}

module.exports = { db, initDB };
```

---

## Flujo de integración

### Registro/Login
```
Usuario abre la app
  → Pantalla de login (apodo + contraseña)
  → POST registro o login
  → Server valida con bcrypt
  → Devuelve userId + apodo
  → Se guarda en sessionStorage
  → Redirige al lobby con identidad persistente
```

### Al terminar una partida
```
finalizarRonda() detecta winnerJuego
  → Guardar en tabla "partidas"
  → Guardar en tabla "partida_jugadores"
  → Actualizar "estadisticas" de cada jugador
  → Recalcular ELO si aplica
```

### Ranking
```
Página /ranking
  → Query: SELECT apodo, elo, partidas_ganadas FROM ...
  → ORDER BY elo DESC LIMIT 50
  → Mostrar tabla con posición, nombre, ELO, victorias
```

### Amigos
```
En el lobby:
  → Buscar jugador por apodo
  → Enviar solicitud de amistad
  → Ver amigos online (cruzar con socketIds conectados)
  → Invitar a partida
```

---

## Orden de implementación sugerido

| Paso | Feature | Complejidad |
|------|---------|-------------|
| 1 | Setup Turso + db.js + initDB | Baja |
| 2 | Registro/Login simple | Baja |
| 3 | Guardar resultado de partidas | Baja |
| 4 | Estadísticas por jugador | Baja |
| 5 | Página de ranking | Media |
| 6 | Página de perfil | Media |
| 7 | Sistema de amigos | Media |
| 8 | Invitar amigos a partida | Alta |

---

## Dependencias nuevas

```bash
npm install @libsql/client bcryptjs
```

- `@libsql/client`: Cliente oficial de Turso para Node.js
- `bcryptjs`: Hash de contraseñas (versión JS pura, sin compilar C++)

---

## Costo

**$0** — Todo dentro del tier gratis de Turso.
El uso de una app de truco con decenas/cientos de jugadores no se acerca ni al 1% del límite gratis.
