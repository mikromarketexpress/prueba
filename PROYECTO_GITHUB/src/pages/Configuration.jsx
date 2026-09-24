import React, { useState, useEffect } from 'react'
import { 
    Settings, Building2, Sliders, DollarSign, Database, ShieldCheck, 
    Save, RefreshCw, Printer, CheckCircle2, AlertTriangle, ExternalLink, 
    Trash2, Wifi, Zap, FileSpreadsheet, HardDrive, Clock, Check, Users
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsService, DEFAULT_CONFIG } from '../lib/googleSheetsService'
import { useToast } from '../context/ToastContext'
import { abrirTicketImpresion } from '../lib/ticketPrinter'
import UserManagerModal from '../components/UserManagerModal'

const TABS = [
    { id: 'empresa', label: 'EMPRESA Y TICKET', icon: Building2 },
    { id: 'pos', label: 'PARÁMETROS POS', icon: Sliders },
    { id: 'tasas', label: 'TASAS BCV', icon: DollarSign },
    { id: 'database', label: 'GOOGLE SHEETS / NUBE', icon: Database },
    { id: 'usuarios', label: 'SEGURIDAD Y ACCESO', icon: ShieldCheck },
]

export default function Configuration() {
    const { showToast } = useToast()
    const [activeTab, setActiveTab] = useState('empresa')
    const [saving, setSaving] = useState(false)
    const [refreshingTasas, setRefreshingTasas] = useState(false)
    const [syncingAll, setSyncingAll] = useState(false)
    const [diagLoading, setDiagLoading] = useState(false)
    const [diagResult, setDiagResult] = useState(null)
    const [showUserManager, setShowUserManager] = useState(false)

    // Form state
    const [config, setConfig] = useState(() => gsService.getConfig())

    // Live BCV data
    const [tasaUSD, setTasaUSD] = useState(gsService.tasaBcv || 0)
    const [tasaEUR, setTasaEUR] = useState(gsService.tasaBcvEuro || 0)
    const [fechaTasa, setFechaTasa] = useState(gsService.cache?.fecha || gsService.cache?.Tasa?.tasa_fecha || '')

    useEffect(() => {
        const loaded = gsService.getConfig()
        setConfig(loaded)
        if (gsService.tasaBcv) setTasaUSD(gsService.tasaBcv)
        if (gsService.tasaBcvEuro) setTasaEUR(gsService.tasaBcvEuro)
    }, [])

    const handleChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handleSave = async () => {
        // 1. Guardar de forma inmediata en almacenamiento local y memoria (0 ms)
        try {
            localStorage.setItem('mme_config_v1', JSON.stringify(config))
            if (gsService.cache) {
                gsService.cache.Configuracion = config
                gsService._saveToLocalStorage()
            }
            showToast('⚡ CONFIGURACIÓN GUARDADA EXITOSAMENTE', 'success')
        } catch (e) {
            console.warn('[Config] Error guardando local:', e)
        }

        // 2. Sincronización en segundo plano con Google Sheets (no bloquea al usuario)
        gsService.saveConfig(config).then(res => {
            if (res && res.success && !res.localOnly) {
                console.log('[Config] ✅ Configuración sincronizada en Google Sheets')
            } else {
                console.log('[Config] ℹ️ Configuración guardada localmente')
            }
        }).catch(err => {
            console.error('[Config] Error en sincronización con servidor:', err)
            showToast('AVISO: Guardado en dispositivo, pendiente sincronizar nube', 'warning')
        })
    }

    const handleTestPrint = () => {
        try {
            // Guardar temporalmente en localStorage para que el ticket use los valores editados
            localStorage.setItem('mme_config_v1', JSON.stringify(config))
            abrirTicketImpresion({
                idVenta: 'TICKET-DEMO-' + Math.floor(1000 + Math.random() * 9000),
                fecha: new Date().toISOString(),
                sesionCajaId: 'SES-DEMO-01',
                productos: [
                    { nombre: 'HARINA DE MAÍZ 1KG', cantidad: 2, precio_usd: 1.10 },
                    { nombre: 'ARROZ BLANCO 1KG', cantidad: 3, precio_usd: 1.25 },
                    { nombre: 'ACEITE VEGETAL 1L', cantidad: 1, precio_usd: 2.80 }
                ],
                pagos: { efectivo_usd: 10.00 },
                vueltoUSD: 1.05,
                vueltoBS: 0,
                subtotalUSD: 8.95,
                ivaUSD: 0,
                totalUSD: 8.95,
                totalBS: 8.95 * (tasaUSD || 36.5),
                tasaBCV: tasaUSD || 36.5,
                clienteNombre: 'CLIENTE MOSTRADOR',
                clienteIdentificacion: 'V-00000000',
                clienteTipo: 'Persona Natural'
            })
            showToast('VENTANA DE IMPRESIÓN GENERADA', 'info')
        } catch (err) {
            showToast('ERROR AL GENERAR TICKET DE PRUEBA', 'error')
        }
    }

    const handleRefreshTasas = async () => {
        setRefreshingTasas(true)
        try {
            const res = await gsService.fetchAndUpdateTasas()
            if (res && res.success && res.data) {
                const usd = Number(res.data.tasa_bcv || 0)
                const eur = Number(res.data.tasa_euro || 0)
                if (usd > 0) setTasaUSD(usd)
                if (eur > 0) setTasaEUR(eur)
                setFechaTasa(res.data.tasa_fecha || new Date().toLocaleString('es-VE'))
                showToast(`TASAS ACTUALIZADAS: $ Bs ${usd.toFixed(2)} | € Bs ${eur.toFixed(2)}`, 'success')
            } else {
                showToast('NO SE PUDIERON OBTENER LAS TASAS EN ESTE MOMENTO', 'warning')
            }
        } catch (err) {
            showToast('ERROR CONSULTANDO TASAS: ' + err.message, 'error')
        } finally {
            setRefreshingTasas(false)
        }
    }

    const handleRunDiag = async () => {
        setDiagLoading(true)
        setDiagResult(null)
        const t0 = performance.now()
        try {
            const res = await gsService.runDiagnostic()
            const latency = Math.round(performance.now() - t0)
            setDiagResult({ ...res, latency })
            if (res.sheetReachable) {
                showToast(`DIAGNÓSTICO EXITOSO (${latency} ms)`, 'success')
            } else {
                showToast('ADVERTENCIA EN EL DIAGNÓSTICO', 'warning')
            }
        } catch (err) {
            setDiagResult({ error: err.message, networkOk: navigator.onLine })
            showToast('FALLÓ EL DIAGNÓSTICO', 'error')
        } finally {
            setDiagLoading(false)
        }
    }

    const handleSyncAll = async () => {
        setSyncingAll(true)
        try {
            await gsService.refresh()
            const updated = gsService.getConfig()
            setConfig(updated)
            if (gsService.tasaBcv) setTasaUSD(gsService.tasaBcv)
            if (gsService.tasaBcvEuro) setTasaEUR(gsService.tasaBcvEuro)
            showToast('BASE DE DATOS SINCRONIZADA COMPLETAMENTE', 'success')
        } catch (err) {
            showToast('ERROR AL SINCRONIZAR: ' + err.message, 'error')
        } finally {
            setSyncingAll(false)
        }
    }

    const handleClearCache = () => {
        if (window.confirm('¿Está seguro de limpiar la memoria caché local? Se recargarán todos los datos directamente desde Google Sheets.')) {
            try {
                localStorage.removeItem('mme_gs_cache_v8')
                showToast('CACHÉ LOCAL LIMPIADO. RECARGANDO DATOS...', 'info')
                setTimeout(() => {
                    window.location.reload()
                }, 800)
            } catch (e) {
                window.location.reload()
            }
        }
    }

    const connStatus = gsService.getConnectionStatus()
    const usersCount = (gsService.getUsuarios() || []).length

    return (
        <div className="s-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', overflowY: 'auto' }}>
            
            {/* Header del módulo */}
            <div className="s-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Settings size={24} style={{ color: 'var(--s-neon)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em', margin: 0 }}>
                            CONFIGURACIÓN DEL SISTEMA
                        </h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--s-text-secondary)', fontWeight: 600 }}>
                            Ajustes generales del negocio, parámetros de venta, conexión a base de datos y tasas de cambio
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="s-btn s-btn--primary"
                        style={{
                            background: 'var(--s-neon)', color: '#000', fontWeight: 900,
                            padding: '0.65rem 1.4rem', borderRadius: '8px', display: 'flex',
                            alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)'
                        }}
                    >
                        {saving ? <RefreshCw size={16} className="s-spin" /> : <Save size={16} />}
                        {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
                    </button>
                </div>
            </div>

            {/* Selector de pestañas */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                padding: '0.7rem 1.1rem', borderRadius: '10px',
                                background: isActive ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                border: isActive ? '1px solid var(--s-neon)' : '1px solid var(--s-glass-border)',
                                color: isActive ? 'var(--s-neon)' : 'var(--s-text-secondary)',
                                fontWeight: isActive ? 800 : 600,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Contenido según pestaña */}
            <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                    
                    {/* TAB 1: EMPRESA Y TICKET */}
                    {activeTab === 'empresa' && (
                        <motion.div
                            key="empresa"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        >
                            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                            DATOS DE IDENTIFICACIÓN FISCAL Y COMERCIAL
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', margin: '0.2rem 0 0' }}>
                                            Esta información se imprime en el encabezado de las notas de entrega y facturas de venta.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleTestPrint}
                                        className="s-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--s-glass-border)',
                                            color: '#fff', padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '0.75rem', fontWeight: 700
                                        }}
                                    >
                                        <Printer size={15} style={{ color: 'var(--s-neon)' }} />
                                        PROBAR IMPRESIÓN DE TICKET
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            NOMBRE O RAZÓN SOCIAL DEL NEGOCIO
                                        </label>
                                        <input
                                            type="text"
                                            className="s-input"
                                            value={config.nombre_empresa || ''}
                                            onChange={e => handleChange('nombre_empresa', e.target.value.toUpperCase())}
                                            placeholder="EJ: MICRO MARKET EXPRESS"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            RIF / DOCUMENTO FISCAL
                                        </label>
                                        <input
                                            type="text"
                                            className="s-input"
                                            value={config.rif_empresa || ''}
                                            onChange={e => handleChange('rif_empresa', e.target.value.toUpperCase())}
                                            placeholder="EJ: J-12345678-9"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            TELÉFONO DE CONTACTO / WHATSAPP
                                        </label>
                                        <input
                                            type="text"
                                            className="s-input"
                                            value={config.telefono_empresa || ''}
                                            onChange={e => handleChange('telefono_empresa', e.target.value)}
                                            placeholder="EJ: +58 412-1234567"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            DIRECCIÓN DEL ESTABLECIMIENTO
                                        </label>
                                        <input
                                            type="text"
                                            className="s-input"
                                            value={config.direccion_empresa || ''}
                                            onChange={e => handleChange('direccion_empresa', e.target.value.toUpperCase())}
                                            placeholder="EJ: AV. PRINCIPAL, LOCAL 1, CARACAS"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                        MENSAJE PERSONALIZADO AL PIE DEL TICKET
                                    </label>
                                    <input
                                        type="text"
                                        className="s-input"
                                        value={config.mensaje_ticket || ''}
                                        onChange={e => handleChange('mensaje_ticket', e.target.value)}
                                        placeholder="EJ: ¡GRACIAS POR SU COMPRA! VUELVA PRONTO."
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 600 }}
                                    />
                                    <span style={{ fontSize: '0.68rem', color: 'var(--s-text-dim)', marginTop: '0.3rem', display: 'block' }}>
                                        Este mensaje se imprimirá centrado al final de cada comprobante emitido en el Punto de Venta.
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 2: PARÁMETROS POS */}
                    {activeTab === 'pos' && (
                        <motion.div
                            key="pos"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        >
                            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.75rem' }}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                        COMPORTAMIENTO Y POLÍTICAS DE CAJA / VENTA
                                    </h3>
                                    <p style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', margin: '0.2rem 0 0' }}>
                                        Configure los valores predeterminados para impuestos, alertas de stock e impresión.
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            MONEDA BASE DEL SISTEMA
                                        </label>
                                        <select
                                            className="s-input"
                                            value={config.moneda_defecto || 'USD'}
                                            onChange={e => handleChange('moneda_defecto', e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        >
                                            <option value="USD">DÓLARES AMERICANOS ($ USD)</option>
                                            <option value="BS">BOLÍVARES DIGITALES (Bs.)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            PORCENTAJE DE I.V.A. (%)
                                        </label>
                                        <input
                                            type="number"
                                            className="s-input"
                                            value={config.iva_porcentaje ?? 16}
                                            onChange={e => handleChange('iva_porcentaje', Number(e.target.value))}
                                            min="0"
                                            max="100"
                                            step="1"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            PORCENTAJE DE I.G.T.F. (%)
                                        </label>
                                        <input
                                            type="number"
                                            className="s-input"
                                            value={config.igtf_porcentaje ?? 3}
                                            onChange={e => handleChange('igtf_porcentaje', Number(e.target.value))}
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            UMBRAL DE ALERTA DE STOCK MÍNIMO
                                        </label>
                                        <input
                                            type="number"
                                            className="s-input"
                                            value={config.stock_alerta_minimo ?? 5}
                                            onChange={e => handleChange('stock_alerta_minimo', Number(e.target.value))}
                                            min="1"
                                            max="100"
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                                        padding: '0.85rem 1rem', borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--s-glass-border)',
                                        cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={config.permitir_venta_sin_stock === true || config.permitir_venta_sin_stock === 'true'}
                                            onChange={e => handleChange('permitir_venta_sin_stock', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--s-neon)', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                                                Permitir venta de productos con stock en cero o negativo
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--s-text-secondary)' }}>
                                                Si está activo, los cajeros podrán añadir al carrito productos incluso si el inventario registrado es 0.
                                            </div>
                                        </div>
                                    </label>

                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                                        padding: '0.85rem 1rem', borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--s-glass-border)',
                                        cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={config.impresion_automatica_ticket === true || config.impresion_automatica_ticket === 'true'}
                                            onChange={e => handleChange('impresion_automatica_ticket', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--s-neon)', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                                                Abrir ventana de impresión de ticket automáticamente tras cobrar
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--s-text-secondary)' }}>
                                                Al confirmar la venta en el POS, se abrirá la vista de impresión térmica directamente.
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 3: TASAS BCV */}
                    {activeTab === 'tasas' && (
                        <motion.div
                            key="tasas"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        >
                            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                            MONITOR DE TASAS DE CAMBIO OFICIALES (BANCO CENTRAL DE VENEZUELA)
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', margin: '0.2rem 0 0' }}>
                                            Sincronización en tiempo real directa con los valores oficiales de Dólar ($) y Euro (€).
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleRefreshTasas}
                                        disabled={refreshingTasas}
                                        className="s-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            background: 'rgba(0, 230, 118, 0.1)', border: '1px solid var(--s-neon)',
                                            color: 'var(--s-neon)', padding: '0.55rem 1rem', borderRadius: '8px',
                                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800
                                        }}
                                    >
                                        <RefreshCw size={15} className={refreshingTasas ? 's-spin' : ''} />
                                        {refreshingTasas ? 'CONSULTANDO...' : 'CONSULTAR AHORA'}
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                                    {/* Tarjeta Dólar BCV */}
                                    <div style={{
                                        padding: '1.25rem', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%)',
                                        border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--s-neon)', letterSpacing: '0.1em' }}>
                                                DÓLAR OFICIAL BCV
                                            </span>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 900, background: 'rgba(0, 230, 118, 0.15)', color: 'var(--s-neon)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                EN VIVO
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                                            Bs. {tasaUSD > 0 ? tasaUSD.toFixed(2) : '---'}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--s-text-secondary)' }}>
                                            1 USD = {tasaUSD > 0 ? tasaUSD.toFixed(2) : '---'} Bolívares
                                        </div>
                                    </div>

                                    {/* Tarjeta Euro BCV */}
                                    <div style={{
                                        padding: '1.25rem', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%)',
                                        border: '1px solid rgba(33, 150, 243, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2196f3', letterSpacing: '0.1em' }}>
                                                EURO OFICIAL BCV
                                            </span>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 900, background: 'rgba(33, 150, 243, 0.15)', color: '#2196f3', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                EN VIVO
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                                            Bs. {tasaEUR > 0 ? tasaEUR.toFixed(2) : '---'}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--s-text-secondary)' }}>
                                            1 EUR = {tasaEUR > 0 ? tasaEUR.toFixed(2) : '---'} Bolívares
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)', marginBottom: '0.35rem' }}>
                                            INTERVALO DE REFRESCADO AUTOMÁTICO EN TIEMPO REAL
                                        </label>
                                        <select
                                            className="s-input"
                                            value={config.intervalo_bcv_minutos || '1'}
                                            onChange={e => handleChange('intervalo_bcv_minutos', e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#0a0e17', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontWeight: 700 }}
                                        >
                                            <option value="1">CADA 1 MINUTO (Recomendado)</option>
                                            <option value="5">CADA 5 MINUTOS</option>
                                            <option value="15">CADA 15 MINUTOS</option>
                                            <option value="30">CADA 30 MINUTOS</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-text-secondary)', marginBottom: '0.35rem' }}>
                                            ÚLTIMA FECHA / HORA REGISTRADA
                                        </label>
                                        <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--s-glass-border)', color: '#fff', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Clock size={16} style={{ color: 'var(--s-neon)' }} />
                                            {fechaTasa || 'Sincronizado'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 4: GOOGLE SHEETS & DATABASE */}
                    {activeTab === 'database' && (
                        <motion.div
                            key="database"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        >
                            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                            INFRAESTRUCTURA DE DATOS EN LA NUBE (GOOGLE SHEETS & DRIVE)
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', margin: '0.2rem 0 0' }}>
                                            Monitoreo de conectividad, sincronización bidireccional y almacenamiento de imágenes.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={handleRunDiag}
                                            disabled={diagLoading}
                                            className="s-btn"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                background: 'rgba(33, 150, 243, 0.1)', border: '1px solid #2196f3',
                                                color: '#2196f3', padding: '0.5rem 0.9rem', borderRadius: '8px',
                                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
                                            }}
                                        >
                                            <Zap size={14} className={diagLoading ? 's-spin' : ''} />
                                            {diagLoading ? 'PROBANDO...' : 'PROBAR LATENCIA / PING'}
                                        </button>

                                        <button
                                            onClick={handleSyncAll}
                                            disabled={syncingAll}
                                            className="s-btn"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                background: 'rgba(0, 230, 118, 0.1)', border: '1px solid var(--s-neon)',
                                                color: 'var(--s-neon)', padding: '0.5rem 0.9rem', borderRadius: '8px',
                                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
                                            }}
                                        >
                                            <RefreshCw size={14} className={syncingAll ? 's-spin' : ''} />
                                            {syncingAll ? 'SINCRONIZANDO...' : 'FORZAR SINCRONIZACIÓN'}
                                        </button>
                                    </div>
                                </div>

                                {/* Métricas de conexión */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                                    <div style={{ padding: '0.9rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid var(--s-glass-border)' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-text-dim)', letterSpacing: '0.08em' }}>ESTADO DE CONEXIÓN</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: connStatus.status === 'ok' ? 'var(--s-neon)' : '#ff5252', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                            <Wifi size={16} />
                                            {connStatus.status === 'ok' ? 'EN LÍNEA / ACTIVO' : 'SIN CONEXIÓN'}
                                        </div>
                                    </div>

                                    <div style={{ padding: '0.9rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid var(--s-glass-border)' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-text-dim)', letterSpacing: '0.08em' }}>PRODUCTOS REGISTRADOS</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '0.2rem' }}>
                                            {connStatus.productsInCache || 0}
                                        </div>
                                    </div>

                                    <div style={{ padding: '0.9rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid var(--s-glass-border)' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-text-dim)', letterSpacing: '0.08em' }}>CATEGORÍAS DE PRODUCTOS</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '0.2rem' }}>
                                            {connStatus.categoriesInCache || 0}
                                        </div>
                                    </div>

                                    <div style={{ padding: '0.9rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', border: '1px solid var(--s-glass-border)' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-text-dim)', letterSpacing: '0.08em' }}>USUARIOS DEL SISTEMA</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '0.2rem' }}>
                                            {usersCount}
                                        </div>
                                    </div>
                                </div>

                                {/* Resultados de diagnóstico */}
                                {diagResult && (
                                    <div style={{
                                        padding: '1rem', borderRadius: '10px',
                                        background: diagResult.sheetReachable ? 'rgba(0, 230, 118, 0.06)' : 'rgba(255, 82, 82, 0.06)',
                                        border: diagResult.sheetReachable ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 82, 82, 0.3)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.82rem', color: diagResult.sheetReachable ? 'var(--s-neon)' : '#ff5252' }}>
                                            {diagResult.sheetReachable ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                            {diagResult.sheetReachable ? `Conexión con Google Sheets verificada (${diagResult.latency} ms)` : 'Problema al contactar la base de datos'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', marginTop: '0.3rem' }}>
                                            {diagResult.productsLoaded ? '✓ Catálogo y tablas leídas correctamente.' : '⚠️ No se pudieron cargar las tablas del servidor.'}
                                        </div>
                                    </div>
                                )}

                                {/* Identificadores y enlaces directos */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.85rem 1rem', borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--s-glass-border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <FileSpreadsheet size={20} style={{ color: 'var(--s-neon)' }} />
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                                                    Libro de Google Sheets (Base de Datos Central)
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--s-text-dim)', fontFamily: 'monospace' }}>
                                                    ID: 1VVejGluaLaGTXsT9F7yl5sx5-ePsL2KEp6pCKK_pkWo
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href="https://docs.google.com/spreadsheets/d/1VVejGluaLaGTXsT9F7yl5sx5-ePsL2KEp6pCKK_pkWo/edit"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                fontSize: '0.72rem', fontWeight: 700, color: 'var(--s-neon)',
                                                textDecoration: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px',
                                                background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.2)'
                                            }}
                                        >
                                            <ExternalLink size={14} />
                                            ABRIR EN GOOGLE SHEETS
                                        </a>
                                    </div>

                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.85rem 1rem', borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--s-glass-border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <HardDrive size={20} style={{ color: '#2196f3' }} />
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                                                    Carpeta de Google Drive (Almacenamiento de Fotos e Imágenes)
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--s-text-dim)', fontFamily: 'monospace' }}>
                                                    ID: 1Otottj5OHWtAszwKm_MQMIuByt_UBLW8
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href="https://drive.google.com/drive/folders/1Otottj5OHWtAszwKm_MQMIuByt_UBLW8"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                fontSize: '0.72rem', fontWeight: 700, color: '#2196f3',
                                                textDecoration: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px',
                                                background: 'rgba(33, 150, 243, 0.08)', border: '1px solid rgba(33, 150, 243, 0.2)'
                                            }}
                                        >
                                            <ExternalLink size={14} />
                                            ABRIR CARPETA DRIVE
                                        </a>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--s-glass-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={handleClearCache}
                                        className="s-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.3)',
                                            color: '#ff5252', padding: '0.55rem 1rem', borderRadius: '8px',
                                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800
                                        }}
                                    >
                                        <Trash2 size={15} />
                                        VACIAR MEMORIA CACHÉ LOCAL
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 5: SEGURIDAD Y ACCESO */}
                    {activeTab === 'usuarios' && (
                        <motion.div
                            key="usuarios"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                        >
                            <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ borderBottom: '1px solid var(--s-glass-border)', paddingBottom: '0.75rem' }}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                                        GESTIÓN DE USUARIOS, FOTOS DE PERFIL Y CONTROL DE ROLES
                                    </h3>
                                    <p style={{ fontSize: '0.72rem', color: 'var(--s-text-secondary)', margin: '0.2rem 0 0' }}>
                                        Cree y configure los accesos de cajeros, supervisores y administradores a cada módulo del sistema.
                                    </p>
                                </div>

                                <div style={{
                                    padding: '1.5rem', borderRadius: '12px',
                                    background: 'rgba(0, 230, 118, 0.03)', border: '1px dashed rgba(0, 230, 118, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Users size={24} style={{ color: 'var(--s-neon)' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                                                Gestor Completo de Personal ({usersCount} usuarios registrados)
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--s-text-secondary)' }}>
                                                Permite asignar fotos de perfil desde cámara o archivo, claves seguras, cargos y permisos granulares.
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowUserManager(true)}
                                        className="s-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            background: 'var(--s-neon)', color: '#000', fontWeight: 900,
                                            padding: '0.65rem 1.25rem', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '0.78rem', border: 'none', boxShadow: '0 0 15px rgba(0, 230, 118, 0.25)'
                                        }}
                                    >
                                        <Users size={16} />
                                        ABRIR GESTOR DE USUARIOS Y ROLES
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Modal de Gestor de Usuarios */}
            {showUserManager && (
                <UserManagerModal onClose={() => setShowUserManager(false)} />
            )}
        </div>
    )
}
