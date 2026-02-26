import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    // Verificar que el usuario existe y no es premium activo
    const result = await db.execute({
      sql: 'SELECT id, apodo, es_premium, premium_expira FROM usuarios WHERE id = ?',
      args: [userId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const usuario = result.rows[0]

    // Si ya es premium y no ha expirado, no permitir comprar de nuevo
    if (usuario.es_premium && usuario.premium_expira) {
      const expira = new Date(usuario.premium_expira as string)
      if (expira > new Date()) {
        return NextResponse.json(
          { error: 'Ya tenes un pase premium activo' },
          { status: 400 }
        )
      }
    }

    // Configurar MercadoPago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json(
        { error: 'MercadoPago no configurado' },
        { status: 500 }
      )
    }

    const client = new MercadoPagoConfig({ accessToken })
    const preference = new Preference(client)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: 'premium_30d',
            title: 'Pase Premium 30 dias - Truco Uruguayo',
            description: 'Sin anuncios, audios custom, cosmeticos exclusivos, bonus x1.5 monedas y XP',
            quantity: 1,
            unit_price: 59,
            currency_id: 'UYU',
          },
        ],
        back_urls: {
          success: `${siteUrl}/premium/resultado?status=approved`,
          failure: `${siteUrl}/premium/resultado?status=failure`,
          pending: `${siteUrl}/premium/resultado?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        external_reference: `premium_${userId}`,
        statement_descriptor: 'TRUCO URUGUAYO',
      },
    })

    return NextResponse.json({
      success: true,
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
    })
  } catch (error) {
    console.error('[API Payments] Error creando preferencia:', error)
    return NextResponse.json(
      { error: 'Error al crear el pago' },
      { status: 500 }
    )
  }
}
