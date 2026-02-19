const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  try {
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

      CREATE TABLE IF NOT EXISTS audios_custom (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        tipo_audio TEXT NOT NULL,
        url_archivo TEXT NOT NULL,
        file_key TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(usuario_id, tipo_audio)
      );
    `);

    // Agregar columnas nuevas a usuarios (ignorar si ya existen)
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN es_premium INTEGER DEFAULT 0'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN avatar_url TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    // Personalización de mesa (premium)
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN tema_mesa TEXT DEFAULT "clasico"'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN reverso_cartas TEXT DEFAULT "clasico"'); } catch { /* ya existe */ }

    console.log('[DB] Tablas inicializadas correctamente');
  } catch (err) {
    console.error('[DB] Error inicializando tablas:', err);
  }
}

// ============ USUARIOS ============

async function crearUsuario(apodo, passwordHash) {
  const result = await db.execute({
    sql: 'INSERT INTO usuarios (apodo, password_hash) VALUES (?, ?)',
    args: [apodo, passwordHash],
  });
  const userId = Number(result.lastInsertRowid);
  // Crear estadísticas iniciales
  await db.execute({
    sql: 'INSERT INTO estadisticas (usuario_id) VALUES (?)',
    args: [userId],
  });
  return userId;
}

async function buscarUsuarioPorApodo(apodo) {
  const result = await db.execute({
    sql: 'SELECT * FROM usuarios WHERE apodo = ?',
    args: [apodo],
  });
  return result.rows[0] || null;
}

async function actualizarUltimoLogin(userId) {
  await db.execute({
    sql: 'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?',
    args: [userId],
  });
}

async function setPremium(userId, isPremium) {
  await db.execute({
    sql: 'UPDATE usuarios SET es_premium = ? WHERE id = ?',
    args: [isPremium ? 1 : 0, userId],
  });
}

async function actualizarAvatarUrl(userId, url) {
  await db.execute({
    sql: 'UPDATE usuarios SET avatar_url = ? WHERE id = ?',
    args: [url, userId],
  });
}

async function actualizarPersonalizacion(userId, temaMesa, reversoCartas) {
  await db.execute({
    sql: 'UPDATE usuarios SET tema_mesa = ?, reverso_cartas = ? WHERE id = ?',
    args: [temaMesa, reversoCartas, userId],
  });
}

async function obtenerPersonalizacion(userId) {
  const result = await db.execute({
    sql: 'SELECT tema_mesa, reverso_cartas FROM usuarios WHERE id = ?',
    args: [userId],
  });
  return result.rows[0] || { tema_mesa: 'clasico', reverso_cartas: 'clasico' };
}

// ============ ESTADÍSTICAS ============

async function obtenerEstadisticas(userId) {
  const result = await db.execute({
    sql: 'SELECT e.*, u.apodo, u.es_premium, u.avatar_url FROM estadisticas e JOIN usuarios u ON u.id = e.usuario_id WHERE e.usuario_id = ?',
    args: [userId],
  });
  return result.rows[0] || null;
}

async function actualizarEstadisticas(userId, gano) {
  if (gano) {
    await db.execute({
      sql: `UPDATE estadisticas SET
        partidas_jugadas = partidas_jugadas + 1,
        partidas_ganadas = partidas_ganadas + 1,
        racha_actual = racha_actual + 1,
        mejor_racha = MAX(mejor_racha, racha_actual + 1),
        elo = elo + 25
      WHERE usuario_id = ?`,
      args: [userId],
    });
  } else {
    await db.execute({
      sql: `UPDATE estadisticas SET
        partidas_jugadas = partidas_jugadas + 1,
        partidas_perdidas = partidas_perdidas + 1,
        racha_actual = 0,
        elo = MAX(0, elo - 15)
      WHERE usuario_id = ?`,
      args: [userId],
    });
  }
}

// ============ PARTIDAS ============

async function guardarPartida(modo, equipoGanador, puntajeEq1, puntajeEq2, duracionSeg, jugadores) {
  const result = await db.execute({
    sql: 'INSERT INTO partidas (modo, equipo_ganador, puntaje_eq1, puntaje_eq2, duracion_seg) VALUES (?, ?, ?, ?, ?)',
    args: [modo, equipoGanador, puntajeEq1, puntajeEq2, duracionSeg],
  });
  const partidaId = Number(result.lastInsertRowid);

  // Guardar cada jugador registrado en la partida
  for (const j of jugadores) {
    if (!j.userId) continue; // Jugadores no registrados se omiten
    await db.execute({
      sql: 'INSERT INTO partida_jugadores (partida_id, usuario_id, equipo) VALUES (?, ?, ?)',
      args: [partidaId, j.userId, j.equipo],
    });
    // Actualizar estadísticas
    await actualizarEstadisticas(j.userId, j.equipo === equipoGanador);
  }

  return partidaId;
}

async function obtenerHistorial(userId, limite = 20) {
  const result = await db.execute({
    sql: `SELECT p.*, pj.equipo as mi_equipo,
      (SELECT GROUP_CONCAT(u.apodo, ', ')
       FROM partida_jugadores pj2
       JOIN usuarios u ON u.id = pj2.usuario_id
       WHERE pj2.partida_id = p.id AND pj2.equipo != pj.equipo
      ) as rivales
      FROM partidas p
      JOIN partida_jugadores pj ON pj.partida_id = p.id
      WHERE pj.usuario_id = ?
      ORDER BY p.jugada_en DESC
      LIMIT ?`,
    args: [userId, limite],
  });
  return result.rows;
}

// ============ RANKING ============

async function obtenerRanking(limite = 50) {
  const result = await db.execute({
    sql: `SELECT u.apodo, u.es_premium, e.*
      FROM estadisticas e
      JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.partidas_jugadas > 0
      ORDER BY e.elo DESC
      LIMIT ?`,
    args: [limite],
  });
  return result.rows;
}

// ============ AMIGOS ============

async function agregarAmigo(userId, amigoId) {
  // Relación bidireccional
  await db.execute({
    sql: 'INSERT OR IGNORE INTO amigos (usuario_id, amigo_id) VALUES (?, ?)',
    args: [userId, amigoId],
  });
  await db.execute({
    sql: 'INSERT OR IGNORE INTO amigos (usuario_id, amigo_id) VALUES (?, ?)',
    args: [amigoId, userId],
  });
}

async function eliminarAmigo(userId, amigoId) {
  await db.execute({
    sql: 'DELETE FROM amigos WHERE (usuario_id = ? AND amigo_id = ?) OR (usuario_id = ? AND amigo_id = ?)',
    args: [userId, amigoId, amigoId, userId],
  });
}

async function obtenerAmigos(userId) {
  const result = await db.execute({
    sql: `SELECT u.id, u.apodo, u.es_premium, e.elo, e.partidas_ganadas, e.partidas_jugadas
      FROM amigos a
      JOIN usuarios u ON u.id = a.amigo_id
      LEFT JOIN estadisticas e ON e.usuario_id = u.id
      WHERE a.usuario_id = ?
      ORDER BY u.apodo`,
    args: [userId],
  });
  return result.rows;
}

async function buscarUsuarios(termino, excludeUserId) {
  const result = await db.execute({
    sql: `SELECT id, apodo, es_premium FROM usuarios WHERE apodo LIKE ? AND id != ? LIMIT 10`,
    args: [`%${termino}%`, excludeUserId],
  });
  return result.rows;
}

// ============ AUDIOS CUSTOM ============

async function guardarAudioCustom(userId, tipoAudio, urlArchivo, fileKey) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO audios_custom (usuario_id, tipo_audio, url_archivo, file_key)
      VALUES (?, ?, ?, ?)`,
    args: [userId, tipoAudio, urlArchivo, fileKey || null],
  });
}

