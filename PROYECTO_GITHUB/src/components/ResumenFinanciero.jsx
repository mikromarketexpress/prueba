import React, { useMemo } from 'react'
import { AlertTriangle, Clock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { getResumenCuentas } from '../lib/vencimientoUtils'
import { gsService } from '../lib/googleSheetsService'

const ResumenFinanciero = ({ compact = false }) => {
    const resumenCobrar = useMemo(() => {
        const raw = gsService.getCuentasCobrar() || []
        const formatted = raw.map(c => ({
            id: c.id,
            nombre: c.cliente_nombre || 'Cliente',
            fechaVencimiento: c.fecha_vencimiento,
            saldoPendiente: Number(c.saldo_pendiente_usd ?? (Number(c.monto_total_usd || 0) - Number(c.total_abonado_usd || 0)))
        }))
        return getResumenCuentas(formatted)
    }, [])

    const resumenPagar = useMemo(() => {
        const raw = gsService.getCuentasPagar() || []
        const formatted = raw.map(c => ({
            id: c.id,
            nombre: c.proveedor_nombre || 'Proveedor',
            fechaVencimiento: c.fecha_vencimiento,
            saldoPendiente: Number(c.saldo_pendiente_usd ?? (Number(c.monto_total_usd || 0) - Number(c.total_abonado_usd || 0)))
        }))
        return getResumenCuentas(formatted)
    }, [])

    const tieneAlertas = resumenCobrar.critico > 0 || resumenPagar.critico > 0 || resumenCobrar.proximo > 0 || resumenPagar.proximo > 0

    const cardStyle = {
        padding: '1rem',
        borderRadius: 'var(--r-standard)',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--s-glass-border)',
    }

    if (compact) {
        return (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                {resumenCobrar.critico > 0 && (
                    <div style={{ ...cardStyle, borderColor: 'rgba(255,49,49,0.4)', background: 'rgba(255,49,49,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={14} style={{ color: '#ff3131' }} />
                            <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>
                                {resumenCobrar.critico} CRÍTICOS
                            </span>
                        </div>
                    </div>
                )}
                {resumenCobrar.proximo > 0 && (
                    <div style={{ ...cardStyle, borderColor: 'rgba(255,193,7,0.4)', background: 'rgba(255,193,7,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={14} style={{ color: '#ffc107' }} />
                            <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>
                                {resumenCobrar.proximo} PRÓXIMOS
                            </span>
                        </div>
                    </div>
                )}
                {resumenPagar.critico > 0 && (
                    <div style={{ ...cardStyle, borderColor: 'rgba(255,49,49,0.4)', background: 'rgba(255,49,49,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={14} style={{ color: '#ff6b6b' }} />
                            <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>
                                {resumenPagar.critico} PAGAR
                            </span>
                        </div>
                    </div>
                )}
                {!tieneAlertas && (
                    <div style={{ ...cardStyle, borderColor: 'rgba(0,230,118,0.3)', background: 'rgba(0,230,118,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={14} style={{ color: 'var(--s-neon)' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--s-neon)', fontWeight: 700 }}>
                                TODO AL DÍA
                            </span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="s-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DollarSign size={22} style={{ color: 'var(--s-neon)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>
                    RESUMEN FINANCIERO
                </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ ...cardStyle, borderColor: resumenCobrar.critico > 0 ? 'rgba(255,49,49,0.4)' : 'var(--s-glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--s-neon)', fontWeight: 800, textTransform: 'uppercase' }}>
                            COBRAR
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Críticos</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff3131' }}>
                                {resumenCobrar.critico}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Próximos</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ffc107' }}>
                                {resumenCobrar.proximo}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Total Pendiente</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--s-neon)' }}>
                                ${resumenCobrar.totalPendiente.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ ...cardStyle, borderColor: resumenPagar.critico > 0 ? 'rgba(255,49,49,0.4)' : 'var(--s-glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#ff6b6b', fontWeight: 800, textTransform: 'uppercase' }}>
                            PAGAR
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Críticos</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff3131' }}>
                                {resumenPagar.critico}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Próximos</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ffc107' }}>
                                {resumenPagar.proximo}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)' }}>Total Pendiente</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff6b6b' }}>
                                ${resumenPagar.totalPendiente.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {tieneAlertas && (
                <div style={{ 
                    padding: '0.75rem 1rem', 
                    borderRadius: 'var(--r-standard)',
                    background: 'rgba(255,49,49,0.1)',
                    border: '1px solid rgba(255,49,49,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <AlertTriangle size={18} style={{ color: '#ff3131' }} />
                    <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                        Tienes {resumenCobrar.critico + resumenPagar.critico} cuentas críticas que requieren atención inmediata
                    </span>
                </div>
            )}
        </div>
    )
}

export default ResumenFinanciero