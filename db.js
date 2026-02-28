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

      CREATE TABLE IF NOT EXISTS logros (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        icono TEXT,
        categoria TEXT DEFAULT 'general',
        puntos_exp INTEGER DEFAULT 50,
        oculto INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS usuario_logros (
        usuario_id INTEGER REFERENCES usuarios(id),
        logro_id TEXT REFERENCES logros(id),
        desbloqueado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, logro_id)
      );

      CREATE TABLE IF NOT EXISTS estadisticas_detalladas (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
        envidos_cantados INTEGER DEFAULT 0,
        envidos_ganados INTEGER DEFAULT 0,
        trucos_cantados INTEGER DEFAULT 0,
        trucos_ganados INTEGER DEFAULT 0,
        flores_cantadas INTEGER DEFAULT 0,
        flores_ganadas INTEGER DEFAULT 0,
        partidas_1v1 INTEGER DEFAULT 0,
        partidas_2v2 INTEGER DEFAULT 0,
        partidas_3v3 INTEGER DEFAULT 0,
        victorias_1v1 INTEGER DEFAULT 0,
        victorias_2v2 INTEGER DEFAULT 0,
        victorias_3v3 INTEGER DEFAULT 0,
        matas_jugadas INTEGER DEFAULT 0,
        partidas_perfectas INTEGER DEFAULT 0,
        idas_al_mazo INTEGER DEFAULT 0,
        nivel INTEGER DEFAULT 1,
        experiencia INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cosmeticos (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        imagen_preview TEXT,
        precio_monedas INTEGER DEFAULT 0,
        nivel_requerido INTEGER DEFAULT 1,
        es_premium INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS usuario_cosmeticos (
        usuario_id INTEGER REFERENCES usuarios(id),
        cosmetico_id TEXT REFERENCES cosmeticos(id),
        equipado INTEGER DEFAULT 0,
        obtenido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, cosmetico_id)
      );

      CREATE TABLE IF NOT EXISTS historial_monedas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        cantidad INTEGER NOT NULL,
        motivo TEXT NOT NULL,
        balance_despues INTEGER NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sugerencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT,
        tipo TEXT DEFAULT 'sugerencia',
        mensaje TEXT NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id),
        estado TEXT DEFAULT 'pendiente',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pagos_premium (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        payment_id TEXT NOT NULL,
        status TEXT NOT NULL,
        monto REAL NOT NULL,
        moneda TEXT DEFAULT 'UYU',
        premium_inicio TEXT NOT NULL,
        premium_expira TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pagos_monedas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        payment_id TEXT NOT NULL,
        status TEXT NOT NULL,
        monto REAL NOT NULL,
        moneda TEXT DEFAULT 'UYU',
        monedas_compradas INTEGER NOT NULL,
        pack_id TEXT NOT NULL,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Agregar columnas nuevas a usuarios (ignorar si ya existen)
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN es_premium INTEGER DEFAULT 0'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN avatar_url TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    // Personalización de mesa (premium)
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN tema_mesa TEXT DEFAULT "clasico"'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN reverso_cartas TEXT DEFAULT "clasico"'); } catch { /* ya existe */ }
    // Sistema de monedas
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN monedas INTEGER DEFAULT 0'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN ultimo_login_recompensa TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN dias_consecutivos_login INTEGER DEFAULT 0'); } catch { /* ya existe */ }
    // Premium con expiracion
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN premium_inicio TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN premium_expira TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN mercadopago_payment_id TEXT DEFAULT NULL'); } catch { /* ya existe */ }
    // Google Auth columns (sin UNIQUE porque SQLite no lo soporta en ALTER TABLE)
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN email TEXT'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN google_id TEXT'); } catch { /* ya existe */ }
    try { await db.execute('ALTER TABLE usuarios ADD COLUMN auth_provider TEXT DEFAULT "local"'); } catch { /* ya existe */ }

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

async function buscarUsuarioPorGoogleId(googleId) {
  const result = await db.execute({
    sql: 'SELECT * FROM usuarios WHERE google_id = ?',
    args: [googleId],
  });
  return result.rows[0] || null;
}

async function buscarUsuarioPorEmail(email) {
  const result = await db.execute({
    sql: 'SELECT * FROM usuarios WHERE email = ?',
    args: [email],
  });
  return result.rows[0] || null;
}

async function crearUsuarioGoogle(googleId, email, nombre, avatarUrl) {
  // Generar apodo único basado en el nombre
  let apodo = nombre.substring(0, 20).trim();
  let existente = await buscarUsuarioPorApodo(apodo);
  let contador = 1;

  while (existente) {
    const sufijo = `_${contador}`;
    apodo = nombre.substring(0, 20 - sufijo.length).trim() + sufijo;
    existente = await buscarUsuarioPorApodo(apodo);
    contador++;
  }

  const result = await db.execute({
    sql: `INSERT INTO usuarios (apodo, password_hash, email, google_id, auth_provider, avatar_url)
          VALUES (?, '', ?, ?, 'google', ?)`,
    args: [apodo, email, googleId, avatarUrl || null],
  });

  const userId = Number(result.lastInsertRowid);

  // Crear estadísticas iniciales
  await db.execute({
    sql: 'INSERT INTO estadisticas (usuario_id) VALUES (?)',
    args: [userId],
  });

  return { userId, apodo };
}

