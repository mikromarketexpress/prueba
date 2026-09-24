import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Search,
    UserPlus,
    FileText,
    DollarSign,
    Calendar,
    AlertCircle,
    CheckCircle,
    Clock,
    Plus,
    Trash2,
    Edit2,
    Users,
    Receipt,
    Eye,
    CreditCard,
    ShieldCheck,
    RefreshCw,
    X,
    Filter,
    Percent,
    Building2,
    Phone,
    MapPin,
    Hash,
    Mail
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { gsService } from '../lib/googleSheetsService'
import { getEstadoVencimiento, formatCurrency } from '../lib/vencimientoUtils'
import { formatUSD, formatBS } from '../lib/financialUtils'

export const CuentasPorCobrar = () => {
    const { showToast } = useToast()

    // Pestaña activa: 'cuentas' o 'clientes'
    const [activeTab, setActiveTab] = useState('cuentas')

    // Datos sincronizados con Google Sheets
    const [cuentas, setCuentas] = useState(() => gsService.getCuentasCobrar() || [])
    const [clientes, setClientes] = useState(() => gsService.getClientes() || [])
    const [loading, setLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Búsqueda y Filtros
    const [search, setSearch] = useState('')
    const [filterEstado, setFilterEstado] = useState('todos') // 'todos' | 'pendientes' | 'criticos' | 'pagados'

    // Modales
    const [showNewCuentaModal, setShowNewCuentaModal] = useState(false)
    const [showAbonoModal, setShowAbonoModal] = useState(false)
    const [showHistorialModal, setShowHistorialModal] = useState(false)
    const [showClienteModal, setShowClienteModal] = useState(false)

    // Cuenta / Cliente seleccionado para modal
    const [selectedCuenta, setSelectedCuenta] = useState(null)
    const [selectedCliente, setSelectedCliente] = useState(null)

    // Formulario de Cliente
    const [clienteForm, setClienteForm] = useState({
        id: '',
        rifPrefix: 'V-',
        rifNumero: '',
        nombre: '',
        tipoPersona: 'NATURAL',
        tipoContribuyente: 'PERSONA_NATURAL',
        direccion: '',
        telefono: '',
        email: '',
        limiteCredito: 100,
        diasCredito: 15,
        estado: 'activo'
    })

    // Formulario de Nueva Cuenta por Cobrar
    const [cuentaForm, setCuentaForm] = useState({
        clienteId: '',
        clienteNombre: '',
        clienteRif: '',
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

    const [clienteModalQuery, setClienteModalQuery] = useState('')
    const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false)

    // Formulario de Abono
    const [abonoForm, setAbonoForm] = useState({
        moneda: 'USD', // 'USD' | 'BS'
        monto: '',
        metodoPago: 'EFECTIVO_USD',
        aplicaRetencionIva: false,
        porcentajeRetencion: 75,
        numeroComprobanteRetencion: '',
        referencia: '',
        notas: ''
    })

    // Tasa BCV
    const tasaBcv = gsService.getTasaBcv() || 1

    // Cargar datos al montar y refrescar
    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        setIsRefreshing(true)
        try {
            await gsService.refresh()
            setCuentas(gsService.getCuentasCobrar() || [])
            setClientes(gsService.getClientes() || [])
        } catch (err) {
            console.error('[CuentasPorCobrar] Error cargando datos:', err)
        } finally {
            if (!silent) setLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadData(true)
    }, [loadData])

    // =========================================================================
    // CÁLCULOS Y FILTRADO DE CUENTAS POR COBRAR
    // =========================================================================

    const cuentasConEstado = useMemo(() => {
        return cuentas.map(c => {
            const saldo = Number(c.saldo_pendiente_usd !== undefined ? c.saldo_pendiente_usd : c.saldoPendiente || 0)
            const fechaVence = c.fecha_vencimiento || c.fechaVencimiento
            const estadoInfo = getEstadoVencimiento(fechaVence, saldo)

            return {
                ...c,
                id: c.id,
                nombre: c.cliente_nombre || c.nombre || 'Cliente General',
                rif: c.cliente_rif || '',
                factura: c.numero_factura || `FAC-${c.id}`,
                control: c.numero_control || 'N/A',
                fechaEmision: c.fecha_emision || c.fecha || 'N/A',
                fechaVencimiento: fechaVence || 'N/A',
                montoOriginal: Number(c.monto_total_usd !== undefined ? c.monto_total_usd : c.montoOriginal || 0),
                saldoPendiente: saldo,
                retencionIvaBs: Number(c.retencion_iva_monto_bs || 0),
                retencionPorcentaje: Number(c.retencion_iva_porcentaje || 0),
                comprobanteRetencion: c.comprobante_retencion || '',
                historialAbonos: Array.isArray(c.historial_abonos) 
                    ? c.historial_abonos 
                    : (typeof c.historial_abonos_json === 'string' && c.historial_abonos_json.startsWith('[')
                        ? JSON.parse(c.historial_abonos_json)
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
            totalCobrado: cuentasConEstado.reduce((sum, c) => sum + (c.montoOriginal - c.saldoPendiente), 0),
            critico: pendientes.filter(c => c.estado === 'critico').length,
            proximo: pendientes.filter(c => c.estado === 'proximo').length,
            alDia: pendientes.filter(c => c.estado === 'al-dia').length,
            totalCuentas: cuentasConEstado.length
        }
    }, [cuentasConEstado])

    // =========================================================================
    // FILTRADO DE CLIENTES
    // =========================================================================

    const filteredClientes = useMemo(() => {
        return clientes.filter(cl => {
            const term = search.toLowerCase()
            const nombre = (cl.nombre_razon_social || cl.nombre || cl.razon_social || '').toLowerCase()
            const rif = (cl.cedula_rif || '').toLowerCase()
            const tel = String(cl.telefono || '').toLowerCase()
            const email = (cl.email || '').toLowerCase()
            return nombre.includes(term) || rif.includes(term) || tel.includes(term) || email.includes(term)
        })
    }, [clientes, search])

    // =========================================================================
    // HANDLERS CLIENTES
    // =========================================================================

    const handleOpenNewCliente = () => {
        setSelectedCliente(null)
        setClienteForm({
            id: '',
            rifPrefix: 'V-',
            rifNumero: '',
            nombre: '',
            tipoPersona: 'NATURAL',
            tipoContribuyente: 'PERSONA_NATURAL',
            direccion: '',
            telefono: '',
            email: '',
            limiteCredito: 100,
            diasCredito: 15,
            estado: 'activo'
        })
        setShowClienteModal(true)
    }

    const handleOpenEditCliente = (cliente) => {
        setSelectedCliente(cliente)
        const rifFull = cliente.cedula_rif || ''
        const prefix = ['V-', 'J-', 'E-', 'G-'].find(p => rifFull.startsWith(p)) || 'V-'
        const numero = rifFull.replace(prefix, '')

        setClienteForm({
            id: cliente.id || '',
            rifPrefix: prefix,
            rifNumero: numero,
            nombre: cliente.nombre_razon_social || cliente.nombre || cliente.razon_social || '',
            tipoPersona: cliente.tipo_persona || (prefix === 'J-' || prefix === 'G-' ? 'JURIDICA' : 'NATURAL'),
            tipoContribuyente: cliente.tipo_contribuyente || 'PERSONA_NATURAL',
            direccion: cliente.direccion_fiscal || cliente.direccion || '',
            telefono: cliente.telefono || '',
            email: cliente.email || '',
            limiteCredito: Number(cliente.limite_credito_usd || 100),
            diasCredito: Number(cliente.dias_credito || 15),
            estado: cliente.estado || 'activo'
        })
        setShowClienteModal(true)
    }

    const handleSaveCliente = async (e) => {
        e.preventDefault()
        if (!clienteForm.nombre.trim()) {
            showToast('El nombre o razón social es obligatorio', 'warning')
            return
        }
        if (!clienteForm.rifNumero.trim()) {
            showToast('El número de Cédula/RIF es obligatorio', 'warning')
            return
        }

        const cedulaRif = `${clienteForm.rifPrefix}${clienteForm.rifNumero.trim().toUpperCase()}`
        const clientePayload = {
            id: clienteForm.id || `cli_${Date.now()}`,
            cedula_rif: cedulaRif,
            nombre_razon_social: clienteForm.nombre.trim().toUpperCase(),
            nombre: clienteForm.nombre.trim().toUpperCase(),
            tipo_persona: clienteForm.tipoPersona,
            tipo_contribuyente: clienteForm.tipoContribuyente,
            direccion_fiscal: clienteForm.direccion.trim().toUpperCase(),
            telefono: clienteForm.telefono.trim(),
            email: clienteForm.email.trim().toLowerCase(),
            limite_credito_usd: Number(clienteForm.limiteCredito) || 0,
            dias_credito: Number(clienteForm.diasCredito) || 15,
            saldo_actual_usd: selectedCliente?.saldo_actual_usd || 0,
            estado: clienteForm.estado || 'activo'
        }

        setLoading(true)
        try {
            const res = await gsService.upsertCliente(clientePayload)
            if (res.success) {
                showToast(selectedCliente ? 'Cliente actualizado correctamente' : 'Cliente registrado en la base de datos', 'success')
                setShowClienteModal(false)
                setClientes(gsService.getClientes() || [])
            } else {
                showToast(`Error al guardar cliente: ${res.error || 'Intente de nuevo'}`, 'error')
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteCliente = async (id, nombre) => {
        if (!window.confirm(`¿Seguro que desea eliminar al cliente "${nombre}"?`)) return
        setLoading(true)
        try {
            const res = await gsService.deleteCliente(id)
            if (res.success) {
                showToast('Cliente eliminado del directorio', 'success')
                setClientes(gsService.getClientes() || [])
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
    // HANDLERS NUEVA CUENTA POR COBRAR
    // =========================================================================

    const clientesFiltradosModal = useMemo(() => {
        if (!clienteModalQuery.trim()) return clientes.slice(0, 10)
        const q = clienteModalQuery.toLowerCase().trim()
        return clientes.filter(c => {
            const nom = (c.nombre_razon_social || c.nombre || c.razon_social || '').toLowerCase()
            const rif = (c.cedula_rif || '').toLowerCase()
            const tel = String(c.telefono || '').toLowerCase()
            return nom.includes(q) || rif.includes(q) || tel.includes(q)
        }).slice(0, 15)
    }, [clientes, clienteModalQuery])

    const handleOpenNewCuenta = () => {
        const hoy = new Date()
        const fechaEmision = hoy.toISOString().split('T')[0]
        const vence = new Date(hoy)
        vence.setDate(vence.getDate() + 15)
        const fechaVencimiento = vence.toISOString().split('T')[0]

        setClienteModalQuery('')
        setIsClienteDropdownOpen(false)

        setCuentaForm({
            clienteId: '',
            clienteNombre: '',
            clienteRif: '',
            numeroFactura: `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
            numeroControl: `00-${Math.floor(100000 + Math.random() * 900000)}`,
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

    const handleSelectClienteForCuenta = (cl) => {
        if (!cl) return

        const hoy = new Date(cuentaForm.fechaEmision || new Date())
        const dias = Number(cl.dias_credito || 15)
        hoy.setDate(hoy.getDate() + dias)

        const nom = cl.nombre_razon_social || cl.nombre || cl.razon_social || ''
        setCuentaForm(prev => ({
            ...prev,
            clienteId: cl.id,
            clienteNombre: nom,
            clienteRif: cl.cedula_rif || '',
            fechaVencimiento: hoy.toISOString().split('T')[0]
        }))
        setClienteModalQuery(`${cl.cedula_rif || ''} - ${nom}`)
        setIsClienteDropdownOpen(false)
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
        if (!cuentaForm.clienteNombre.trim()) {
            showToast('Seleccione o ingrese el cliente', 'warning')
            return
        }
        if (!cuentaForm.numeroFactura.trim()) {
            showToast('Ingrese el número de factura', 'warning')
            return
        }
        if (cuentaForm.montoTotalUsd <= 0) {
            showToast('El monto total debe ser mayor a 0', 'warning')
            return
        }

        const montoTotalUsd = cuentaForm.montoTotalUsd
        const montoTotalBs = parseFloat((montoTotalUsd * tasaBcv).toFixed(2))

        const payload = {
            id: `cxc_${Date.now()}`,
            cliente_id: cuentaForm.clienteId || '',
            cliente_nombre: cuentaForm.clienteNombre.trim().toUpperCase(),
            cliente_rif: cuentaForm.clienteRif.trim().toUpperCase(),
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
            historial_abonos: []
        }

        setLoading(true)
        try {
            const res = await gsService.upsertCuentaCobrar(payload)
            if (res.success) {
                showToast('Cuenta por cobrar registrada con éxito', 'success')
                setShowNewCuentaModal(false)
                setCuentas(gsService.getCuentasCobrar() || [])
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
        if (!window.confirm(`¿Seguro que desea eliminar la cuenta por cobrar Factura: "${factura}"?`)) return
        setLoading(true)
        try {
            const res = await gsService.deleteCuentaCobrar(id)
            if (res.success) {
                showToast('Cuenta por cobrar eliminada', 'success')
                setCuentas(gsService.getCuentasCobrar() || [])
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
    // HANDLERS ABONO Y RETENCIÓN IVA SENIAT
    // =========================================================================

    const handleOpenAbono = (cuenta) => {
        setSelectedCuenta(cuenta)
        setAbonoForm({
            moneda: 'USD',
            monto: '',
            metodoPago: 'EFECTIVO_USD',
            aplicaRetencionIva: false,
            porcentajeRetencion: 75,
            numeroComprobanteRetencion: '',
            referencia: '',
            notas: ''
        })
        setShowAbonoModal(true)
    }

    // Cálculo del monto máximo de retención de IVA según SENIAT
    const montoIvaBsFactura = useMemo(() => {
        if (!selectedCuenta) return 0
        const ivaUsd = Number(selectedCuenta.iva_usd || (selectedCuenta.montoOriginal * 0.16 / 1.16) || 0)
        return parseFloat((ivaUsd * tasaBcv).toFixed(2))
    }, [selectedCuenta, tasaBcv])

    const retencionIvaCalculadaBs = useMemo(() => {
        if (!abonoForm.aplicaRetencionIva) return 0
        const factor = (Number(abonoForm.porcentajeRetencion) || 75) / 100
        return parseFloat((montoIvaBsFactura * factor).toFixed(2))
    }, [abonoForm.aplicaRetencionIva, abonoForm.porcentajeRetencion, montoIvaBsFactura])

    const retencionIvaCalculadaUsd = useMemo(() => {
        if (!retencionIvaCalculadaBs || tasaBcv <= 0) return 0
        return parseFloat((retencionIvaCalculadaBs / tasaBcv).toFixed(2))
    }, [retencionIvaCalculadaBs, tasaBcv])

    const handleSubmitAbono = async (e) => {
        e.preventDefault()
        if (!selectedCuenta) return

        const montoInput = parseFloat(abonoForm.monto) || 0
        if (montoInput <= 0 && (!abonoForm.aplicaRetencionIva || retencionIvaCalculadaBs <= 0)) {
            showToast('Ingrese un monto de abono válido o aplique comprobante de retención', 'warning')
            return
        }

        if (abonoForm.aplicaRetencionIva && !abonoForm.numeroComprobanteRetencion.trim()) {
            showToast('Según el SENIAT, debe ingresar el N° de Comprobante de Retención', 'warning')
            return
        }

        // Convertir monto pagado a USD
        const montoPagadoUsd = abonoForm.moneda === 'USD' 
            ? montoInput 
            : parseFloat((montoInput / tasaBcv).toFixed(2))
        const montoPagadoBs = abonoForm.moneda === 'BS' 
            ? montoInput 
            : parseFloat((montoInput * tasaBcv).toFixed(2))

        const totalDeduccionUsd = montoPagadoUsd + retencionIvaCalculadaUsd

        if (totalDeduccionUsd > selectedCuenta.saldoPendiente + 0.05) {
            showToast(`El monto excede el saldo pendiente ($${formatCurrency(selectedCuenta.saldoPendiente)})`, 'warning')
            return
        }

        const payloadAbono = {
            cuenta_id: selectedCuenta.id,
            monto_abono_usd: montoPagadoUsd,
            monto_abono_bs: montoPagadoBs,
            metodo_pago: abonoForm.metodoPago,
            moneda_pago: abonoForm.moneda,
            tasa_bcv: tasaBcv,
            referencia: abonoForm.referencia.trim().toUpperCase(),
            retencion_iva: abonoForm.aplicaRetencionIva ? {
                porcentaje: abonoForm.porcentajeRetencion,
                monto_bs: retencionIvaCalculadaBs,
                monto_usd: retencionIvaCalculadaUsd,
                comprobante: abonoForm.numeroComprobanteRetencion.trim().toUpperCase()
            } : null,
            notas: abonoForm.notas.trim()
        }

        setLoading(true)
        try {
            const res = await gsService.registrarAbonoCobrar(payloadAbono)
            if (res.success) {
                showToast('Abono y retención fiscal registrados con éxito', 'success')
                setShowAbonoModal(false)
                setCuentas(gsService.getCuentasCobrar() || [])
            } else {
                showToast(`Error: ${res.error || 'No se pudo registrar abono'}`, 'error')
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    // =========================================================================
    // BADGE DE ESTADO FISCAL / VENCIMIENTO
    // =========================================================================

    const renderBadge = (cuenta) => {
        const { clasificacion, diasRestantes, estado } = cuenta

        if (estado === 'pagado') {
            return (
                <span style={{ ...badgeStyle, background: 'rgba(0,230,118,0.15)', color: 'var(--s-neon)', borderColor: 'rgba(0,230,118,0.3)' }}>
                    <CheckCircle size={12} />
                    COBRADO
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
            
            {/* ENCABEZADO CON TABS */}
            <div className="s-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(0,230,118,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(0,230,118,0.3)'
                    }}>
                        <UserPlus size={26} style={{ color: 'var(--s-neon)' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em', margin: 0 }}>
                            GESTIÓN FISCAL DE COBRANZAS & CLIENTES
                        </h1>
                        <span style={{ fontSize: '0.75rem', color: 'var(--s-text-dim)', letterSpacing: '0.05em' }}>
                            NORMATIVA SENIAT • PROVIDENCIA 00071 / 0049 • TASA BCV: Bs {tasaBcv.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* BOTONES DE PESTAÑAS */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#0a0d14', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--s-glass-border)' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cuentas')}
                        style={{
                            ...tabButtonStyle,
                            background: activeTab === 'cuentas' ? 'var(--s-neon)' : 'transparent',
                            color: activeTab === 'cuentas' ? '#000' : '#888',
                            fontWeight: 900
                        }}
                    >
                        <Receipt size={16} />
                        CUENTAS POR COBRAR ({cuentasConEstado.filter(c => c.saldoPendiente > 0).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('clientes')}
                        style={{
                            ...tabButtonStyle,
                            background: activeTab === 'clientes' ? 'var(--s-neon)' : 'transparent',
                            color: activeTab === 'clientes' ? '#000' : '#888',
                            fontWeight: 900
                        }}
                    >
                        <Users size={16} />
                        DIRECTORIO DE CLIENTES ({clientes.length})
                    </button>
                </div>
            </div>

            {/* SECCIÓN 1: VISTA DE CUENTAS POR COBRAR */}
            {activeTab === 'cuentas' && (
                <>
                    {/* BARRA DE HERRAMIENTAS Y RESUMEN */}
                    <div className="s-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)' }} />
                            <input
                                name="buscar"
                                type="text"
                                className="s-input"
                                placeholder="Buscar deudor, RIF, N° Factura o Control..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: '3rem', width: '100%' }}
                            />
                        </div>

                        {/* FILTROS RÁPIDOS */}
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {[
                                { id: 'todos', label: 'TODAS' },
                                { id: 'pendientes', label: 'PENDIENTES' },
                                { id: 'criticos', label: 'CRÍTICOS' },
                                { id: 'pagados', label: 'COBRADAS' }
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
                                        border: filterEstado === fil.id ? '1px solid var(--s-neon)' : '1px solid var(--s-glass-border)',
                                        background: filterEstado === fil.id ? 'rgba(0,230,118,0.1)' : 'transparent',
                                        color: filterEstado === fil.id ? 'var(--s-neon)' : '#888',
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
                                <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block' }}>TOTAL PENDIENTE</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--s-neon)' }}>{formatCurrency(resumen.totalPendiente)}</span>
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

                        {/* BOTÓN NUEVO CRÉDITO & REFRESCAR */}
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
                                className="s-btn s-btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900, padding: '0.65rem 1.25rem' }}
                            >
                                <Plus size={18} />
                                NUEVO CRÉDITO
                            </button>
                        </div>
                    </div>

                    {/* TABLA DE CUENTAS POR COBRAR */}
                    <div className="s-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div className="s-scroll" style={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#0d121c', zIndex: 1 }}>
                                    <tr>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Receipt size={14} /> FACTURA / CONTROL</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Users size={14} /> CLIENTE (RIF)</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> EMISIÓN</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> VENCE</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><DollarSign size={14} /> TOTAL FACTURA</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={14} /> SALDO PENDIENTE</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Percent size={14} /> RET. IVA SENIAT</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertCircle size={14} /> ESTADO</div></th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCuentas.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--s-text-dim)' }}>
                                                No se encontraron cuentas por cobrar registradas con este criterio.
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
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--s-neon)', opacity: 0.9 }}>Ctrl: {cuenta.control}</div>
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
                                                <td style={{ ...tdStyle, fontWeight: 800, color: cuenta.saldoPendiente > 0 ? 'var(--s-neon)' : '#888' }}>
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
                                                                onClick={() => handleOpenAbono(cuenta)}
                                                                style={{
                                                                    padding: '0.35rem 0.75rem',
                                                                    borderRadius: '6px',
                                                                    background: 'rgba(0,230,118,0.15)',
                                                                    border: '1px solid rgba(0,230,118,0.3)',
                                                                    color: 'var(--s-neon)',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 800,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem'
                                                                }}
                                                                title="Registrar Abono o Retención"
                                                            >
                                                                <DollarSign size={13} />
                                                                ABONAR
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
                                                            title="Ver Historial de Abonos"
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
                </>
            )}

            {/* SECCIÓN 2: DIRECTORIO DE CLIENTES */}
            {activeTab === 'clientes' && (
                <>
                    <div className="s-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)' }} />
                            <input
                                name="buscarCliente"
                                type="text"
                                className="s-input"
                                placeholder="Buscar cliente por Cédula, RIF, Nombre o Teléfono..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: '3rem', width: '100%' }}
                            />
                        </div>

                        <div className="s-panel" style={{ padding: '0.6rem 1.25rem', minWidth: '140px' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block' }}>TOTAL CLIENTES</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--s-neon)' }}>{clientes.length}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => loadData()}
                                disabled={isRefreshing}
                                className="s-btn"
                                style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--s-glass-border)' }}
                                title="Refrescar directorio"
                            >
                                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenNewCliente}
                                className="s-btn s-btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900, padding: '0.65rem 1.25rem' }}
                            >
                                <Plus size={18} />
                                REGISTRAR CLIENTE
                            </button>
                        </div>
                    </div>

                    {/* TABLA DE CLIENTES */}
                    <div className="s-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div className="s-scroll" style={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#0d121c', zIndex: 1 }}>
                                    <tr>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Hash size={14} /> CÉDULA / RIF</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Users size={14} /> NOMBRE / RAZÓN SOCIAL</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={14} /> CORREO FISCAL</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Building2 size={14} /> TIPO CONTRIBUYENTE</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14} /> CONTACTO</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={14} /> DIRECCIÓN FISCAL</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><DollarSign size={14} /> LÍMITE CRÉDITO</div></th>
                                        <th style={thStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={14} /> DÍAS CRÉDITO</div></th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClientes.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--s-text-dim)' }}>
                                                No hay clientes registrados que coincidan con la búsqueda.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredClientes.map((cl) => (
                                            <tr key={cl.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={tdStyle}>
                                                    <span style={{ fontWeight: 900, color: 'var(--s-neon)', background: 'rgba(0,230,118,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                        {cl.cedula_rif}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 800, color: '#fff' }}>
                                                        {cl.nombre_razon_social || cl.nombre || cl.razon_social || 'SIN NOMBRE'}
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    {cl.email ? (
                                                        <span style={{ color: '#00e5ff', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                            {cl.email}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#666', fontSize: '0.75rem' }}>N/A</span>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        background: cl.tipo_contribuyente === 'ESPECIAL' ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.05)',
                                                        color: cl.tipo_contribuyente === 'ESPECIAL' ? '#00e5ff' : '#ccc',
                                                        border: cl.tipo_contribuyente === 'ESPECIAL' ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.1)'
                                                    }}>
                                                        {cl.tipo_contribuyente === 'ESPECIAL' ? 'CONTRIB. ESPECIAL (RET. IVA)' : cl.tipo_contribuyente || 'PERSONA NATURAL'}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ color: '#fff' }}>{cl.telefono || 'Sin teléfono'}</div>
                                                </td>
                                                <td style={{ ...tdStyle, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {cl.direccion_fiscal || cl.direccion || 'Sin dirección registrada'}
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontWeight: 800, color: '#fff' }}>${formatCurrency(cl.limite_credito_usd || 0)}</span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ color: '#aaa' }}>{cl.dias_credito || 15} días</span>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditCliente(cl)}
                                                            style={{
                                                                padding: '0.35rem 0.5rem',
                                                                borderRadius: '6px',
                                                                background: 'rgba(255,255,255,0.05)',
                                                                border: '1px solid var(--s-glass-border)',
                                                                color: '#aaa',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Editar Cliente"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCliente(cl.id, cl.nombre_razon_social || cl.nombre || cl.razon_social)}
                                                            style={{
                                                                padding: '0.35rem 0.5rem',
                                                                borderRadius: '6px',
                                                                background: 'rgba(255,49,49,0.1)',
                                                                border: '1px solid rgba(255,49,49,0.2)',
                                                                color: '#ff3131',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Eliminar Cliente"
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
                </>
            )}

            {/* ========================================================================= */}
            {/* MODAL: REGISTRAR / EDITAR CLIENTE (SENIAT) */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showClienteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={modalOverlayStyle}
                        onClick={() => setShowClienteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...modalBoxStyle, width: '42rem' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <Users size={22} style={{ color: 'var(--s-neon)' }} />
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                        {selectedCliente ? 'EDITAR CLIENTE SENIAT' : 'REGISTRAR NUEVO CLIENTE SENIAT'}
                                    </h3>
                                </div>
                                <button type="button" onClick={() => setShowClienteModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSaveCliente} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>TIPO PERSONA</label>
                                        <select
                                            value={clienteForm.tipoPersona}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setClienteForm(prev => ({
                                                    ...prev,
                                                    tipoPersona: val,
                                                    rifPrefix: val === 'JURIDICA' ? 'J-' : 'V-'
                                                }))
                                            }}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        >
                                            <option value="NATURAL">Natural (V / E)</option>
                                            <option value="JURIDICA">Jurídica (J / G)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>CÉDULA / RIF (SENIAT)</label>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <select
                                                value={clienteForm.rifPrefix}
                                                onChange={(e) => setClienteForm(prev => ({ ...prev, rifPrefix: e.target.value }))}
                                                className="s-input"
                                                style={{ width: '70px', fontWeight: 900 }}
                                            >
                                                <option value="V-">V-</option>
                                                <option value="J-">J-</option>
                                                <option value="E-">E-</option>
                                                <option value="G-">G-</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={clienteForm.rifNumero}
                                                onChange={(e) => setClienteForm(prev => ({ ...prev, rifNumero: e.target.value.replace(/[^0-9]/g, '') }))}
                                                placeholder="Ej: 12345678"
                                                className="s-input"
                                                style={{ flex: 1 }}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>NOMBRE COMPLETO O RAZÓN SOCIAL</label>
                                    <input
                                        type="text"
                                        value={clienteForm.nombre}
                                        onChange={(e) => setClienteForm(prev => ({ ...prev, nombre: e.target.value }))}
                                        placeholder="Nombre registrado ante el SENIAT"
                                        className="s-input"
                                        style={{ width: '100%' }}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>TIPO DE CONTRIBUYENTE</label>
                                        <select
                                            value={clienteForm.tipoContribuyente}
                                            onChange={(e) => setClienteForm(prev => ({ ...prev, tipoContribuyente: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        >
                                            <option value="PERSONA_NATURAL">Persona Natural</option>
                                            <option value="ORDINARIO">Contribuyente Ordinario</option>
                                            <option value="ESPECIAL">Sujeto Pasivo Especial (Agente Retención IVA)</option>
                                            <option value="FORMAL">Contribuyente Formal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>TELÉFONO / CELULAR</label>
                                        <input
                                            type="text"
                                            value={clienteForm.telefono}
                                            onChange={(e) => setClienteForm(prev => ({ ...prev, telefono: e.target.value }))}
                                            placeholder="Ej: 0412-1234567"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>DIRECCIÓN FISCAL (EXIGENCIA SENIAT)</label>
                                    <input
                                        type="text"
                                        value={clienteForm.direccion}
                                        onChange={(e) => setClienteForm(prev => ({ ...prev, direccion: e.target.value }))}
                                        placeholder="Av, Calle, Local, Ciudad, Estado..."
                                        className="s-input"
                                        style={{ width: '100%' }}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>EMAIL FISCAL</label>
                                        <input
                                            type="email"
                                            value={clienteForm.email}
                                            onChange={(e) => setClienteForm(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="correo@empresa.com"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>LÍMITE DE CRÉDITO ($)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={clienteForm.limiteCredito}
                                            onChange={(e) => setClienteForm(prev => ({ ...prev, limiteCredito: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>DÍAS DE CRÉDITO</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="120"
                                            value={clienteForm.diasCredito}
                                            onChange={(e) => setClienteForm(prev => ({ ...prev, diasCredito: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button type="button" onClick={() => setShowClienteModal(false)} className="s-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                        CANCELAR
                                    </button>
                                    <button type="submit" disabled={loading} className="s-btn s-btn-primary" style={{ fontWeight: 900 }}>
                                        {loading ? 'GUARDANDO...' : 'GUARDAR CLIENTE'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* MODAL: NUEVA CUENTA POR COBRAR / FACTURA A CRÉDITO */}
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
                            style={{ ...modalBoxStyle, width: '44rem' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <Receipt size={22} style={{ color: 'var(--s-neon)' }} />
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                        NUEVA CUENTA POR COBRAR FISCAL
                                    </h3>
                                </div>
                                <button type="button" onClick={() => setShowNewCuentaModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSaveCuenta} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                <div style={{
                                    background: 'rgba(0,230,118,0.03)',
                                    padding: '0.85rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(0,230,118,0.2)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--s-neon)' }}>
                                            <Search size={15} />
                                            BUSCAR CLIENTE POR NOMBRE O CÉDULA
                                        </label>
                                        {clienteModalQuery && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setClienteModalQuery('');
                                                    setIsClienteDropdownOpen(false);
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                Limpiar
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ position: 'relative' }}>
                                        <Search size={17} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)', pointerEvents: 'none' }} />
                                        <input
                                            type="text"
                                            value={clienteModalQuery}
                                            onChange={(e) => {
                                                setClienteModalQuery(e.target.value);
                                                setIsClienteDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsClienteDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsClienteDropdownOpen(false), 200)}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setIsClienteDropdownOpen(false); }}
                                            placeholder="Escriba Cédula, RIF o Nombre para filtrar..."
                                            className="s-input"
                                            style={{
                                                width: '100%',
                                                paddingLeft: '2.6rem',
                                                paddingRight: '1rem',
                                                background: '#121212',
                                                border: '1px solid rgba(0,230,118,0.3)',
                                                color: '#fff',
                                                fontSize: '0.95rem',
                                                fontWeight: '700',
                                                borderRadius: '8px'
                                            }}
                                        />

                                        {/* LISTA FLOTANTE DE RESULTADOS */}
                                        {isClienteDropdownOpen && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '110%',
                                                    left: 0,
                                                    right: 0,
                                                    background: '#161d28',
                                                    border: '1px solid var(--s-neon)',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 12px 35px rgba(0,0,0,0.85)',
                                                    zIndex: 1000,
                                                    maxHeight: '220px',
                                                    overflowY: 'auto'
                                                }}
                                            >
                                                {clientesFiltradosModal.length === 0 ? (
                                                    <div style={{ padding: '0.85rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                                                        No se encontró cliente con ese criterio.
                                                    </div>
                                                ) : (
                                                    clientesFiltradosModal.map((c, idx) => {
                                                        const nom = c.nombre_razon_social || c.nombre || c.razon_social || 'SIN NOMBRE';
                                                        return (
                                                            <div
                                                                key={c.id || c.cedula_rif || idx}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleSelectClienteForCuenta(c);
                                                                }}
                                                                style={{
                                                                    padding: '0.7rem 0.9rem',
                                                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    transition: 'background 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,230,118,0.12)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{ fontWeight: 900, color: 'var(--s-neon)', fontSize: '0.9rem' }}>
                                                                            {c.cedula_rif}
                                                                        </span>
                                                                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                                                                            {nom}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.15rem' }}>
                                                                        {c.telefono ? `Tel: ${c.telefono} • ` : ''}Límite: ${c.limite_credito_usd || 100} USD • {c.dias_credito || 15} días
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    style={{
                                                                        background: 'rgba(0,230,118,0.15)',
                                                                        border: '1px solid var(--s-neon)',
                                                                        color: 'var(--s-neon)',
                                                                        padding: '0.25rem 0.6rem',
                                                                        borderRadius: '5px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Elegir
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>NOMBRE O RAZÓN SOCIAL</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.clienteNombre}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, clienteNombre: e.target.value }))}
                                            placeholder="Nombre del cliente"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>CÉDULA / RIF</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.clienteRif}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, clienteRif: e.target.value }))}
                                            placeholder="V-12345678"
                                            className="s-input"
                                            style={{ width: '100%' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={labelStyle}>N° FACTURA</label>
                                        <input
                                            type="text"
                                            value={cuentaForm.numeroFactura}
                                            onChange={(e) => setCuentaForm(prev => ({ ...prev, numeroFactura: e.target.value }))}
                                            placeholder="FAC-0001"
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
                                        <label style={labelStyle}>FECHA EMISIÓN</label>
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
                                        <label style={labelStyle}>FECHA VENCIMIENTO</label>
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
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--s-neon)', display: 'block', marginBottom: '0.75rem' }}>
                                        DESGLOSE IMPOSITIVO SENIAT (USD)
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
                                            <label style={labelStyle}>IVA 16% ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={cuentaForm.ivaUsd}
                                                readOnly
                                                className="s-input"
                                                style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--s-neon)' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#ccc' }}>TOTAL FACTURA:</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--s-neon)' }}>
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
                                    <button type="submit" disabled={loading} className="s-btn s-btn-primary" style={{ fontWeight: 900 }}>
                                        {loading ? 'GUARDANDO...' : 'REGISTRAR CRÉDITO'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* MODAL: REGISTRAR ABONO Y RETENCIÓN DE IVA SENIAT */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showAbonoModal && selectedCuenta && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={modalOverlayStyle}
                        onClick={() => setShowAbonoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...modalBoxStyle, width: '42rem' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <DollarSign size={22} style={{ color: 'var(--s-neon)' }} />
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                            REGISTRAR ABONO / COBRANZA
                                        </h3>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                            Factura: {selectedCuenta.factura} • Control: {selectedCuenta.control} • Cliente: {selectedCuenta.nombre}
                                        </span>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowAbonoModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSubmitAbono} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                {/* PANEL DE SALDO ACTUAL */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', padding: '1rem', borderRadius: '12px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--s-text-dim)', display: 'block' }}>SALDO PENDIENTE ACTUAL</span>
                                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--s-neon)' }}>${formatCurrency(selectedCuenta.saldoPendiente)}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#aaa', display: 'block' }}>Bs {formatCurrency(selectedCuenta.saldoPendiente * tasaBcv)}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--s-text-dim)', display: 'block' }}>TASA BCV VIGENTE</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Bs {tasaBcv.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* SELECCIÓN DE MONEDA Y MONTO DE ABONO */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>MONEDA DE PAGO</label>
                                        <select
                                            value={abonoForm.moneda}
                                            onChange={(e) => setAbonoForm(prev => ({ ...prev, moneda: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%', fontWeight: 800 }}
                                        >
                                            <option value="USD">Dólares ($ USD)</option>
                                            <option value="BS">Bolívares (Bs)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={labelStyle}>MONTO DEL ABONO</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const val = abonoForm.moneda === 'USD' 
                                                        ? selectedCuenta.saldoPendiente 
                                                        : parseFloat((selectedCuenta.saldoPendiente * tasaBcv).toFixed(2))
                                                    setAbonoForm(prev => ({ ...prev, monto: val.toString() }))
                                                }}
                                                style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--s-neon)', cursor: 'pointer', fontWeight: 800 }}
                                            >
                                                PAGAR SALDO TOTAL
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={abonoForm.monto}
                                            onChange={(e) => setAbonoForm(prev => ({ ...prev, monto: e.target.value }))}
                                            placeholder={`Ingrese monto en ${abonoForm.moneda}`}
                                            className="s-input"
                                            style={{ width: '100%', fontSize: '1.1rem', fontWeight: 800 }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={labelStyle}>FORMA DE PAGO</label>
                                        <select
                                            value={abonoForm.metodoPago}
                                            onChange={(e) => setAbonoForm(prev => ({ ...prev, metodoPago: e.target.value }))}
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        >
                                            <option value="EFECTIVO_USD">Efectivo USD</option>
                                            <option value="EFECTIVO_BS">Efectivo Bs</option>
                                            <option value="PAGO_MOVIL">Pago Móvil</option>
                                            <option value="PUNTO_DEBITO">Punto Débito</option>
                                            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                                            <option value="BIOPAGO">Biopago</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>N° REFERENCIA BANCARIA / RECIBO</label>
                                        <input
                                            type="text"
                                            value={abonoForm.referencia}
                                            onChange={(e) => setAbonoForm(prev => ({ ...prev, referencia: e.target.value }))}
                                            placeholder="Últimos 4 o 6 dígitos..."
                                            className="s-input"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                </div>

                                {/* RETENCIÓN DE IVA SENIAT */}
                                <div style={{
                                    background: abonoForm.aplicaRetencionIva ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)',
                                    border: abonoForm.aplicaRetencionIva ? '1px solid rgba(0,229,255,0.3)' : '1px solid var(--s-glass-border)',
                                    borderRadius: '12px',
                                    padding: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                                            <input
                                                type="checkbox"
                                                checked={abonoForm.aplicaRetencionIva}
                                                onChange={(e) => setAbonoForm(prev => ({ ...prev, aplicaRetencionIva: e.target.checked }))}
                                                style={{ width: '18px', height: '18px', accentColor: 'var(--s-neon)' }}
                                            />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: abonoForm.aplicaRetencionIva ? '#00e5ff' : '#ccc' }}>
                                                ¿APLICAR COMPROBANTE DE RETENCIÓN DE IVA SENIAT?
                                            </span>
                                        </label>
                                        <span style={{ fontSize: '0.7rem', color: '#888' }}>PROVIDENCIA 0049</span>
                                    </div>

                                    {abonoForm.aplicaRetencionIva && (
                                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                                <div>
                                                    <label style={labelStyle}>% RETENCIÓN</label>
                                                    <select
                                                        value={abonoForm.porcentajeRetencion}
                                                        onChange={(e) => setAbonoForm(prev => ({ ...prev, porcentajeRetencion: Number(e.target.value) }))}
                                                        className="s-input"
                                                        style={{ width: '100%' }}
                                                    >
                                                        <option value="75">75% (General)</option>
                                                        <option value="100">100% (Especial / Sin RIF)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>N° DE COMPROBANTE DE RETENCIÓN (SENIAT)</label>
                                                    <input
                                                        type="text"
                                                        value={abonoForm.numeroComprobanteRetencion}
                                                        onChange={(e) => setAbonoForm(prev => ({ ...prev, numeroComprobanteRetencion: e.target.value }))}
                                                        placeholder="Ej: 20260400000001"
                                                        className="s-input"
                                                        style={{ width: '100%' }}
                                                        required={abonoForm.aplicaRetencionIva}
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                <span style={{ color: '#aaa' }}>Monto Retención Fiscal IVA a deducir:</span>
                                                <span style={{ fontWeight: 900, color: '#00e5ff' }}>
                                                    Bs {formatCurrency(retencionIvaCalculadaBs)} (${formatCurrency(retencionIvaCalculadaUsd)})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setShowAbonoModal(false)} className="s-btn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                        CANCELAR
                                    </button>
                                    <button type="submit" disabled={loading} className="s-btn s-btn-primary" style={{ fontWeight: 900 }}>
                                        {loading ? 'PROCESANDO...' : 'CONFIRMAR ABONO'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* MODAL: HISTORIAL DE ABONOS DE LA CUENTA */}
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
                            style={{ ...modalBoxStyle, width: '40rem' }}
                        >
                            <div style={modalHeaderStyle}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>
                                        HISTORIAL DE PAGOS & RETENCIONES
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--s-neon)' }}>
                                        {selectedCuenta.factura} • Control: {selectedCuenta.control} • {selectedCuenta.nombre}
                                    </span>
                                </div>
                                <button type="button" onClick={() => setShowHistorialModal(false)} style={closeBtnStyle}><X size={20} /></button>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', color: '#888', display: 'block' }}>MONTO TOTAL ORIGINAL</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>${formatCurrency(selectedCuenta.montoOriginal)}</span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', color: '#888', display: 'block' }}>SALDO PENDIENTE</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--s-neon)' }}>${formatCurrency(selectedCuenta.saldoPendiente)}</span>
                                    </div>
                                </div>

                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    {(!selectedCuenta.historialAbonos || selectedCuenta.historialAbonos.length === 0) ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#777' }}>
                                            No se han registrado abonos previos para esta cuenta.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedCuenta.historialAbonos.map((ab, idx) => (
                                                <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 800, color: '#fff' }}>
                                                            {ab.fecha ? ab.fecha.split('T')[0] : 'Fecha N/A'} • {ab.metodo_pago || 'Pago'}
                                                        </span>
                                                        <span style={{ fontWeight: 900, color: 'var(--s-neon)' }}>
                                                            +${formatCurrency(ab.monto_abono_usd || 0)}
                                                        </span>
                                                    </div>
                                                    {ab.retencion_iva && (
                                                        <div style={{ fontSize: '0.7rem', color: '#00e5ff', marginTop: '0.2rem' }}>
                                                            Ret. IVA {ab.retencion_iva.porcentaje}%: Bs {formatCurrency(ab.retencion_iva.monto_bs)} • Comp: {ab.retencion_iva.comprobante}
                                                        </div>
                                                    )}
                                                    {ab.referencia && (
                                                        <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.1rem' }}>
                                                            Ref: {ab.referencia}
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

// =========================================================================
// STYLES
// =========================================================================

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

const tabButtonStyle = {
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s ease'
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
    border: '1px solid var(--s-neon)',
    boxShadow: '0 0 40px rgba(0,230,118,0.15)',
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

export default CuentasPorCobrar