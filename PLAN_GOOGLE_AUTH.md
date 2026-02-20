# Plan de Implementación: Login con Google + Sistema Actual

## Resumen

Agregar autenticación con Google manteniendo compatibilidad total con el sistema actual de apodo/contraseña. Ambos métodos coexistirán y un usuario podrá vincular su cuenta Google a una cuenta existente.

---

## Estado Actual del Sistema

- **Auth vía Socket.IO**: eventos `login` y `registrar`
- **Sesión cliente**: `sessionStorage` (truco_usuario, truco_auth)
- **Sesión servidor**: `socketUsuarios` Map (socketId → usuario)
- **DB**: Turso con tabla `usuarios` (apodo, password_hash)
- **Seguridad**: bcrypt para passwords

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE                                 │
├─────────────────────────────────────────────────────────────┤
│  Login Page                                                  │
│  ├── [Apodo + Contraseña] → Socket.IO 'login'              │
│  └── [Continuar con Google] → NextAuth → /api/auth/google  │
│                                                              │
│  Después de auth exitoso:                                   │
│  → sessionStorage guarda usuario                            │
│  → Socket.IO se autentica con userId (no password)         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      SERVIDOR                                │
├─────────────────────────────────────────────────────────────┤
│  NextAuth.js                                                 │
│  └── /api/auth/[...nextauth]/route.ts                       │
│      ├── Google Provider                                    │
│      └── Callbacks: signIn, jwt, session                    │
│                                                              │
│  Socket.IO (server.js)                                      │
│  ├── 'login' - auth con apodo/password (sin cambios)       │
│  ├── 'login-google' - auth con googleId                    │
│  └── 'vincular-google' - vincular cuenta existente         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS                             │
├─────────────────────────────────────────────────────────────┤
│  usuarios                                                    │
│  ├── id, apodo, password_hash (existentes)                 │
│  ├── email TEXT UNIQUE (NUEVO)                             │
│  ├── google_id TEXT UNIQUE (NUEVO)                         │
│  └── auth_provider TEXT DEFAULT 'local' (NUEVO)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Pasos de Implementación

### PASO 1: Modificar Base de Datos (db.js)

**Agregar columnas a tabla usuarios:**
```sql
ALTER TABLE usuarios ADD COLUMN email TEXT UNIQUE;
ALTER TABLE usuarios ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE usuarios ADD COLUMN auth_provider TEXT DEFAULT 'local';
```

**Nuevas funciones:**
- `buscarUsuarioPorGoogleId(googleId)` - buscar usuario por Google ID
- `buscarUsuarioPorEmail(email)` - buscar usuario por email
- `crearUsuarioGoogle(googleId, email, nombre, avatarUrl)` - crear usuario desde Google
- `vincularGoogle(userId, googleId, email)` - vincular Google a cuenta existente

---

### PASO 2: Instalar Dependencias

```bash
npm install next-auth@beta
```

Nota: Usamos next-auth v5 (beta) que es compatible con Next.js 14 App Router.

---

### PASO 3: Configurar Variables de Entorno

Agregar a `.env.local`:
```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-generado-con-openssl

# Google OAuth (desde Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
```

---

### PASO 4: Crear Configuración NextAuth

**Crear `src/lib/auth.ts`:**
```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Buscar o crear usuario en nuestra DB
      // Retornar true si OK, false si error
    },
    async jwt({ token, user, account }) {
      // Agregar nuestro userId al token
    },
    async session({ session, token }) {
      // Pasar userId a la sesión del cliente
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
```

---

### PASO 5: Crear API Route de NextAuth