async function vincularGoogle(userId, googleId, email) {
  await db.execute({
    sql: 'UPDATE usuarios SET google_id = ?, email = ?, auth_provider = CASE WHEN password_hash = "" THEN "google" ELSE "both" END WHERE id = ?',
    args: [googleId, email, userId],
  });
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

async function activarPremium(userId, paymentId, dias = 30, monto = 0, moneda = 'UYU') {
  const ahora = new Date();
  const expira = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
  const premiumInicio = ahora.toISOString();
  const premiumExpira = expira.toISOString();

  await db.execute({
    sql: `UPDATE usuarios SET es_premium = 1, premium_inicio = ?, premium_expira = ?, mercadopago_payment_id = ? WHERE id = ?`,
    args: [premiumInicio, premiumExpira, paymentId, userId],
  });

  await db.execute({
    sql: `INSERT INTO pagos_premium (usuario_id, payment_id, status, monto, moneda, premium_inicio, premium_expira) VALUES (?, ?, 'approved', ?, ?, ?, ?)`,
    args: [userId, paymentId, monto, moneda, premiumInicio, premiumExpira],
  });

  return { success: true, premium_inicio: premiumInicio, premium_expira: premiumExpira };
}

async function verificarExpiracionPremium(userId) {
  const result = await db.execute({
    sql: 'SELECT es_premium, premium_expira FROM usuarios WHERE id = ?',
    args: [userId],
  });
  if (result.rows.length === 0) return { expirado: false };

  const usuario = result.rows[0];
  if (!usuario.es_premium) return { expirado: false, es_premium: false };
  if (!usuario.premium_expira) return { expirado: false, es_premium: true };

  const ahora = new Date();
  const expira = new Date(usuario.premium_expira);

  if (ahora > expira) {
    // Premium expirado - desactivar
    await db.execute({
      sql: 'UPDATE usuarios SET es_premium = 0 WHERE id = ?',
      args: [userId],
    });
    return { expirado: true, es_premium: false };
  }

  return { expirado: false, es_premium: true, premium_expira: usuario.premium_expira };
}

async function obtenerEstadoPremium(userId) {
  const result = await db.execute({
    sql: 'SELECT es_premium, premium_inicio, premium_expira FROM usuarios WHERE id = ?',
    args: [userId],
  });
  if (result.rows.length === 0) return { es_premium: false };

  const usuario = result.rows[0];
  let diasRestantes = 0;

  if (usuario.premium_expira) {
    const ahora = new Date();
    const expira = new Date(usuario.premium_expira);
    diasRestantes = Math.max(0, Math.ceil((expira.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)));
  }

  return {
    es_premium: !!usuario.es_premium,
    premium_inicio: usuario.premium_inicio || null,
    premium_expira: usuario.premium_expira || null,
    dias_restantes: diasRestantes,
  };
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
    sql: `SELECT u.id, u.apodo, u.es_premium, u.avatar_url, e.*
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

// ============ ESTADÍSTICAS DETALLADAS ============

async function obtenerEstadisticasDetalladas(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM estadisticas_detalladas WHERE usuario_id = ?',
    args: [userId],
  });
  if (result.rows[0]) {
    return result.rows[0];
  }
  // Crear registro si no existe
  await db.execute({
    sql: 'INSERT OR IGNORE INTO estadisticas_detalladas (usuario_id) VALUES (?)',
    args: [userId],
  });
  const newResult = await db.execute({
    sql: 'SELECT * FROM estadisticas_detalladas WHERE usuario_id = ?',
    args: [userId],
  });
  return newResult.rows[0] || null;
}

async function actualizarEstadisticasDetalladas(userId, stats) {
  // stats es un objeto con los campos a incrementar
  const campos = [];
  const args = [];

  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === 'number' && value > 0) {
      campos.push(`${key} = ${key} + ?`);
      args.push(value);
    }
  }

  if (campos.length === 0) return;

  args.push(userId);
  await db.execute({
    sql: `UPDATE estadisticas_detalladas SET ${campos.join(', ')} WHERE usuario_id = ?`,
    args,
  });
}

async function agregarExperiencia(userId, exp) {
  // Obtener estado actual
  const stats = await obtenerEstadisticasDetalladas(userId);
  if (!stats) return { nivel: 1, experiencia: 0, subioNivel: false };

  let { nivel, experiencia } = stats;
  experiencia += exp;

  // Calcular si sube de nivel (cada nivel requiere nivel * 100 XP)
  let subioNivel = false;
  let expRequerida = nivel * 100;

  while (experiencia >= expRequerida) {
    experiencia -= expRequerida;
    nivel += 1;
    subioNivel = true;
    expRequerida = nivel * 100;
  }

  await db.execute({
    sql: 'UPDATE estadisticas_detalladas SET nivel = ?, experiencia = ? WHERE usuario_id = ?',
    args: [nivel, experiencia, userId],
  });

  return { nivel, experiencia, subioNivel, expRequerida };
}

// ============ LOGROS ============

async function inicializarLogros() {
  // Insertar logros predefinidos si no existen
  const logros = [
    // Primeros pasos
    { id: 'primera_victoria', nombre: 'Primera Victoria', descripcion: 'Gana tu primera partida', icono: '🏆', categoria: 'primeros_pasos', puntos_exp: 50 },
    { id: 'primer_truco', nombre: 'Truco!', descripcion: 'Canta tu primer truco', icono: '🎯', categoria: 'primeros_pasos', puntos_exp: 25 },
    { id: 'primer_envido', nombre: 'Envido!', descripcion: 'Canta tu primer envido', icono: '🎲', categoria: 'primeros_pasos', puntos_exp: 25 },
    { id: 'primera_flor', nombre: 'Flor!', descripcion: 'Canta tu primera flor', icono: '🌸', categoria: 'primeros_pasos', puntos_exp: 30 },

    // Victorias
    { id: 'victorias_10', nombre: 'Jugador Dedicado', descripcion: 'Gana 10 partidas', icono: '⭐', categoria: 'victorias', puntos_exp: 100 },
    { id: 'victorias_50', nombre: 'Veterano', descripcion: 'Gana 50 partidas', icono: '🌟', categoria: 'victorias', puntos_exp: 250 },
    { id: 'victorias_100', nombre: 'Maestro del Truco', descripcion: 'Gana 100 partidas', icono: '💫', categoria: 'victorias', puntos_exp: 500 },
    { id: 'victorias_500', nombre: 'Leyenda', descripcion: 'Gana 500 partidas', icono: '👑', categoria: 'victorias', puntos_exp: 1000 },

    // Rachas
    { id: 'racha_3', nombre: 'En Racha', descripcion: 'Gana 3 partidas seguidas', icono: '🔥', categoria: 'rachas', puntos_exp: 75 },
    { id: 'racha_5', nombre: 'Imparable', descripcion: 'Gana 5 partidas seguidas', icono: '💥', categoria: 'rachas', puntos_exp: 150 },
    { id: 'racha_10', nombre: 'Invencible', descripcion: 'Gana 10 partidas seguidas', icono: '⚡', categoria: 'rachas', puntos_exp: 300 },

    // Habilidad
    { id: 'partida_perfecta', nombre: 'Partida Perfecta', descripcion: 'Gana 30-0 a tu rival', icono: '💎', categoria: 'habilidad', puntos_exp: 200 },
    { id: 'trucos_ganados_50', nombre: 'Trucazo', descripcion: 'Gana 50 trucos', icono: '🎯', categoria: 'habilidad', puntos_exp: 150 },
    { id: 'envidos_ganados_50', nombre: 'Rey del Envido', descripcion: 'Gana 50 envidos', icono: '🎲', categoria: 'habilidad', puntos_exp: 150 },
    { id: 'flores_ganadas_25', nombre: 'Florista', descripcion: 'Gana 25 flores', icono: '🌺', categoria: 'habilidad', puntos_exp: 150 },

    // Modos de juego
    { id: 'modo_1v1_maestro', nombre: 'Duelista', descripcion: 'Gana 25 partidas 1v1', icono: '⚔️', categoria: 'modos', puntos_exp: 200 },
    { id: 'modo_2v2_maestro', nombre: 'Compañero Ideal', descripcion: 'Gana 25 partidas 2v2', icono: '🤝', categoria: 'modos', puntos_exp: 200 },
    { id: 'modo_3v3_maestro', nombre: 'Líder de Equipo', descripcion: 'Gana 25 partidas 3v3', icono: '👥', categoria: 'modos', puntos_exp: 200 },

    // Especiales
    { id: 'al_mazo_5', nombre: 'Prudente', descripcion: 'Ve al mazo 5 veces', icono: '📦', categoria: 'especiales', puntos_exp: 50 },
    { id: 'nivel_10', nombre: 'Experimentado', descripcion: 'Alcanza el nivel 10', icono: '🎖️', categoria: 'niveles', puntos_exp: 200 },
    { id: 'nivel_25', nombre: 'Experto', descripcion: 'Alcanza el nivel 25', icono: '🏅', categoria: 'niveles', puntos_exp: 400 },
    { id: 'nivel_50', nombre: 'Gran Maestro', descripcion: 'Alcanza el nivel 50', icono: '🥇', categoria: 'niveles', puntos_exp: 750 },
  ];

  for (const logro of logros) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO logros (id, nombre, descripcion, icono, categoria, puntos_exp, oculto)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [logro.id, logro.nombre, logro.descripcion, logro.icono, logro.categoria, logro.puntos_exp, logro.oculto || 0],
    });
  }
}

async function obtenerTodosLosLogros() {
  const result = await db.execute({
    sql: 'SELECT * FROM logros WHERE oculto = 0 ORDER BY categoria, puntos_exp',
    args: [],
  });
  return result.rows;
}

async function obtenerLogrosUsuario(userId) {
  const result = await db.execute({
    sql: `SELECT l.*, ul.desbloqueado_en
      FROM logros l
      LEFT JOIN usuario_logros ul ON ul.logro_id = l.id AND ul.usuario_id = ?
      WHERE l.oculto = 0
      ORDER BY l.categoria, l.puntos_exp`,
    args: [userId],
  });
  return result.rows;
}

async function desbloquearLogro(userId, logroId) {
  // Verificar si ya tiene el logro
  const existing = await db.execute({
    sql: 'SELECT 1 FROM usuario_logros WHERE usuario_id = ? AND logro_id = ?',
    args: [userId, logroId],
  });

  if (existing.rows.length > 0) return null; // Ya lo tiene

  // Obtener info del logro
  const logroResult = await db.execute({
    sql: 'SELECT * FROM logros WHERE id = ?',
    args: [logroId],
  });

  if (!logroResult.rows[0]) return null;
  const logro = logroResult.rows[0];

  // Desbloquear
  await db.execute({
    sql: 'INSERT INTO usuario_logros (usuario_id, logro_id) VALUES (?, ?)',
    args: [userId, logroId],
  });

  // Dar experiencia
  const nivelInfo = await agregarExperiencia(userId, logro.puntos_exp);

  return { logro, experienciaGanada: logro.puntos_exp, ...nivelInfo };
}

async function verificarYDesbloquearLogros(userId, stats, estadisticasBasicas) {
  const logrosDesbloqueados = [];

  // Obtener estadísticas detalladas actuales
  const ed = await obtenerEstadisticasDetalladas(userId);
  if (!ed) return logrosDesbloqueados;

  // Primera victoria
  if (estadisticasBasicas?.partidas_ganadas >= 1) {
    const r = await desbloquearLogro(userId, 'primera_victoria');
    if (r) logrosDesbloqueados.push(r);
  }

  // Victorias múltiples
  if (estadisticasBasicas?.partidas_ganadas >= 10) {
    const r = await desbloquearLogro(userId, 'victorias_10');
    if (r) logrosDesbloqueados.push(r);
  }
  if (estadisticasBasicas?.partidas_ganadas >= 50) {
    const r = await desbloquearLogro(userId, 'victorias_50');
    if (r) logrosDesbloqueados.push(r);
  }
  if (estadisticasBasicas?.partidas_ganadas >= 100) {
    const r = await desbloquearLogro(userId, 'victorias_100');
    if (r) logrosDesbloqueados.push(r);
  }
  if (estadisticasBasicas?.partidas_ganadas >= 500) {
    const r = await desbloquearLogro(userId, 'victorias_500');
    if (r) logrosDesbloqueados.push(r);
  }

  // Rachas
  if (estadisticasBasicas?.mejor_racha >= 3) {
    const r = await desbloquearLogro(userId, 'racha_3');
    if (r) logrosDesbloqueados.push(r);
  }
  if (estadisticasBasicas?.mejor_racha >= 5) {
    const r = await desbloquearLogro(userId, 'racha_5');
    if (r) logrosDesbloqueados.push(r);
  }
  if (estadisticasBasicas?.mejor_racha >= 10) {
    const r = await desbloquearLogro(userId, 'racha_10');
    if (r) logrosDesbloqueados.push(r);
  }

  // Primer truco/envido/flor
  if (ed.trucos_cantados >= 1) {
    const r = await desbloquearLogro(userId, 'primer_truco');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.envidos_cantados >= 1) {
    const r = await desbloquearLogro(userId, 'primer_envido');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.flores_cantadas >= 1) {
    const r = await desbloquearLogro(userId, 'primera_flor');
    if (r) logrosDesbloqueados.push(r);
  }

  // Habilidades
  if (ed.trucos_ganados >= 50) {
    const r = await desbloquearLogro(userId, 'trucos_ganados_50');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.envidos_ganados >= 50) {
    const r = await desbloquearLogro(userId, 'envidos_ganados_50');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.flores_ganadas >= 25) {
    const r = await desbloquearLogro(userId, 'flores_ganadas_25');
    if (r) logrosDesbloqueados.push(r);
  }

  // Partidas perfectas
  if (ed.partidas_perfectas >= 1) {
    const r = await desbloquearLogro(userId, 'partida_perfecta');
    if (r) logrosDesbloqueados.push(r);
  }

  // Modos de juego
  if (ed.victorias_1v1 >= 25) {
    const r = await desbloquearLogro(userId, 'modo_1v1_maestro');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.victorias_2v2 >= 25) {
    const r = await desbloquearLogro(userId, 'modo_2v2_maestro');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.victorias_3v3 >= 25) {
    const r = await desbloquearLogro(userId, 'modo_3v3_maestro');
    if (r) logrosDesbloqueados.push(r);
  }

  // Al mazo
  if (ed.idas_al_mazo >= 5) {
    const r = await desbloquearLogro(userId, 'al_mazo_5');
    if (r) logrosDesbloqueados.push(r);
  }

  // Niveles
  if (ed.nivel >= 10) {
    const r = await desbloquearLogro(userId, 'nivel_10');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.nivel >= 25) {
    const r = await desbloquearLogro(userId, 'nivel_25');
    if (r) logrosDesbloqueados.push(r);
  }
  if (ed.nivel >= 50) {
    const r = await desbloquearLogro(userId, 'nivel_50');
    if (r) logrosDesbloqueados.push(r);
  }

  return logrosDesbloqueados;
}

// ============ COSMÉTICOS ============

async function inicializarCosmeticos() {
  const cosmeticos = [
    // Temas de mesa
    { id: 'mesa_clasico', tipo: 'tema_mesa', nombre: 'Clásico', descripcion: 'El tapete verde tradicional', imagen_preview: '/temas/clasico.png', precio_monedas: 0, nivel_requerido: 1 },
    { id: 'mesa_noche', tipo: 'tema_mesa', nombre: 'Noche', descripcion: 'Tapete azul oscuro elegante', imagen_preview: '/temas/noche.png', precio_monedas: 500, nivel_requerido: 5 },
    { id: 'mesa_rojo', tipo: 'tema_mesa', nombre: 'Casino', descripcion: 'Tapete rojo estilo casino', imagen_preview: '/temas/rojo.png', precio_monedas: 750, nivel_requerido: 10 },
    { id: 'mesa_dorado', tipo: 'tema_mesa', nombre: 'Dorado', descripcion: 'Tapete dorado premium', imagen_preview: '/temas/dorado.png', precio_monedas: 1500, nivel_requerido: 20, es_premium: 1 },
    { id: 'mesa_cuero', tipo: 'tema_mesa', nombre: 'Cuero', descripcion: 'Tapete estilo cuero envejecido', imagen_preview: '/temas/cuero.png', precio_monedas: 600, nivel_requerido: 8 },
    { id: 'mesa_marmol', tipo: 'tema_mesa', nombre: 'Mármol', descripcion: 'Elegante superficie de mármol gris', imagen_preview: '/temas/marmol.png', precio_monedas: 800, nivel_requerido: 12 },
    { id: 'mesa_neon', tipo: 'tema_mesa', nombre: 'Neón', descripcion: 'Estilo cyberpunk con luces neón', imagen_preview: '/temas/neon.png', precio_monedas: 1200, nivel_requerido: 18, es_premium: 1 },
    { id: 'mesa_medianoche', tipo: 'tema_mesa', nombre: 'Medianoche', descripcion: 'Negro profundo con destellos índigo', imagen_preview: '/temas/medianoche.png', precio_monedas: 2000, nivel_requerido: 25, es_premium: 1 },

    // Reversos de cartas
    { id: 'reverso_clasico', tipo: 'reverso_cartas', nombre: 'Clásico', descripcion: 'Reverso tradicional', imagen_preview: '/reversos/clasico.png', precio_monedas: 0, nivel_requerido: 1 },
    { id: 'reverso_azul', tipo: 'reverso_cartas', nombre: 'Azul Elegante', descripcion: 'Diseño azul con patrones', imagen_preview: '/reversos/azul.png', precio_monedas: 300, nivel_requerido: 3 },
    { id: 'reverso_rojo', tipo: 'reverso_cartas', nombre: 'Rojo Fuego', descripcion: 'Diseño rojo intenso', imagen_preview: '/reversos/rojo.png', precio_monedas: 300, nivel_requerido: 3 },
    { id: 'reverso_dorado', tipo: 'reverso_cartas', nombre: 'Dorado Real', descripcion: 'Reverso dorado premium', imagen_preview: '/reversos/dorado.png', precio_monedas: 1000, nivel_requerido: 15, es_premium: 1 },
    { id: 'reverso_verde', tipo: 'reverso_cartas', nombre: 'Verde Bosque', descripcion: 'Reverso verde oscuro natural', imagen_preview: '/reversos/verde.png', precio_monedas: 300, nivel_requerido: 6 },
    { id: 'reverso_purpura', tipo: 'reverso_cartas', nombre: 'Púrpura', descripcion: 'Diseño violeta misterioso', imagen_preview: '/reversos/purpura.png', precio_monedas: 500, nivel_requerido: 10 },
    { id: 'reverso_negro', tipo: 'reverso_cartas', nombre: 'Obsidiana', descripcion: 'Negro profundo elegante', imagen_preview: '/reversos/negro.png', precio_monedas: 1000, nivel_requerido: 20, es_premium: 1 },
    { id: 'reverso_arcoiris', tipo: 'reverso_cartas', nombre: 'Arcoíris', descripcion: 'Gradiente multicolor vibrante', imagen_preview: '/reversos/arcoiris.png', precio_monedas: 2500, nivel_requerido: 30, es_premium: 1 },

    // Marcos de avatar
    { id: 'marco_ninguno', tipo: 'marco_avatar', nombre: 'Sin Marco', descripcion: 'Avatar sin marco', imagen_preview: '/marcos/ninguno.png', precio_monedas: 0, nivel_requerido: 1 },
    { id: 'marco_bronce', tipo: 'marco_avatar', nombre: 'Bronce', descripcion: 'Marco de bronce', imagen_preview: '/marcos/bronce.png', precio_monedas: 200, nivel_requerido: 5 },
    { id: 'marco_plata', tipo: 'marco_avatar', nombre: 'Plata', descripcion: 'Marco plateado', imagen_preview: '/marcos/plata.png', precio_monedas: 500, nivel_requerido: 10 },
    { id: 'marco_oro', tipo: 'marco_avatar', nombre: 'Oro', descripcion: 'Marco dorado', imagen_preview: '/marcos/oro.png', precio_monedas: 1000, nivel_requerido: 20 },
    { id: 'marco_diamante', tipo: 'marco_avatar', nombre: 'Diamante', descripcion: 'Marco de diamante premium', imagen_preview: '/marcos/diamante.png', precio_monedas: 2500, nivel_requerido: 30, es_premium: 1 },

    // Fondos de perfil
    { id: 'fondo_clasico', tipo: 'fondo_perfil', nombre: 'Clásico', descripcion: 'Fondo oscuro por defecto', imagen_preview: '/fondos/clasico.png', precio_monedas: 0, nivel_requerido: 1 },
    { id: 'fondo_celeste', tipo: 'fondo_perfil', nombre: 'Celeste', descripcion: 'Gradiente celeste suave', imagen_preview: '/fondos/celeste.png', precio_monedas: 300, nivel_requerido: 5 },
    { id: 'fondo_atardecer', tipo: 'fondo_perfil', nombre: 'Atardecer', descripcion: 'Tonos cálidos de atardecer', imagen_preview: '/fondos/atardecer.png', precio_monedas: 500, nivel_requerido: 10 },
    { id: 'fondo_galaxia', tipo: 'fondo_perfil', nombre: 'Galaxia', descripcion: 'Fondo galáctico premium', imagen_preview: '/fondos/galaxia.png', precio_monedas: 1500, nivel_requerido: 20, es_premium: 1 },
    { id: 'fondo_fuego', tipo: 'fondo_perfil', nombre: 'Fuego', descripcion: 'Llamas ardientes premium', imagen_preview: '/fondos/fuego.png', precio_monedas: 2000, nivel_requerido: 25, es_premium: 1 },

    // Packs de sonidos
    { id: 'sonido_clasico', tipo: 'pack_sonido', nombre: 'Clásico', descripcion: 'Sonidos por defecto del juego', imagen_preview: '/sonidos/clasico.png', precio_monedas: 0, nivel_requerido: 1 },
    { id: 'sonido_casino', tipo: 'pack_sonido', nombre: 'Casino', descripcion: 'Sonidos estilo casino', imagen_preview: '/sonidos/casino.png', precio_monedas: 400, nivel_requerido: 8 },
    { id: 'sonido_campo', tipo: 'pack_sonido', nombre: 'Campo', descripcion: 'Ambiente rural uruguayo', imagen_preview: '/sonidos/campo.png', precio_monedas: 400, nivel_requerido: 8 },
    { id: 'sonido_fiesta', tipo: 'pack_sonido', nombre: 'Fiesta', descripcion: 'Sonidos festivos premium', imagen_preview: '/sonidos/fiesta.png', precio_monedas: 1000, nivel_requerido: 15, es_premium: 1 },
  ];

  for (const c of cosmeticos) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO cosmeticos (id, tipo, nombre, descripcion, imagen_preview, precio_monedas, nivel_requerido, es_premium)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [c.id, c.tipo, c.nombre, c.descripcion, c.imagen_preview, c.precio_monedas, c.nivel_requerido, c.es_premium || 0],
    });
  }
}

async function obtenerTodosLosCosmeticos() {
  const result = await db.execute({
    sql: 'SELECT * FROM cosmeticos ORDER BY tipo, nivel_requerido, precio_monedas',
    args: [],
  });
  return result.rows;
}

async function obtenerCosmeticosUsuario(userId) {
  // Auto-desbloquear cosméticos gratuitos que el usuario no tiene aún
  await db.execute({
    sql: `INSERT OR IGNORE INTO usuario_cosmeticos (usuario_id, cosmetico_id, equipado)
      SELECT ?, c.id, 0 FROM cosmeticos c
      WHERE c.precio_monedas = 0
      AND NOT EXISTS (SELECT 1 FROM usuario_cosmeticos uc WHERE uc.usuario_id = ? AND uc.cosmetico_id = c.id)`,
    args: [userId, userId],
  });

  const result = await db.execute({
    sql: `SELECT c.*, uc.equipado, uc.obtenido_en,
      CASE WHEN uc.usuario_id IS NOT NULL THEN 1 ELSE 0 END as desbloqueado
      FROM cosmeticos c
      LEFT JOIN usuario_cosmeticos uc ON uc.cosmetico_id = c.id AND uc.usuario_id = ?
      ORDER BY c.tipo, c.nivel_requerido, c.precio_monedas`,
    args: [userId],
  });
  return result.rows;
}

async function comprarCosmetico(userId, cosmeticoId) {
  // Verificar si ya lo tiene
  const existing = await db.execute({
    sql: 'SELECT 1 FROM usuario_cosmeticos WHERE usuario_id = ? AND cosmetico_id = ?',
    args: [userId, cosmeticoId],
  });

  if (existing.rows.length > 0) {
    return { error: 'Ya tienes este cosmético' };
  }

  // Obtener info del cosmético
  const cosmeticoResult = await db.execute({
    sql: 'SELECT * FROM cosmeticos WHERE id = ?',
    args: [cosmeticoId],
  });

  if (!cosmeticoResult.rows[0]) {
    return { error: 'Cosmético no encontrado' };
  }

  const cosmetico = cosmeticoResult.rows[0];

  // Verificar nivel
  const stats = await obtenerEstadisticasDetalladas(userId);
  if (stats.nivel < cosmetico.nivel_requerido) {
    return { error: `Necesitas nivel ${cosmetico.nivel_requerido}` };
  }

  // Verificar y descontar monedas
  if (cosmetico.precio_monedas > 0) {
    const gasto = await gastarMonedas(userId, cosmetico.precio_monedas, `cosmetico:${cosmeticoId}`);
    if (gasto.error) return { error: gasto.error };
  }

  // Desequipar otros del mismo tipo primero
  await db.execute({
    sql: `UPDATE usuario_cosmeticos SET equipado = 0
      WHERE usuario_id = ? AND cosmetico_id IN (SELECT id FROM cosmeticos WHERE tipo = ?)`,
    args: [userId, cosmetico.tipo],
  });

  // Insertar y equipar automáticamente
  await db.execute({
    sql: 'INSERT INTO usuario_cosmeticos (usuario_id, cosmetico_id, equipado) VALUES (?, ?, 1)',
    args: [userId, cosmeticoId],
  });

  return { success: true, cosmetico };
}

async function equiparCosmetico(userId, cosmeticoId, autoDesbloquear = false) {
  console.log(`[DB] equiparCosmetico: userId=${userId}, cosmeticoId=${cosmeticoId}, autoDesbloquear=${autoDesbloquear}`);

  // Verificar que lo tiene
  const existing = await db.execute({
    sql: 'SELECT 1 FROM usuario_cosmeticos WHERE usuario_id = ? AND cosmetico_id = ?',
    args: [userId, cosmeticoId],
  });

  // Obtener tipo del cosmético
  const cosmeticoResult = await db.execute({
    sql: 'SELECT tipo FROM cosmeticos WHERE id = ?',
    args: [cosmeticoId],
  });

  const tipo = cosmeticoResult.rows[0]?.tipo;
  console.log(`[DB] equiparCosmetico: existing=${existing.rows.length}, tipo=${tipo}`);

  if (!tipo) {
    console.log(`[DB] equiparCosmetico: Cosmético no encontrado: ${cosmeticoId}`);
    return { error: 'Cosmético no encontrado' };
  }

  if (existing.rows.length === 0) {
    if (autoDesbloquear) {
      // Desbloquear automáticamente (para usuarios premium)
      console.log(`[DB] equiparCosmetico: Auto-desbloqueando ${cosmeticoId} para usuario ${userId}`);
      await db.execute({
        sql: 'INSERT INTO usuario_cosmeticos (usuario_id, cosmetico_id, equipado) VALUES (?, ?, 0)',
        args: [userId, cosmeticoId],
      });
    } else {
      console.log(`[DB] equiparCosmetico: Usuario no tiene el cosmético y autoDesbloquear=false`);
      return { error: 'No tienes este cosmético' };
    }
  }

  // Desequipar otros del mismo tipo
  await db.execute({
    sql: `UPDATE usuario_cosmeticos SET equipado = 0
      WHERE usuario_id = ? AND cosmetico_id IN (SELECT id FROM cosmeticos WHERE tipo = ?)`,
    args: [userId, tipo],
  });

  // Equipar este
  await db.execute({
    sql: 'UPDATE usuario_cosmeticos SET equipado = 1 WHERE usuario_id = ? AND cosmetico_id = ?',
    args: [userId, cosmeticoId],
  });

  console.log(`[DB] equiparCosmetico: SUCCESS - ${cosmeticoId} equipado para usuario ${userId}`);
  return { success: true };
}

async function obtenerCosmeticosEquipados(userId) {
  const result = await db.execute({
    sql: `SELECT c.* FROM cosmeticos c
      JOIN usuario_cosmeticos uc ON uc.cosmetico_id = c.id
      WHERE uc.usuario_id = ? AND uc.equipado = 1`,
    args: [userId],
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

// ============ SUGERENCIAS ============

async function crearSugerencia(nombre, email, tipo, mensaje, userId = null) {
  const result = await db.execute({
    sql: `INSERT INTO sugerencias (nombre, email, tipo, mensaje, usuario_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: [nombre, email || null, tipo, mensaje, userId],
  });
  return Number(result.lastInsertRowid);
}

