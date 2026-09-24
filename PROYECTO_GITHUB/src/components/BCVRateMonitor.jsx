import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCcw, CheckCircle, AlertTriangle, Clock, DollarSign, Euro } from 'lucide-react'
import { gsService } from '../lib/googleSheetsService'

const BCVRateMonitor = ({ onTasaChange }) => {
    const [tasaBcv, setTasaBcv] = useState(() => {
        const saved = localStorage.getItem('mme_tasa_bcv')
        return saved ? parseFloat(saved) : (gsService.getTasaBcv() || 0)
    })
    const [tasaBcvEuro, setTasaBcvEuro] = useState(() => {
        const saved = localStorage.getItem('mme_tasa_bcv_euro')
        return saved ? parseFloat(saved) : (gsService.getTasaBcvEuro() || 0)
    })
    const [tasaFecha, setTasaFecha] = useState(() => {
        return localStorage.getItem('mme_tasa_fecha') || null
    })
    const [tasaHora, setTasaHora] = useState(() => {
        return localStorage.getItem('mme_tasa_hora') || null
    })
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState('idle') // 'idle' | 'syncing' | 'success' | 'changed' | 'error' | 'offline'
    const [mensaje, setMensaje] = useState('')
    const [showTooltip, setShowTooltip] = useState(false)
    const intervalRef = useRef(null)

    const syncTasa = useCallback(async (forzar = false) => {
        setIsLoading(true)
        setStatus('syncing')
        setMensaje('Sincronizando...')
        
        try {
            const result = await gsService.fetchAndUpdateTasas()
            const tasaUsd = Number(result?.data?.tasa_bcv || gsService.tasaBcv || gsService.cache?.tasaBCV || 0)
            const tasaEur = Number(result?.data?.tasa_euro || gsService.tasaBcvEuro || gsService.cache?.tasaBCVEuro || 0)
            const fechaTasa = gsService.cache?.Tasa?.tasa_fecha || gsService.cache?.fecha || null
            
            if (tasaUsd > 0 || tasaEur > 0) {
                const ahora = new Date()
                const horaStr = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                
                const huboCambio = result?.cambio || 
                    (tasaBcv > 0 && Math.abs(tasaBcv - tasaUsd) > 0.001) ||
                    (tasaBcvEuro > 0 && Math.abs(tasaBcvEuro - tasaEur) > 0.001)

                setTasaBcv(tasaUsd)
                setTasaBcvEuro(tasaEur)
                setTasaFecha(fechaTasa)
                setTasaHora(horaStr)

                if (tasaUsd > 0) {
                    localStorage.setItem('mme_tasa_bcv', tasaUsd.toString())
                    onTasaChange?.(tasaUsd)
                }
                if (tasaEur > 0) {
                    localStorage.setItem('mme_tasa_bcv_euro', tasaEur.toString())
                }
                localStorage.setItem('mme_tasa_fecha', fechaTasa || '')
                localStorage.setItem('mme_tasa_hora', horaStr)

                setStatus(huboCambio ? 'changed' : 'success')
                setMensaje(huboCambio ? '¡Tasa actualizada!' : 'En tiempo real')
                
                setTimeout(() => {
                    setStatus('idle')
                    setMensaje('')
                }, 3500)
            } else {
                setStatus('error')
                setMensaje('Tasa no disponible')
            }
        } catch (e) {
            console.error('Error sincronizando tasas:', e)
            setStatus('error')
            setMensaje('Error de conexión')
            
            const tasaUsdCache = gsService.tasaBcv || gsService.getTasaBcv() || 0
            const tasaEurCache = gsService.tasaBcvEuro || gsService.getTasaBcvEuro() || 0
            if (tasaUsdCache > 0 || tasaEurCache > 0) {
                setTasaBcv(tasaUsdCache)
                setTasaBcvEuro(tasaEurCache)
                onTasaChange?.(tasaUsdCache)
                setStatus('success')
                setMensaje('Usando caché')
                setTimeout(() => {
                    setStatus('idle')
                    setMensaje('')
                }, 3000)
            } else {
                setStatus('offline')
                setMensaje('Sin conexión')
            }
        } finally {
            setIsLoading(false)
        }
    }, [onTasaChange, tasaBcv, tasaBcvEuro])

    useEffect(() => {
        const tasaUsdCache = gsService.tasaBcv || gsService.getTasaBcv() || 0
        const tasaEurCache = gsService.tasaBcvEuro || gsService.getTasaBcvEuro() || 0
        if (tasaUsdCache > 0) {
            setTasaBcv(tasaUsdCache)
            onTasaChange?.(tasaUsdCache)
        }
        if (tasaEurCache > 0) {
            setTasaBcvEuro(tasaEurCache)
        }

        // Sincronizar en background al montar
        const timer = setTimeout(() => syncTasa(true), 1500)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        // Monitoreo en tiempo real: verificar cada 60 segundos
        intervalRef.current = setInterval(() => {
            syncTasa(false)
        }, 60000)

        const handleFocus = () => syncTasa(false)
        window.addEventListener('focus', handleFocus)

        const handleTasasUpdated = (e) => {
            if (e.detail) {
                if (e.detail.tasaBcv > 0) setTasaBcv(e.detail.tasaBcv)
                if (e.detail.tasaBcvEuro > 0) setTasaBcvEuro(e.detail.tasaBcvEuro)
            }
        }
        window.addEventListener('mme_tasas_updated', handleTasasUpdated)
        
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('mme_tasas_updated', handleTasasUpdated)
        }
    }, [syncTasa])

    const formatFecha = (fecha) => {
        if (!fecha) return ''
        try {
            const d = new Date(fecha)
            return d.toLocaleDateString('es-VE', { 
                day: '2-digit', 
                month: '2-digit',
                year: 'numeric'
            })
        } catch { return fecha }
    }

    const getBorderColor = () => {
        switch (status) {
            case 'changed': return 'rgba(0, 229, 255, 0.6)'
            case 'success': return 'rgba(0, 230, 118, 0.5)'
            case 'error': return 'rgba(255, 82, 82, 0.4)'
            case 'syncing': return 'rgba(255, 193, 7, 0.4)'
            case 'offline': return 'rgba(128, 128, 128, 0.4)'
            default: return 'rgba(0, 230, 118, 0.3)'
        }
    }

    const getBgColor = () => {
        switch (status) {
            case 'changed': return 'rgba(0, 229, 255, 0.12)'
            case 'success': return 'rgba(0, 230, 118, 0.15)'
            case 'error': return 'rgba(255, 82, 82, 0.1)'
            case 'syncing': return 'rgba(255, 193, 7, 0.1)'
            case 'offline': return 'rgba(128, 128, 128, 0.1)'
            default: return 'rgba(0, 230, 118, 0.08)'
        }
    }

    const getStatusIcon = () => {
        switch (status) {
            case 'changed': return <CheckCircle size={13} style={{ color: '#00e5ff' }} />
            case 'success': return <CheckCircle size={13} style={{ color: '#00e676' }} />
            case 'error': return <AlertTriangle size={13} style={{ color: '#ff5252' }} />
            case 'syncing': return <RefreshCcw size={13} style={{ color: '#ffc107', animation: 'spin 1s linear infinite' }} />
            case 'offline': return <AlertTriangle size={13} style={{ color: '#888' }} />
            default: return null
        }
    }

    const getTextColor = () => {
        if (status === 'changed') return '#00e5ff'
        if (status === 'error' || status === 'offline') return '#ff5252'
        if (status === 'syncing') return '#ffc107'
        return 'var(--s-neon)'
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.45rem 1rem',
            background: getBgColor(),
            borderRadius: '8px',
            border: `1px solid ${getBorderColor()}`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative'
        }} 
        onClick={() => syncTasa(true)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        >
            {getStatusIcon()}
            
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem'
            }}>
                {/* Contenedor lado a lado: USD y EUR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* BCV DÓLAR */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <DollarSign size={13} style={{ color: 'var(--s-neon)' }} />
                            <span style={{ 
                                fontSize: '0.6rem', 
                                fontWeight: 800, 
                                color: getTextColor(),
                                letterSpacing: '0.05em'
                            }}>
                                BCV
                            </span>
                        </div>
                        <span style={{
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            color: '#fff',
                            fontFamily: 'monospace',
                            lineHeight: 1
                        }}>
                            {tasaBcv > 0 ? `BS ${tasaBcv.toFixed(2)}` : '---'}
                        </span>
                    </div>

                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: 900 }}>|</span>

                    {/* BCV EURO (al lado del dólar en tiempo real) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <Euro size={13} style={{ color: '#38bdf8' }} />
                            <span style={{ 
                                fontSize: '0.6rem', 
                                fontWeight: 800, 
                                color: '#38bdf8',
                                letterSpacing: '0.05em'
                            }}>
                                BCV
                            </span>
                        </div>
                        <span style={{
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            color: '#fff',
                            fontFamily: 'monospace',
                            lineHeight: 1
                        }}>
                            {tasaBcvEuro > 0 ? `BS ${tasaBcvEuro.toFixed(2)}` : '---'}
                        </span>
                    </div>
                </div>

                {/* Subtítulo con fecha o mensaje de cambio */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {mensaje ? (
                        <span style={{ fontSize: '0.55rem', color: status === 'changed' ? '#00e5ff' : status === 'syncing' ? '#ffc107' : '#00e676', fontWeight: 800 }}>
                            {mensaje}
                        </span>
                    ) : (
                        tasaFecha && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Clock size={8} style={{ color: '#666' }} />
                                <span style={{ fontSize: '0.55rem', color: '#888', fontWeight: 700 }}>
                                    {tasaHora ? `${tasaHora} • ` : ''}{formatFecha(tasaFecha)}
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>
            
            {!isLoading && status !== 'syncing' && (
                <RefreshCcw 
                    size={12} 
                    style={{ 
                        color: '#888',
                        marginLeft: '0.2rem'
                    }} 
                />
            )}
            
            {showTooltip && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '0.5rem',
                    background: 'rgba(10,14,26,0.98)',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    color: '#aaa',
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(0,230,118,0.25)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                }}>
                    <div style={{ fontWeight: 900, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
                        TASAS OFICIALES BCV (TIEMPO REAL)
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--s-neon)', fontWeight: 800 }}>DÓLAR (USD):</span>
                        <span style={{ color: '#fff', fontWeight: 900, fontFamily: 'monospace' }}>
                            {tasaBcv > 0 ? `BS ${tasaBcv.toFixed(2)}` : '---'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 800 }}>EURO (EUR):</span>
                        <span style={{ color: '#fff', fontWeight: 900, fontFamily: 'monospace' }}>
                            {tasaBcvEuro > 0 ? `BS ${tasaBcvEuro.toFixed(2)}` : '---'}
                        </span>
                    </div>
                    {tasaFecha && <div style={{ fontSize: '0.6rem', color: '#888' }}>Vigencia: {formatFecha(tasaFecha)}</div>}
                    {tasaHora && <div style={{ fontSize: '0.6rem', color: '#888' }}>Última sync: {tasaHora}</div>}
                    <div style={{ color: 'var(--s-neon)', fontSize: '0.55rem', marginTop: '0.2rem', textAlign: 'center' }}>
                        ● Monitoreo continuo cada 60s (clic para forzar)
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default BCVRateMonitor