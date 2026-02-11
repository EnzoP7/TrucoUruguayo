const bcrypt = require('bcryptjs');
const { crearUsuario, buscarUsuarioPorApodo, actualizarUltimoLogin } = require('./db');

const SALT_ROUNDS = 10;

async function registrar(apodo, password) {
  // Validaciones
  if (!apodo || apodo.trim().length < 2) {
    return { success: false, error: 'El apodo debe tener al menos 2 caracteres' };
  }
  if (apodo.trim().length > 20) {
    return { success: false, error: 'El apodo no puede tener más de 20 caracteres' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'La contraseña debe tener al menos 4 caracteres' };
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
    usuario: { id: userId, apodo: apodoLimpio, es_premium: false, avatar_url: null },
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
    usuario: { id: Number(usuario.id), apodo: usuario.apodo, es_premium: !!usuario.es_premium, avatar_url: usuario.avatar_url || null },
  };
}

module.exports = { registrar, login };