async function obtenerAudiosCustom(userId) {
  const result = await db.execute({
    sql: 'SELECT id, tipo_audio, url_archivo, file_key, creado_en FROM audios_custom WHERE usuario_id = ? ORDER BY tipo_audio',
    args: [userId],
  });
  return result.rows;
}

async function eliminarAudioCustom(id, userId) {
  // Obtener file_key antes de borrar (para cleanup en UploadThing)
  const existing = await db.execute({
    sql: 'SELECT file_key FROM audios_custom WHERE id = ? AND usuario_id = ?',
    args: [id, userId],
  });
  const fileKey = existing.rows[0]?.file_key || null;
  await db.execute({
    sql: 'DELETE FROM audios_custom WHERE id = ? AND usuario_id = ?',
    args: [id, userId],
  });
  return fileKey;
}

async function obtenerAudiosCustomMultiples(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT usuario_id, tipo_audio, url_archivo FROM audios_custom WHERE usuario_id IN (${placeholders})`,
    args: userIds,
  });
  return result.rows;
}

module.exports = {
  db,
  initDB,
  crearUsuario,
  buscarUsuarioPorApodo,
  actualizarUltimoLogin,
  setPremium,
  actualizarAvatarUrl,
  actualizarPersonalizacion,
  obtenerPersonalizacion,
  obtenerEstadisticas,
  actualizarEstadisticas,
  guardarPartida,
  obtenerHistorial,
  obtenerRanking,
  agregarAmigo,
  eliminarAmigo,
  obtenerAmigos,
  buscarUsuarios,
  guardarAudioCustom,
  obtenerAudiosCustom,
  eliminarAudioCustom,
  obtenerAudiosCustomMultiples,
};
