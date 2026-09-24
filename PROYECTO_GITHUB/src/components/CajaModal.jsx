import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Lock, Unlock, DollarSign, TrendingUp, BarChart2, AlertCircle, CreditCard, Smartphone, QrCode, ArrowLeftRight, Printer, FileText, CheckCircle2, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { gsService } from '../lib/googleSheetsService'
import { useCaja } from '../context/CajaContext'
import { useAuth } from '../context/AuthContext'
import UserAvatar from './UserAvatar'
import CurrencyInput from './CurrencyInput'
import BsInput from './BsInput'
import { formatUSD, formatBS, parseUSDNumber, parseVENumber } from '../lib/financialUtils'
import { imprimirReporteX, imprimirReporteZ } from '../lib/ticketPrinter'
import dayjs from 'dayjs'

const METODOS_SISTEMA = [
    { id: 'debito', label: 'MONTO CIERRE (DÉBITO)', icon: CreditCard, color: '#2196f3' },
    { id: 'pago_movil', label: 'MONTO CIERRE (PAGO MÓVIL)', icon: Smartphone, color: '#ff9800' },
    { id: 'bio_pago', label: 'MONTO CIERRE (BIO PAGO)', icon: QrCode, color: '#9c27b0' },
    { id: 'transferencia', label: 'MONTO CIERRE (TRANSFERENCIAS)', icon: ArrowLeftRight, color: '#00bcd4' }
]