async function obtenerSugerencias(estado = null, limite = 50) {
  let sql = 'SELECT * FROM sugerencias';
  const args = [];

  if (estado) {
    sql += ' WHERE estado = ?';
    args.push(estado);
  }

  sql += ' ORDER BY creado_en DESC LIMIT ?';
  args.push(limite);

  const result = await db.execute({ sql, args });
  return result.rows;
}

async function actualizarEstadoSugerencia(id, estado) {
  await db.execute({
    sql: 'UPDATE sugerencias SET estado = ? WHERE id = ?',
    args: [estado, id],
  });
}

// ============ MONEDAS ============

async function obtenerMonedas(userId) {
  const result = await db.execute({
    sql: 'SELECT monedas FROM usuarios WHERE id = ?',
    args: [userId],
  });
  return result.rows[0]?.monedas ?? 0;
}

async function agregarMonedas(userId, cantidad, motivo) {
  await db.execute({
    sql: 'UPDATE usuarios SET monedas = monedas + ? WHERE id = ?',
    args: [cantidad, userId],
  });
  const nuevoBalance = await obtenerMonedas(userId);
  await db.execute({
    sql: 'INSERT INTO historial_monedas (usuario_id, cantidad, motivo, balance_despues) VALUES (?, ?, ?, ?)',
    args: [userId, cantidad, motivo, nuevoBalance],
  });
  return nuevoBalance;
}

