import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const COIN_PACKS: Record<string, { monedas: number }> = {
  'pack_500': { monedas: 500 },
  'pack_1200': { monedas: 1200 },
  'pack_3000': { monedas: 3000 },
  'pack_7500': { monedas: 7500 },
}

async function activarPremiumDB(userId: number, paymentId: string, monto: number, moneda: string) {
  const ahora = new Date()
  const expira = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000)
  const premiumInicio = ahora.toISOString()
  const premiumExpira = expira.toISOString()

  await db.execute({
    sql: `UPDATE usuarios SET es_premium = 1, premium_inicio = ?, premium_expira = ?, mercadopago_payment_id = ? WHERE id = ?`,
    args: [premiumInicio, premiumExpira, paymentId, userId],
  })

  await db.execute({
    sql: `INSERT INTO pagos_premium (usuario_id, payment_id, status, monto, moneda, premium_inicio, premium_expira) VALUES (?, ?, 'approved', ?, ?, ?, ?)`,
    args: [userId, paymentId, monto, moneda, premiumInicio, premiumExpira],
  })

  console.log(`[Webhook MP] Premium activado para usuario ${userId} hasta ${premiumExpira}`)
}

async function procesarPagoMonedasDB(userId: number, paymentId: string, packId: string, monto: number, moneda: string) {
  const pack = COIN_PACKS[packId]
  if (!pack) {
    console.error(`[Webhook MP] Pack no encontrado: ${packId}`)
    return
  }

  // Registrar el pago
  await db.execute({
    sql: `INSERT INTO pagos_monedas (usuario_id, payment_id, status, monto, moneda, monedas_compradas, pack_id) VALUES (?, ?, 'approved', ?, ?, ?, ?)`,
    args: [userId, paymentId, monto, moneda, pack.monedas, packId],
  })

  // Agregar las monedas al usuario
  await db.execute({
    sql: 'UPDATE usuarios SET monedas = monedas + ? WHERE id = ?',
    args: [pack.monedas, userId],
  })

  // Obtener nuevo balance para el historial
  const balanceResult = await db.execute({
    sql: 'SELECT monedas FROM usuarios WHERE id = ?',
    args: [userId],
  })
  const nuevoBalance = (balanceResult.rows[0]?.monedas as number) || 0

  await db.execute({
    sql: 'INSERT INTO historial_monedas (usuario_id, cantidad, motivo, balance_despues) VALUES (?, ?, ?, ?)',
    args: [userId, pack.monedas, `compra:${packId}:${paymentId}`, nuevoBalance],
  })

  console.log(`[Webhook MP] Monedas agregadas: userId=${userId}, pack=${packId}, monedas=${pack.monedas}, balance=${nuevoBalance}`)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // MercadoPago envia notificaciones con type y data.id
    // Solo procesar notificaciones de tipo payment
    if (body.type !== 'payment' && body.action !== 'payment.created' && body.action !== 'payment.updated') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      console.log('[Webhook MP] Notificacion sin payment ID:', body)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Verificar el pago con la API de MercadoPago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      console.error('[Webhook MP] MERCADOPAGO_ACCESS_TOKEN no configurado')
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken })
    const payment = new Payment(client)

    const paymentInfo = await payment.get({ id: paymentId })

    if (!paymentInfo || paymentInfo.status !== 'approved') {
      console.log(`[Webhook MP] Pago ${paymentId} no aprobado: ${paymentInfo?.status}`)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const externalRef = paymentInfo.external_reference
    if (!externalRef) {
      console.log(`[Webhook MP] external_reference vacio`)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const monto = paymentInfo.transaction_amount || 0
    const moneda = paymentInfo.currency_id || 'UYU'
    const paymentIdStr = String(paymentId)

    // Procesar segun el tipo de pago
    if (externalRef.startsWith('premium_')) {
      // Pago de Premium Pass
      const userId = parseInt(externalRef.replace('premium_', ''), 10)
      if (isNaN(userId)) {
        console.log(`[Webhook MP] userId invalido en premium ref: ${externalRef}`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Verificar duplicado
      const existing = await db.execute({
        sql: 'SELECT id FROM pagos_premium WHERE payment_id = ?',
        args: [paymentIdStr],
      })
      if (existing.rows.length > 0) {
        console.log(`[Webhook MP] Pago premium ${paymentId} ya procesado`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      await activarPremiumDB(userId, paymentIdStr, monto, moneda)
      return NextResponse.json({ received: true, activated: true }, { status: 200 })

    } else if (externalRef.startsWith('monedas_')) {
      // Pago de Pack de Monedas (formato: "monedas_{packId}_{userId}")
      const parts = externalRef.split('_')
      // parts = ['monedas', 'pack', '{cantidad}', '{userId}']
      // externalRef example: "monedas_pack_500_123"
      const packId = `${parts[1]}_${parts[2]}` // "pack_500"
      const userId = parseInt(parts[3], 10)

      if (isNaN(userId) || !COIN_PACKS[packId]) {
        console.log(`[Webhook MP] Referencia monedas invalida: ${externalRef}`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Verificar duplicado
      const existing = await db.execute({
        sql: 'SELECT id FROM pagos_monedas WHERE payment_id = ?',
        args: [paymentIdStr],
      })
      if (existing.rows.length > 0) {
        console.log(`[Webhook MP] Pago monedas ${paymentId} ya procesado`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      await procesarPagoMonedasDB(userId, paymentIdStr, packId, monto, moneda)
      return NextResponse.json({ received: true, coins_added: true }, { status: 200 })

    } else {
      console.log(`[Webhook MP] external_reference no reconocido: ${externalRef}`)
      return NextResponse.json({ received: true }, { status: 200 })
    }
  } catch (error) {
    console.error('[Webhook MP] Error procesando webhook:', error)
    // Siempre retornar 200 para que MercadoPago no reintente indefinidamente
    return NextResponse.json({ received: true, error: 'internal' }, { status: 200 })
  }
}

// MercadoPago tambien puede enviar GET para verificar que el endpoint existe
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'mercadopago-webhook' })
}
