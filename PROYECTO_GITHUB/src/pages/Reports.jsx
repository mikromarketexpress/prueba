import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Calendar, Printer, Filter, CreditCard, Smartphone, QrCode, ArrowLeftRight, Wallet, Database, Wifi, WifiOff, AlertTriangle, BookOpen, Download, FileSpreadsheet } from 'lucide-react'
import { motion } from 'framer-motion'
import { gsService } from '../lib/googleSheetsService'
import { injectarDatosPrueba } from '../lib/seedTestData'
import { formatUSD, formatBS, formatBs } from '../lib/financialUtils'
import { getEmpresaConfig } from '../lib/ticketPrinter'
import dayjs from 'dayjs'

const PERIODOS = [
    { id: 'diario', label: 'DIARIO', icon: Calendar },
    { id: 'semanal', label: 'SEMANAL', icon: Calendar },
    { id: 'mensual', label: 'MENSUAL', icon: Calendar },
    { id: 'anual', label: 'ANUAL', icon: Calendar }
]

const METODOS_PAGO_CONFIG = [
    { id: 'pago_efectivo_usd', label: 'EFECTIVO (USD)', icon: DollarSign, color: '#00e676' },
    { id: 'pago_efectivo_bs', label: 'EFECTIVO (BS)', icon: Wallet, color: '#2196f3' },
    { id: 'pago_debito', label: 'DÉBITO', icon: CreditCard, color: '#9c27b0' },
    { id: 'pago_pago_movil', label: 'PAGO MÓVIL', icon: Smartphone, color: '#ff9800' },
    { id: 'pago_bio_pago', label: 'BIO PAGO', icon: QrCode, color: '#e91e63' },
    { id: 'pago_transferencia', label: 'TRANSFERENCIA', icon: ArrowLeftRight, color: '#00bcd4' }
]

const MESES = [
    { id: 0, nombre: 'ENERO' },
    { id: 1, nombre: 'FEBRERO' },
    { id: 2, nombre: 'MARZO' },
    { id: 3, nombre: 'ABRIL' },
    { id: 4, nombre: 'MAYO' },
    { id: 5, nombre: 'JUNIO' },
    { id: 6, nombre: 'JULIO' },
    { id: 7, nombre: 'AGOSTO' },
    { id: 8, nombre: 'SEPTIEMBRE' },
    { id: 9, nombre: 'OCTUBRE' },
    { id: 10, nombre: 'NOVIEMBRE' },
    { id: 11, nombre: 'DICIEMBRE' },
]

const parseResilientDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return dateStr;
    const timestamp = Date.parse(dateStr);
    if (!isNaN(timestamp)) {
        return new Date(timestamp);
    }
    const cleanStr = String(dateStr).trim();
    const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
    const match = cleanStr.match(dmyRegex);
    if (match) {
        const [_, day, month, year, hours, minutes, seconds] = match;
        return new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            hours ? parseInt(hours, 10) : 0,
            minutes ? parseInt(minutes, 10) : 0,
            seconds ? parseInt(seconds, 10) : 0
        );
    }
    return new Date(dateStr);
};