const CajaModal = ({ type, onClose, onSessionUpdate }) => {
    const { setTasaBCV } = useCaja()
    const { user, usuarios } = useAuth()
    const [fondoCashUSD, setFondoCashUSD] = useState('')
    const [fondoCashBS, setFondoCashBS] = useState('')
    const [tasaBcv, setTasaBcv] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [showPrintReport, setShowPrintReport] = useState(false)
    const cierreRef = useRef(null)

    const isAbrir = type === 'abrir'

    useEffect(() => {
        if (isAbrir) {
            const tasaCache = gsService.getTasaBcv() || gsService.tasaBcv
            if (tasaCache > 0) {
                setTasaBcv(Number(tasaCache).toFixed(2))
            } else {
                gsService.fetchAndUpdateTasaBcv().then(result => {
                    if (result?.success && result.data?.tasa_bcv > 0) {
                        setTasaBcv(Number(result.data.tasa_bcv).toFixed(2))
                    }
                }).catch(() => {})
            }
        }
    }, [isAbrir])

    const generateSesionId = () => {
        const datePart = dayjs().format('YYYYMMDD')
        const randPart = Math.random().toString(36).substring(2, 7).toUpperCase()
        return `CAJA-${datePart}-${randPart}`
    }

    const sesiones = gsService.getTable('Caja') || []
    const sesionActiva = sesiones.find(s => s.estado === 'ACTIVA')
    const ventas = (gsService.getTable('Ventas') || []).filter(v => v.sesion_caja_id === sesionActiva?.id)

    const totalVentas = ventas.reduce((sum, v) => sum + (Number(v.total_venta_usd) || 0), 0)
    const totalVentasBS = ventas.reduce((sum, v) => sum + (Number(v.total_bs) || 0), 0)
    const totalExentoUSD = ventas.reduce((sum, v) => sum + (Number(v.base_exenta_usd) || 0), 0)
    const totalBaseUSD = ventas.reduce((sum, v) => sum + (Number(v.base_imponible_usd) || 0), 0)
    const totalIvaUSD = ventas.reduce((sum, v) => sum + (Number(v.iva_usd) || 0), 0)
    const totalBaseIgtfUSD = ventas.reduce((sum, v) => sum + (Number(v.base_igtf_usd) || 0), 0)
    const totalIgtfUSD = ventas.reduce((sum, v) => sum + (Number(v.igtf_usd) || 0), 0)

    const totalEfectivoUSD = ventas.reduce((sum, v) => sum + (Number(v.pago_efectivo_usd) || 0), 0)
    const totalEfectivoBS = ventas.reduce((sum, v) => sum + (Number(v.pago_efectivo_bs) || 0), 0)

    const totalItemsVendidos = ventas.reduce((sum, v) => {
        try {
            const prods = typeof v.productos_json === 'string' ? JSON.parse(v.productos_json) : v.productos_json
            return sum + (prods || []).reduce((s, p) => s + (Number(p.cantidad) || 0), 0)
        } catch { return sum }
    }, 0)

    const totalsSistema = ventas.reduce((acc, v) => {
        acc.debito += Number(v.pago_debito) || 0
        acc.pago_movil += Number(v.pago_pago_movil) || 0
        acc.bio_pago += Number(v.pago_bio_pago) || 0
        acc.transferencia += Number(v.pago_transferencia) || 0
        return acc
    }, { debito: 0, pago_movil: 0, bio_pago: 0, transferencia: 0 })

    const sortedVentas = useMemo(() => {
        return [...ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    }, [ventas])

    const facturaInicialActual = sortedVentas[0]?.numero_factura || (sortedVentas[0]?.id ? sortedVentas[0].id.slice(0, 8).toUpperCase() : '00000001')
    const facturaFinalActual = sortedVentas[sortedVentas.length - 1]?.numero_factura || (sortedVentas[sortedVentas.length - 1]?.id ? sortedVentas[sortedVentas.length - 1].id.slice(0, 8).toUpperCase() : facturaInicialActual)

    // Identificar qué cajero abrió la caja
    const cajeroApertura = useMemo(() => {
        if (!sesionActiva) return null

        if (sesionActiva.usuario_id && usuarios?.length) {
            const found = usuarios.find(u => String(u.id) === String(sesionActiva.usuario_id))
            if (found) return found
        }

        if (sesionActiva.usuario_nombre && usuarios?.length) {
            const needle = String(sesionActiva.usuario_nombre).toLowerCase().trim()
            const found = usuarios.find(u => 
                (u.nombre_completo && u.nombre_completo.toLowerCase().trim() === needle) ||
                (u.nombre_vendedor && u.nombre_vendedor.toLowerCase().trim() === needle) ||
                (u.username && u.username.toLowerCase().trim() === needle)
            )
            if (found) return found
        }

        if (sesionActiva.usuario_nombre || sesionActiva.usuario_foto) {
            return {
                id: sesionActiva.usuario_id || '',
                nombre_completo: sesionActiva.usuario_nombre || 'Cajero',
                foto_url: sesionActiva.usuario_foto || '',
                cargo: sesionActiva.usuario_cargo || 'Cajero',
                rol: sesionActiva.usuario_rol || 'cajero'
            }
        }

        return user || {
            nombre_completo: 'Edson Designer',
            foto_url: 'https://drive.google.com/thumbnail?id=1JLaEUIVJxwpE4q3D980RW41fYGzHTwJR&sz=w400',
            cargo: 'Administrador Master',
            rol: 'admin_master'
        }
    }, [sesionActiva, usuarios, user])

    const handleEmitirReporteX = () => {
        if (!sesionActiva) return
        imprimirReporteX({
            sesionId: sesionActiva.id,
            cajero: sesionActiva.usuario_nombre || sesionActiva.usuario_apertura || cajeroApertura?.nombre_completo || user?.nombre_completo || 'ADMINISTRADOR',
            fechaApertura: sesionActiva.fecha_apertura,
            tasaBCV: sesionActiva.tasa_bcv_apertura || gsService.getTasaBcv() || 1,
            totalVentasUSD: totalVentas,
            totalVentasBS: totalVentasBS,
            baseExentaUSD: totalExentoUSD,
            baseImponibleUSD: totalBaseUSD,
            ivaUSD: totalIvaUSD,
            baseIgtfUSD: totalBaseIgtfUSD,
            igtfUSD: totalIgtfUSD,
            cantTransacciones: ventas.length,
            facturaInicial: facturaInicialActual,
            facturaFinal: facturaFinalActual,
            desglosePagos: {
                ...totalsSistema,
                efectivo_usd: totalEfectivoUSD,
                efectivo_bs: totalEfectivoBS
            }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const numUSD = parseUSDNumber(fondoCashUSD)
        const numBS = parseVENumber(fondoCashBS)
        const numTasa = parseUSDNumber(tasaBcv)

        if (isAbrir && (isNaN(numTasa) || numTasa <= 0)) {
            setError('LA TASA BCV ES REQUERIDA')
            setLoading(false)
            return
        }

        try {
            if (isAbrir) {
                const sesionId = generateSesionId()
                const sesionObj = {
                    id: sesionId,
                    fecha_apertura: new Date().toISOString(),
                    apertura_usd: numUSD,
                    apertura_bs: numBS,
                    tasa_bcv_apertura: numTasa,
                    estado: 'ACTIVA',
                    usuario_id: user?.id || '',
                    usuario_nombre: user?.nombre_completo || user?.nombre_vendedor || user?.username || 'Edson Designer',
                    usuario_foto: user?.foto_url || '',
                    usuario_cargo: user?.cargo || (user?.rol === 'admin_master' ? 'Administrador Master' : 'Cajero'),
                    usuario_rol: user?.rol || 'admin_master'
                }
                
                // Actualizar inmediatamente contexto y UI
                setTasaBCV(numTasa)
                onSessionUpdate(sesionObj)
                onClose()

                await gsService.abrirSesionCaja(sesionObj)
            } else {
                const activa = sesiones.find(s => s.estado === 'ACTIVA')
                if (activa) {
                    const montoCierreUSD = (Number(activa.apertura_usd) || 0) + totalVentas
                    const montoCierreBS = (Number(activa.apertura_bs) || 0) + totalVentasBS

                    // Consecutivo Reporte Z
                    const closedSesiones = sesiones.filter(s => s.numero_reporte_z)
                    const nextZNum = (closedSesiones.length + 1).toString().padStart(4, '0')
                    const numeroReporteZ = `Z-${nextZNum}`

                    const totalExentoBS = ventas.reduce((s, v) => s + (Number(v.base_exenta_bs) || (Number(v.base_exenta_usd) * Number(v.tasa_bcv)) || 0), 0)
                    const totalBaseBS = ventas.reduce((s, v) => s + (Number(v.base_imponible_bs) || (Number(v.base_imponible_usd) * Number(v.tasa_bcv)) || 0), 0)
                    const totalIvaBS = ventas.reduce((s, v) => s + (Number(v.iva_bs) || (Number(v.iva_usd) * Number(v.tasa_bcv)) || 0), 0)
                    const totalIgtfBS = ventas.reduce((s, v) => s + (Number(v.igtf_bs) || (Number(v.igtf_usd) * Number(v.tasa_bcv)) || 0), 0)

                    cierreRef.current = {
                        sesion: activa,
                        numeroReporteZ,
                        ventasCount: ventas.length,
                        totalVentasUSD: totalVentas,
                        totalVentasBS: totalVentasBS,
                        totalItemsVendidos,
                        baseExentaUSD: totalExentoUSD,
                        baseImponibleUSD: totalBaseUSD,
                        ivaUSD: totalIvaUSD,
                        baseIgtfUSD: totalBaseIgtfUSD,
                        igtfUSD: totalIgtfUSD,
                        facturaInicial: facturaInicialActual,
                        facturaFinal: facturaFinalActual,
                        totalsSistema: { ...totalsSistema, efectivo_usd: totalEfectivoUSD, efectivo_bs: totalEfectivoBS },
                        cierreUSD: montoCierreUSD,
                        cierreBS: montoCierreBS,
                        observaciones
                    }

                    const cierreData = {
                        id: activa.id,
                        fecha_cierre: new Date().toISOString(),
                        cierre_usd: montoCierreUSD,
                        cierre_bs: montoCierreBS,
                        cierre_debito: totalsSistema.debito,
                        cierre_pago_movil: totalsSistema.pago_movil,
                        cierre_bio_pago: totalsSistema.bio_pago,
                        cierre_transferencia: totalsSistema.transferencia,
                        numero_reporte_z: numeroReporteZ,
                        factura_inicial: facturaInicialActual,
                        factura_final: facturaFinalActual,
                        total_exento_bs: totalExentoBS,
                        total_base_bs: totalBaseBS,
                        total_iva_bs: totalIvaBS,
                        total_igtf_bs: totalIgtfBS,
                        observaciones: observaciones,
                        usuario_cierre_id: user?.id || '',
                        usuario_cierre_nombre: user?.nombre_completo || user?.nombre_vendedor || user?.username || 'Usuario',
                        usuario_cierre_foto: user?.foto_url || ''
                    }

                    // 1. Limpiar sesión en almacenamiento local inmediatamente
                    try {
                        localStorage.removeItem('mme_sesion_caja_id')
                    } catch (e) {}

                    // 2. Actualizar estado de inmediato a cerrada para que la app se actualice sin demora
                    onSessionUpdate(null)

                    // 3. Persistir en base de datos en segundo plano sin bloquear la UI
                    gsService.cerrarSesionCaja(cierreData).catch(err => {
                        console.error('[CajaModal] Error guardando cierre en background:', err)
                    })

                    // 4. Mostrar pantalla de Reporte Z con controles inmediatos
                    setShowPrintReport(true)

                    // 5. Emitir automáticamente el Reporte Z físico en ventana de impresión
                    try {
                        imprimirReporteZ({
                            numeroReporteZ,
                            sesionId: activa.id,
                            cajero: activa.usuario_nombre || activa.usuario_apertura || cajeroApertura?.nombre_completo || user?.nombre_completo || 'ADMINISTRADOR',
                            fechaApertura: activa.fecha_apertura,
                            fechaCierre: cierreData.fecha_cierre,
                            tasaBCV: activa.tasa_bcv_apertura || gsService.getTasaBcv() || 1,
                            totalVentasUSD: totalVentas,
                            totalVentasBS: totalVentasBS,
                            baseExentaUSD: totalExentoUSD,
                            baseImponibleUSD: totalBaseUSD,
                            ivaUSD: totalIvaUSD,
                            baseIgtfUSD: totalBaseIgtfUSD,
                            igtfUSD: totalIgtfUSD,
                            cantTransacciones: ventas.length,
                            facturaInicial: facturaInicialActual,
                            facturaFinal: facturaFinalActual,
                            desglosePagos: { ...totalsSistema, efectivo_usd: totalEfectivoUSD, efectivo_bs: totalEfectivoBS },
                            montoInicialUSD: Number(activa.apertura_usd) || 0,
                            montoInicialBS: Number(activa.apertura_bs) || 0,
                            montoFinalRealUSD: montoCierreUSD,
                            montoFinalRealBS: montoCierreBS,
                            diferenciaUSD: 0,
                            diferenciaBS: 0
                        })
                    } catch (errPrint) {
                        console.warn('[CajaModal] Error al imprimir Reporte Z:', errPrint)
                    }

                    return
                }
                try {
                    localStorage.removeItem('mme_sesion_caja_id')
                } catch (e) {}
                onSessionUpdate(null)
                setShowPrintReport(true)
                return
            }
        } catch (err) {
            console.error('[CajaModal] Error al procesar caja:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        if (!cierreRef.current) return
        imprimirReporteZ({
            numeroReporteZ: cierreRef.current.numeroReporteZ || 'Z-0001',
            sesionId: cierreRef.current.sesion.id,
            cajero: cierreRef.current.sesion.usuario_apertura || 'ADMINISTRADOR',
            fechaApertura: cierreRef.current.sesion.fecha_apertura,
            fechaCierre: new Date().toISOString(),
            tasaBCV: cierreRef.current.sesion.tasa_bcv_apertura || gsService.getTasaBcv() || 1,
            totalVentasUSD: cierreRef.current.totalVentasUSD,
            totalVentasBS: cierreRef.current.totalVentasBS,
            baseExentaUSD: cierreRef.current.baseExentaUSD,
            baseImponibleUSD: cierreRef.current.baseImponibleUSD,
            ivaUSD: cierreRef.current.ivaUSD,
            baseIgtfUSD: cierreRef.current.baseIgtfUSD,
            igtfUSD: cierreRef.current.igtfUSD,
            cantTransacciones: cierreRef.current.ventasCount,
            facturaInicial: cierreRef.current.facturaInicial,
            facturaFinal: cierreRef.current.facturaFinal,
            desglosePagos: cierreRef.current.totalsSistema,
            montoInicialUSD: Number(cierreRef.current.sesion.apertura_usd) || 0,
            montoInicialBS: Number(cierreRef.current.sesion.apertura_bs) || 0,
            montoFinalRealUSD: cierreRef.current.cierreUSD,
            montoFinalRealBS: cierreRef.current.cierreBS,
            diferenciaUSD: 0,
            diferenciaBS: 0
        })
    }

    const handleCloseReport = () => {
        setShowPrintReport(false)
        onClose()
    }

    // Permitir cerrar el reporte Z y volver a la app con tecla Escape
    useEffect(() => {
        if (!showPrintReport) return
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCloseReport()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showPrintReport])

    const accentColor = isAbrir ? 'var(--s-neon)' : '#ff5252'

    return (
        <div className="s-overlay" style={{ zIndex: 9999, padding: '1rem', overflowY: 'auto' }}>
            <motion.div className="s-overlay__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="s-modal s-modal--crystal"
                style={{
                    width: '35rem',
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 2.5rem)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    margin: 'auto',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 25px rgba(0,0,0,0.5)'
                }}
            >
                <div className="s-modal__header" style={{ flexShrink: 0, padding: '1.25rem 1.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '10px', background: isAbrir ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)', border: `1px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                            {isAbrir ? <Unlock size={20} /> : <Lock size={20} />}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff' }}>{isAbrir ? 'APERTURA DE CAJA' : 'CIERRE DE CAJA (REPORTE Z)'}</h2>
                            <p style={{ fontSize: '0.6rem', fontWeight: 800, color: accentColor }}>{isAbrir ? 'INICIO DE JORNADA' : `SESIÓN: ${sesionActiva?.id?.slice(0, 15) || '—'}`}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="s-btn s-btn-secondary s-btn-icon"><X size={20} /></button>
                </div>

                <div 
                    className="s-modal__body s-scroll" 
                    style={{ 
                        gap: '1.2rem', 
                        flex: 1, 
                        minHeight: 0, 
                        overflowY: 'auto', 
                        padding: '1.5rem 1.75rem',
                        scrollbarWidth: 'thin'
                    }}
                >
                    {!isAbrir && sesionActiva && (
                        <>
                            {/* Tarjetas Superiores */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.6rem' }}>
                                {[
                                    { icon: TrendingUp, label: 'VENTAS USD', value: `$${formatUSD(totalVentas)}`, color: 'var(--s-neon)' },
                                    { icon: BarChart2, label: 'TRANSACCIONES', value: ventas.length, color: '#2196f3' },
                                    { icon: DollarSign, label: 'APERTURA USD', value: `$${formatUSD(sesionActiva.apertura_usd)}`, color: '#00e676' },
                                    { icon: DollarSign, label: 'APERTURA BS', value: `Bs ${formatBS(sesionActiva.apertura_bs)}`, color: '#2196f3' }
                                ].map(({ icon: Icon, label, value, color }) => (
                                    <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.4rem', textAlign: 'center' }}>
                                        <Icon size={16} style={{ color, margin: '0 auto 0.3rem' }} />
                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>{value}</div>
                                        <div style={{ fontSize: '0.52rem', color: 'var(--s-text-dim)', fontWeight: 800 }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Botón de Emisión Reporte X (Corte Parcial en Cualquier Momento) */}
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button
                                    type="button"
                                    onClick={handleEmitirReporteX}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        background: 'rgba(56, 189, 248, 0.1)',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        color: '#38bdf8',
                                        fontSize: '0.75rem',
                                        fontWeight: 900,
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        cursor: 'pointer'
                                    }}
                                    title="Imprimir corte parcial de caja sin cerrar la jornada"
                                >
                                    <Printer size={16} />
                                    EMITIR REPORTE X (CORTE PARCIAL)
                                </button>
                            </div>
                        </>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {isAbrir ? (
                            <>
                                {/* Tarjeta Informativa del Cajero que abre */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.85rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    background: 'rgba(0, 230, 118, 0.06)',
                                    border: '1px solid rgba(0, 230, 118, 0.25)',
                                    marginBottom: '0.25rem'
                                }}>
                                    <UserAvatar
                                        src={user?.foto_url}
                                        name={user?.nombre_completo || user?.username || 'Usuario'}
                                        role={user?.rol || 'admin_master'}
                                        size={44}
                                        showOnlineDot
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--s-neon)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            Cajero Responsable de Apertura
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {user?.nombre_completo || user?.nombre_vendedor || user?.username || 'Edson Designer'}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#aaa', fontWeight: 600 }}>
                                            {user?.cargo || (user?.rol === 'admin_master' ? 'Administrador Master' : 'Cajero Autorizado')}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="s-section-label" style={{ color: '#00e676' }}>MONTO INICIAL EFECTIVO (USD)</label>
                                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                        <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#00e676', fontWeight: 900, fontSize: '1.4rem' }}>$</div>
                                        <CurrencyInput currency="USD" autoFocus name="fondo_usd" id="caja-fondo-usd" value={fondoCashUSD} onChange={v => setFondoCashUSD(String(v))} placeholder="0.00" color="#00e676" style={{ paddingLeft: '3rem', fontSize: '1.8rem', height: '5rem', fontWeight: 900, textAlign: 'center', borderColor: '#00e676' }} />
                                    </div>
                                </div>

                                <div>
                                    <label className="s-section-label" style={{ color: '#2196f3' }}>MONTO INICIAL EFECTIVO (BS)</label>
                                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                        <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#2196f3', fontWeight: 900, fontSize: '1.4rem' }}>Bs</div>
                                        <BsInput id="caja-fondo-bs" name="fondo_bs" value={fondoCashBS} onChange={v => setFondoCashBS(String(v))} placeholder="0,00" color="#2196f3" style={{ fontSize: '1.8rem', height: '5rem', paddingLeft: '3rem' }} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Tarjeta Informativa de Quién abrió la caja */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.85rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    marginBottom: '0.25rem'
                                }}>
                                    <UserAvatar
                                        src={cajeroApertura?.foto_url}
                                        name={cajeroApertura?.nombre_completo || sesionActiva?.usuario_nombre || 'Cajero'}
                                        role={cajeroApertura?.rol || sesionActiva?.usuario_cargo || 'cajero'}
                                        size={40}
                                        showOnlineDot
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            Caja Abierta Por
                                        </div>
                                        <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cajeroApertura?.nombre_completo || sesionActiva?.usuario_nombre || user?.nombre_completo || 'Edson Designer'}
                                        </div>
                                        <div style={{ fontSize: '0.66rem', color: '#888' }}>
                                            Apertura: {dayjs(sesionActiva?.fecha_apertura).format('DD/MM/YYYY hh:mm A')}
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen Fiscal SENIAT */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.85rem' }}>
                                    <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.12em', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>RESUMEN TRIBUTARIO FISCAL SENIAT</span>
                                        <span>FACTURAS: #{facturaInicialActual} AL #{facturaFinalActual}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem' }}>
                                        <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>EXENTO (E):</span>
                                            <span style={{ fontWeight: 800, color: '#00e676' }}>${formatUSD(totalExentoUSD)}</span>
                                        </div>
                                        <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>BASE (G 16%):</span>
                                            <span style={{ fontWeight: 800, color: '#fff' }}>${formatUSD(totalBaseUSD)}</span>
                                        </div>
                                        <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>IVA (16%):</span>
                                            <span style={{ fontWeight: 800, color: '#2196f3' }}>${formatUSD(totalIvaUSD)}</span>
                                        </div>
                                        <div style={{ padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>IGTF (3%):</span>
                                            <span style={{ fontWeight: 800, color: '#ffb300' }}>${formatUSD(totalIgtfUSD)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem' }}>
                                    <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#666', letterSpacing: '0.15em', marginBottom: '0.75rem' }}>TOTALES DEL SISTEMA (SOLO LECTURA)</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(0,230,118,0.15)' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888' }}>APERTURA USD</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00e676', fontFamily: 'monospace' }}>${formatUSD(Number(sesionActiva?.apertura_usd) || 0)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888' }}>VENTAS USD</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00e676', fontFamily: 'monospace' }}>${formatUSD(totalVentas)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(0,230,118,0.06)', borderRadius: '6px', border: '1px solid #00e676' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#00e676' }}>MONTO CIERRE USD</span>
                                            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#00e676', fontFamily: 'monospace' }}>${formatUSD((Number(sesionActiva?.apertura_usd) || 0) + totalVentas)}</span>
                                        </div>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.2rem 0' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(33,150,243,0.15)' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888' }}>APERTURA BS</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#2196f3', fontFamily: 'monospace' }}>Bs {formatBS(Number(sesionActiva?.apertura_bs) || 0)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888' }}>VENTAS BS</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#2196f3', fontFamily: 'monospace' }}>Bs {formatBS(totalVentasBS)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(33,150,243,0.06)', borderRadius: '6px', border: '1px solid #2196f3' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#2196f3' }}>MONTO CIERRE BS</span>
                                            <span style={{ fontSize: '1rem', fontWeight: 900, color: '#2196f3', fontFamily: 'monospace' }}>Bs {formatBS((Number(sesionActiva?.apertura_bs) || 0) + totalVentasBS)}</span>
                                        </div>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.2rem 0' }} />
                                        {METODOS_SISTEMA.map(({ id, label, icon: Icon, color }) => (
                                            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: `1px solid ${color}20` }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Icon size={14} style={{ color }} />
                                                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888', letterSpacing: '0.05em' }}>{label}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color, fontFamily: 'monospace' }}>Bs {formatBS(totalsSistema[id])}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {isAbrir && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <label className="s-section-label">TASA BCV</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const fetchTasa = async () => {
                                                try {
                                                    const result = await gsService.fetchAndUpdateTasaBcv()
                                                    if (result?.tasaBCV && result.tasaBCV > 0) {
                                                        setTasaBcv(Number(result.tasaBCV).toFixed(2))
                                                    }
                                                } catch (e) {}
                                            }
                                            fetchTasa()
                                        }}
                                        style={{
                                            background: 'none',
                                            border: '1px solid var(--s-neon)',
                                            color: 'var(--s-neon)',
                                            fontSize: '0.6rem',
                                            fontWeight: 800,
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                        title="Actualizar tasa BCV"
                                    >
                                        ↻ ACTUALIZAR
                                    </button>
                                </div>
                                <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                    <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)', fontWeight: 900 }}>BS</div>
                                    <CurrencyInput currency="USD" name="tasa_bcv" id="caja-tasa" value={tasaBcv} onChange={v => setTasaBcv(parseFloat(v).toFixed(2))} placeholder="Tasa actual" color="var(--s-neon)" style={{ paddingLeft: '3rem', fontSize: '1.2rem', height: '4rem', fontWeight: 900, textAlign: 'center' }} />
                                </div>
                                <div style={{ fontSize: '0.55rem', color: 'var(--s-text-dim)', textAlign: 'center', marginTop: '0.25rem' }}>
                                    (Valor obtenido automáticamente del BCV - editable)
                                </div>
                            </div>
                        )}

                        {!isAbrir && (
                            <div>
                                <label className="s-section-label">OBSERVACIONES DEL CIERRE</label>
                                <textarea name="observaciones" id="caja-observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} className="s-input" placeholder="Observaciones del cierre fiscal..." style={{ marginTop: '0.5rem', height: '4.5rem', resize: 'none', paddingTop: '0.75rem' }} />
                            </div>
                        )}

                        {error && (
                            <div style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)', padding: '0.875rem', borderRadius: '8px', color: '#ff5252', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <AlertCircle size={16} />{error.toUpperCase()}
                            </div>
                        )}

                        <button type="submit" disabled={loading} style={{ height: '3.5rem', minHeight: '3.5rem', flexShrink: 0, marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 900, borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', background: isAbrir ? 'linear-gradient(135deg, var(--s-neon), #00b248)' : 'rgba(255,82,82,0.15)', color: isAbrir ? '#000' : '#ff5252', opacity: loading ? 0.7 : 1 }}>
                            {loading ? 'PROCESANDO...' : (isAbrir ? '✓ INICIAR JORNADA' : '⚑ CERRAR JORNADA Y EMITIR REPORTE Z')}
                        </button>
                    </form>
                </div>
            </motion.div>

            {showPrintReport && cierreRef.current && (
                <div className="print-cierre" style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: '#0d1117', zIndex: 10000, display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', fontFamily: 'monospace'
                }}>
                    {/* BARRA SUPERIOR FIJA / ACCIONES RÁPIDAS (no-print) */}
                    <div className="no-print" style={{
                        background: '#161b22',
                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                        padding: '0.85rem 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        zIndex: 10,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: '#00e676',
                                boxShadow: '0 0 10px #00e676'
                            }} />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
                                        REPORTE Z GUARDADO EXITOSAMENTE
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#00e676', fontWeight: 800, background: 'rgba(0,230,118,0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                                        {cierreRef.current.numeroReporteZ}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: '2px' }}>
                                    Caja cerrada en el sistema • Puedes volver a la pantalla de ventas
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button
                                onClick={handlePrint}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.6rem 1.1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#fff',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Printer size={16} /> RE-IMPRIMIR
                            </button>

                            <button
                                onClick={handleCloseReport}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 1.4rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 900,
                                    background: '#00e676',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: '0 0 16px rgba(0, 230, 118, 0.35)'
                                }}
                            >
                                <ArrowLeft size={16} /> VOLVER A LA APLICACIÓN
                            </button>

                            <button
                                onClick={handleCloseReport}
                                title="Cerrar (Esc)"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#8b949e',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* VISTA DEL TICKET EN FORMATO PAPEL CON SCROLL */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                            background: '#fff',
                            color: '#000',
                            padding: '1.75rem',
                            borderRadius: '6px',
                            maxWidth: '80mm',
                            width: '100%',
                            boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
                            margin: '0 auto'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #000' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>MICRO MARKET EXPRESS</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.25rem' }}>REPORTE Z - CIERRE FISCAL</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#333' }}>{cierreRef.current.numeroReporteZ}</div>
                            </div>

                            <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666', width: '40%' }}>REPORTE Z NRO</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{cierreRef.current.numeroReporteZ}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>SESIÓN CAJA</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{cierreRef.current.sesion.id?.slice(0, 15)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>APERTURA</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{dayjs(cierreRef.current.sesion.fecha_apertura).format('DD/MM/YYYY HH:mm')}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>CIERRE</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{dayjs().format('DD/MM/YYYY HH:mm')}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>RANGO FACTURAS</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{cierreRef.current.facturaInicial} AL {cierreRef.current.facturaFinal}</td></tr>
                                </tbody>
                            </table>

                            <div style={{ margin: '0.75rem 0', borderTop: '1px dashed #000' }} />

                            <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr><td style={{ fontWeight: 900, padding: '0.3rem 0', borderBottom: '1px solid #000', fontSize: '0.75rem' }} colSpan={2}>RESUMEN TRIBUTARIO ACUMULADO</td></tr>
                                </thead>
                                <tbody>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>TOTAL EXENTO (E)</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.baseExentaUSD)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>BASE IMPONIBLE (G 16%)</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.baseImponibleUSD)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>DÉBITO FISCAL IVA (16%)</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.ivaUSD)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>I.G.T.F. PERCIBIDO (3%)</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.igtfUSD)}</td></tr>
                                </tbody>
                            </table>

                            <div style={{ margin: '0.75rem 0', borderTop: '1px dashed #000' }} />

                            <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr><td style={{ fontWeight: 900, padding: '0.3rem 0', borderBottom: '1px solid #000', fontSize: '0.75rem' }} colSpan={2}>TOTALES DE VENTAS</td></tr>
                                </thead>
                                <tbody>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>TRANSACCIONES</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{cierreRef.current.ventasCount}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>PRODUCTOS VENDIDOS</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>{cierreRef.current.totalItemsVendidos}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>TOTAL USD</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.totalVentasUSD)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>TOTAL BS</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalVentasBS)}</td></tr>
                                </tbody>
                            </table>

                            <div style={{ margin: '0.75rem 0', borderTop: '1px dashed #000' }} />

                            <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr><td style={{ fontWeight: 900, padding: '0.3rem 0', borderBottom: '1px solid #000', fontSize: '0.75rem' }} colSpan={2}>MÉTODOS DE PAGO</td></tr>
                                </thead>
                                <tbody>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>EFECTIVO USD</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>${formatUSD(cierreRef.current.totalsSistema.efectivo_usd)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>EFECTIVO BS</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalsSistema.efectivo_bs)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>DÉBITO</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalsSistema.debito)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>PAGO MÓVIL</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalsSistema.pago_movil)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>BIO PAGO</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalsSistema.bio_pago)}</td></tr>
                                    <tr><td style={{ padding: '0.2rem 0', color: '#666' }}>TRANSFERENCIA</td><td style={{ padding: '0.2rem 0', fontWeight: 700, textAlign: 'right' }}>Bs {formatBS(cierreRef.current.totalsSistema.transferencia)}</td></tr>
                                </tbody>
                            </table>

                            {cierreRef.current.observaciones && (
                                <>
                                    <div style={{ margin: '0.75rem 0', borderTop: '1px dashed #000' }} />
                                    <div style={{ fontSize: '0.65rem' }}>
                                        <div style={{ fontWeight: 900, marginBottom: '0.2rem' }}>OBSERVACIONES</div>
                                        <div style={{ color: '#333' }}>{cierreRef.current.observaciones}</div>
                                    </div>
                                </>
                            )}

                            <div style={{ margin: '1rem 0', borderTop: '2px solid #000' }} />
                            <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#888' }}>
                                {dayjs().format('DD/MM/YYYY HH:mm:ss')} | Cierre Fiscal SENIAT MME
                            </div>
                        </div>

                        {/* BARRA INFERIOR DE APOYO (no-print) */}
                        <div className="no-print" style={{
                            textAlign: 'center', padding: '1.5rem', marginTop: '1rem',
                            display: 'flex', gap: '1rem', justifyContent: 'center'
                        }}>
                            <button
                                onClick={handlePrint}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.75rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 800,
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#fff',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Printer size={16} /> RE-IMPRIMIR TICKET
                            </button>

                            <button
                                onClick={handleCloseReport}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 2rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 900,
                                    background: '#00e676',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: '0 0 20px rgba(0, 230, 118, 0.4)'
                                }}
                            >
                                <ArrowLeft size={18} /> VOLVER A LA APLICACIÓN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CajaModal
