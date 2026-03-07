import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export async function POST(request: Request) {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Solo disponible en modo desarrollo' },
      { status: 403 }
    )
  }

  try {
    const { userId, activar } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    // Verificar que el usuario existe
    const result = await db.execute({
      sql: 'SELECT id, apodo FROM usuarios WHERE id = ?',
      args: [userId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (activar) {
      // Activar premium por 30 días
      const expiraDate = new Date()
      expiraDate.setDate(expiraDate.getDate() + 30)

      await db.execute({
        sql: 'UPDATE usuarios SET es_premium = 1, premium_expira = ? WHERE id = ?',
        args: [expiraDate.toISOString(), userId],
      })

      console.log(`[DEV] Premium ACTIVADO para usuario ${userId} hasta ${expiraDate.toISOString()}`)
    } else {
      // Desactivar premium
      await db.execute({
        sql: 'UPDATE usuarios SET es_premium = 0, premium_expira = NULL WHERE id = ?',
        args: [userId],
      })

      console.log(`[DEV] Premium DESACTIVADO para usuario ${userId}`)
    }

    return NextResponse.json({
      success: true,
      esPremium: activar,
      mensaje: activar ? 'Premium activado (modo dev)' : 'Premium desactivado (modo dev)',
    })
  } catch (error) {
    console.error('[API Dev] Error toggling premium:', error)
    return NextResponse.json(
      { error: 'Error al cambiar estado premium' },
      { status: 500 }
    )
  }
}
