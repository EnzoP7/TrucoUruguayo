const bcrypt = require('bcryptjs');
const {
  crearUsuario,
  buscarUsuarioPorApodo,
  buscarUsuarioPorGoogleId,
  buscarUsuarioPorEmail,
  crearUsuarioGoogle,
  vincularGoogle,
  actualizarUltimoLogin,
  actualizarAvatarUrl,
} = require('./db');

const SALT_ROUNDS = 10;

async function registrar(apodo, password) {
  // Validaciones
  if (!apodo || apodo.trim().length < 2) {
    return { success: false, error: 'El apodo debe tener al menos 2 caracteres' };
  }
  if (apodo.trim().length > 20) {
    return { success: false, error: 'El apodo no puede tener más de 20 caracteres' };
  }
  if (!password || password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  const apodoLimpio = apodo.trim();

  // Verificar si ya existe
  const existente = await buscarUsuarioPorApodo(apodoLimpio);
  if (existente) {
    return { success: false, error: 'Ese apodo ya está en uso' };
  }

  // Crear usuario
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await crearUsuario(apodoLimpio, hash);

  return {
    success: true,
    usuario: { id: userId, apodo: apodoLimpio, es_premium: false, avatar_url: null, tema_mesa: 'clasico', reverso_cartas: 'clasico' },
  };
}

async function login(apodo, password) {
  if (!apodo || !password) {
    return { success: false, error: 'Apodo y contraseña son obligatorios' };
  }

  const usuario = await buscarUsuarioPorApodo(apodo.trim());
  if (!usuario) {
    return { success: false, error: 'Apodo o contraseña incorrectos' };
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    return { success: false, error: 'Apodo o contraseña incorrectos' };
  }

  await actualizarUltimoLogin(usuario.id);

  return {
    success: true,
    usuario: { id: Number(usuario.id), apodo: usuario.apodo, es_premium: !!usuario.es_premium, avatar_url: usuario.avatar_url || null, tema_mesa: usuario.tema_mesa || 'clasico', reverso_cartas: usuario.reverso_cartas || 'clasico' },
  };
}

// Login o registro con Google
async function loginConGoogle(googleId, email, nombre, avatarUrl) {
  try {
    // Buscar usuario por Google ID
    let usuario = await buscarUsuarioPorGoogleId(googleId);

    if (!usuario) {
      // Verificar si existe cuenta con ese email
      const existentePorEmail = await buscarUsuarioPorEmail(email);

      if (existentePorEmail) {
        // Vincular automáticamente si el email coincide
        await vincularGoogle(existentePorEmail.id, googleId, email);
        // Guardar avatar de Google si no tenía
        if (avatarUrl && !existentePorEmail.avatar_url) {
          await actualizarAvatarUrl(existentePorEmail.id, avatarUrl);
        }
        usuario = await buscarUsuarioPorGoogleId(googleId);
      } else {
        // Crear nuevo usuario
        const { userId, apodo } = await crearUsuarioGoogle(googleId, email, nombre, avatarUrl);
        usuario = {
          id: userId,
          apodo,
          email,
          es_premium: 0,
          avatar_url: avatarUrl,
        };
      }
    }

    await actualizarUltimoLogin(usuario.id);

    // Sincronizar avatar de Google si cambió o no tenía
    if (avatarUrl && avatarUrl !== usuario.avatar_url) {
      await actualizarAvatarUrl(usuario.id, avatarUrl);
      usuario.avatar_url = avatarUrl;
    }

    return {
      success: true,
      usuario: {
        id: Number(usuario.id),
        apodo: usuario.apodo,
        email: usuario.email,
        es_premium: !!usuario.es_premium,
        avatar_url: usuario.avatar_url || null,
        tema_mesa: usuario.tema_mesa || 'clasico',
        reverso_cartas: usuario.reverso_cartas || 'clasico',
      },
    };
  } catch (error) {
    console.error('[Auth] Error en loginConGoogle:', error);
    return { success: false, error: error.message || 'Error al autenticar con Google' };
  }
}

// Vincular cuenta Google a usuario existente
async function vincularCuentaGoogle(userId, googleId, email) {
  try {
    // Verificar que el googleId no esté ya vinculado a otra cuenta
    const existente = await buscarUsuarioPorGoogleId(googleId);
    if (existente && Number(existente.id) !== userId) {
      return { success: false, error: 'Esta cuenta de Google ya está vinculada a otro usuario' };
    }

    await vincularGoogle(userId, googleId, email);
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error en vincularCuentaGoogle:', error);
    return { success: false, error: error.message || 'Error al vincular cuenta de Google' };
  }
}

// Agregar contraseña a cuenta que solo tiene Google
async function agregarPassword(userId, password) {
  if (!password || password.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { db } = require('./db');
    await db.execute({
      sql: 'UPDATE usuarios SET password_hash = ?, auth_provider = "both" WHERE id = ?',
      args: [hash, userId],
    });
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error en agregarPassword:', error);
    return { success: false, error: error.message || 'Error al agregar contraseña' };
  }
}

module.exports = { registrar, login, loginConGoogle, vincularCuentaGoogle, agregarPassword };