async function gastarMonedas(userId, cantidad, motivo) {
  const balanceActual = await obtenerMonedas(userId);
  if (balanceActual < cantidad) {
    return { error: `No tenés suficientes monedas (tenés ${balanceActual}, necesitás ${cantidad})` };
  }
  await db.execute({
    sql: 'UPDATE usuarios SET monedas = monedas - ? WHERE id = ?',
    args: [cantidad, userId],
  });
  const nuevoBalance = await obtenerMonedas(userId);
  await db.execute({
    sql: 'INSERT INTO historial_monedas (usuario_id, cantidad, motivo, balance_despues) VALUES (?, ?, ?, ?)',
    args: [userId, -cantidad, motivo, nuevoBalance],
  });
  return { success: true, balance: nuevoBalance };
}

// ============ PAGOS DE MONEDAS ============

const COIN_PACKS = {
  'pack_500': { monedas: 500, precio: 49, nombre: 'Basico' },
  'pack_1200': { monedas: 1200, precio: 99, nombre: 'Popular' },
  'pack_3000': { monedas: 3000, precio: 199, nombre: 'Mejor Valor' },
  'pack_7500': { monedas: 7500, precio: 399, nombre: 'Mega Pack' },
};

async function procesarPagoMonedas(userId, paymentId, packId, monto, moneda) {
  const pack = COIN_PACKS[packId];
  if (!pack) {
    return { error: 'Pack no encontrado' };
  }

  // Registrar el pago
  await db.execute({
    sql: `INSERT INTO pagos_monedas (usuario_id, payment_id, status, monto, moneda, monedas_compradas, pack_id) VALUES (?, ?, 'approved', ?, ?, ?, ?)`,
    args: [userId, paymentId, monto, moneda, pack.monedas, packId],
  });

  // Agregar las monedas al usuario
  const nuevoBalance = await agregarMonedas(userId, pack.monedas, `compra:${packId}:${paymentId}`);

  console.log(`[DB] Pago monedas procesado: userId=${userId}, pack=${packId}, monedas=${pack.monedas}, balance=${nuevoBalance}`);
  return { success: true, monedas: pack.monedas, balance: nuevoBalance };
}

