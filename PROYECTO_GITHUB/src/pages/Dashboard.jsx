import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Package, Clock, RefreshCw, AlertTriangle, ShoppingBag, CreditCard, Smartphone, Wallet, ArrowLeftRight, CheckCircle2, Calendar, Layers, Percent } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsService } from '../lib/googleSheetsService'
import { useDatabase } from '../hooks/useDatabase'
import { useCaja } from '../context/CajaContext'
import StockAlertBanner from '../components/StockAlertBanner'
import { formatUSD, formatBS } from '../lib/financialUtils'
import { getEstadoVencimiento, EstadoVencimiento } from '../lib/vencimientoUtils'
import dayjs from 'dayjs'

const PERIODOS = [
    { id: 'hoy', label: 'HOY' },
    { id: 'semana', label: 'ÚLTIMOS 7 DÍAS' },
    { id: 'mes', label: 'ESTE MES' },
    { id: 'todos', label: 'HISTÓRICO' }
]

const PALETA_COLORES = [
    '#00e676', // Neon Green
    '#2196f3', // Blue
    '#9c27b0', // Purple
    '#ff9800', // Orange
    '#00bcd4', // Cyan
    '#e91e63', // Pink
    '#ffeb3b', // Yellow
    '#4caf50'  // Green
]

const parseResilientDate = (dateStr) => {
    if (!dateStr) return new Date(0)
    if (dateStr instanceof Date) return dateStr
    const timestamp = Date.parse(dateStr)
    if (!isNaN(timestamp)) return new Date(timestamp)

    const cleanStr = String(dateStr).trim()
    const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    const match = cleanStr.match(dmyRegex)
    if (match) {
        const [_, day, month, year, hours, minutes, seconds] = match
        return new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            hours ? parseInt(hours, 10) : 0,
            minutes ? parseInt(minutes, 10) : 0,
            seconds ? parseInt(seconds, 10) : 0
        )
    }
    return new Date(0)
}

