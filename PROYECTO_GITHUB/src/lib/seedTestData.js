/**
 * Generador de Dataset de Prueba para REPORTES y CIERRE DE CAJA.
 * 
 * USO: Ejecutar en la consola del navegador o importar temporalmente:
 *   import { injectarDatosPrueba } from './lib/seedTestData.js'
 *   injectarDatosPrueba()
 */

import { gsService } from './googleSheetsService'

const TASA_BCV = 48.21

function rand(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomHour() {
    const hour = randInt(8, 20)
    const minute = randInt(0, 59)
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

function productosAleatorios() {
    const items = [
        { id: 'p1', nombre: 'Harina PAN', precio_costo: 0.60, precio_usd: 1.20 },
        { id: 'p2', nombre: 'Arroz Mary', precio_costo: 0.50, precio_usd: 0.95 },
        { id: 'p3', nombre: 'Pasta La Campiña', precio_costo: 0.40, precio_usd: 0.75 },
        { id: 'p4', nombre: 'Aceite Girasol', precio_costo: 1.80, precio_usd: 3.20 },
        { id: 'p5', nombre: 'Azúcar Refinada', precio_costo: 0.55, precio_usd: 1.00 },
        { id: 'p6', nombre: 'Café Nacional', precio_costo: 2.00, precio_usd: 4.50 },
        { id: 'p7', nombre: 'Leche en Polvo', precio_costo: 1.50, precio_usd: 2.80 },
        { id: 'p8', nombre: 'Atún en Lata', precio_costo: 0.90, precio_usd: 1.60 },
    ]
    const count = randInt(1, 3)
    const shuffled = [...items].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, count)
    return selected.map(p => ({
        ...p,
        cantidad: randInt(1, 3),
        precio_costo: p.precio_costo,
        precio_usd: p.precio_usd
    }))
}

function calcularTotal(productos) {
    return productos.reduce((sum, p) => sum + p.precio_usd * p.cantidad, 0)
}

function generarVentas(count = 18) {
    const ventas = []
    const metodos = ['efectivo_usd', 'debito', 'pago_movil', 'bio_pago', 'transferencia']
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaHoy = hoy.toISOString().split('T')[0]

    for (let i = 0; i < count; i++) {
        const productos = productosAleatorios()
        const totalUsd = calcularTotal(productos)
        const costoUsd = totalUsd * (0.60 + Math.random() * 0.10)
        const totalBs = parseFloat((totalUsd * TASA_BCV).toFixed(2))

        const hora = randomHour()
        const fecha = `${fechaHoy}T${hora}`

        const venta = {
            id: crypto.randomUUID(),
            fecha,
            productos_json: productos,
            total_costo_usd: parseFloat(costoUsd.toFixed(2)),
            total_venta_usd: parseFloat(totalUsd.toFixed(2)),
            total_bs: totalBs,
            tasa_bcv: TASA_BCV,
            sesion_caja_id: ''
        }

        if (i < 3) {
            // Ventas con PAGO MIXTO (3 primeras)
            const partes = [
                { campo: 'pago_efectivo_usd', porc: rand(0.2, 0.6) },
                { campo: 'pago_pago_movil', porc: 0 }
            ]
            partes[1].porc = 1 - partes[0].porc
            partes.forEach(p => {
                venta[p.campo] = parseFloat((totalUsd * p.porc).toFixed(2))
            })
            venta.pago_efectivo_bs = 0
            venta.pago_debito = 0
            venta.pago_bio_pago = 0
            venta.pago_transferencia = 0
        } else if (i < 6) {
            // Ventas en EFECTIVO_BS (3 siguientes)
            venta.pago_efectivo_bs = totalBs
            venta.pago_efectivo_usd = 0
            venta.pago_debito = 0
            venta.pago_pago_movil = 0
            venta.pago_bio_pago = 0
            venta.pago_transferencia = 0
        } else {
            // Resto: método aleatorio
            const metodo = metodos[randInt(0, metodos.length - 1)]
            venta.pago_efectivo_usd = 0
            venta.pago_efectivo_bs = 0
            venta.pago_debito = 0
            venta.pago_pago_movil = 0
            venta.pago_bio_pago = 0
            venta.pago_transferencia = 0
            venta[`pago_${metodo}`] = parseFloat(totalUsd.toFixed(2))
        }

        ventas.push(venta)
    }

    return ventas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
}

export async function injectarDatosPrueba(count = 18) {
    console.log('🚀 Generando dataset de prueba...')
    const ventas = generarVentas(count)

    console.log(`📦 ${ventas.length} ventas generadas:`)
    ventas.forEach((v, i) => {
        const metodo = v.pago_efectivo_usd > 0 && v.pago_pago_movil > 0
            ? 'MIXTO'
            : v.pago_efectivo_bs > 0 ? 'EFECTIVO_BS'
            : v.pago_debito > 0 ? 'DEBITO'
            : v.pago_pago_movil > 0 ? 'PAGO_MOVIL'
            : v.pago_bio_pago > 0 ? 'BIO_PAGO'
            : 'TRANSFERENCIA'
        console.log(`  ${i + 1}. $${v.total_venta_usd.toFixed(2)} | ${metodo} | ${v.fecha.split('T')[1]}`)
    })

    const totalGeneral = ventas.reduce((s, v) => s + v.total_venta_usd, 0)
    const costoGeneral = ventas.reduce((s, v) => s + v.total_costo_usd, 0)
    const gananciaNeta = totalGeneral - costoGeneral
    console.log(`\n💰 TOTAL VENTAS: $${totalGeneral.toFixed(2)}`)
    console.log(`📉 COSTO TOTAL: $${costoGeneral.toFixed(2)}`)
    console.log(`📈 GANANCIA NETA: $${gananciaNeta.toFixed(2)}`)
    console.log(`📊 MARGEN: ${((gananciaNeta / totalGeneral) * 100).toFixed(1)}%`)

    console.log('\n⏳ Inyectando en Google Sheets...')
    let exitosas = 0
    let fallidas = 0

    for (const venta of ventas) {
        try {
            await gsService.saveSale(venta)
            exitosas++
        } catch (err) {
            fallidas++
            console.error(`❌ Error en venta ${venta.id}:`, err.message)
        }
    }

    console.log(`\n✅ ${exitosas} ventas inyectadas correctamente`)
    if (fallidas > 0) console.log(`⚠️ ${fallidas} ventas fallaron`)
    console.log('🔄 Refrescando datos locales...')
    await gsService.refresh()
    console.log('🎉 ¡Datos de prueba listos! Ve a REPORTES para ver el resultado.')

    return { exitosas, fallidas, ventas }
}

if (typeof window !== 'undefined') {
    window.injectarDatosPrueba = injectarDatosPrueba
    console.log('%c💉 injectarDatosPrueba() disponible en la consola', 'color: #00e676; font-size: 14px; font-weight: bold;')
    console.log('%cEscribe: injectarDatosPrueba(18)', 'color: #888; font-size: 12px;')
}
