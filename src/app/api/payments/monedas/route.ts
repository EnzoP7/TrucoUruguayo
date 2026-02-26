import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const COIN_PACKS: Record<string, { monedas: number; precio: number; nombre: string }> = {
  'pack_500': { monedas: 500, precio: 49, nombre: 'Basico' },
  'pack_1200': { monedas: 1200, precio: 99, nombre: 'Popular' },
  'pack_3000': { monedas: 3000, precio: 199, nombre: 'Mejor Valor' },
  'pack_7500': { monedas: 7500, precio: 399, nombre: 'Mega Pack' },
}

export async function POST(request: Request) {
  try {
    const { userId, packId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    if (!packId || !COIN_PACKS[packId]) {
      return NextResponse.json({ error: 'Pack no valido' }, { status: 400 })
    }

    const pack = COIN_PACKS[packId]

    // Verificar que el usuario existe
    const result = await db.execute({
      sql: 'SELECT id, apodo FROM usuarios WHERE id = ?',
      args: [userId],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
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
            id: packId,
            title: `${pack.monedas} Monedas - Truco Uruguayo`,
            description: `Pack ${pack.nombre}: ${pack.monedas} monedas para desbloquear cosmeticos`,
            quantity: 1,
            unit_price: pack.precio,
            currency_id: 'UYU',
          },
        ],
        back_urls: {
          success: `${siteUrl}/premium/resultado?status=approved&type=monedas&pack=${packId}`,
          failure: `${siteUrl}/premium/resultado?status=failure&type=monedas`,
          pending: `${siteUrl}/premium/resultado?status=pending&type=monedas`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        external_reference: `monedas_${packId}_${userId}`,
        statement_descriptor: 'TRUCO URUGUAYO',
      },
    })

    return NextResponse.json({
      success: true,
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
    })
  } catch (error) {
    console.error('[API Payments Monedas] Error creando preferencia:', error)
    return NextResponse.json(
      { error: 'Error al crear el pago' },
      { status: 500 }
    )
  }
}