const Dashboard = ({ setActivePage }) => {
    const { isReady, getVentas, getProductos, getCategorias, refresh } = useDatabase()
    const { sesionActiva, tasaBCV, isCajaAbierta } = useCaja()

    const [periodo, setPeriodo] = useState('hoy')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastSyncTime, setLastSyncTime] = useState(dayjs().format('HH:mm:ss'))

    // Datos crudos reactivos desde Google Sheets
    const [rawVentas, setRawVentas] = useState([])
    const [rawProductos, setRawProductos] = useState([])
    const [rawCategorias, setRawCategorias] = useState([])
    const [rawCuentasCobrar, setRawCuentasCobrar] = useState([])
    const [rawCuentasPagar, setRawCuentasPagar] = useState([])

    const tasaActual = useMemo(() => {
        const t = parseFloat(tasaBCV) || gsService.getTasaBcv() || 1
        return t > 0 ? t : 1
    }, [tasaBCV])

    const tasaEuro = useMemo(() => {
        return gsService.getTasaBcvEuro() || 0
    }, [])

    const cargarDatosLocales = useCallback(() => {
        try {
            const v = gsService.getVentas() || []
            const p = gsService.getTable('Productos') || []
            const c = gsService.getCategorias() || []
            const cxc = gsService.getCuentasCobrar() || []
            const cxp = gsService.getCuentasPagar() || []

            setRawVentas(Array.isArray(v) ? v : [])
            setRawProductos(Array.isArray(p) ? p : [])
            setRawCategorias(Array.isArray(c) ? c : [])
            setRawCuentasCobrar(Array.isArray(cxc) ? cxc : [])
            setRawCuentasPagar(Array.isArray(cxp) ? cxp : [])
            setLastSyncTime(dayjs().format('HH:mm:ss'))
        } catch (err) {
            console.error('[Dashboard] Error cargando datos:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isReady) {
            cargarDatosLocales()
        }
    }, [isReady, cargarDatosLocales])

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await gsService.refresh()
            cargarDatosLocales()
        } catch (err) {
            console.error('[Dashboard] Error en refresh:', err)
        } finally {
            setRefreshing(false)
        }
    }

    // =========================================================================
    // FILTRADO DE VENTAS POR PERÍODO
    // =========================================================================
    const ventasFiltradas = useMemo(() => {
        const hoy = dayjs().startOf('day')
        const hace7Dias = dayjs().subtract(7, 'day').startOf('day')
        const inicioMes = dayjs().startOf('month')

        return rawVentas.filter(v => {
            if (!v) return false
            const d = dayjs(parseResilientDate(v.fecha))
            if (!d.isValid() || d.year() < 2020) return false

            if (periodo === 'hoy') {
                return d.isSame(hoy, 'day')
            }
            if (periodo === 'semana') {
                return d.isAfter(hace7Dias) || d.isSame(hace7Dias, 'day')
            }
            if (periodo === 'mes') {
                return d.isAfter(inicioMes) || d.isSame(inicioMes, 'day')
            }
            return true // 'todos'
        })
    }, [rawVentas, periodo])

    // =========================================================================
    // KPIS PRINCIPALES
    // =========================================================================
    const metricas = useMemo(() => {
        let totalUSD = 0
        let totalCostoUSD = 0
        let totalBS = 0
        let totalUtilidadUSD = 0
        let totalProductosUnidades = 0

        const desglosePagos = {
            efectivo_usd: 0,
            efectivo_bs: 0,
            debito: 0,
            pago_movil: 0,
            bio_pago: 0,
            transferencia: 0
        }

        ventasFiltradas.forEach(v => {
            const montoUSD = Number(v.total_venta_usd ?? v.total_usd ?? 0)
            const costoUSD = Number(v.total_costo_usd ?? 0)
            const montoBS = Number(v.total_bs ?? (montoUSD * tasaActual))
            const utilidadUSD = Number(v.utilidad_neta_usd ?? (montoUSD - costoUSD))

            totalUSD += montoUSD
            totalCostoUSD += costoUSD
            totalBS += montoBS
            totalUtilidadUSD += utilidadUSD

            // Pagos
            desglosePagos.efectivo_usd += Number(v.pago_efectivo_usd || 0)
            desglosePagos.efectivo_bs += Number(v.pago_efectivo_bs || 0)
            desglosePagos.debito += Number(v.pago_debito || 0)
            desglosePagos.pago_movil += Number(v.pago_pago_movil || 0)
            desglosePagos.bio_pago += Number(v.pago_bio_pago || 0)
            desglosePagos.transferencia += Number(v.pago_transferencia || 0)

            // Conteo de unidades vendidas
            try {
                let prods = []
                if (Array.isArray(v.productos)) {
                    prods = v.productos
                } else if (v.productos_json) {
                    prods = JSON.parse(v.productos_json)
                }
                prods.forEach(p => {
                    totalProductosUnidades += Number(p.cantidad || 0)
                })
            } catch {}
        })

        const count = ventasFiltradas.length
        const ticketPromedio = count > 0 ? (totalUSD / count) : 0
        const margenPorcentaje = totalUSD > 0 ? ((totalUtilidadUSD / totalUSD) * 100) : 0

        return {
            totalUSD,
            totalBS,
            totalCostoUSD,
            totalUtilidadUSD,
            margenPorcentaje,
            totalProductosUnidades,
            transacciones: count,
            ticketPromedio,
            desglosePagos
        }
    }, [ventasFiltradas, tasaActual])

    // =========================================================================
    // FLUJO DE INGRESOS (GRÁFICO TEMPORAL)
    // =========================================================================
    const historyData = useMemo(() => {
        if (periodo === 'hoy') {
            const horasMap = {}
            for (let h = 7; h <= 21; h++) {
                horasMap[`${String(h).padStart(2, '0')}:00`] = 0
            }
            ventasFiltradas.forEach(v => {
                const d = dayjs(parseResilientDate(v.fecha))
                const hora = `${String(d.hour()).padStart(2, '0')}:00`
                const monto = Number(v.total_venta_usd ?? v.total_usd ?? 0)
                if (horasMap[hora] !== undefined) {
                    horasMap[hora] += monto
                } else {
                    horasMap[hora] = monto
                }
            })
            return Object.entries(horasMap).map(([name, ventes]) => ({
                name,
                ventes: Number(ventes.toFixed(2)),
                ventesBs: Number((ventes * tasaActual).toFixed(2))
            }))
        } else {
            // Agrupar por días
            const diasMap = {}
            ventasFiltradas.forEach(v => {
                const d = dayjs(parseResilientDate(v.fecha))
                const diaKey = d.format('DD/MM')
                const monto = Number(v.total_venta_usd ?? v.total_usd ?? 0)
                diasMap[diaKey] = (diasMap[diaKey] || 0) + monto
            })

            const entries = Object.entries(diasMap)
            if (entries.length === 0) {
                return [
                    { name: dayjs().subtract(2, 'day').format('DD/MM'), ventes: 0 },
                    { name: dayjs().subtract(1, 'day').format('DD/MM'), ventes: 0 },
                    { name: dayjs().format('DD/MM'), ventes: 0 }
                ]
            }
            return entries.map(([name, ventes]) => ({
                name,
                ventes: Number(ventes.toFixed(2)),
                ventesBs: Number((ventes * tasaActual).toFixed(2))
            }))
        }
    }, [ventasFiltradas, periodo, tasaActual])

    // =========================================================================
    // PRODUCTOS LÍDERES (TOP SELLER)
    // =========================================================================
    const topProducts = useMemo(() => {
        const prodMap = {}
        ventasFiltradas.forEach(v => {
            try {
                let prods = []
                if (Array.isArray(v.productos)) {
                    prods = v.productos
                } else if (v.productos_json) {
                    prods = JSON.parse(v.productos_json)
                }
                prods.forEach(p => {
                    const idKey = String(p.id || p.nombre)
                    if (!prodMap[idKey]) {
                        prodMap[idKey] = {
                            id: idKey,
                            name: String(p.nombre || 'Producto').toUpperCase(),
                            cantidad: 0,
                            recaudadoUSD: 0
                        }
                    }
                    const cant = Number(p.cantidad || 0)
                    const pu = Number(p.precio_usd || 0)
                    prodMap[idKey].cantidad += cant
                    prodMap[idKey].recaudadoUSD += (cant * pu)
                })
            } catch {}
        })

        const sorted = Object.values(prodMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)
        const colors = ['#00e676', '#2196f3', '#9c27b0', '#ff9800', '#00bcd4']
        return sorted.map((p, i) => ({
            ...p,
            color: colors[i] || '#fff',
            rank: i + 1
        }))
    }, [ventasFiltradas])

    // =========================================================================
    // COMPOSICIÓN DE VENTAS POR CATEGORÍA
    // =========================================================================
    const categorySales = useMemo(() => {
        const catMap = {}

        // Mapa de id producto a categoria
        const prodToCat = {}
        rawProductos.forEach(p => {
            const catNombre = String(p.categoria || p.categoria_nombre || 'GENERAL').trim().toUpperCase()
            prodToCat[String(p.id)] = catNombre
        })

        ventasFiltradas.forEach(v => {
            try {
                let prods = []
                if (Array.isArray(v.productos)) {
                    prods = v.productos
                } else if (v.productos_json) {
                    prods = JSON.parse(v.productos_json)
                }
                prods.forEach(p => {
                    const cat = prodToCat[String(p.id)] || String(p.categoria || 'GENERAL').trim().toUpperCase()
                    const monto = Number(p.cantidad || 1) * Number(p.precio_usd || 0)
                    catMap[cat] = (catMap[cat] || 0) + monto
                })
            } catch {}
        })

        const totalCatUSD = Object.values(catMap).reduce((s, v) => s + v, 0)
        const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1])

        if (entries.length === 0) {
            return [
                { name: 'SIN VENTAS', value: 100, color: 'rgba(255,255,255,0.1)', totalUSD: 0 }
            ]
        }

        return entries.map(([name, val], i) => ({
            name,
            value: totalCatUSD > 0 ? Number(((val / totalCatUSD) * 100).toFixed(1)) : 0,
            totalUSD: Number(val.toFixed(2)),
            color: PALETA_COLORES[i % PALETA_COLORES.length]
        }))
    }, [ventasFiltradas, rawProductos])

    // =========================================================================
    // ALERTAS DE CUENTAS POR COBRAR Y POR PAGAR (DATOS REALES)
    // =========================================================================
    const alertasFinancieras = useMemo(() => {
        let cobrCritico = 0
        let cobrProximo = 0
        let cobrTotal = 0

        rawCuentasCobrar.forEach(c => {
            const saldo = Number(c.saldo_pendiente_usd ?? (Number(c.monto_total_usd || 0) - Number(c.total_abonado_usd || 0)))
            if (saldo <= 0.01) return
            cobrTotal += saldo
            const venc = getEstadoVencimiento(c.fecha_vencimiento, saldo)
            if (venc.estado === EstadoVencimiento.CRITICO) cobrCritico++
            else if (venc.estado === EstadoVencimiento.PROXIMO) cobrProximo++
        })

        let pagCritico = 0
        let pagProximo = 0
        let pagTotal = 0

        rawCuentasPagar.forEach(c => {
            const saldo = Number(c.saldo_pendiente_usd ?? (Number(c.monto_total_usd || 0) - Number(c.total_abonado_usd || 0)))
            if (saldo <= 0.01) return
            pagTotal += saldo
            const venc = getEstadoVencimiento(c.fecha_vencimiento, saldo)
            if (venc.estado === EstadoVencimiento.CRITICO) pagCritico++
            else if (venc.estado === EstadoVencimiento.PROXIMO) pagProximo++
        })

        return {
            cobrCritico,
            cobrProximo,
            cobrTotal,
            pagCritico,
            pagProximo,
            pagTotal,
            tieneAlertas: (cobrCritico > 0 || cobrProximo > 0 || pagCritico > 0 || pagProximo > 0)
        }
    }, [rawCuentasCobrar, rawCuentasPagar])

    return (
        <div className="s-scroll" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '0.5rem', overflowY: 'auto' }}>
            <StockAlertBanner onNavigateInventory={() => setActivePage?.('inventory')} />

            {/* BANNER DE ALERTAS FINANCIERAS (REALES DESDE GOOGLE SHEETS) */}
            {alertasFinancieras.tieneAlertas ? (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '1rem 1.5rem',
                        borderRadius: 'var(--r-standard)',
                        background: 'rgba(255,49,49,0.08)',
                        border: '1px solid rgba(255,49,49,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <AlertTriangle size={22} style={{ color: '#ff3131', flexShrink: 0 }} />
                        {alertasFinancieras.cobrCritico > 0 && (
                            <button
                                onClick={() => setActivePage?.('cuentas-por-cobrar')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}
                            >
                                <span style={{ fontSize: '0.85rem', color: '#ff3131', fontWeight: 900 }}>
                                    {alertasFinancieras.cobrCritico} CXC CRÍTICAS
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)' }}>
                                    (${formatUSD(alertasFinancieras.cobrTotal)})
                                </span>
                            </button>
                        )}
                        {alertasFinancieras.pagCritico > 0 && (
                            <button
                                onClick={() => setActivePage?.('cuentas-por-pagar')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}
                            >
                                <span style={{ fontSize: '0.85rem', color: '#ff9800', fontWeight: 900 }}>
                                    {alertasFinancieras.pagCritico} CXP A PROVEEDORES POR VENCER
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)' }}>
                                    (${formatUSD(alertasFinancieras.pagTotal)})
                                </span>
                            </button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)', fontWeight: 700 }}>
                        Click para resolver en Tesorería
                    </span>
                </motion.div>
            ) : (
                <div style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(0,230,118,0.04)',
                    border: '1px solid rgba(0,230,118,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--s-neon)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--s-neon)', fontWeight: 800 }}>
                        TESORERÍA AL DÍA • 0 Cuentas por cobrar o pagar vencidas en la base de datos
                    </span>
                </div>
            )}

            {/* HEADER DE ESTADÍSTICAS */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#fff', margin: 0 }}>CENTRO DE ANÁLISIS & ESTADÍSTICAS</h2>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--s-neon)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.25rem 0 0 0' }}>
                        Google Sheets en Vivo • Sincronización Automática
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* SELECTOR DE PERÍODO */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--s-glass-border)', borderRadius: '10px', padding: '3px' }}>
                        {PERIODOS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriodo(p.id)}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: periodo === p.id ? 'var(--s-neon)' : 'transparent',
                                    color: periodo === p.id ? '#000' : 'var(--s-text-dim)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {sesionActiva && (
                        <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '8px', padding: '0.45rem 0.8rem', fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-neon)' }}>
                            CAJA ACTIVA
                        </div>
                    )}

                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="s-btn s-btn-secondary"
                        style={{ height: '2.5rem', padding: '0 1rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        title="Actualizar datos desde Google Sheets"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'SINCRONIZANDO...' : 'ACTUALIZAR'}
                    </button>

                    <div className="s-panel" style={{ padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: 900, color: 'var(--s-neon)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={14} /> {lastSyncTime}
                    </div>
                </div>
            </header>

            {/* KPIS PRINCIPALES (DATOS 100% REALES) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--gap-2)' }}>
                {/* 1. VENTAS TOTALES */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="s-panel" style={{ padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'rgba(0,230,118,0.1)', border: '1px solid var(--s-neon)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--s-neon)', flexShrink: 0 }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase' }}>
                            Ventas ({periodo.toUpperCase()})
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.7rem', fontWeight: 1000, color: '#fff', margin: 0 }}>
                                ${formatUSD(metricas.totalUSD)}
                            </h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--s-neon)' }}>
                                Bs {formatBS(metricas.totalBS)}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* 2. TICKET PROMEDIO */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="s-panel" style={{ padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'rgba(33,150,243,0.1)', border: '1px solid #2196f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2196f3', flexShrink: 0 }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase' }}>
                            Ticket Promedio
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.7rem', fontWeight: 1000, color: '#fff', margin: 0 }}>
                                ${formatUSD(metricas.ticketPromedio)}
                            </h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2196f3' }}>
                                Bs {formatBS(metricas.ticketPromedio * tasaActual)}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* 3. TRANSACCIONES REALIZADAS */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="s-panel" style={{ padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'rgba(156,39,176,0.1)', border: '1px solid #9c27b0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9c27b0', flexShrink: 0 }}>
                        <Package size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase' }}>
                            Transacciones
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.7rem', fontWeight: 1000, color: '#fff', margin: 0 }}>
                                {metricas.transacciones}
                            </h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9c27b0' }}>
                                {metricas.totalProductosUnidades} unds. despachadas
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* 4. UTILIDAD NETA / MARGEN */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="s-panel" style={{ padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '12px', background: 'rgba(255,152,0,0.1)', border: '1px solid #ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9800', flexShrink: 0 }}>
                        <Percent size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase' }}>
                            Utilidad Estimada
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.7rem', fontWeight: 1000, color: '#fff', margin: 0 }}>
                                ${formatUSD(metricas.totalUtilidadUSD)}
                            </h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff9800' }}>
                                Margen: {metricas.margenPorcentaje.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* GRÁFICOS Y TABLEROS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--gap-2)', flex: 1, minHeight: '380px' }}>
                {/* 1. GRÁFICO DE FLUJO DE INGRESOS */}
                <div className="s-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', margin: 0 }}>FLUJO DE INGRESOS REALES</h3>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-text-dim)', textTransform: 'uppercase' }}>
                                {periodo === 'hoy' ? 'Movimiento por Hora (Hoy)' : `Comportamiento de Ventas (${periodo.toUpperCase()})`}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.7rem', fontWeight: 900, color: 'var(--s-neon)', background: 'rgba(0,230,118,0.1)', padding: '0.3rem 0.7rem', borderRadius: '6px' }}>
                            <span>TASA BCV: Bs {formatBS(tasaActual)}</span>
                        </div>
                    </div>

                    <div style={{ flex: 1, minHeight: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--s-neon)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--s-neon)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} dy={10} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ background: '#121726', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                                    formatter={(value) => [`$ ${formatUSD(value)} (Bs ${formatBS(value * tasaActual)})`, 'Ingresos']}
                                    labelStyle={{ color: '#fff', fontWeight: 900, marginBottom: '0.25rem' }}
                                />
                                <Area type="monotone" dataKey="ventes" stroke="var(--s-neon)" strokeWidth={3} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. COMPOSICIÓN POR CATEGORÍA & TOP SELLERS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-2)' }}>
                    {/* COMPOSICIÓN DE CATEGORÍAS */}
                    <div className="s-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase', margin: 0 }}>
                                COMPOSICIÓN POR CATEGORÍA
                            </h3>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-neon)' }}>
                                {categorySales.length} Categorías
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ height: '140px', width: '140px', flexShrink: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value" stroke="none">
                                            {categorySales.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: '#121726', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            formatter={(value, name, item) => [`${value}% ($${formatUSD(item.payload.totalUSD)})`, item.payload.name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                                {categorySales.slice(0, 4).map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                                            <span style={{ color: '#fff', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {c.name}
                                            </span>
                                        </div>
                                        <span style={{ color: 'var(--s-text-dim)', fontWeight: 900, flexShrink: 0 }}>
                                            {c.value}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* PRODUCTOS LÍDERES */}
                    <div className="s-panel" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--s-text-dim)', textTransform: 'uppercase', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
                            PRODUCTOS LÍDERES (TOP VENTAS)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
                            {topProducts.map(p => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                        <div style={{ width: '1.8rem', height: '1.8rem', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0 }}>
                                            #{p.rank}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {p.name}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>
                                                {p.cantidad} unidades vendidas
                                            </span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 1000, color: 'var(--s-neon)', flexShrink: 0 }}>
                                        ${formatUSD(p.recaudadoUSD)}
                                    </span>
                                </div>
                            ))}

                            {topProducts.length === 0 && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                                    <Package size={30} strokeWidth={1} />
                                    <span style={{ color: 'var(--s-text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                        Sin ventas registradas en este período
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* DESGLOSE DE MÉTODOS DE PAGO DEL PERÍODO */}
            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Wallet size={16} style={{ color: 'var(--s-neon)' }} />
                        DESGLOSE DE MEDIOS DE PAGO RECIBIDOS ({periodo.toUpperCase()})
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--s-text-dim)', fontWeight: 700 }}>
                        Registro directo de Terminal y Caja
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-neon)', display: 'block' }}>EFECTIVO USD</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>${formatUSD(metricas.desglosePagos.efectivo_usd)}</span>
                    </div>

                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.2)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#2196f3', display: 'block' }}>EFECTIVO BS</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>Bs {formatBS(metricas.desglosePagos.efectivo_bs)}</span>
                    </div>

                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(156,39,176,0.06)', border: '1px solid rgba(156,39,176,0.2)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9c27b0', display: 'block' }}>PUNTO DE VENTA (DÉBITO)</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>Bs {formatBS(metricas.desglosePagos.debito)}</span>
                    </div>

                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(255,152,0,0.06)', border: '1px solid rgba(255,152,0,0.2)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ff9800', display: 'block' }}>PAGO MÓVIL</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>Bs {formatBS(metricas.desglosePagos.pago_movil)}</span>
                    </div>

                    <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.2)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00bcd4', display: 'block' }}>BIOPAGO / TRANSF.</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>Bs {formatBS(metricas.desglosePagos.bio_pago + metricas.desglosePagos.transferencia)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