**Crear `src/app/api/auth/[...nextauth]/route.ts`:**
```typescript
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

---

### PASO 6: Actualizar auth.js (Backend)

**Agregar funciones para Google:**
```javascript
// Buscar o crear usuario con Google
async function loginConGoogle(googleId, email, nombre, avatarUrl) {
  let usuario = await buscarUsuarioPorGoogleId(googleId);

  if (!usuario) {
    // Verificar si existe cuenta con ese email
    const existente = await buscarUsuarioPorEmail(email);
    if (existente) {
      // Vincular automáticamente si el email coincide
      await vincularGoogle(existente.id, googleId, email);
      usuario = await buscarUsuarioPorGoogleId(googleId);
    } else {
      // Crear nuevo usuario
      const userId = await crearUsuarioGoogle(googleId, email, nombre, avatarUrl);
      usuario = { id: userId, apodo: nombre, email, es_premium: false, avatar_url: avatarUrl };
    }
  }

  await actualizarUltimoLogin(usuario.id);
  return { success: true, usuario };
}

// Vincular Google a cuenta existente (requiere estar logueado)
async function vincularCuentaGoogle(userId, googleId, email) {
  // Verificar que el googleId no esté ya vinculado a otra cuenta
  const existente = await buscarUsuarioPorGoogleId(googleId);
  if (existente && existente.id !== userId) {
    return { success: false, error: 'Esta cuenta de Google ya está vinculada a otro usuario' };
  }

  await vincularGoogle(userId, googleId, email);
  return { success: true };
}
```

---

### PASO 7: Actualizar server.js (Socket.IO)

**Agregar nuevo evento:**
```javascript
// Login con Google (después de que NextAuth valida)
socket.on('login-google', async (data, callback) => {
  const { googleId, email, nombre, avatarUrl } = data;

  try {
    const result = await loginConGoogle(googleId, email, nombre, avatarUrl);

    if (result.success) {
      socketUsuarios.set(socket.id, result.usuario);

      // Buscar partidas activas
      const partidasActivas = buscarPartidasActivasDeUsuario(result.usuario.id);
      result.partidasActivas = partidasActivas;
    }

    callback(result);
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});

// Vincular Google a cuenta existente
socket.on('vincular-google', async (data, callback) => {
  const usuario = socketUsuarios.get(socket.id);
  if (!usuario) {
    return callback({ success: false, error: 'No autenticado' });
  }

  const { googleId, email } = data;
  const result = await vincularCuentaGoogle(usuario.id, googleId, email);
  callback(result);
});
```

---

### PASO 8: Actualizar src/lib/socket.ts

**Agregar método para login con Google:**
```typescript
async loginConGoogle(googleId: string, email: string, nombre: string, avatarUrl?: string): Promise<any> {
  return new Promise((resolve) => {
    this.socket!.emit('login-google' as any, { googleId, email, nombre, avatarUrl }, (result: any) => {
      resolve(result);
    });
  });
}

async vincularGoogle(googleId: string, email: string): Promise<any> {
  return new Promise((resolve) => {
    this.socket!.emit('vincular-google' as any, { googleId, email }, (result: any) => {
      resolve(result);
    });
  });
}
```

---

### PASO 9: Actualizar Login Page

**Modificar `src/app/login/page.tsx`:**

```tsx
import { signIn } from 'next-auth/react';

// Agregar botón de Google
<button
  onClick={() => signIn('google', { callbackUrl: '/lobby' })}
  className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 rounded-lg py-3 hover:bg-gray-50"
>
  <GoogleIcon />
  Continuar con Google
</button>

// Separador
<div className="flex items-center gap-4 my-4">
  <div className="flex-1 h-px bg-gray-600" />
  <span className="text-gray-400">o</span>
  <div className="flex-1 h-px bg-gray-600" />
</div>

// Form existente de apodo/contraseña (sin cambios)
```

---

### PASO 10: Crear Callback Page para Google

**Crear `src/app/api/auth/callback/page.tsx`** (o manejar en lobby):

Después de que Google autentica, NextAuth redirige. En el lobby, detectar si hay sesión de NextAuth y sincronizar con Socket.IO:

```tsx
// En lobby/page.tsx
import { useSession } from 'next-auth/react';

const { data: session } = useSession();

useEffect(() => {
  if (session?.user && !usuario) {
    // Usuario viene de Google auth
    socketService.loginConGoogle(
      session.user.googleId,
      session.user.email,
      session.user.name,
      session.user.image
    ).then(result => {
      if (result.success) {
        setUsuario(result.usuario);
        sessionStorage.setItem('truco_usuario', JSON.stringify(result.usuario));
      }
    });
  }
}, [session]);
```

---

### PASO 11: Configurar Google Cloud Console

1. Ir a https://console.cloud.google.com/
2. Crear proyecto o seleccionar existente
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
4. Application type: Web application
5. Authorized JavaScript origins: `http://localhost:3000`
6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copiar Client ID y Client Secret a `.env.local`

---

### PASO 12: Agregar SessionProvider

**Modificar `src/app/layout.tsx`:**
```tsx
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

## Flujos de Usuario

### Flujo 1: Usuario nuevo con Google
1. Click "Continuar con Google"
2. Google OAuth → NextAuth valida
3. Callback → busca/crea usuario en DB con google_id
4. Redirige a /lobby
5. Lobby detecta sesión NextAuth → emit 'login-google' a Socket.IO
6. Socket.IO mapea usuario → socketUsuarios
7. Usuario listo para jugar

### Flujo 2: Usuario existente (apodo/password) quiere vincular Google
1. Login normal con apodo/password
2. En perfil: "Vincular cuenta de Google"
3. Click → Google OAuth
4. Al volver, emit 'vincular-google' con googleId
5. DB actualiza usuario con google_id y email
6. Próxima vez puede usar cualquier método

### Flujo 3: Usuario con Google quiere agregar contraseña
1. En perfil: "Agregar contraseña"
2. Ingresa nueva contraseña
3. emit 'agregar-password' → bcrypt hash → guarda en DB
4. Ahora puede usar ambos métodos

---

## Casos Edge

| Caso | Comportamiento |
|------|----------------|
| Google email ya existe en DB (como apodo) | Vincular automáticamente |
| Usuario Google sin apodo | Usar nombre de Google, permitir cambiar después |
| Apodo de Google ya tomado | Agregar sufijo numérico (ej: "Juan_123") |
| Usuario borra cuenta Google | Sigue funcionando si tiene password |
| Usuario solo tiene Google y lo desvincula | No permitir (debe agregar password primero) |

---

## Archivos a Crear/Modificar

### Crear:
- `src/lib/auth.ts` - Configuración NextAuth
- `src/app/api/auth/[...nextauth]/route.ts` - API route
- `src/components/GoogleButton.tsx` - Botón reutilizable (opcional)

### Modificar:
- `db.js` - Nuevas columnas y funciones
- `auth.js` - Funciones para Google
- `server.js` - Eventos Socket.IO para Google
- `src/lib/socket.ts` - Métodos cliente para Google
- `src/app/login/page.tsx` - UI con botón Google
- `src/app/lobby/page.tsx` - Sincronizar sesión NextAuth con Socket.IO
- `src/app/layout.tsx` - SessionProvider
- `src/app/perfil/page.tsx` - Opción vincular/desvincular Google
- `.env.local` - Variables de entorno

---

## Testing

1. **Registro con Google** - Usuario nuevo
2. **Login con Google** - Usuario existente
3. **Login tradicional** - Verificar que sigue funcionando
4. **Vincular Google** - Usuario con password vincula Google
5. **Cambiar entre métodos** - Mismo usuario, ambos métodos
6. **Reconexión** - Socket.IO reconecta y mantiene sesión
7. **Partidas activas** - Usuario Google puede reconectarse a partida

---

## Estimación de Complejidad

| Componente | Dificultad | Archivos |
|------------|------------|----------|
| DB schema | Fácil | 1 |
| NextAuth config | Media | 2 |
| Socket.IO eventos | Fácil | 2 |
| UI Login | Fácil | 1 |
| Sincronización sesiones | Media | 2 |
| Casos edge | Media | varios |
| **Total** | **Media** | ~10 archivos |

---

## Notas de Seguridad

1. **NEXTAUTH_SECRET** debe ser un string largo y aleatorio
2. **No guardar tokens de Google** - NextAuth los maneja
3. **Validar googleId en servidor** - No confiar en cliente
4. **HTTPS en producción** - Requerido para OAuth
5. **Mantener password_hash NULL** para usuarios solo-Google