const RECOMPENSA_DIARIA = [15, 20, 25, 30, 35, 40, 50]; // día 1-7

async function obtenerRecompensaDiaria(userId) {
  const result = await db.execute({
    sql: 'SELECT ultimo_login_recompensa, dias_consecutivos_login FROM usuarios WHERE id = ?',
    args: [userId],
  });
  const usuario = result.rows[0];
  if (!usuario) return { yaReclamado: true, monedas: 0, diasConsecutivos: 0 };

  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ultimoReclamo = usuario.ultimo_login_recompensa;

  if (ultimoReclamo === hoy) {
    return { yaReclamado: true, monedas: 0, diasConsecutivos: Number(usuario.dias_consecutivos_login) };
  }

  // Calcular si es consecutivo
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const esConsecutivo = ultimoReclamo === ayer;
  const diasConsecutivos = esConsecutivo ? Math.min(Number(usuario.dias_consecutivos_login) + 1, 7) : 1;
  const monedas = RECOMPENSA_DIARIA[diasConsecutivos - 1];

  return { yaReclamado: false, monedas, diasConsecutivos };
}

async function reclamarRecompensaDiaria(userId) {
  const info = await obtenerRecompensaDiaria(userId);
  if (info.yaReclamado) {
    return { success: false, error: 'Ya reclamaste tu recompensa hoy', diasConsecutivos: info.diasConsecutivos };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  await db.execute({
    sql: 'UPDATE usuarios SET ultimo_login_recompensa = ?, dias_consecutivos_login = ? WHERE id = ?',
    args: [hoy, info.diasConsecutivos, userId],
  });

  const nuevoBalance = await agregarMonedas(userId, info.monedas, `recompensa_diaria:dia${info.diasConsecutivos}`);
  return { success: true, monedas: info.monedas, balance: nuevoBalance, diasConsecutivos: info.diasConsecutivos };
}

module.exports = {
  db,
  initDB,
  crearUsuario,
  buscarUsuarioPorApodo,
  buscarUsuarioPorGoogleId,
  buscarUsuarioPorEmail,
  crearUsuarioGoogle,
  vincularGoogle,
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
  // Estadísticas detalladas y niveles
  obtenerEstadisticasDetalladas,
  actualizarEstadisticasDetalladas,
  agregarExperiencia,
  // Logros
  inicializarLogros,
  obtenerTodosLosLogros,
  obtenerLogrosUsuario,
  desbloquearLogro,
  verificarYDesbloquearLogros,
  // Cosméticos
  inicializarCosmeticos,
  obtenerTodosLosCosmeticos,
  obtenerCosmeticosUsuario,
  comprarCosmetico,
  equiparCosmetico,
  obtenerCosmeticosEquipados,
  // Sugerencias
  crearSugerencia,
  obtenerSugerencias,
  actualizarEstadoSugerencia,
  // Monedas
  obtenerMonedas,
  agregarMonedas,
  gastarMonedas,
  obtenerRecompensaDiaria,
  reclamarRecompensaDiaria,
  // Premium con pagos
  activarPremium,
  verificarExpiracionPremium,
  obtenerEstadoPremium,
  // Pagos de monedas
  COIN_PACKS,
  procesarPagoMonedas,
};