const Reports = () => {
    const [activeTab, setActiveTab] = useState('metricas') // 'metricas' | 'libro_seniat'
    const [ventas, setVentas] = useState([])
    const [productos, setProductos] = useState([])
    const [periodo, setPeriodo] = useState('diario')
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState(false)
    const [diagResult, setDiagResult] = useState(null)
    const [showDiag, setShowDiag] = useState(false)
    const connStatus = gsService.getConnectionStatus()
    const empresaConfig = getEmpresaConfig()

    // Filtros del Libro de Ventas SENIAT
    const now = new Date()
    const [seniatYear, setSeniatYear] = useState(now.getFullYear())
    const [seniatMonth, setSeniatMonth] = useState(now.getMonth())
    const [seniatQuincena, setSeniatQuincena] = useState('todas') // '1' (1-15), '2' (16-fin), 'todas'

    const handleSeedData = async () => {
        setSeeding(true)
        try {
            await injectarDatosPrueba(18)
            await loadData()
        } catch (err) {
            console.error('Error inyectando datos:', err)
        } finally {
            setSeeding(false)
        }
    }

    const handleDiagnostic = async () => {
        setDiagResult(null)
        setShowDiag(true)
        const result = await gsService.runDiagnostic()
        setDiagResult(result)
    }

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async (forceInit = false) => {
        setLoading(true)
        try {
            const cachedVentas = gsService.getTable('Ventas') || []
            if (cachedVentas.length === 0 || forceInit) {
                await gsService.initialize()
            }
            const ventasData = gsService.getTable('Ventas') || []
            const productosData = gsService.getTable('Productos') || []
            setVentas(ventasData)
            setProductos(productosData)
        } catch (err) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    const getPeriodDateRange = useCallback(() => {
        const nowDate = new Date()
        const start = new Date()

        switch (periodo) {
            case 'diario':
                start.setHours(0, 0, 0, 0)
                break
            case 'semanal':
                start.setDate(nowDate.getDate() - nowDate.getDay())
                start.setHours(0, 0, 0, 0)
                break
            case 'mensual':
                start.setDate(1)
                start.setHours(0, 0, 0, 0)
                break
            case 'anual':
                start.setMonth(0, 1)
                start.setHours(0, 0, 0, 0)
                break
        }

        return { start, end: nowDate }
    }, [periodo])

    const ventasFiltradas = useMemo(() => {
        const { start, end } = getPeriodDateRange()
        return ventas.filter(v => {
            const fecha = parseResilientDate(v.fecha)
            return fecha >= start && fecha <= end
        })
    }, [ventas, getPeriodDateRange])

    const resumen = useMemo(() => {
        let totalVentas = 0
        let totalCosto = 0
        let totalBs = 0
        const pagos = {}
        METODOS_PAGO_CONFIG.forEach(m => pagos[m.id] = 0)

        ventasFiltradas.forEach(v => {
            const venta = Number(v.total_venta_usd) || 0
            const costo = Number(v.total_costo_usd) || 0
            const bs = Number(v.total_bs) || 0

            totalVentas += venta
            totalCosto += costo
            totalBs += bs

            METODOS_PAGO_CONFIG.forEach(m => {
                pagos[m.id] += Number(v[m.id]) || 0
            })
        })

        return {
            totalVentas,
            totalCosto,
            gananciaNeta: totalVentas - totalCosto,
            margenGanancia: totalVentas > 0 ? ((totalVentas - totalCosto) / totalVentas) * 100 : 0,
            totalBs,
            totalTransacciones: ventasFiltradas.length,
            pagos
        }
    }, [ventasFiltradas])

    const handlePrint = () => {
        window.print()
    }

    const periodLabel = useMemo(() => {
        const { start, end } = getPeriodDateRange()
        if (periodo === 'diario') return `DÍA: ${start.toLocaleDateString('es-VE')}`
        if (periodo === 'semanal') return `SEMANA: ${start.toLocaleDateString('es-VE')} — ${end.toLocaleDateString('es-VE')}`
        if (periodo === 'mensual') return `MES: ${start.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}`
        return `AÑO: ${start.getFullYear()}`
    }, [periodo, getPeriodDateRange])

    // =========================================================================
    // FILTROS Y PROCESAMIENTO DEL LIBRO DE VENTAS SENIAT
    // =========================================================================
    const ventasLibroSeniat = useMemo(() => {
        return ventas.filter(v => {
            const f = parseResilientDate(v.fecha)
            if (f.getFullYear() !== Number(seniatYear)) return false
            if (f.getMonth() !== Number(seniatMonth)) return false

            const dia = f.getDate()
            if (seniatQuincena === '1') return dia <= 15
            if (seniatQuincena === '2') return dia > 15
            return true
        }).sort((a, b) => parseResilientDate(a.fecha) - parseResilientDate(b.fecha))
    }, [ventas, seniatYear, seniatMonth, seniatQuincena])

    const totalesLibroSeniat = useMemo(() => {
        let totalBs = 0
        let exentoBs = 0
        let baseBs = 0
        let ivaBs = 0
        let baseIgtfBs = 0
        let igtfBs = 0

        ventasLibroSeniat.forEach(v => {
            const tasa = Number(v.tasa_bcv) > 0 ? Number(v.tasa_bcv) : 1
            const tBs = Number(v.total_bs) || (Number(v.total_venta_usd) * tasa) || 0
            const exBs = Number(v.base_exenta_bs) || (Number(v.base_exenta_usd) * tasa) || 0
            const bBs = Number(v.base_imponible_bs) || (Number(v.base_imponible_usd) * tasa) || 0
            const iBs = Number(v.iva_bs) || (Number(v.iva_usd) * tasa) || 0
            const bIgtfBs = Number(v.base_igtf_bs) || (Number(v.base_igtf_usd) * tasa) || 0
            const igBs = Number(v.igtf_bs) || (Number(v.igtf_usd) * tasa) || 0

            totalBs += tBs
            exentoBs += exBs
            baseBs += bBs
            ivaBs += iBs
            baseIgtfBs += bIgtfBs
            igtfBs += igBs
        })

        return { totalBs, exentoBs, baseBs, ivaBs, baseIgtfBs, igtfBs }
    }, [ventasLibroSeniat])

    const exportarLibroCSV = () => {
        const BOM = '\uFEFF';
        const sep = ';';
        let csv = BOM;
        const nombreMes = MESES.find(m => m.id === Number(seniatMonth))?.nombre || '';
        const quincenaTexto = seniatQuincena === '1' ? '1RA QUINCENA' : seniatQuincena === '2' ? '2DA QUINCENA' : 'MES COMPLETO';
        
        csv += `LIBRO DE VENTAS FISCAL SENIAT${sep}${empresaConfig.nombre}${sep}RIF: ${empresaConfig.rif}\n`;
        csv += `PERIODO TRIBUTARIO:${sep}${nombreMes} ${seniatYear} (${quincenaTexto})${sep}PROVIDENCIA: ${empresaConfig.providencia_seniat}\n\n`;
        
        csv += [
            'Oper N°', 'Fecha', 'RIF/Cédula', 'Nombre o Razón Social', 'N° Factura', 'N° Control',
            'N° Nota Débito', 'N° Nota Crédito', 'Tipo Trans.', 'Fact. Afectada',
            'Total Ventas inc. IVA (Bs)', 'Ventas Exentas (Bs)', 'Base Imponible 16% (Bs)',
            '% Alic. IVA', 'Impuesto IVA 16% (Bs)', 'Base Imponible IGTF (Bs)', '% Alic. IGTF', 'IGTF Percibido (Bs)'
        ].join(sep) + '\n';

        ventasLibroSeniat.forEach((v, idx) => {
            const tasa = Number(v.tasa_bcv) > 0 ? Number(v.tasa_bcv) : 1
            const tBs = Number(v.total_bs) || (Number(v.total_venta_usd) * tasa) || 0
            const exBs = Number(v.base_exenta_bs) || (Number(v.base_exenta_usd) * tasa) || 0
            const bBs = Number(v.base_imponible_bs) || (Number(v.base_imponible_usd) * tasa) || 0
            const iBs = Number(v.iva_bs) || (Number(v.iva_usd) * tasa) || 0
            const bIgtfBs = Number(v.base_igtf_bs) || (Number(v.base_igtf_usd) * tasa) || 0
            const igBs = Number(v.igtf_bs) || (Number(v.igtf_usd) * tasa) || 0

            const docNum = v.numero_factura || String(v.id || '').slice(0, 8).toUpperCase()
            const clienteDoc = v.cliente_cedula_rif || v.cliente_identificacion || 'V-99999999-0'
            const clienteNom = v.cliente_nombre || 'CONSUMIDOR FINAL'

            csv += [
                idx + 1,
                dayjs(v.fecha).format('DD/MM/YYYY'),
                `"${clienteDoc}"`,
                `"${clienteNom.replace(/"/g, '""')}"`,
                docNum,
                docNum,
                '-', '-', '01-REG', '-',
                tBs.toFixed(2).replace('.', ','),
                exBs.toFixed(2).replace('.', ','),
                bBs.toFixed(2).replace('.', ','),
                '16%',
                iBs.toFixed(2).replace('.', ','),
                bIgtfBs.toFixed(2).replace('.', ','),
                bIgtfBs > 0 ? '3%' : '0%',
                igBs.toFixed(2).replace('.', ',')
            ].join(sep) + '\n';
        });

        csv += `\nTOTALES GENERALES${sep}${sep}${sep}${sep}${sep}${sep}${sep}${sep}${sep}${sep}`;
        csv += [
            totalesLibroSeniat.totalBs.toFixed(2).replace('.', ','),
            totalesLibroSeniat.exentoBs.toFixed(2).replace('.', ','),
            totalesLibroSeniat.baseBs.toFixed(2).replace('.', ','),
            '-',
            totalesLibroSeniat.ivaBs.toFixed(2).replace('.', ','),
            totalesLibroSeniat.baseIgtfBs.toFixed(2).replace('.', ','),
            '-',
            totalesLibroSeniat.igtfBs.toFixed(2).replace('.', ',')
        ].join(sep) + '\n';

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Libro_Ventas_SENIAT_${nombreMes}_${seniatYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return (
        <div className="print-report" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--gap-2)', overflow: 'hidden' }}>
            {/* Barra de Conexión */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', background: connStatus.status === 'ok' ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)', border: `1px solid ${connStatus.status === 'ok' ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)'}`, borderRadius: '8px', fontSize: '0.6rem', fontWeight: 800 }} className="no-print">
                {connStatus.status === 'ok' ? <Wifi size={14} style={{ color: 'var(--s-neon)' }} /> : connStatus.status === 'loading' ? <div style={{ width: 12, height: 12, border: '2px solid rgba(0,230,118,0.2)', borderTopColor: 'var(--s-neon)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <WifiOff size={14} style={{ color: '#ff5252' }} />}
                <span style={{ color: connStatus.status === 'ok' ? 'var(--s-neon)' : '#ff5252' }}>
                    {connStatus.status === 'ok' ? 'CONECTADO' : connStatus.status === 'loading' ? 'CONECTANDO...' : connStatus.status === 'error' ? 'DESCONECTADO' : 'SIN CONEXIÓN'}
                </span>
                {connStatus.status === 'ok' && <span style={{ color: '#888', marginLeft: '0.5rem' }}>| {connStatus.productsInCache} productos | Tasa: ${formatUSD(gsService.getTasaBcv())} | Providencia: {empresaConfig.providencia_seniat}</span>}
                {connStatus.lastError && <span style={{ color: '#ff5252', marginLeft: '0.5rem' }}>({connStatus.lastError.substring(0, 60)}...)</span>}
                <button onClick={handleDiagnostic} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    DIAGNÓSTICO
                </button>
            </div>

            {/* Selector de Pestañas Principales */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => setActiveTab('metricas')}
                        className={`s-chip ${activeTab === 'metricas' ? 'active' : ''}`}
                        style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem', fontWeight: 900, gap: '0.5rem' }}
                    >
                        <BarChart3 size={16} />
                        MÉTRICAS Y ANÁLISIS
                    </button>
                    <button
                        onClick={() => setActiveTab('libro_seniat')}
                        className={`s-chip ${activeTab === 'libro_seniat' ? 'active' : ''}`}
                        style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem', fontWeight: 900, gap: '0.5rem', borderColor: activeTab === 'libro_seniat' ? '#38bdf8' : undefined, color: activeTab === 'libro_seniat' ? '#38bdf8' : undefined }}
                    >
                        <BookOpen size={16} />
                        LIBRO DE VENTAS SENIAT (LEGAL)
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                        onClick={() => loadData(true)}
                        className="s-btn s-btn-secondary"
                        style={{ height: '2.5rem' }}
                    >
                        <Filter size={14} /> ACTUALIZAR
                    </button>
                    {activeTab === 'metricas' && (
                        <>
                            <button
                                onClick={handleSeedData}
                                disabled={seeding}
                                className="s-btn"
                                style={{ height: '2.5rem', background: 'rgba(156,39,176,0.15)', border: '1px solid rgba(156,39,176,0.3)', color: '#ce93d8', cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.7 : 1 }}
                            >
                                <Database size={14} /> {seeding ? 'INYECTANDO...' : 'INYECTAR DATOS PRUEBA'}
                            </button>
                            <button
                                onClick={handlePrint}
                                className="s-btn s-btn-primary"
                                style={{ height: '2.5rem' }}
                            >
                                <Printer size={14} /> GENERAR INFORME
                            </button>
                        </>
                    )}
                    {activeTab === 'libro_seniat' && (
                        <>
                            <button
                                onClick={exportarLibroCSV}
                                className="s-btn"
                                style={{ height: '2.5rem', background: 'rgba(0, 230, 118, 0.15)', border: '1px solid #00e676', color: '#00e676', fontWeight: 900 }}
                            >
                                <FileSpreadsheet size={15} /> EXPORTAR A EXCEL (.CSV)
                            </button>
                            <button
                                onClick={handlePrint}
                                className="s-btn s-btn-primary"
                                style={{ height: '2.5rem' }}
                            >
                                <Printer size={14} /> IMPRIMIR LIBRO
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '3rem', height: '3rem', border: '3px solid rgba(0,230,118,0.2)', borderTopColor: 'var(--s-neon)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : activeTab === 'metricas' ? (
                /* ========================================================= */
                /* TAB 1: MÉTRICAS Y ANÁLISIS FINANCIERO                      */
                /* ========================================================= */
                <>
                    <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
                        {PERIODOS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setPeriodo(id)}
                                className={`s-chip ${periodo === id ? 'active' : ''}`}
                                style={{ gap: '0.4rem' }}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--gap-2)' }}>
                        {[
                            { label: 'VENTAS TOTALES', value: `$${formatUSD(resumen.totalVentas)}`, sub: `BS ${formatBs(resumen.totalBs)}`, icon: DollarSign, color: 'var(--s-neon)', border: '#00e676' },
                            { label: 'GANANCIA NETA', value: `$${formatUSD(resumen.gananciaNeta)}`, sub: `MARGEN: ${resumen.margenGanancia.toFixed(1)}%`, icon: TrendingUp, color: '#00e676', border: '#00e676' },
                            { label: 'COSTO TOTAL', value: `$${formatUSD(resumen.totalCosto)}`, sub: `${resumen.totalTransacciones} TRANSACCIONES`, icon: TrendingDown, color: '#ff9800', border: '#ff9800' },
                            { label: 'AJUSTES / PÉRDIDAS', value: `$${formatUSD(0)}`, sub: 'SIN REGISTROS', icon: BarChart3, color: '#ff5252', border: '#ff5252' }
                        ].map(({ label, value, sub, icon: Icon, color }) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="print-summary-card"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}
                            >
                                <div style={{ width: '3rem', height: '3rem', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={18} style={{ color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#666', letterSpacing: '0.15em' }}>{label}</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 1000, color, lineHeight: 1.2, marginTop: '0.25rem' }}>{value}</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#888', marginTop: '0.15rem' }}>{sub}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-2)', flex: 1 }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em', marginBottom: '1rem' }}>DESGLOSE POR MÉTODO DE PAGO</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {METODOS_PAGO_CONFIG.map(({ id, label, icon: Icon, color }) => (
                                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${color}15` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Icon size={16} style={{ color }} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ccc' }}>{label}</span>
                                        </div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color, fontFamily: 'monospace' }}>
                                            {id === 'pago_efectivo_usd'
                                                ? `$ ${formatUSD(resumen.pagos[id])}`
                                                : `Bs ${formatBS(resumen.pagos[id])}`
                                            }
                                        </div>
                                    </div>
                                ))}
                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff' }}>TOTAL RECAUDADO</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--s-neon)', fontFamily: 'monospace' }}>${formatUSD(resumen.totalVentas)}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(100vh - 18rem)' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em', marginBottom: '1rem' }}>ÚLTIMAS TRANSACCIONES</h3>
                            {ventasFiltradas.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#555' }}>
                                    <BarChart3 size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                    <p style={{ fontSize: '0.8rem', fontWeight: 800 }}>SIN VENTAS EN ESTE PERÍODO</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {[...ventasFiltradas].reverse().slice(0, 20).map(v => (
                                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>#{String(v.numero_factura || v.id || '').slice(0, 8)}</div>
                                                <div style={{ fontSize: '0.55rem', color: '#666', fontWeight: 700 }}>
                                                    {dayjs(v.fecha).format('DD/MM/YYYY hh:mm A')}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--s-neon)', fontFamily: 'monospace' }}>${formatUSD(Number(v.total_venta_usd) || 0)}</div>
                                                <div style={{ fontSize: '0.55rem', color: '#888', fontWeight: 700 }}>
                                                    {(Number(v.pago_efectivo_usd) || 0) > 0 ? 'EFV ' : ''}
                                                    {(Number(v.pago_debito) || 0) > 0 ? 'DBT ' : ''}
                                                    {(Number(v.pago_pago_movil) || 0) > 0 ? 'PM ' : ''}
                                                    {(Number(v.pago_bio_pago) || 0) > 0 ? 'BIO ' : ''}
                                                    {(Number(v.pago_transferencia) || 0) > 0 ? 'TRF ' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* ========================================================= */
                /* TAB 2: LIBRO DE VENTAS SENIAT (18 COLUMNAS OFICIALES)     */
                /* ========================================================= */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
                    {/* Filtros de Año, Mes y Quincena */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }} className="no-print">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888' }}>AÑO:</label>
                            <select
                                value={seniatYear}
                                onChange={e => setSeniatYear(Number(e.target.value))}
                                className="s-select"
                                style={{ height: '2.4rem', fontWeight: 800 }}
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888' }}>MES:</label>
                            <select
                                value={seniatMonth}
                                onChange={e => setSeniatMonth(Number(e.target.value))}
                                className="s-select"
                                style={{ height: '2.4rem', fontWeight: 800 }}
                            >
                                {MESES.map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888' }}>PERÍODO FISCAL:</label>
                            <select
                                value={seniatQuincena}
                                onChange={e => setSeniatQuincena(e.target.value)}
                                className="s-select"
                                style={{ height: '2.4rem', fontWeight: 800 }}
                            >
                                <option value="todas">MES COMPLETO</option>
                                <option value="1">1RA QUINCENA (DÍAS 1 AL 15)</option>
                                <option value="2">2DA QUINCENA (DÍAS 16 AL FIN)</option>
                            </select>
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 800 }}>
                            <span style={{ color: '#888' }}>DOCUMENTOS: <b style={{ color: '#fff' }}>{ventasLibroSeniat.length}</b></span>
                            <span style={{ color: '#888' }}>TOTAL FACTURADO: <b style={{ color: 'var(--s-neon)' }}>Bs {formatBS(totalesLibroSeniat.totalBs)}</b></span>
                        </div>
                    </div>

                    {/* Encabezado Legal Formal */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>{empresaConfig.nombre} | RIF: {empresaConfig.rif}</div>
                            <div style={{ fontSize: '0.65rem', color: '#888' }}>{empresaConfig.direccion} | PROVIDENCIA: {empresaConfig.providencia_seniat}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#38bdf8' }}>LIBRO DE VENTAS (ART. 56 LEY IVA Y ART. 72 REG.)</div>
                            <div style={{ fontSize: '0.65rem', color: '#aaa' }}>
                                PERÍODO: {MESES.find(m => m.id === Number(seniatMonth))?.nombre} {seniatYear} {seniatQuincena === '1' ? '(1ra Quincena)' : seniatQuincena === '2' ? '(2da Quincena)' : '(Mes Completo)'}
                            </div>
                        </div>
                    </div>

                    {/* Tabla de 18 Columnas con Scroll Horizontal */}
                    <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <table style={{ width: '100%', minWidth: '1300px', borderCollapse: 'collapse', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '35px' }}>OP#</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '75px' }}>FECHA</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '95px' }}>RIF / CÉDULA</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'left', minWidth: '150px' }}>NOMBRE / RAZÓN SOCIAL</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '80px' }}>N° FACTURA</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '80px' }}>N° CONTROL</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '50px' }}>TIPO</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '100px' }}>TOTAL VENTAS (BS)</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '95px' }}>EXENTO (BS)</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '100px' }}>BASE IMPONIBLE (BS)</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '50px' }}>% IVA</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '95px' }}>IVA 16% (BS)</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '95px' }}>BASE IGTF (BS)</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center', width: '50px' }}>% IGTF</th>
                                    <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right', width: '95px' }}>IGTF 3% (BS)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ventasLibroSeniat.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                                            NO EXISTEN OPERACIONES REGISTRADAS EN ESTE PERÍODO TRIBUTARIO
                                        </td>
                                    </tr>
                                ) : (
                                    ventasLibroSeniat.map((v, idx) => {
                                        const tasa = Number(v.tasa_bcv) > 0 ? Number(v.tasa_bcv) : 1
                                        const tBs = Number(v.total_bs) || (Number(v.total_venta_usd) * tasa) || 0
                                        const exBs = Number(v.base_exenta_bs) || (Number(v.base_exenta_usd) * tasa) || 0
                                        const bBs = Number(v.base_imponible_bs) || (Number(v.base_imponible_usd) * tasa) || 0
                                        const iBs = Number(v.iva_bs) || (Number(v.iva_usd) * tasa) || 0
                                        const bIgtfBs = Number(v.base_igtf_bs) || (Number(v.base_igtf_usd) * tasa) || 0
                                        const igBs = Number(v.igtf_bs) || (Number(v.igtf_usd) * tasa) || 0

                                        const docNum = v.numero_factura || String(v.id || '').slice(0, 8).toUpperCase()
                                        const clienteDoc = v.cliente_cedula_rif || v.cliente_identificacion || 'V-99999999-0'
                                        const clienteNom = v.cliente_nombre || 'CONSUMIDOR FINAL'

                                        return (
                                            <tr key={v.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#666' }}>{idx + 1}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#fff' }}>{dayjs(v.fecha).format('DD/MM/YYYY')}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>{clienteDoc}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{clienteNom}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', fontWeight: 800, color: '#fff' }}>{docNum}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#888' }}>{docNum}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#aaa' }}>01-REG</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', fontWeight: 800, color: 'var(--s-neon)' }}>{formatBS(tBs)}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#00e676' }}>{formatBS(exBs)}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#fff' }}>{formatBS(bBs)}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#aaa' }}>16%</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#2196f3' }}>{formatBS(iBs)}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#ccc' }}>{formatBS(bIgtfBs)}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'center', color: '#aaa' }}>{bIgtfBs > 0 ? '3%' : '0%'}</td>
                                                <td style={{ padding: '0.4rem 0.3rem', textAlign: 'right', color: '#ffb300' }}>{formatBS(igBs)}</td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            {ventasLibroSeniat.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: 'rgba(255,255,255,0.06)', borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 900 }}>
                                        <td colSpan={7} style={{ padding: '0.6rem 0.4rem', textAlign: 'right', color: '#fff', fontSize: '0.72rem' }}>TOTALES DEL PERÍODO:</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: 'var(--s-neon)', fontSize: '0.75rem' }}>{formatBS(totalesLibroSeniat.totalBs)}</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: '#00e676' }}>{formatBS(totalesLibroSeniat.exentoBs)}</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: '#fff' }}>{formatBS(totalesLibroSeniat.baseBs)}</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'center', color: '#888' }}>-</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: '#2196f3' }}>{formatBS(totalesLibroSeniat.ivaBs)}</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: '#ccc' }}>{formatBS(totalesLibroSeniat.baseIgtfBs)}</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'center', color: '#888' }}>-</td>
                                        <td style={{ padding: '0.6rem 0.3rem', textAlign: 'right', color: '#ffb300' }}>{formatBS(totalesLibroSeniat.igtfBs)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Reports
