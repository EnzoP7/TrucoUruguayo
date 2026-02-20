import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, email, tipo, mensaje } = body

    // Validaciones
    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: 'El nombre debe tener al menos 2 caracteres' },
        { status: 400 }
      )
    }

    if (!mensaje || mensaje.trim().length < 10) {
      return NextResponse.json(
        { error: 'El mensaje debe tener al menos 10 caracteres' },
        { status: 400 }
      )
    }

    if (mensaje.trim().length > 2000) {
      return NextResponse.json(
        { error: 'El mensaje no puede exceder 2000 caracteres' },
        { status: 400 }
      )
    }

    // Validar email si se proporciona
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'El email no es valido' },
        { status: 400 }
      )
    }

    // Validar tipo
    const tiposValidos = ['sugerencia', 'error', 'mejora', 'otro']
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'sugerencia'

    // Guardar en la base de datos
    const result = await db.execute({
      sql: `INSERT INTO sugerencias (nombre, email, tipo, mensaje)
            VALUES (?, ?, ?, ?)`,
      args: [nombre.trim(), email?.trim() || null, tipoFinal, mensaje.trim()],
    })

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: 'Gracias por tu sugerencia! La revisaremos pronto.',
    })
  } catch (error) {
    console.error('[API Sugerencias] Error:', error)
    return NextResponse.json(
      { error: 'Error al guardar la sugerencia' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Endpoint solo para admin (por ahora sin auth)
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM sugerencias ORDER BY creado_en DESC LIMIT 100',
      args: [],
    })

    return NextResponse.json({
      success: true,
      sugerencias: result.rows,
    })
  } catch (error) {
    console.error('[API Sugerencias] Error GET:', error)
    return NextResponse.json(
      { error: 'Error al obtener sugerencias' },
      { status: 500 }
    )
  }
}
