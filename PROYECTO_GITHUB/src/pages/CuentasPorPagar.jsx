import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Search,
    UserMinus,
    FileText,
    DollarSign,
    Calendar,
    AlertCircle,
    CheckCircle,
    Clock,
    Plus,
    Trash2,
    Eye,
    Percent,
    Building2,
    Hash,
    RefreshCw,
    X,
    CreditCard,
    Receipt
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { gsService } from '../lib/googleSheetsService'
import { getEstadoVencimiento, formatCurrency } from '../lib/vencimientoUtils'
import { formatUSD, formatBS } from '../lib/financialUtils'

export const CuentasPorPagar = () => {
    const { showToast } = useToast()

    // Datos sincronizados con Google Sheets
    const [cuentas, setCuentas] = useState(() => gsService.getCuentasPagar() || [])
    const [loading, setLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Búsqueda y Filtros
    const [search, setSearch] = useState('')
    const [filterEstado, setFilterEstado] = useState('todos') // 'todos' | 'pendientes' | 'criticos' | 'pagados'

    // Modales
    const [showNewCuentaModal, setShowNewCuentaModal] = useState(false)
    const [showPagoModal, setShowPagoModal] = useState(false)
    const [showHistorialModal, setShowHistorialModal] = useState(false)

    // Cuenta seleccionada
    const [selectedCuenta, setSelectedCuenta] = useState(null)

    // Formulario de Nueva Cuenta por Pagar (Factura de Compra SENIAT)
    const [cuentaForm, setCuentaForm] = useState({
        proveedorNombre: '',
        proveedorRifPrefix: 'J-',
        proveedorRifNumero: '',
        numeroFactura: '',
        numeroControl: '',
        fechaEmision: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
        montoExentoUsd: 0,
        baseImponibleUsd: 0,
        ivaUsd: 0,
        montoTotalUsd: 0,
        notas: ''
    })

    // Formulario de Pago a Proveedor
    const [pagoForm, setPagoForm] = useState({
        moneda: 'USD',
        monto: '',
        metodoPago: 'TRANSFERENCIA',
        aplicaRetencionIva: false,
        porcentajeRetencion: 75,
        numeroComprobanteRetencion: '',
        referencia: '',
        notas: ''
    })

    // Tasa BCV
    const tasaBcv = gsService.getTasaBcv() || 1

    // Cargar datos
    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        setIsRefreshing(true)
        try {
            await gsService.refresh()
            setCuentas(gsService.getCuentasPagar() || [])
        } catch (err) {
            console.error('[CuentasPorPagar] Error cargando datos:', err)
        } finally {
            if (!silent) setLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadData(true)
    }, [loadData])

    // =========================================================================
    // CÁLCULOS Y FILTRADO
    // =========================================================================

    const cuentasConEstado = useMemo(() => {
        return cuentas.map(c => {
            const saldo = Number(c.saldo_pendiente_usd !== undefined ? c.saldo_pendiente_usd : c.saldoPendiente || 0)
            const fechaVence = c.fecha_vencimiento || c.fechaVencimiento
            const estadoInfo = getEstadoVencimiento(fechaVence, saldo)

            return {
                ...c,
                id: c.id,
                nombre: c.proveedor_nombre || c.nombre || 'Proveedor Desconocido',
                rif: c.proveedor_rif || '',
                factura: c.numero_factura || `FAC-${c.id}`,
                control: c.numero_control || 'N/A',
                fechaEmision: c.fecha_emision || c.fecha || 'N/A',
                fechaVencimiento: fechaVence || 'N/A',
                montoOriginal: Number(c.monto_total_usd !== undefined ? c.monto_total_usd : c.montoOriginal || 0),
                saldoPendiente: saldo,
                retencionIvaBs: Number(c.retencion_iva_monto_bs || 0),
                retencionPorcentaje: Number(c.retencion_iva_porcentaje || 0),
                comprobanteRetencion: c.comprobante_retencion || '',
                historialPagos: Array.isArray(c.historial_pagos)
                    ? c.historial_pagos
                    : (typeof c.historial_pagos_json === 'string' && c.historial_pagos_json.startsWith('[')
                        ? JSON.parse(c.historial_pagos_json)
                        : []),
                ...estadoInfo
            }
        })
    }, [cuentas])

    const filteredCuentas = useMemo(() => {
        return cuentasConEstado.filter(c => {
            const matchSearch =
                c.nombre.toLowerCase().includes(search.toLowerCase()) ||
                c.rif.toLowerCase().includes(search.toLowerCase()) ||
                c.factura.toLowerCase().includes(search.toLowerCase()) ||
                c.control.toLowerCase().includes(search.toLowerCase())

            if (!matchSearch) return false

            if (filterEstado === 'pendientes') return c.saldoPendiente > 0
            if (filterEstado === 'criticos') return c.saldoPendiente > 0 && c.estado === 'critico'
            if (filterEstado === 'pagados') return c.saldoPendiente <= 0 || c.estado === 'pagado'
            return true
        })
    }, [cuentasConEstado, search, filterEstado])

    const resumen = useMemo(() => {
        const pendientes = cuentasConEstado.filter(c => c.saldoPendiente > 0)
        return {
            totalPendiente: pendientes.reduce((sum, c) => sum + c.saldoPendiente, 0),
            totalPagado: cuentasConEstado.reduce((sum, c) => sum + (c.montoOriginal - c.saldoPendiente), 0),
            critico: pendientes.filter(c => c.estado === 'critico').length,
            proximo: pendientes.filter(c => c.estado === 'proximo').length,
            alDia: pendientes.filter(c => c.estado === 'al-dia').length,
            totalCuentas: cuentasConEstado.length
        }
    }, [cuentasConEstado])

    // =========================================================================
    // HANDLERS NUEVA FACTURA DE PROVEEDOR
    // =========================================================================

    const handleOpenNewCuenta = () => {
        const hoy = new Date()
        const fechaEmision = hoy.toISOString().split('T')[0]
        const vence = new Date(hoy)
        vence.setDate(vence.getDate() + 15)
        const fechaVencimiento = vence.toISOString().split('T')[0]

        setCuentaForm({
            proveedorNombre: '',
            proveedorRifPrefix: 'J-',
            proveedorRifNumero: '',
            numeroFactura: '',
            numeroControl: '',
            fechaEmision,
            fechaVencimiento,
            montoExentoUsd: 0,
            baseImponibleUsd: 0,
            ivaUsd: 0,
            montoTotalUsd: 0,
            notas: ''
        })
        setShowNewCuentaModal(true)
    }

    const handleCuentaMountsChange = (campo, valor) => {
        const num = Math.max(0, parseFloat(valor) || 0)
        setCuentaForm(prev => {
            const next = { ...prev, [campo]: num }
            if (campo === 'baseImponibleUsd') {
                next.ivaUsd = parseFloat((num * 0.16).toFixed(2))
            }
            next.montoTotalUsd = parseFloat(((next.montoExentoUsd || 0) + (next.baseImponibleUsd || 0) + (next.ivaUsd || 0)).toFixed(2))
            return next
        })
    }

    const handleSaveCuenta = async (e) => {
        e.preventDefault()
        if (!cuentaForm.proveedorNombre.trim()) {
            showToast('El nombre o razón social del proveedor es obligatorio', 'warning')
            return
        }
        if (!cuentaForm.proveedorRifNumero.trim()) {
            showToast('El RIF del proveedor es obligatorio', 'warning')
            return
        }
        if (!cuentaForm.numeroFactura.trim()) {
            showToast('Ingrese el número de factura del proveedor', 'warning')
            return
        }
        if (!cuentaForm.numeroControl.trim()) {
            showToast('Según el SENIAT (Prov. 00071), debe registrar el N° de Control de imprenta autorizada', 'warning')
            return
        }
        if (cuentaForm.montoTotalUsd <= 0) {
            showToast('El monto total debe ser mayor a 0', 'warning')
            return
        }

        const rifCompleto = `${cuentaForm.proveedorRifPrefix}${cuentaForm.proveedorRifNumero.trim().toUpperCase()}`
        const montoTotalUsd = cuentaForm.montoTotalUsd
        const montoTotalBs = parseFloat((montoTotalUsd * tasaBcv).toFixed(2))

        const payload = {
            id: `cxp_${Date.now()}`,
            proveedor_nombre: cuentaForm.proveedorNombre.trim().toUpperCase(),
            proveedor_rif: rifCompleto,
            numero_factura: cuentaForm.numeroFactura.trim().toUpperCase(),
            numero_control: cuentaForm.numeroControl.trim().toUpperCase(),
            fecha_emision: cuentaForm.fechaEmision,
            fecha_vencimiento: cuentaForm.fechaVencimiento,
            tasa_bcv_emision: tasaBcv,
            monto_exento_usd: cuentaForm.montoExentoUsd,
            base_imponible_usd: cuentaForm.baseImponibleUsd,
            iva_usd: cuentaForm.ivaUsd,
            monto_total_usd: montoTotalUsd,
            monto_total_bs: montoTotalBs,
            saldo_pendiente_usd: montoTotalUsd,
            saldo_pendiente_bs: montoTotalBs,
            retencion_iva_porcentaje: 0,
            retencion_iva_monto_bs: 0,
            comprobante_retencion: '',
            estado: 'pendiente',
            notas: cuentaForm.notas,
            historial_pagos: []
        }

        setLoading(true)
        try {
            const res = await gsService.upsertCuentaPagar(payload)
            if (res.success) {
                showToast('Factura de proveedor registrada en Cuentas por Pagar', 'success')
                setShowNewCuentaModal(false)
                setCuentas(gsService.getCuentasPagar() || [])
            } else {
                showToast(`Error: ${res.error || 'No se pudo guardar'}`, 'error')
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteCuenta = async (id, factura) => {
        if (!window.confirm(`¿Seguro que desea eliminar la cuenta por pagar Factura: "${factura}"?`)) return
        setLoading(true)
        try {
            const res = await gsService.deleteCuentaPagar(id)
            if (res.success) {
                showToast('Factura de proveedor eliminada', 'success')
                setCuentas(gsService.getCuentasPagar() || [])
            } else {
                showToast(`Error: ${res.error || 'No se pudo eliminar'}`, 'error')
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    // =========================================================================
    // HANDLERS PAGO A PROVEEDOR & RETENCIÓN DE IVA
    // =========================================================================

    const handleOpenPago = (cuenta) => {
        setSelectedCuenta(cuenta)
        setPagoForm({
            moneda: 'USD',
            monto: '',
            metodoPago: 'TRANSFERENCIA',
            aplicaRetencionIva: false,
            porcentajeRetencion: 75,
            numeroComprobanteRetencion: '',
            referencia: '',
            notas: ''
        })
        setShowPagoModal(true)
    }

    const montoIvaBsFactura = useMemo(() => {
        if (!selectedCuenta) return 0
        const ivaUsd = Number(selectedCuenta.iva_usd || (selectedCuenta.montoOriginal * 0.16 / 1.16) || 0)
        return parseFloat((ivaUsd * tasaBcv).toFixed(2))
    }, [selectedCuenta, tasaBcv])

    const retencionIvaCalculadaBs = useMemo(() => {
        if (!pagoForm.aplicaRetencionIva) return 0
        const factor = (Number(pagoForm.porcentajeRetencion) || 75) / 100
        return parseFloat((montoIvaBsFactura * factor).toFixed(2))
    }, [pagoForm.aplicaRetencionIva, pagoForm.porcentajeRetencion, montoIvaBsFactura])

    const retencionIvaCalculadaUsd = useMemo(() => {
        if (!retencionIvaCalculadaBs || tasaBcv <= 0) return 0
        return parseFloat((retencionIvaCalculadaBs / tasaBcv).toFixed(2))
    }, [retencionIvaCalculadaBs, tasaBcv])

    const handleSubmitPago = async (e) => {
        e.preventDefault()
        if (!selectedCuenta) return

        const montoInput = parseFloat(pagoForm.monto) || 0
        if (montoInput <= 0 && (!pagoForm.aplicaRetencionIva || retencionIvaCalculadaBs <= 0)) {
            showToast('Ingrese un monto de pago o aplique retención de IVA', 'warning')
            return
        }

        if (pagoForm.aplicaRetencionIva && !pagoForm.numeroComprobanteRetencion.trim()) {
            showToast('Ingrese el número de comprobante de retención emitido según el SENIAT', 'warning')
            return
        }

        const montoPagadoUsd = pagoForm.moneda === 'USD'
            ? montoInput
            : parseFloat((montoInput / tasaBcv).toFixed(2))
        const montoPagadoBs = pagoForm.moneda === 'BS'
            ? montoInput
            : parseFloat((montoInput * tasaBcv).toFixed(2))

        const totalDeduccionUsd = montoPagadoUsd + retencionIvaCalculadaUsd

        if (totalDeduccionUsd > selectedCuenta.saldoPendiente + 0.05) {
            showToast(`El total pagado excede el saldo pendiente ($${formatCurrency(selectedCuenta.saldoPendiente)})`, 'warning')
            return
        }

        const payloadPago = {
            cuenta_id: selectedCuenta.id,
            monto_pago_usd: montoPagadoUsd,
            monto_pago_bs: montoPagadoBs,
            metodo_pago: pagoForm.metodoPago,
            moneda_pago: pagoForm.moneda,
            tasa_bcv: tasaBcv,
            referencia: pagoForm.referencia.trim().toUpperCase(),
            retencion_iva: pagoForm.aplicaRetencionIva ? {
                porcentaje: pagoForm.porcentajeRetencion,
                monto_bs: retencionIvaCalculadaBs,
                monto_usd: retencionIvaCalculadaUsd,
                comprobante: pagoForm.numeroComprobanteRetencion.trim().toUpperCase()
            } : null,
            notas: pagoForm.notas.trim()
        }

        setLoading(true)
        try {
            const res = await gsService.registrarPagoPagar(payloadPago)
            if (res.success) {
                showToast('Pago y retención a proveedor registrados con éxito', 'success')
                setShowPagoModal(false)
                setCuentas(gsService.getCuentasPagar() || [])
            } else {
                showToast(`Error: ${res.error || 'No se pudo registrar el pago'}`, 'error')
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const renderBadge = (cuenta) => {
        const { clasificacion, diasRestantes, estado } = cuenta

        if (estado === 'pagado') {
            return (
                <span style={{ ...badgeStyle, background: 'rgba(0,230,118,0.15)', color: 'var(--s-neon)', borderColor: 'rgba(0,230,118,0.3)' }}>
                    <CheckCircle size={12} />
                    PAGADO
                </span>
            )
        }

        const showDias = diasRestantes !== null && diasRestantes !== undefined
        const diasLabel = showDias
            ? diasRestantes < 0
                ? `${Math.abs(diasRestantes)} DÍAS VENCIDO`
                : `${diasRestantes} DÍAS`
            : ''

        return (
            <span style={{ ...badgeStyle, background: clasificacion?.bg || 'rgba(255,255,255,0.05)', color: clasificacion?.color || '#fff', borderColor: clasificacion?.border || 'rgba(255,255,255,0.1)' }}>
                {estado === 'critico' ? <AlertCircle size={12} /> : <Clock size={12} />}
                {clasificacion?.label || 'PENDIENTE'}
                {showDias && diasRestantes <= 7 && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', opacity: 0.85 }}>
                        ({diasLabel})
                    </span>
                )}
            </span>
        )
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '1rem' }}>
            
            {/* ENCABEZADO */}
            <div className="s-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(255,107,107,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,107,107,0.3)'
                    }}>
                        <UserMinus size={26} style={{ color: '#ff6b6b' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em', margin: 0 }}>
                            CUENTAS POR PAGAR (PROVEEDORES)
                        </h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)', letterSpacing: '0.05em' }}>
                            NORMATIVA SENIAT • N° CONTROL IMPRENTA FISCAL • RETENCIÓN IVA • TASA BCV: Bs {tasaBcv.toFixed(2)}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => loadData()}
                        disabled={isRefreshing}
                        className="s-btn"
                        style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--s-glass-border)' }}
                        title="Refrescar datos"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenNewCuenta}
                        className="s-btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 900,
                            padding: '0.65rem 1.25rem',
                            background: '#ff6b6b',
                            color: '#000',
                            border: 'none',
                            borderRadius: '10px'
                        }}
                    >
                        <Plus size={18} />
                        NUEVA FACTURA PROVEEDOR
                    </button>
                </div>
            </div>

            {/* BARRA DE HERRAMIENTAS Y RESUMEN */}
            <div className="s-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#ff6b6b' }} />
                    <input
                        name="buscar"
                        type="text"
                        className="s-input"
                        placeholder="Buscar proveedor, RIF, N° Factura o Control..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: '3rem', width: '100%', borderColor: 'rgba(255,107,107,0.3)' }}
                    />
                </div>

                {/* FILTROS RÁPIDOS */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[
                        { id: 'todos', label: 'TODAS' },
                        { id: 'pendientes', label: 'PENDIENTES' },
                        { id: 'criticos', label: 'CRÍTICOS' },
                        { id: 'pagados', label: 'PAGADAS' }
                    ].map(fil => (
                        <button
                            key={fil.id}
                            type="button"
                            onClick={() => setFilterEstado(fil.id)}
                            style={{
                                padding: '0.5rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: filterEstado === fil.id ? '1px solid #ff6b6b' : '1px solid var(--s-glass-border)',
                                background: filterEstado === fil.id ? 'rgba(255,107,107,0.1)' : 'transparent',
                                color: filterEstado === fil.id ? '#ff6b6b' : '#888',
                                cursor: 'pointer'
                            }}
                        >
                            {fil.label}
                        </button>
                    ))}
                </div>

                {/* CARDS DE RESUMEN */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="s-panel" style={{ padding: '0.6rem 1rem', minWidth: '130px' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block' }}>TOTAL POR PAGAR</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff6b6b' }}>{formatCurrency(resumen.totalPendiente)}</span>
                        <span style={{ fontSize: '0.65rem', color: '#888', display: 'block' }}>Bs {formatCurrency(resumen.totalPendiente * tasaBcv)}</span>
                    </div>
                    <div className="s-panel" style={{ padding: '0.6rem 1rem', minWidth: '90px', borderColor: 'rgba(255,49,49,0.3)' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block' }}>CRÍTICOS</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff3131' }}>{resumen.critico}</span>
                    </div>
                    <div className="s-panel" style={{ padding: '0.6rem 1rem', minWidth: '90px', borderColor: 'rgba(255,193,7,0.3)' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block' }}>PRÓXIMOS</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffc107' }}>{resumen.proximo}</span>
                    </div>
                </div>
            </div>

            {/* TABLA DE CUENTAS POR PAGAR */}
            <div className="s-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="s-scroll" style={{ flex: 1, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#0d121c', zIndex: 1 }}>
                            <tr>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Receipt size={14} /> FACTURA / N° CONTROL</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Building2 size={14} /> PROVEEDOR (RIF)</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> EMISIÓN</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> VENCE</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><DollarSign size={14} /> MONTO ORIGINAL</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> SALDO PENDIENTE</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Percent size={14} /> RET. IVA APLICADA</div></th>
                                <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertCircle size={14} /> ESTADO</div></th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCuentas.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--s-text-dim)' }}>
                                        No se encontraron facturas de proveedores registradas con este criterio.
                                    </td>
                                </tr>
                            ) : (
                                filteredCuentas.map((cuenta) => (
                                    <tr key={cuenta.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        background: cuenta.estado === 'critico' ? 'rgba(255,49,49,0.04)' : cuenta.estado === 'proximo' ? 'rgba(255,193,7,0.02)' : 'transparent'
                                    }}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 800, color: '#fff' }}>{cuenta.factura}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#ff6b6b', opacity: 0.9 }}>Ctrl SENIAT: {cuenta.control}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 800, color: '#fff' }}>{cuenta.nombre}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#888' }}>{cuenta.rif || 'Sin RIF'}</div>
                                        </td>
                                        <td style={tdStyle}>{cuenta.fechaEmision}</td>
                                        <td style={{ ...tdStyle, color: cuenta.estado === 'critico' ? '#ff3131' : cuenta.estado === 'proximo' ? '#ffc107' : 'var(--s-text-primary)' }}>
                                            {cuenta.fechaVencimiento}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 700 }}>${formatCurrency(cuenta.montoOriginal)}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#888' }}>Bs {formatCurrency(cuenta.montoOriginal * tasaBcv)}</div>
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: 800, color: cuenta.saldoPendiente > 0 ? '#ff6b6b' : '#888' }}>
                                            <div>${formatCurrency(cuenta.saldoPendiente)}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Bs {formatCurrency(cuenta.saldoPendiente * tasaBcv)}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            {cuenta.retencionIvaBs > 0 ? (
                                                <div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#00e5ff', background: 'rgba(0,229,255,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                        {cuenta.retencionPorcentaje}% • Bs {formatCurrency(cuenta.retencionIvaBs)}
                                                    </span>
                                                    {cuenta.comprobanteRetencion && (
                                                        <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '0.2rem' }}>Comp: {cuenta.comprobanteRetencion}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: '#666' }}>No aplica</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>{renderBadge(cuenta)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                {cuenta.saldoPendiente > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenPago(cuenta)}
                                                        style={{
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '6px',
                                                            background: 'rgba(255,107,107,0.15)',
                                                            border: '1px solid rgba(255,107,107,0.3)',
                                                            color: '#ff6b6b',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                        title="Registrar Pago a Proveedor"
                                                    >
                                                        <DollarSign size={13} />
                                                        PAGAR
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCuenta(cuenta)
                                                        setShowHistorialModal(true)
                                                    }}
                                                    style={{
                                                        padding: '0.35rem 0.5rem',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--s-glass-border)',
                                                        color: '#aaa',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Ver Historial de Pagos"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteCuenta(cuenta.id, cuenta.factura)}
                                                    style={{
                                                        padding: '0.35rem 0.5rem',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,49,49,0.1)',
                                                        border: '1px solid rgba(255,49,49,0.2)',
                                                        color: '#ff3131',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Eliminar Cuenta"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL: NUEVA FACTURA DE PROVEEDOR (SENIAT) */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showNewCuentaModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={modalOverlayStyle}
                        onClick={() => setShowNewCuentaModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...modalBoxStyle, width: '44rem', borderColor: '#ff6b6b' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <Receipt size={22} style={{ color: '#ff6b6b' }} />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                            REGISTRO DE FACTURA DE COMPRA (PROVEEDOR)
                                        </h3>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                            PROVIDENCIA SENIAT 00071 • N° CONTROL FISCAL DE IMPRENTA
                                        </span>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowNewCuentaModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSaveCuenta} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>RAZÓN SOCIAL / NOMBRE DEL PROVEEDOR</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.proveedorNombre}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, proveedorNombre: e.target.value }))}
                                            placeholder="Ej: DISTRIBUIDORA POLAR C.A."
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>RIF DEL PROVEEDOR</label>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <select
                                                value={cuentaForm.proveedorRifPrefix}
                                                onChange={(e) => setCuentaForm(prev => ({ ...prev, proveedorRifPrefix: e.target.value }))}
                                                className="s-input"
                                                style={{ width: '70px', fontWeight: 900 }}
                                            >
                                                <option value="J-">J-</option>
                                                <option value="V-">V-</option>
                                                <option value="G-">G-</option>
                                                <option value="E-">E-</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={cuentaForm.proveedorRifNumero}
                                                onChange={(e) => setCuentaForm(prev => ({ ...prev, proveedorRifNumero: e.target.value.replace(/[^0-9]/g, '') }))}
                                                placeholder="12345678-0"
                                                className="s-input"
                                                style={{ flex: 1 }}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={labelStyle}>N° DE FACTURA PROVEEDOR</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.numeroFactura}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, numeroFactura: e.target.value }))}
                                            placeholder="0012345"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>N° CONTROL SENIAT</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.numeroControl}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, numeroControl: e.target.value }))}
                                            placeholder="00-001234"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>FECHA DE EMISIÓN</label>
                                        <input
                                            type="date"
                                            value={cuentaForm.fechaEmision}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, fechaEmision: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>FECHA DE VENCIMIENTO</label>
                                        <input
                                            type="date"
                                            value={cuentaForm.fechaVencimiento}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* DESGLOSE SENIAT */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--s-glass-border)' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ff6b6b', display: 'block', marginBottom: '0.75rem' }}>
                                        DESGLOSE IMPOSITIVO SENIAT DE LA COMPRA (USD)
                                    </span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={labelStyle}>MONTO EXENTO ($)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={cuentaForm.montoExentoUsd}
                                                onChange={(e) => handleCuentaMountsChange('montoExentoUsd', e.target.value)}
                                                className="s-input"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>BASE IMPONIBLE 16% ($)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={cuentaForm.baseImponibleUsd}
                                                onChange={(e) => handleCuentaMountsChange('baseImponibleUsd', e.target.value)}
                                                className="s-input"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>CRÉDITO FISCAL IVA 16% ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={cuentaForm.ivaUsd}
                                                readOnly
                                                className="s-input"
                                                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: '#ff6b6b' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#ccc' }}>TOTAL COMPRA A PAGAR:</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ff6b6b' }}>
                                                ${formatCurrency(cuentaForm.montoTotalUsd)}
                                            </span>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#888' }}>
                                                Bs {formatCurrency(cuentaForm.montoTotalUsd * tasaBcv)} (Tasa BCV: {tasaBcv.toFixed(2)})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowNewCuentaModal(false)} className="s-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                        CANCELAR
                                    </button>
                                    <button type="submit" disabled={loading} className="s-btn" style={{ background: '#ff6b6b', color: '#000', fontWeight: 900 }}>
                                        {loading ? 'GUARDANDO...' : 'REGISTRAR FACTURA'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* MODAL: REGISTRAR PAGO A PROVEEDOR Y RETENCIÓN IVA */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showPagoModal && selectedCuenta && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={modalOverlayStyle}
                        onClick={() => setShowPagoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...modalBoxStyle, width: '42rem', borderColor: '#ff6b6b' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <DollarSign size={22} style={{ color: '#ff6b6b' }} />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                            REGISTRAR PAGO A PROVEEDOR
                                        </h3>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                            Factura: {selectedCuenta.factura} • Control: {selectedCuenta.control} • Proveedor: {selectedCuenta.nombre}
                                        </span>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowPagoModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSubmitPago} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                {/* PANEL DE SALDO ACTUAL */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.25)', padding: '1rem', borderRadius: '12px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--s-text-dim)', display: 'block' }}>SALDO PENDIENTE ACTUAL</span>
                                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ff6b6b' }}>${formatCurrency(selectedCuenta.saldoPendiente)}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#aaa', display: 'block' }}>Bs {formatCurrency(selectedCuenta.saldoPendiente * tasaBcv)}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--s-text-dim)', display: 'block' }}>TASA BCV VIGENTE</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Bs {tasaBcv.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>MONEDA DE PAGO</label>
                                        <select
                                            value={pagoForm.moneda}
                                            onChange={(e) => setPagoForm(prev => ({ ...prev, moneda: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%', fontWeight: 800 }}
                                        >
                                            <option value="USD">Dólares ($ USD)</option>
                                            <option value="BS">Bolívares (Bs)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={labelStyle}>MONTO A PAGAR</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = pagoForm.moneda === 'USD'
                                                        ? selectedCuenta.saldoPendiente
                                                        : parseFloat((selectedCuenta.saldoPendiente * tasaBcv).toFixed(2))
                                                    setPagoForm(prev => ({ ...prev, monto: val.toString() }))
                                                }}
                                                style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontWeight: 800 }}
                                            >
                                                PAGAR SALDO TOTAL
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={pagoForm.monto}
                                            onChange={(e) => setPagoForm(prev => ({ ...prev, monto: e.target.value }))}
                                            placeholder={`Ingrese monto en ${pagoForm.moneda}`}
                                            className="s-input"
                                            style={{ width: '100%', fontSize: '1.1rem', fontWeight: 800 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>MÉTODO DE PAGO</label>
                                        <select
                                            value={pagoForm.metodoPago}
                                            onChange={(e) => setPagoForm(prev => ({ ...prev, metodoPago: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        >
                                            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                                            <option value="PAGO_MOVIL">Pago Móvil</option>
                                            <option value="EFECTIVO_USD">Efectivo USD</option>
                                            <option value="EFECTIVO_BS">Efectivo Bs</option>
                                            <option value="PUNTO_DEBITO">Punto Débito</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>N° DE REFERENCIA / CONFIRMACIÓN</label>
                                        <input
                                            type="text"
                                            value={pagoForm.referencia}
                                            onChange={(e) => setPagoForm(prev => ({ ...prev, referencia: e.target.value }))}
                                            placeholder="Referencia bancaria..."
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                {/* RETENCIÓN DE IVA AL PROVEEDOR */}
                                <div style={{
                                    background: pagoForm.aplicaRetencionIva ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)',
                                    border: pagoForm.aplicaRetencionIva ? '1px solid rgba(0,229,255,0.3)' : '1px solid var(--s-glass-border)',
                                    borderRadius: '12px',
                                    padding: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={pagoForm.aplicaRetencionIva}
                                                onChange={(e) => setPagoForm(prev => ({ ...prev, aplicaRetencionIva: e.target.checked }))}
                                                style={{ width: '18px', height: '18px', accentColor: '#ff6b6b' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: pagoForm.aplicaRetencionIva ? '#00e5ff' : '#ccc' }}>
                                                ¿APLICAR RETENCIÓN DE IVA AL PROVEEDOR?
                                            </span>
                                        </label>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>PROVIDENCIA SENIAT 0049</span>
                                    </div>

                                    {pagoForm.aplicaRetencionIva && (
                                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                                <div>
                                                    <label style={labelStyle}>% RETENCIÓN</label>
                                                    <select
                                                        value={pagoForm.porcentajeRetencion}
                                                        onChange={(e) => setPagoForm(prev => ({ ...prev, porcentajeRetencion: Number(e.target.value) }))}
                                                        className="s-input"
                                                        style={{ width: '100%' }}
                                                    >
                                                        <option value="75">75% (General)</option>
                                                        <option value="100">100% (Especial)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>N° COMPROBANTE DE RETENCIÓN EMITIDO</label>
                                                    <input
                                                        type="text"
                                                        value={pagoForm.numeroComprobanteRetencion}
                                                        onChange={(e) => setPagoForm(prev => ({ ...prev, numeroComprobanteRetencion: e.target.value }))}
                                                        placeholder="Ej: 20260400000001"
                                                        className="s-input"
                                                        style={{ width: '100%' }}
                                                        required={pagoForm.aplicaRetencionIva}
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                <span style={{ color: '#aaa' }}>Monto Retenido que se descuenta del pago al proveedor:</span>
                                                <span style={{ fontWeight: 900, color: '#00e5ff' }}>
                                                    Bs {formatCurrency(retencionIvaCalculadaBs)} (${formatCurrency(retencionIvaCalculadaUsd)})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowPagoModal(false)} className="s-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                        CANCELAR
                                    </button>
                                    <button type="submit" disabled={loading} className="s-btn" style={{ background: '#ff6b6b', color: '#000', fontWeight: 900 }}>
                                        {loading ? 'PROCESANDO...' : 'CONFIRMAR PAGO'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* MODAL: HISTORIAL DE PAGOS AL PROVEEDOR */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showHistorialModal && selectedCuenta && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={modalOverlayStyle}
                        onClick={() => setShowHistorialModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...modalBoxStyle, width: '40rem', borderColor: '#ff6b6b' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                        HISTORIAL DE PAGOS AL PROVEEDOR
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: '#ff6b6b' }}>
                                        {selectedCuenta.factura} • Ctrl: {selectedCuenta.control} • {selectedCuenta.nombre}
                                    </span>
                                </div>
                                <button type="button" onClick={() => setShowHistorialModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', color: '#888', display: 'block' }}>MONTO ORIGINAL COMPRA</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>${formatCurrency(selectedCuenta.montoOriginal)}</span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', color: '#888', display: 'block' }}>SALDO PENDIENTE</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff6b6b' }}>${formatCurrency(selectedCuenta.saldoPendiente)}</span>
                                    </div>
                                </div>

                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    {(!selectedCuenta.historialPagos || selectedCuenta.historialPagos.length === 0) ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#777' }}>
                                            No se han registrado pagos previos para esta factura de proveedor.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedCuenta.historialPagos.map((pago, idx) => (
                                                <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 800, color: '#fff' }}>
                                                            {pago.fecha ? pago.fecha.split('T')[0] : 'Fecha N/A'} • {pago.metodo_pago || 'Pago'}
                                                        </span>
                                                        <span style={{ fontWeight: 900, color: '#ff6b6b' }}>
                                                            -${formatCurrency(pago.monto_pago_usd || 0)}
                                                        </span>
                                                    </div>
                                                    {pago.retencion_iva && (
                                                        <div style={{ fontSize: '0.7rem', color: '#00e5ff', marginTop: '0.2rem' }}>
                                                            Ret. IVA {pago.retencion_iva.porcentaje}%: Bs {formatCurrency(pago.retencion_iva.monto_bs)} • Comp: {pago.retencion_iva.comprobante}
                                                        </div>
                                                    )}
                                                    {pago.referencia && (
                                                        <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.1rem' }}>
                                                            Ref: {pago.referencia}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowHistorialModal(false)} className="s-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                        CERRAR
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    )
}

const thStyle = {
    padding: '1rem',
    textAlign: 'left',
    fontSize: '0.7rem',
    fontWeight: 900,
    color: 'var(--s-text-dim)',
    borderBottom: '1px solid var(--s-glass-border)',
}

const tdStyle = {
    padding: '0.9rem 1rem',
    fontSize: '0.82rem',
    color: 'var(--s-text-primary)'
}

const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 800,
    border: '1px solid'
}

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.8)',
    zIndex: 10000,
    backdropFilter: 'blur(5px)',
    padding: '1rem'
}

const modalBoxStyle = {
    background: '#121824',
    borderRadius: '16px',
    border: '1px solid #ff6b6b',
    boxShadow: '0 0 40px rgba(255,107,107,0.15)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    overflowY: 'auto'
}

const modalHeaderStyle = {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#0d121c'
}

const closeBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer'
}

const labelStyle = {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--s-text-dim)',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '0.35rem'
}

export default CuentasPorPagar