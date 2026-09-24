import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, Plus, Minus, Smartphone, Package, ShoppingBag, Trash2, X, AlertTriangle, Database, CreditCard, Wallet, QrCode, ArrowLeftRight, DollarSign, User, Copy, Clipboard, Brush } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { useDatabase } from '../hooks/useDatabase'
import { useCaja } from '../context/CajaContext'
import { gsService } from '../lib/googleSheetsService'
import { CategoryDropdown } from '../components/CategoryDropdown'
import CategoryManager from '../components/CategoryManager'
import BCVRateMonitor from '../components/BCVRateMonitor'
import BsInput from '../components/BsInput'
import CurrencyInput from '../components/CurrencyInput'
import { formatUSD, formatBS, parseUSDNumber, parseVENumber } from '../lib/financialUtils'
import { getProductImageUrl } from '../lib/imageUtils'
import defaultPlaceholderImg from '../../assets/img/subir_imagen.png'
import { abrirTicketImpresion } from '../lib/ticketPrinter'
import { generarPagoMovilData } from '../lib/qrGenerator'
import { generarMensajeWhatsApp } from '../lib/whatsappService'


const METODOS_PAGO = [
    { id: 'efectivo_usd', nombre: 'EFECTIVO (USD)', icon: DollarSign, color: '#00e676', prefix: '$', type: 'usd' },
    { id: 'efectivo_bs', nombre: 'EFECTIVO (BS)', icon: Wallet, color: '#2196f3', prefix: 'Bs', type: 'bs' },
    { id: 'debito', nombre: 'DÉBITO (PUNTO DE VENTA)', icon: CreditCard, color: '#ffffff', prefix: 'Bs', type: 'bs' },
    { id: 'pago_movil', nombre: 'PAGO MÓVIL', icon: Smartphone, color: '#ffffff', prefix: 'Bs', type: 'bs' },
    { id: 'bio_pago', nombre: 'BIO PAGO', icon: QrCode, color: '#ffffff', prefix: 'Bs', type: 'bs' },
    { id: 'transferencia', nombre: 'TRANSFERENCIA', icon: ArrowLeftRight, color: '#ffffff', prefix: 'Bs', type: 'bs' }
]

const pluralizarMedida = (medida, cantidad) => {
    const med = String(medida || 'UNIDAD').toUpperCase()
    const cant = parseFloat(cantidad) || 0
    if (cant === 1) {
        if (med === 'CENTIMETRO_CUBICO' || med === 'CENTIMETRO CUBICO') return 'CENTÍMETRO CÚBICO'
        return med
    }
    if (med === 'UNIDAD') return 'UNIDADES'
    if (med === 'KILOGRAMO') return 'KILOGRAMOS'
    if (med === 'GRAMO') return 'GRAMOS'
    if (med === 'MILIGRAMO') return 'MILIGRAMOS'
    if (med === 'LITRO') return 'LITROS'
    if (med === 'MILILITRO') return 'MILILITROS'
    if (med === 'CENTIMETRO_CUBICO' || med === 'CENTIMETRO CUBICO') return 'CENTÍMETROS CÚBICOS'
    if (med === 'PAQUETE') return 'PAQUETES'
    if (med === 'CAJA') return 'CAJAS'
    return med + 'S'
}

const formatDescripcionTecnica = (p) => {
    const desc = String(p.descripcion_corta || '').trim().toUpperCase()
    const numUnid = parseFloat(p.numero_unid) || 1
    const unidadMed = String(p.unidad_medida || 'UNIDAD').toUpperCase()
    
    const unitFormatted = pluralizarMedida(unidadMed, numUnid)
    const showUnidades = numUnid > 1 || ['KILOGRAMO', 'GRAMO', 'MILIGRAMO', 'LITRO', 'MILILITRO', 'CENTIMETRO_CUBICO', 'CENTIMETRO CUBICO'].includes(unidadMed)
    
    if (showUnidades) {
        const unidStr = `${numUnid} ${unitFormatted}`
        return desc ? `${desc} - ${unidStr}` : unidStr
    }
    
    return desc || '—'
}

const POS = () => {
    const { isReady, productos: dbProductos, categorias: dbCategorias, refresh, saveVenta } = useDatabase()
    const { sesionActiva, tasaBCV, isCajaAbierta, setTasaBCV } = useCaja()
    
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('mme_pos_cart')
            return saved ? JSON.parse(saved) : []
        } catch { return [] }
    })
    const [loading, setLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [showCategoryManager, setShowCategoryManager] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [lastSaleData, setLastSaleData] = useState(null)

    
    const [clienteTipo, setClienteTipo] = useState('Persona Natural')
    const [clientePrefix, setClientePrefix] = useState('V-')
    const [clienteNombre, setClienteNombre] = useState('CONSUMIDOR FINAL')
    const [clienteIdentificacion, setClienteIdentificacion] = useState('99999999-0')
    const [clienteCelular, setClienteCelular] = useState('N/A')
    const [clienteDireccion, setClienteDireccion] = useState('CIUDAD')

    const resetClienteData = useCallback(() => {
        setClienteTipo('Persona Natural')
        setClientePrefix('V-')
        setClienteNombre('CONSUMIDOR FINAL')
        setClienteIdentificacion('99999999-0')
        setClienteCelular('N/A')
        setClienteDireccion('CIUDAD')
    }, [])

    const handleClosePaymentModal = useCallback(() => {
        setCart([])
        resetClienteData()
        setShowPaymentModal(false)
    }, [resetClienteData])
    
    const searchRef = useRef(null)
    const { showToast } = useToast()

    useEffect(() => {
        if (isReady) {
            setProducts(dbProductos || [])
            const catsWithAll = [
                { id: 'all', nombre: 'TODAS LAS CATEGORÍAS', icono_nombre: 'Layers' },
                ...(dbCategorias || []).map(c => ({
                    id: c.id,
                    nombre: c.nombre,
                    icono_nombre: c.icono_nombre || 'Layers'
                }))
            ]
            setCategories(catsWithAll)
            setLoading(false)
        }
    }, [isReady, dbProductos, dbCategorias])

    useEffect(() => {
        try {
            localStorage.setItem('mme_pos_cart', JSON.stringify(cart))
        } catch {}
    }, [cart])

    useEffect(() => {
        if (!isCajaAbierta && cart.length > 0) {
            setCart([])
            showToast('CAJA CERRADA - CARRITO LIMPIADO', 'error')
        }
    }, [isCajaAbierta])

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'F1') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [])

    const addToCart = useCallback((product) => {
        const stock = parseInt(product.stock) || 0
        if (stock <= 0) return

        const existingItem = cart.find(i => i.id === product.id)
        if (existingItem && existingItem.cantidad >= stock) {
            showToast(`SÓLO HAY ${stock} DISPONIBLES`, 'error')
            return
        }

        setCart(prev => {
            const ex = prev.find(i => i.id === product.id)
            if (ex) {
                return prev.map(i => i.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
            }
            return [...prev, { ...product, cantidad: 1 }]
        })
    }, [cart, showToast])

    const updateQty = useCallback((id, delta) => {
        const item = cart.find(i => i.id === id)
        if (!item) return

        const stock = parseInt(item.stock) || 0

        if (delta < 0) {
            setCart(prev => prev.map(i => i.id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
            return
        }

        if (item.cantidad + delta > stock) {
            showToast(`LÍMITE DE STOCK ALCANZADO`, 'error')
            return
        }

        setCart(prev => prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
    }, [cart, showToast])

    const removeItem = useCallback((id) => setCart(prev => prev.filter(i => i.id !== id)), [])

    const subtotalExento = useMemo(() => {
        return cart.reduce((s, i) => s + (i.alicuota_iva === 'E' ? (parseFloat(i.precio_usd) || 0) * i.cantidad : 0), 0)
    }, [cart])

    const baseImponible = useMemo(() => {
        return cart.reduce((s, i) => s + (i.alicuota_iva !== 'E' ? (parseFloat(i.precio_usd) || 0) * i.cantidad : 0), 0)
    }, [cart])

    const subtotal = subtotalExento + baseImponible
    const iva = baseImponible * 0.16
    const total = subtotal + iva
    const totalBs = total * tasaBCV

    const handleCheckout = useCallback(() => {
        if (!cart.length || isProcessing) return
        if (!isCajaAbierta) {
            showToast('DEBE ABRIR CAJA PARA INICIAR LA VENTA', 'error')
            return
        }
        setShowPaymentModal(true)
    }, [cart.length, isProcessing, isCajaAbierta, showToast])

    const processPayment = useCallback(async (payload) => {
        if (!cart.length || isProcessing) return
        setIsProcessing(true)
        try {
            const { pagos, vuelto_entregado_usd, vuelto_entregado_bs, vuelto_efectivo_bs, vuelto_pago_movil, vuelto_transferencia, cliente_tipo, cliente_nombre, cliente_identificacion, cliente_celular, cliente_direccion } = payload
            const tasaActual = parseFloat(tasaBCV) || 46.5
            const totalCosto = cart.reduce((s, i) => s + (parseFloat(i.precio_costo) || 0) * i.cantidad, 0)
            const saleId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : (`sale_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)
            const saleFecha = new Date().toISOString()

            const efectivoUSDVal = parseUSDNumber(pagos.efectivo_usd)
            const baseIgtfUSD = efectivoUSDVal
            const igtfUSD = baseIgtfUSD > 0 ? baseIgtfUSD * 0.03 : 0
            const totalFinalUSD = subtotalExento + baseImponible + iva + igtfUSD
            const totalFinalBS = totalFinalUSD * tasaActual

            // Enviar la venta a Google Sheets en segundo plano (no bloquea la UI)
            saveVenta({
                id: saleId,
                productos: cart.map(item => ({
                    id: item.id,
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    precio_costo: item.precio_costo || 0,
                    precio_usd: item.precio_usd,
                    alicuota_iva: item.alicuota_iva || 'G'
                })),
                pago_efectivo_usd: parseUSDNumber(pagos.efectivo_usd),
                pago_efectivo_bs: parseVENumber(pagos.efectivo_bs),
                pago_debito: parseVENumber(pagos.debito),
                pago_pago_movil: parseVENumber(pagos.pago_movil),
                pago_bio_pago: parseVENumber(pagos.bio_pago),
                pago_transferencia: parseVENumber(pagos.transferencia),
                vuelto_entregado_usd: Number(vuelto_entregado_usd) || 0,
                vuelto_entregado_bs: Number(vuelto_entregado_bs) || 0,
                vuelto_efectivo_bs: Number(vuelto_efectivo_bs) || 0,
                vuelto_pago_movil: Number(vuelto_pago_movil) || 0,
                vuelto_transferencia: Number(vuelto_transferencia) || 0,
                // DESGLOSE FISCAL SENIAT
                base_exenta_usd: subtotalExento,
                base_exenta_bs: subtotalExento * tasaActual,
                base_imponible_usd: baseImponible,
                base_imponible_bs: baseImponible * tasaActual,
                iva_usd: iva,
                iva_bs: iva * tasaActual,
                base_igtf_usd: baseIgtfUSD,
                base_igtf_bs: baseIgtfUSD * tasaActual,
                igtf_usd: igtfUSD,
                igtf_bs: igtfUSD * tasaActual,
                total_venta_usd: totalFinalUSD,
                total_bs: totalFinalBS,
                total_costo_usd: totalCosto,
                tasa_bcv: tasaActual,
                sesion_caja_id: sesionActiva?.id || null,
                fecha: saleFecha,
                cliente_tipo: cliente_tipo || 'Persona Natural',
                cliente_nombre: String(cliente_nombre || '').toUpperCase(),
                cliente_identificacion: String(cliente_identificacion || '').toUpperCase(),
                cliente_cedula_rif: String(cliente_identificacion || '').toUpperCase(),
                cliente_tipo_doc: (String(cliente_identificacion || '').toUpperCase().startsWith('J') || String(cliente_identificacion || '').toUpperCase().startsWith('G')) ? 'J' : 'V',
                cliente_celular: String(cliente_celular || '').toUpperCase(),
                cliente_direccion: String(cliente_direccion || '').toUpperCase()
            }).then(result => {
                if (result && !result.success) {
                    showToast(`⚠️ NO SINCRONIZÓ EN GOOGLE SHEETS: ${result.error || 'FALLO'}`, 'warning')
                } else {
                    showToast(`✅ VENTA FISCAL SINCRONIZADA CON ÉXITO`, 'success')
                }
            }).catch(err => {
                showToast(`⚠️ ERROR DE CONEXIÓN AL SINCRONIZAR VENTA`, 'warning')
            })

            // Inmediatamente abrir ticket fiscal, limpiar carrito, guardar datos y cerrar modal
            const saleData = {
                idVenta: saleId,
                fecha: saleFecha,
                sesionCajaId: sesionActiva?.id || null,
                productos: [...cart],
                pagos: { ...pagos },
                vueltoUSD: Number(vuelto_entregado_usd) || 0,
                vueltoBS: Number(vuelto_entregado_bs) || 0,
                baseExentaUSD: subtotalExento,
                baseImponibleUSD: baseImponible,
                subtotalUSD: subtotal,
                ivaUSD: iva,
                baseIgtfUSD: baseIgtfUSD,
                igtfUSD: igtfUSD,
                totalUSD: totalFinalUSD,
                totalBS: totalFinalBS,
                tasaBCV: tasaActual,
                cliente: {
                    tipo: cliente_tipo || 'Persona Natural',
                    nombre: String(cliente_nombre || '').toUpperCase(),
                    cedulaRif: String(cliente_identificacion || '').toUpperCase(),
                    telefono: String(cliente_celular || '').toUpperCase(),
                    direccion: String(cliente_direccion || '').toUpperCase()
                }
            }

            try {
                abrirTicketImpresion(saleData)
            } catch (ticketErr) {
                console.warn('[POS] Error al abrir ticket para impresión:', ticketErr)
            }

            setLastSaleData(saleData)
            setShowSuccessModal(true)

            // Decrementar optimistamente el stock local
            setProducts(prevProducts => {
                return prevProducts.map(p => {
                    const cartItem = cart.find(item => item.id === p.id)
                    if (cartItem) {
                        const currentStock = parseInt(p.stock) || 0
                        const soldQty = cartItem.cantidad
                        return { ...p, stock: Math.max(0, currentStock - soldQty) }
                    }
                    return p
                })
            })

            showToast(`VENTA REGISTRADA - TASA: BS ${formatBS(tasaActual)}`)
            setCart([])
            resetClienteData()
            setShowPaymentModal(false)
        } catch (err) {
            console.error('[POS] Error procesando venta:', err)
            showToast(`ERROR AL PROCESAR: ${err.message || 'FALLO'}`, 'error')
        } finally {
            setIsProcessing(false)
        }
    }, [cart, isProcessing, tasaBCV, subtotalExento, baseImponible, subtotal, iva, total, totalBs, sesionActiva, saveVenta, showToast, resetClienteData])

    const filtered = useMemo(() => {
        const q = String(searchQuery || '').trim().toLowerCase()
        const noFilter = !selectedCategory || selectedCategory === 'all' || selectedCategory === 'TODAS LAS CATEGORÍAS'

        const selectedCat = noFilter ? null : categories.find(c => c.id === selectedCategory)
        const selectedCatName = selectedCat
            ? String(selectedCat.nombre || '').trim().toUpperCase()
            : noFilter ? null : String(selectedCategory || '').trim().toUpperCase()

        return products.filter(p => {
            const nombre = String(p.nombre || '').trim().toLowerCase()
            const codigo = String(p.codigo_barras || '').trim().toLowerCase()
            const productCat = String(p.categoria || p.categoria_nombre || '').trim().toUpperCase()
            const matchSearch = nombre.includes(q) || codigo.includes(q)
            const matchCategory = noFilter || (selectedCatName && productCat === selectedCatName)
            return matchSearch && matchCategory
        })
    }, [products, searchQuery, selectedCategory, categories])

    return (
        <div style={{ display: 'flex', height: '100%', gap: 'var(--gap-2)', overflow: 'hidden', position: 'relative' }}>
            <LoadingOverlay isVisible={loading} message="Sincronizando Terminal..." />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--gap-2)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-2)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 1000, color: '#fff' }}>PUNTO DE VENTA</h2>
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--s-neon)', letterSpacing: '0.1em' }}>
                                {filtered.length} PRODUCTOS • GS v8.0
                            </span>
                        </div>
                        {isCajaAbierta && <BCVRateMonitor onTasaChange={setTasaBCV} />}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--gap-2)' }}>
                        <CategoryDropdown
                            categories={categories}
                            products={products}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                            onManageCategories={() => setShowCategoryManager(true)}
                            isDropdownOpen={isDropdownOpen}
                            setIsDropdownOpen={setIsDropdownOpen}
                        />

                        <div className="s-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1.5rem', height: '3.8rem', borderColor: 'rgba(0, 230, 118, 0.2)' }}>
                            <Search size={22} style={{ color: 'var(--s-neon)' }} />
                            <input
                                ref={searchRef}
                                name="buscar"
                                id="pos-buscar"
                                className="s-input"
                                style={{
                                    background: 'transparent', border: 'none', padding: 0,
                                    backdropFilter: 'none', fontSize: '1.2rem', color: 'var(--s-neon)', fontWeight: '800'
                                }}
                                placeholder="Escanee código o busque... (F1)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <div style={{ fontSize: '0.65rem', fontWeight: 1000, color: 'var(--s-neon)', padding: '0.4rem 0.8rem', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '6px', border: '1px solid rgba(0, 230, 118, 0.2)' }}>F1</div>
                        </div>
                    </div>
                </div>

                <div className="s-scroll" style={{ flex: 1, paddingRight: '0.5rem' }}>
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            className="s-grid-inventory"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
                        >
                            {filtered.map((p, idx) => {
                                const stockOriginal = parseInt(p.stock) || 0
                                const cartItem = cart.find(item => item.id === p.id)
                                const cartQty = cartItem ? cartItem.cantidad : 0
                                const stock = Math.max(0, stockOriginal - cartQty)
                                const stockMin = parseInt(p.stock_minimo) || 5
                                const isLowStock = stock <= stockMin
                                const isOutOfStock = stock <= 0
                                const precioUsd = parseFloat(p.precio_usd) || 0
                                const precioBs = precioUsd * tasaBCV
                                const imagenUrl = getProductImageUrl(p)

                                return (
                                    <motion.div
                                        key={String(p.id) || idx}
                                        layout
                                        variants={{
                                            hidden: { opacity: 0, y: 20, scale: 0.9 },
                                            visible: { opacity: 1, y: 0, scale: 1, transition: { delay: idx * 0.02 } }
                                        }}
                                        className="s-product-card"
                                        onClick={() => {
                                            if (!isCajaAbierta) {
                                                showToast('ACCIÓN BLOQUEADA: DEBE ABRIR CAJA PARA INICIAR UNA ORDEN', 'error')
                                                return
                                            }
                                            !isOutOfStock && addToCart(p)
                                        }}
                                        style={{
                                            opacity: isOutOfStock || !isCajaAbierta ? 0.6 : 1,
                                            cursor: isOutOfStock || !isCajaAbierta ? 'not-allowed' : 'pointer',
                                            borderColor: isOutOfStock ? '#ff3131' : 'transparent'
                                        }}
                                    >
                                        <div className="s-product-card__img" style={{ aspectRatio: '1/1' }}>
                                            {imagenUrl ? (
                                                <img 
                                                    src={imagenUrl} 
                                                    alt={String(p.nombre || '')} 
                                                    style={{ objectFit: 'cover' }}
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer"
                                                    onError={(e) => { e.target.src = defaultPlaceholderImg }}
                                                />
                                            ) : (
                                                <img 
                                                    src={defaultPlaceholderImg} 
                                                    alt="Sin imagen"
                                                    style={{ objectFit: 'cover', opacity: 0.5 }}
                                                    referrerPolicy="no-referrer"
                                                />
                                            )}
                                            <div
                                                className="s-product-card__stock"
                                                style={{
                                                    borderColor: isOutOfStock ? '#ff3131' : isLowStock ? '#ffc107' : 'var(--s-neon)',
                                                    background: 'rgba(0,0,0,0.85)'
                                                }}
                                            >
                                                {isOutOfStock ? <X size={10} color="#ff3131" /> : isLowStock ? <AlertTriangle size={10} color="#ffc107" /> : <Plus size={10} color="var(--s-neon)" />}
                                                {isOutOfStock ? 'AGOTADO' : `${stock} DISP.`}
                                            </div>
                                        </div>

                                        <div className="s-product-card__info" style={{ padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {String(p.nombre || '').toUpperCase()}
                                            </h3>

                                            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', opacity: 0.6, textTransform: 'uppercase' }}>
                                                {formatDescripcionTecnica(p)}
                                            </p>

                                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', opacity: 0.5, textTransform: 'uppercase' }}>
                                                {String(p.codigo_barras || 'SIN SKU')}
                                            </p>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.25rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div className="s-product-card__price" style={{ fontSize: '0.95rem', fontWeight: 900, lineHeight: 1.1 }}>
                                                        ${formatUSD(precioUsd)}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>
                                                        {isCajaAbierta && tasaBCV > 0 ? `BS ${formatBS(precioBs)}` : 'BS 0,00'}
                                                    </div>
                                                </div>
                                                {isCajaAbierta ? (
                                                    <div className="s-btn s-btn-secondary s-btn-icon" style={{ width: '1.8rem', height: '1.8rem' }}>
                                                        <Plus size={14} />
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.5rem', fontWeight: 900, color: '#ff5252', whiteSpace: 'nowrap', padding: '0.2rem 0.4rem', border: '1px solid rgba(255,82,82,0.3)', borderRadius: '4px', background: 'rgba(255,82,82,0.08)' }}>
                                                        CAJA CERRADA
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    </AnimatePresence>

                    {filtered.length === 0 && !loading && (
                        <div style={{ height: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', opacity: 0.2 }}>
                            <Package size={80} strokeWidth={1} />
                            <h2 style={{ fontWeight: 1000, letterSpacing: '0.2em' }}>SIN COINCIDENCIAS</h2>
                        </div>
                    )}
                </div>
            </div>

            <div className="s-panel" style={{ width: '22rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--s-glass-border)' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--s-glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>ORDEN ACTUAL</h2>
                        {!isCajaAbierta && cart.length > 0 && (
                            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#ff5252', background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                BLOQUEADA
                            </span>
                        )}
                        <span style={{ fontSize: '0.6rem', color: 'var(--s-neon)', fontWeight: 900, background: 'rgba(0,230,118,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(0,230,118,0.2)' }}>
                            TASA: {formatBS(tasaBCV)} BS
                        </span>
                    </div>
                    <button
                        className="s-btn s-btn-secondary"
                        onClick={() => setCart([])}
                        style={{ height: '2.2rem', width: '2.2rem', padding: 0, color: '#ff3131', borderColor: 'rgba(255, 49, 49, 0.2)' }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div className="s-scroll" style={{ flex: 1, padding: '1rem' }}>
                    {cart.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                            <ShoppingBag size={50} strokeWidth={1} />
                            <span style={{ fontWeight: 800, marginTop: '0.5rem', fontSize: '0.8rem' }}>CARRITO VACÍO</span>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {cart.map(item => {
                                const precioUsd = parseFloat(item.precio_usd) || 0
                                const precioBs = precioUsd * tasaBCV
                                
                                return (
                                    <motion.div 
                                        key={String(item.id)} 
                                        layout 
                                        initial={{ opacity: 0, x: 20 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        className="s-panel" 
                                        style={{ padding: '0.75rem', marginBottom: '0.5rem', display: 'flex', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}
                                    >
                                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img 
                                                src={getProductImageUrl(item)} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { e.target.src = defaultPlaceholderImg }} 
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {String(item.nombre || '').toUpperCase()}
                                            </p>
                                            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', opacity: 0.5 }}>
                                                {String(item.codigo_barras || 'SIN SKU')}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '0.15rem 0.4rem' }}>
                                                    <button onClick={() => updateQty(item.id, -1)} disabled={!isCajaAbierta} style={{ background: 'none', border: 'none', color: isCajaAbierta ? '#fff' : '#555', cursor: isCajaAbierta ? 'pointer' : 'not-allowed', padding: 0 }}><Minus size={10} /></button>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, minWidth: '0.8rem', textAlign: 'center' }}>{item.cantidad}</span>
                                                    <button onClick={() => updateQty(item.id, 1)} disabled={!isCajaAbierta} style={{ background: 'none', border: 'none', color: isCajaAbierta ? '#fff' : '#555', cursor: isCajaAbierta ? 'pointer' : 'not-allowed', padding: 0 }}><Plus size={10} /></button>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--s-neon)' }}>${formatUSD(precioUsd * item.cantidad)}</span>
                                                <span style={{ fontSize: '0.65rem', color: '#888' }}>{isCajaAbierta && tasaBCV > 0 ? `BS ${formatBS(precioBs * item.cantidad)}` : 'BS 0,00'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeItem(item.id)} style={{ alignSelf: 'center', background: 'none', border: 'none', color: 'var(--s-text-dim)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    )}
                </div>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--s-glass-border)', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                        {subtotalExento > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, color: '#00e676', opacity: 0.9 }}>
                                <span>EXENTO (E)</span>
                                <span>${formatUSD(subtotalExento)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, color: '#fff', opacity: 0.7 }}>
                            <span>BASE IMPONIBLE (G 16%)</span>
                            <span>${formatUSD(baseImponible)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, color: '#fff', opacity: 0.7 }}>
                            <span>I.V.A. (16%)</span>
                            <span>${formatUSD(iva)}</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--s-glass-border)', margin: '0.25rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 1000, color: '#fff' }}>TOTAL</span>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: 'var(--s-neon)', lineHeight: 1.1 }}>${formatUSD(total)}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 1000, color: '#fff', lineHeight: 1.1 }}>{isCajaAbierta && tasaBCV > 0 ? `BS ${formatBS(totalBs)}` : 'BS 0,00'}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        className="s-btn s-btn-primary"
                        onClick={handleCheckout}
                        disabled={!cart.length || isProcessing || !isCajaAbierta}
                        style={{
                            width: '100%', height: '3.5rem', fontSize: '1rem', letterSpacing: '0.1em',
                            opacity: !isCajaAbierta ? 0.5 : 1
                        }}
                        title={!isCajaAbierta ? 'Debe abrir caja para iniciar la venta' : ''}
                    >
                        <Smartphone size={18} />
                        {!isCajaAbierta ? 'CAJA CERRADA' : isProcessing ? 'PROCESANDO...' : 'PAGAR'}
                    </button>
                </div>
            </div>

            <CategoryManager
                isOpen={showCategoryManager}
                onClose={() => setShowCategoryManager(false)}
                categories={categories.filter(c => c.id !== 'all')}
                products={products}
                onToast={showToast}
            />

            <AnimatePresence>
                {showPaymentModal && (
                    <PaymentModal
                        key="payment-modal"
                        total={total}
                        totalBs={totalBs}
                        tasaBcv={tasaBCV}
                        clienteTipo={clienteTipo}
                        setClienteTipo={setClienteTipo}
                        clientePrefix={clientePrefix}
                        setClientePrefix={setClientePrefix}
                        clienteNombre={clienteNombre}
                        setClienteNombre={setClienteNombre}
                        clienteIdentificacion={clienteIdentificacion}
                        setClienteIdentificacion={setClienteIdentificacion}
                        clienteCelular={clienteCelular}
                        setClienteCelular={setClienteCelular}
                        clienteDireccion={clienteDireccion}
                        setClienteDireccion={setClienteDireccion}
                        onSubmit={processPayment}
                        onClose={handleClosePaymentModal}
                        onEditOrder={() => setShowPaymentModal(false)}
                    />
                )}
                {showSuccessModal && lastSaleData && (
                    <motion.div
                        key="success-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0,0,0,0.85)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 10000
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            style={{
                                width: '36rem',
                                background: '#1a1a1a',
                                borderRadius: '24px',
                                border: '2px solid var(--s-neon)',
                                padding: '2.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                boxShadow: '0 0 60px rgba(0,230,118,0.3)',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0,230,118,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '2px solid var(--s-neon)' }}>
                                <ShoppingBag size={44} style={{ color: 'var(--s-neon)' }} />
                            </div>
                            
                            <h2 style={{ fontSize: '2rem', fontWeight: 1000, color: '#fff', margin: '0 0 0.5rem 0' }}>¡VENTA EXITOSA!</h2>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#888', margin: '0 0 2rem 0' }}>
                                La transacción ha sido registrada y sincronizada correctamente.
                            </p>

                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                                    <span style={{ color: '#666' }}>ID VENTA:</span>
                                    <span style={{ color: '#fff', fontFamily: 'monospace' }}>#{lastSaleData.idVenta.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                                    <span style={{ color: '#666' }}>CLIENTE:</span>
                                    <span style={{ color: '#fff' }}>{lastSaleData.cliente?.nombre || 'Consumidor Final'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 1000, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
                                    <span style={{ color: 'var(--s-neon)' }}>TOTAL PAGADO:</span>
                                    <span style={{ color: 'var(--s-neon)' }}>${formatUSD(lastSaleData.totalUSD)}</span>
                                </div>
                                {lastSaleData.tasaBCV > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#888' }}>
                                        <span>EN BOLÍVARES:</span>
                                        <span>Bs {formatBS(lastSaleData.totalBS)}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                                    <button
                                        type="button"
                                        onClick={() => abrirTicketImpresion(lastSaleData)}
                                        style={{
                                            flex: 1,
                                            height: '4rem',
                                            fontSize: '1.1rem',
                                            fontWeight: 900,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: '#fff',
                                            letterSpacing: '0.05em',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    >
                                        📠 IMPRIMIR TICKET
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const { link } = generarMensajeWhatsApp(lastSaleData);
                                            window.open(link, '_blank');
                                        }}
                                        style={{
                                            flex: 1,
                                            height: '4rem',
                                            fontSize: '1.1rem',
                                            fontWeight: 900,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            background: '#25D366',
                                            color: '#fff',
                                            letterSpacing: '0.05em',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
                                    >
                                        💬 WHATSAPP
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setLastSaleData(null);
                                    }}
                                    style={{
                                        height: '4.2rem',
                                        fontSize: '1.2rem',
                                        fontWeight: 1000,
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, var(--s-neon), #00b248)',
                                        color: '#000',
                                        letterSpacing: '0.05em',
                                        boxShadow: '0 4px 20px rgba(0, 230, 118, 0.2)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                                >
                                    ✨ NUEVA VENTA
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const LoadingOverlay = ({ isVisible, message }) => {
    if (!isVisible) return null
    return (
        <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '1rem', zIndex: 1000
        }}>
            <div style={{
                width: '40px', height: '40px', border: '3px solid rgba(0,230,118,0.2)',
                borderTopColor: 'var(--s-neon)', borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }} />
            <span style={{ color: 'var(--s-neon)', fontWeight: 800 }}>{message}</span>
        </div>
    )
}

const PaymentModal = ({
    total,
    totalBs,
    tasaBcv,
    clienteTipo,
    setClienteTipo,
    clientePrefix,
    setClientePrefix,
    clienteNombre,
    setClienteNombre,
    clienteIdentificacion,
    setClienteIdentificacion,
    clienteCelular,
    setClienteCelular,
    clienteDireccion,
    setClienteDireccion,
    onSubmit,
    onClose,
    onEditOrder
}) => {
    const tipoCliente = clienteTipo
    const setTipoCliente = setClienteTipo
    const prefixSeleccionado = clientePrefix
    const setPrefixSeleccionado = setClientePrefix
    const nombreCliente = clienteNombre
    const setNombreCliente = setClienteNombre
    const identificacionCliente = clienteIdentificacion
    const setIdentificacionCliente = setClienteIdentificacion
    const celularCliente = clienteCelular
    const setCellularCliente = setClienteCelular
    const direccionCliente = clienteDireccion
    const setDireccionCliente = setClienteDireccion

    const [showCustomerModal, setShowCustomerModal] = useState(false)

    const [pagos, setPagos] = useState(() => {
        const init = {}
        METODOS_PAGO.forEach(m => init[m.id] = '')
        return init
    })
    const clientesGuardados = useMemo(() => {
        try {
            const list = gsService.getClientes()
            return Array.isArray(list) ? list.filter(Boolean) : []
        } catch {
            return []
        }
    }, [showCustomerModal])
    const [clienteQuery, setClienteQuery] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    const clientesFiltradosPOS = useMemo(() => {
        const list = Array.isArray(clientesGuardados) ? clientesGuardados.filter(Boolean) : []
        if (!clienteQuery.trim()) return list.slice(0, 8)
        const q = clienteQuery.toLowerCase().trim()
        return list.filter(c => {
            if (!c) return false
            const nom = String(c.nombre_razon_social || c.nombre || c.razon_social || '').toLowerCase()
            const rif = String(c.cedula_rif || '').toLowerCase()
            const tel = String(c.telefono || '').toLowerCase()
            return nom.includes(q) || rif.includes(q) || tel.includes(q)
        }).slice(0, 15)
    }, [clientesGuardados, clienteQuery])

    const handleSeleccionarCliente = (cl) => {
        if (!cl) return
        const rifFull = String(cl.cedula_rif || '')
        const prefix = ['V-', 'J-', 'E-', 'G-'].find(p => rifFull.startsWith(p)) || (cl.tipo_persona === 'JURIDICA' ? 'J-' : 'V-')
        const num = rifFull.replace(prefix, '')
        setTipoCliente(cl.tipo_persona === 'JURIDICA' ? 'Persona Juridica' : 'Persona Natural')
        setPrefixSeleccionado(prefix)
        setIdentificacionCliente(num)
        setNombreCliente(cl.nombre_razon_social || cl.nombre || cl.razon_social || '')
        setCellularCliente(cl.telefono || '')
        setDireccionCliente(cl.direccion_fiscal || cl.direccion || '')
        setClienteQuery(`${cl.cedula_rif || ''} - ${cl.nombre_razon_social || cl.nombre || cl.razon_social || ''}`)
        setIsDropdownOpen(false)
    }

    const [pagoMovilQrData, setPagoMovilQrData] = useState(null)
    const [vueltoAsignado, setVueltoAsignado] = useState({
        usd: '',
        bs: '',
        pago_movil: '',
        transferencia: ''
    })
    const [loading, setLoading] = useState(false)
    const { showToast } = useToast()

    const [copiedUSD, setCopiedUSD] = useState('')
    const [copiedBS, setCopiedBS] = useState('')

    const handleCopyUSD = (amount) => {
        const textToCopy = formatUSD(amount);
        navigator.clipboard.writeText(textToCopy);
        setCopiedUSD(textToCopy);
        showToast(`COPIADO: $ ${textToCopy}`, 'success');
    }

    const handleCopyBS = (amount) => {
        const textToCopy = formatBS(amount);
        navigator.clipboard.writeText(textToCopy);
        setCopiedBS(textToCopy);
        showToast(`COPIADO: Bs ${textToCopy}`, 'success');
    }

    const handlePaste = async (id, type) => {
        try {
            let clipboardText = '';
            try {
                clipboardText = await navigator.clipboard.readText();
            } catch (err) {
                clipboardText = type === 'usd' ? copiedUSD : copiedBS;
            }

            if (!clipboardText) {
                clipboardText = type === 'usd' ? copiedUSD : copiedBS;
            }

            if (clipboardText) {
                const isBsText = /,\d{2}$/.test(clipboardText.trim());
                const isUsdText = /\.\d{2}$/.test(clipboardText.trim());
                
                if (type === 'usd' && isBsText) {
                    showToast('⚠️ NO SE PUEDE PEGAR UN MONTO EN BOLÍVARES EN UN CAMPO DE DÓLARES', 'warning');
                    return;
                }
                if (type === 'bs' && isUsdText) {
                    showToast('⚠️ NO SE PUEDE PEGAR UN MONTO EN DÓLARES EN UN CAMPO DE BOLÍVARES', 'warning');
                    return;
                }

                handleChange(id, clipboardText);
                showToast(`PEGADO: ${clipboardText}`, 'success');
            } else {
                showToast('NADA QUE PEGAR. COPIA UN MONTO PRIMERO.', 'warning');
            }
        } catch (err) {
            showToast('ERROR AL PEGAR', 'error');
        }
    }

    const handlePasteVuelto = async (key) => {
        const isBs = key !== 'usd';
        try {
            let clipboardText = '';
            try {
                clipboardText = await navigator.clipboard.readText();
            } catch (err) {
                clipboardText = isBs ? copiedBS : copiedUSD;
            }

            if (!clipboardText) {
                clipboardText = isBs ? copiedBS : copiedUSD;
            }

            if (clipboardText) {
                const isBsText = /,\d{2}$/.test(clipboardText.trim());
                const isUsdText = /\.\d{2}$/.test(clipboardText.trim());
                
                if (!isBs && isBsText) {
                    showToast('⚠️ NO SE PUEDE PEGAR UN MONTO EN BOLÍVARES EN UN CAMPO DE DÓLARES', 'warning');
                    return;
                }
                if (isBs && isUsdText) {
                    showToast('⚠️ NO SE PUEDE PEGAR UN MONTO EN DÓLARES EN UN CAMPO DE BOLÍVARES', 'warning');
                    return;
                }

                handleVueltoChange(key, clipboardText);
                showToast(`PEGADO VUELTO: ${clipboardText}`, 'success');
            } else {
                showToast('NADA QUE PEGAR. COPIA UN MONTO PRIMERO.', 'warning');
            }
        } catch (err) {
            showToast('ERROR AL PEGAR', 'error');
        }
    }

    const totalPagadoUSD = useMemo(() => {
        const tasaValida = tasaBcv > 0 ? tasaBcv : 1
        return METODOS_PAGO.reduce((sum, m) => {
            const valStr = String(pagos[m.id] || '0')
            const val = m.type === 'usd' ? parseUSDNumber(valStr) : parseVENumber(valStr)
            return sum + (m.type === 'usd' ? val : val / tasaValida)
        }, 0)
    }, [pagos, tasaBcv])

    const totalVueltoUSD = useMemo(() => {
        const tasaValida = tasaBcv > 0 ? tasaBcv : 1
        const usdVal = parseUSDNumber(vueltoAsignado.usd)
        const bsVal = parseVENumber(vueltoAsignado.bs)
        const pmVal = parseVENumber(vueltoAsignado.pago_movil)
        const tfVal = parseVENumber(vueltoAsignado.transferencia)
        return usdVal + ((bsVal + pmVal + tfVal) / tasaValida)
    }, [vueltoAsignado, tasaBcv])

    const efectivoUSD = useMemo(() => {
        return parseUSDNumber(String(pagos.efectivo_usd || '0'))
    }, [pagos.efectivo_usd])

    const igftUSD = useMemo(() => {
        return efectivoUSD * 0.03
    }, [efectivoUSD])

    const totalConIGFT = useMemo(() => {
        return total + igftUSD
    }, [total, igftUSD])

    // El vuelto teórico total que el cliente debe recibir en USD
    const vueltoTeoricoUSD = Math.max(0, totalPagadoUSD - totalConIGFT)
    const vueltoTeoricoBS = vueltoTeoricoUSD * tasaBcv

    // El monto que falta por pagar (si lo pagado es menor al total)
    const falta = Math.max(0, totalConIGFT - totalPagadoUSD)

    // Si pagó de más, debemos validar que la suma declarada de los vueltos (USD/BS/PM/TF) coincida exactamente con el vuelto teórico.
    // Damos una tolerancia de 0.01 USD para evitar problemas de redondeo de punto flotante.
    const tieneVuelto = totalPagadoUSD > totalConIGFT + 0.005
    const vueltoCuadrado = !tieneVuelto || Math.abs(totalVueltoUSD - vueltoTeoricoUSD) < 0.015

    // El botón se habilita si se pagó lo suficiente, el vuelto ha sido desglosado exactamente, y se llenaron los datos obligatorios del cliente.
    const tieneCliente = String(nombreCliente).trim() !== '' && String(identificacionCliente).trim() !== ''
    const puedeConfirmar = totalPagadoUSD >= totalConIGFT - 0.015 && vueltoCuadrado && tieneCliente

    const handleChange = (id, value) => setPagos(prev => ({ ...prev, [id]: String(value) }))
    const handleVueltoChange = (key, value) => setVueltoAsignado(prev => ({ ...prev, [key]: String(value) }))

    const addZeroes = (key, count) => {
        const val = vueltoAsignado[key] || '0';
        const cents = Math.round((parseFloat(String(val).replace(',', '.')) || 0) * 100);
        const factor = count === 2 ? 100 : 1000;
        const newCents = cents * factor;
        if (newCents > 999999999999) return;
        handleVueltoChange(key, newCents / 100);
    }

    const handleClearVuelto = (key) => {
        handleVueltoChange(key, '');
    }

    const handleNoData = () => {
        setTipoCliente('Persona Natural')
        setPrefixSeleccionado('V-')
        setNombreCliente('CONSUMIDOR FINAL')
        setIdentificacionCliente('99999999-0')
        setCellularCliente('N/A')
        setDireccionCliente('CIUDAD')
        showToast('DATOS FISCALES: CONSUMIDOR FINAL ASIGNADO (SENIAT)', 'info')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!puedeConfirmar || loading) return
        setLoading(true)
        try {
            // Clean up any manually typed prefix to avoid double prefixes
            const cleanId = String(identificacionCliente).replace(/^[vjgeVJGE]-?/, '').trim()
            await onSubmit({
                pagos,
                vuelto_entregado_usd: parseFloat(String(vueltoAsignado.usd || '0').replace(',', '.')) || 0,
                vuelto_entregado_bs: parseFloat(String(vueltoAsignado.bs || '0').replace(',', '.')) || 0,
                vuelto_efectivo_bs: parseFloat(String(vueltoAsignado.bs || '0').replace(',', '.')) || 0,
                vuelto_pago_movil: parseFloat(String(vueltoAsignado.pago_movil || '0').replace(',', '.')) || 0,
                vuelto_transferencia: parseFloat(String(vueltoAsignado.transferencia || '0').replace(',', '.')) || 0,
                cliente_tipo: tipoCliente,
                cliente_nombre: nombreCliente,
                cliente_identificacion: prefixSeleccionado + cleanId,
                cliente_celular: celularCliente,
                cliente_direccion: direccionCliente
            })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.85)',
                zIndex: 9998
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
                style={{
                    width: tieneVuelto ? "90rem" : "55rem",
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#1a1a1a',
                    borderRadius: '24px',
                    border: '2px solid var(--s-neon)',
                    boxShadow: '0 0 60px rgba(0,230,118,0.2)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <div style={{ padding: '1.25rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '2.2rem', fontWeight: 1000, color: '#fff', margin: 0 }}>DESGLOSE DE PAGO</h2>
                            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--s-neon)', margin: '0.2rem 0 0 0' }}>MULTIMÉTODO</p>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0.5rem' }}>
                            <X size={36} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 2.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: tieneVuelto ? 'row' : 'column', gap: '2.5rem' }}>
                        {/* SUB-MODAL PARA INGRESAR DATOS DEL CLIENTE */}
                        <AnimatePresence>
                            {showCustomerModal && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowCustomerModal(false)}
                                    style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        width: '100vw',
                                        height: '100vh',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        background: 'rgba(0,0,0,0.75)',
                                        zIndex: 10000,
                                        backdropFilter: 'blur(4px)'
                                    }}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }
                                        }}
                                        style={{
                                            width: '38rem',
                                            maxWidth: '94vw',
                                            maxHeight: '88vh',
                                            background: '#1a1a1a',
                                            borderRadius: '20px',
                                            border: '2px solid var(--s-neon)',
                                            boxShadow: '0 0 50px rgba(0,230,118,0.25)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--s-neon)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <User size={22} />
                                                DATOS DEL CLIENTE
                                            </h3>
                                            <button type="button" onClick={() => setShowCustomerModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                                <X size={26} />
                                            </button>
                                        </div>
                                        {/* Body */}
                                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
                                            {/* BUSCADOR DE CLIENTES POR NOMBRE O CÉDULA/RIF */}
                                            <div style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.4rem',
                                                background: 'rgba(0,230,118,0.06)',
                                                padding: '0.9rem',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(0,230,118,0.25)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--s-neon)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Search size={16} />
                                                        BUSCAR CLIENTE POR NOMBRE O CÉDULA
                                                    </label>
                                                    {clienteQuery && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setClienteQuery('');
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                        >
                                                            Limpiar
                                                        </button>
                                                    )}
                                                </div>

                                                <div style={{ position: 'relative' }}>
                                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)', pointerEvents: 'none' }} />
                                                    <input
                                                        type="text"
                                                        value={clienteQuery}
                                                        onChange={(e) => {
                                                            setClienteQuery(e.target.value);
                                                            setIsDropdownOpen(true);
                                                        }}
                                                        onFocus={() => setIsDropdownOpen(true)}
                                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                        onKeyDown={(e) => { if (e.key === 'Escape') setIsDropdownOpen(false); }}
                                                        placeholder="Escriba Cédula, RIF o Nombre..."
                                                        className="s-input"
                                                        style={{
                                                            width: '100%',
                                                            paddingLeft: '3rem',
                                                            paddingRight: '1rem',
                                                            background: '#121212',
                                                            border: '1px solid rgba(0,230,118,0.3)',
                                                            color: '#fff',
                                                            fontSize: '1.05rem',
                                                            fontWeight: '800',
                                                            borderRadius: '10px'
                                                        }}
                                                    />

                                                    {/* LISTA FLOTANTE DE RESULTADOS */}
                                                    {isDropdownOpen && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: '110%',
                                                                left: 0,
                                                                right: 0,
                                                                background: '#161d28',
                                                                border: '1px solid var(--s-neon)',
                                                                borderRadius: '10px',
                                                                boxShadow: '0 12px 35px rgba(0,0,0,0.95)',
                                                                zIndex: 1000,
                                                                maxHeight: '220px',
                                                                overflowY: 'auto'
                                                            }}
                                                        >
                                                            {clientesFiltradosPOS.length === 0 ? (
                                                                <div style={{ padding: '1rem', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                                                                    No se encontró cliente con ese criterio.
                                                                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.3rem' }}>
                                                                        Puedes registrar los datos en los campos de abajo.
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                clientesFiltradosPOS.map((cl, idx) => (
                                                                    <div
                                                                        key={cl.id || cl.cedula_rif || idx}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            handleSeleccionarCliente(cl);
                                                                        }}
                                                                        style={{
                                                                            padding: '0.75rem 1rem',
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
                                                                                <span style={{ fontWeight: 900, color: 'var(--s-neon)', fontSize: '0.95rem' }}>
                                                                                    {cl.cedula_rif}
                                                                                </span>
                                                                                <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                                                                                    {cl.nombre_razon_social || cl.nombre || cl.razon_social}
                                                                                </span>
                                                                            </div>
                                                                            {(cl.direccion_fiscal || cl.telefono) && (
                                                                                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                                                                                    {cl.telefono ? `Tel: ${cl.telefono} • ` : ''}{cl.direccion_fiscal || ''}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {cl.tipo_contribuyente === 'ESPECIAL' && (
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#00e5ff', background: 'rgba(0,229,255,0.15)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                                                ESPECIAL (RET. IVA)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.05em' }}>TIPO DE CLIENTE</label>
                                                <select 
                                                    value={tipoCliente} 
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setTipoCliente(val);
                                                        setIdentificacionCliente('');
                                                        setPrefixSeleccionado(val === 'Persona Natural' ? 'V-' : 'J-');
                                                    }}
                                                    className="s-input"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: '#fff',
                                                        padding: '0.7rem 1rem',
                                                        borderRadius: '10px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: '800',
                                                        width: '100%',
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="Persona Natural" style={{ background: '#1a1a1a' }}>Persona Natural</option>
                                                    <option value="Persona Juridica" style={{ background: '#1a1a1a' }}>Persona Jurídica</option>
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.05em' }}>NOMBRE DEL CLIENTE</label>
                                                <input 
                                                    type="text"
                                                    value={nombreCliente}
                                                    onChange={e => setNombreCliente(e.target.value)}
                                                    placeholder="Ingrese Nombre o Razón Social"
                                                    className="s-input"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: '#fff',
                                                        padding: '0.7rem 1rem',
                                                        borderRadius: '10px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: '800',
                                                        width: '100%',
                                                        outline: 'none'
                                                    }}
                                                    required
                                                 />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.05em' }}>
                                                        {tipoCliente === 'Persona Natural' ? 'CÉDULA DE IDENTIDAD' : 'RIF'}
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        {tipoCliente === 'Persona Natural' ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPrefixSeleccionado('V-')}
                                                                    style={{
                                                                        padding: '0.25rem 0.6rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '800',
                                                                        border: '1px solid',
                                                                        borderColor: prefixSeleccionado === 'V-' ? 'var(--s-neon)' : 'rgba(255,255,255,0.1)',
                                                                        background: prefixSeleccionado === 'V-' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                                                                        color: prefixSeleccionado === 'V-' ? 'var(--s-neon)' : '#ccc',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    Venezolano (V-)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPrefixSeleccionado('E-')}
                                                                    style={{
                                                                        padding: '0.25rem 0.6rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '800',
                                                                        border: '1px solid',
                                                                        borderColor: prefixSeleccionado === 'E-' ? 'var(--s-neon)' : 'rgba(255,255,255,0.1)',
                                                                        background: prefixSeleccionado === 'E-' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                                                                        color: prefixSeleccionado === 'E-' ? 'var(--s-neon)' : '#ccc',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    Extranjero (E-)
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPrefixSeleccionado('J-')}
                                                                    style={{
                                                                        padding: '0.25rem 0.6rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '800',
                                                                        border: '1px solid',
                                                                        borderColor: prefixSeleccionado === 'J-' ? 'var(--s-neon)' : 'rgba(255,255,255,0.1)',
                                                                        background: prefixSeleccionado === 'J-' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                                                                        color: prefixSeleccionado === 'J-' ? 'var(--s-neon)' : '#ccc',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    Jurídico (J-)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPrefixSeleccionado('G-')}
                                                                    style={{
                                                                        padding: '0.25rem 0.6rem',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '800',
                                                                        border: '1px solid',
                                                                        borderColor: prefixSeleccionado === 'G-' ? 'var(--s-neon)' : 'rgba(255,255,255,0.1)',
                                                                        background: prefixSeleccionado === 'G-' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.02)',
                                                                        color: prefixSeleccionado === 'G-' ? 'var(--s-neon)' : '#ccc',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    Gubernamental (G-)
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
                                                    {prefixSeleccionado && (
                                                        <div style={{
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            borderRight: 'none',
                                                            borderTopLeftRadius: '10px',
                                                            borderBottomLeftRadius: '10px',
                                                            color: '#ffffff',
                                                            fontWeight: '900',
                                                            fontSize: '1.1rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '0 1rem',
                                                            userSelect: 'none'
                                                        }}>
                                                            {prefixSeleccionado}
                                                        </div>
                                                    )}
                                                    <input 
                                                        type="text"
                                                        value={identificacionCliente}
                                                        onChange={e => setIdentificacionCliente(e.target.value)}
                                                        placeholder={tipoCliente === 'Persona Natural' ? '12345678' : '12345678-9'}
                                                        className="s-input"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            color: '#fff',
                                                            padding: '0.7rem 1rem',
                                                            borderRadius: '10px',
                                                            borderTopLeftRadius: prefixSeleccionado ? '0' : '10px',
                                                            borderBottomLeftRadius: prefixSeleccionado ? '0' : '10px',
                                                            fontSize: '1.1rem',
                                                            fontWeight: '800',
                                                            flex: 1,
                                                            outline: 'none'
                                                        }}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.05em' }}>NÚMERO CELULAR</label>
                                                <input 
                                                    type="tel"
                                                    value={celularCliente}
                                                    onChange={e => setCellularCliente(e.target.value)}
                                                    placeholder="Ej: 0412-1234567"
                                                    className="s-input"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: '#fff',
                                                        padding: '0.7rem 1rem',
                                                        borderRadius: '10px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: '800',
                                                        width: '100%',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.05em' }}>DIRECCIÓN CORTA</label>
                                                <input 
                                                    type="text"
                                                    value={direccionCliente}
                                                    onChange={e => setDireccionCliente(e.target.value)}
                                                    placeholder="Ingresar Dirección"
                                                    className="s-input"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: '#fff',
                                                        padding: '0.7rem 1rem',
                                                        borderRadius: '10px',
                                                        fontSize: '1.1rem',
                                                        fontWeight: '800',
                                                        width: '100%',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {/* Footer */}
                                        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#141414', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowCustomerModal(false)} 
                                                className="s-btn s-btn-primary" 
                                                style={{ height: '3.2rem', fontSize: '1.1rem', fontWeight: 900, padding: '0 2.5rem', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,230,118,0.3)' }}
                                            >
                                                ✓ CONFIRMAR DATOS
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* COLUMNA IZQUIERDA: SECCIÓN DE VUELTO (Solo cuando tieneVuelto es true) */}
                        {tieneVuelto && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{
                                    flex: 1,
                                    borderRight: '1px solid rgba(255,255,255,0.06)',
                                    paddingRight: '2.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.25rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--s-neon)' }}>DESGLOSE DE VUELTO</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        TEÓRICO: ${vueltoTeoricoUSD.toFixed(2)}
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUSD(vueltoTeoricoUSD)}
                                            style={{ background: 'none', border: 'none', padding: '0.1rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                            title="Copiar vuelto teórico en USD"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        {tasaBcv > 0 ? ` (BS ${formatBS(vueltoTeoricoBS)})` : ''}
                                        {tasaBcv > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyBS(vueltoTeoricoBS)}
                                                style={{ background: 'none', border: 'none', padding: '0.1rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                title="Copiar vuelto teórico en Bs"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        )}
                                    </span>
                                </div>

                                {vueltoCuadrado ? (
                                    <div style={{ 
                                        background: 'rgba(0,230,118,0.05)', 
                                        border: '1px solid rgba(0,230,118,0.15)', 
                                        borderRadius: '10px', 
                                        padding: '1.25rem', 
                                        textAlign: 'center' 
                                    }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 1000, color: 'var(--s-neon)', lineHeight: 1.1 }}>
                                            ✓ MONTO DE VUELTO CUADRADO EXACTAMENTE
                                        </div>
                                    </div>
                                ) : (
                                    (() => {
                                        const diff = vueltoTeoricoUSD - totalVueltoUSD;
                                        const isExcedido = diff < 0;
                                        const absDiffUSD = Math.abs(diff);
                                        const absDiffBS = absDiffUSD * tasaBcv;
                                        const cardColor = isExcedido ? '#ff9100' : '#ff3131';
                                        
                                        return (
                                            <div style={{ 
                                                background: isExcedido ? 'rgba(255,145,0,0.05)' : 'rgba(255,49,49,0.05)', 
                                                border: `1px solid ${isExcedido ? 'rgba(255,145,0,0.15)' : 'rgba(255,49,49,0.15)'}`, 
                                                borderRadius: '10px', 
                                                padding: '1.25rem', 
                                                textAlign: 'center' 
                                            }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ccc', letterSpacing: '0.15em', marginBottom: '0.35rem' }}>
                                                    {isExcedido ? 'EXCESO A ENTREGAR (REDUCIR MONTOS)' : 'DIFERENCIA POR ASIGNAR'}
                                                </div>
                                                <div style={{ fontSize: '3rem', fontWeight: 1000, color: cardColor, lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    {isExcedido ? '-' : ''}${absDiffUSD.toFixed(2)}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyUSD(absDiffUSD)}
                                                        style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = cardColor}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                        title="Copiar diferencia en USD"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    {tasaBcv > 0 ? `${isExcedido ? '-' : ''}BS ${formatBS(absDiffBS)}` : 'BS 0,00'}
                                                    {tasaBcv > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyBS(absDiffBS)}
                                                            style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = cardColor}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                            title="Copiar diferencia en Bs"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00e676', display: 'block', marginBottom: '0.5rem' }}>VUELTO EN EFECTIVO (USD)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#00e676', fontWeight: 900, fontSize: '1.4rem', zIndex: 1 }}>$</div>
                                                <CurrencyInput
                                                    currency="USD"
                                                    value={vueltoAsignado.usd}
                                                    onChange={v => handleVueltoChange('usd', v)}
                                                    placeholder="0.00"
                                                    color="#00e676"
                                                    style={{ fontSize: '1.2rem', padding: '1rem 1.25rem 1rem 3rem' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleClearVuelto('usd')}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ff5252',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,82,82,0.1)'; e.currentTarget.style.borderColor = '#ff5252'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Limpiar monto"
                                            >
                                                <Brush size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePasteVuelto('usd')}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#00e676',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#00e676'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Pegar monto de vuelto"
                                            >
                                                <Clipboard size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2196f3', display: 'block', marginBottom: '0.5rem' }}>VUELTO EN EFECTIVO (BS)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#2196f3', fontWeight: 900, fontSize: '1.4rem', zIndex: 1 }}>Bs</div>
                                                <BsInput
                                                    value={vueltoAsignado.bs}
                                                    onChange={v => handleVueltoChange('bs', v)}
                                                    placeholder="0,00"
                                                    color="#2196f3"
                                                    disabled={tasaBcv === 0}
                                                    style={{ fontSize: '1.2rem', padding: '1rem 1.25rem 1rem 3rem' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleClearVuelto('bs')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ff5252',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,82,82,0.1)'; e.currentTarget.style.borderColor = '#ff5252'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Limpiar monto"
                                            >
                                                <Brush size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePasteVuelto('bs')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#2196f3',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#2196f3'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Pegar monto de vuelto"
                                            >
                                                <Clipboard size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: '0.5rem' }}>VUELTO PAGO MÓVIL (BS)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#ffffff', fontWeight: 900, fontSize: '1.4rem', zIndex: 1 }}>Bs</div>
                                                <BsInput
                                                    value={vueltoAsignado.pago_movil}
                                                    onChange={v => handleVueltoChange('pago_movil', v)}
                                                    placeholder="0,00"
                                                    color="#ffffff"
                                                    disabled={tasaBcv === 0}
                                                    style={{ fontSize: '1.2rem', padding: '1rem 1.25rem 1rem 3rem' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleClearVuelto('pago_movil')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ff5252',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,82,82,0.1)'; e.currentTarget.style.borderColor = '#ff5252'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Limpiar monto"
                                            >
                                                <Brush size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePasteVuelto('pago_movil')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#ffffff'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Pegar monto de vuelto"
                                            >
                                                <Clipboard size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: '0.5rem' }}>VUELTO TRANSFERENCIA (BS)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#ffffff', fontWeight: 900, fontSize: '1.4rem', zIndex: 1 }}>Bs</div>
                                                <BsInput
                                                    value={vueltoAsignado.transferencia}
                                                    onChange={v => handleVueltoChange('transferencia', v)}
                                                    placeholder="0,00"
                                                    color="#ffffff"
                                                    disabled={tasaBcv === 0}
                                                    style={{ fontSize: '1.2rem', padding: '1rem 1.25rem 1rem 3rem' }}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleClearVuelto('transferencia')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ff5252',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,82,82,0.1)'; e.currentTarget.style.borderColor = '#ff5252'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Limpiar monto"
                                            >
                                                <Brush size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePasteVuelto('transferencia')}
                                                disabled={tasaBcv === 0}
                                                style={{
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '10px',
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#ffffff',
                                                    cursor: tasaBcv === 0 ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => { if (tasaBcv > 0) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#ffffff'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                title="Pegar monto de vuelto"
                                            >
                                                <Clipboard size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* COLUMNA DERECHA: DESGLOSE DE PAGO */}
                        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                {/* TOTAL A PAGAR CARD */}
                                <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
                                    {igftUSD > 0 ? (
                                        <>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#888', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                                <span>BASE:</span>
                                                <span style={{ color: '#fff' }}>${formatUSD(total)} ({tasaBcv > 0 ? `Bs ${formatBS(totalBs)}` : 'Bs 0,00'})</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffc107', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                                                <span>IGTF (3%):</span>
                                                <span>+${formatUSD(igftUSD)} ({tasaBcv > 0 ? `Bs ${formatBS(igftUSD * tasaBcv)}` : 'Bs 0,00'})</span>
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--s-neon)', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>TOTAL CON IGTF</div>
                                            <div style={{ fontSize: '2.6rem', fontWeight: 1000, color: 'var(--s-neon)', lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                ${formatUSD(totalConIGFT)}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyUSD(totalConIGFT)}
                                                    style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                    title="Copiar total con IGTF en USD"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                {tasaBcv > 0 ? `BS ${formatBS(totalConIGFT * tasaBcv)}` : 'BS 0,00'}
                                                {tasaBcv > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyBS(totalConIGFT * tasaBcv)}
                                                        style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                        title="Copiar total con IGTF en Bs"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#888', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>TOTAL A PAGAR</div>
                                            <div style={{ fontSize: '3rem', fontWeight: 1000, color: 'var(--s-neon)', lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                ${formatUSD(total)}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyUSD(total)}
                                                    style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                    title="Copiar monto en USD"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                {tasaBcv > 0 ? `BS ${formatBS(totalBs)}` : 'BS 0,00'}
                                                {tasaBcv > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyBS(totalBs)}
                                                        style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--s-neon)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                        title="Copiar monto en Bs"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* ESTA FALTANDO CARD */}
                                <div style={{ 
                                    background: falta > 0.005 ? 'rgba(255,49,49,0.05)' : 'rgba(0,230,118,0.05)', 
                                    border: falta > 0.005 ? '1px solid rgba(255,49,49,0.15)' : '1px solid rgba(0,230,118,0.15)', 
                                    borderRadius: '14px', 
                                    padding: '1rem', 
                                    textAlign: 'center',
                                    transition: 'all 0.3s'
                                }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: falta > 0.005 ? '#ff4f4f' : '#888', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                                        {falta > 0.005 ? 'ESTÁ FALTANDO' : 'PAGO COMPLETO'}
                                    </div>
                                    <div style={{ fontSize: '3rem', fontWeight: 1000, color: falta > 0.005 ? '#ff3131' : 'var(--s-neon)', lineHeight: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        ${formatUSD(falta)}
                                        {falta > 0.005 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyUSD(falta)}
                                                style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#ff3131'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                title="Copiar monto en USD"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        {tasaBcv > 0 ? `BS ${formatBS(falta * tasaBcv)}` : 'BS 0,00'}
                                        {tasaBcv > 0 && falta > 0.005 && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyBS(falta * tasaBcv)}
                                                style={{ background: 'none', border: 'none', padding: '0.2rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#ff3131'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                                                title="Copiar monto en Bs"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.25rem" }}>
                                {METODOS_PAGO.map(({ id, nombre, icon: Icon, color, prefix, type: pType }) => {
                                    const isBsDisabled = tasaBcv === 0 && pType === 'bs'
                                    return (
                                        <div key={id}>
                                            <label style={{ fontSize: '1.3rem', fontWeight: 800, color, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <Icon size={20} style={{ color }} />
                                                {nombre}
                                            </label>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color, fontWeight: 900, fontSize: '1.5rem', zIndex: 1 }}>{prefix}</div>
                                                    {pType === 'bs' ? (
                                                        <BsInput
                                                            value={pagos[id]}
                                                            onChange={v => handleChange(id, v)}
                                                            disabled={isBsDisabled}
                                                            placeholder="0,00"
                                                            color={color}
                                                            style={{ fontSize: '1.3rem', padding: '1rem 1.25rem 1rem 3.2rem' }}
                                                        />
                                                    ) : (
                                                        <CurrencyInput
                                                            currency="USD"
                                                            value={pagos[id]}
                                                            onChange={v => handleChange(id, v)}
                                                            placeholder="0.00"
                                                            disabled={isBsDisabled}
                                                            color={color}
                                                            style={{ fontSize: '1.3rem', padding: '1rem 1.25rem 1rem 3.2rem' }}
                                                        />
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange(id, '')}
                                                    disabled={isBsDisabled}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: '10px',
                                                        width: '3.5rem',
                                                        height: '3.5rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#ff5252',
                                                        cursor: isBsDisabled ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => { if (!isBsDisabled) { e.currentTarget.style.background = 'rgba(255,82,82,0.1)'; e.currentTarget.style.borderColor = '#ff5252'; } }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                    title="Limpiar monto"
                                                >
                                                    <Brush size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePaste(id, pType)}
                                                    disabled={isBsDisabled}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: '10px',
                                                        width: '3.5rem',
                                                        height: '3.5rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color,
                                                        cursor: isBsDisabled ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => { if (!isBsDisabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = color; } }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                    title="Pegar monto"
                                                >
                                                    <Clipboard size={18} />
                                                </button>
                                                {id === 'pago_movil' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentVal = parseVENumber(String(pagos.pago_movil || '0'));
                                                            const targetVal = currentVal > 0 ? currentVal : (falta * tasaBcv);
                                                            setPagoMovilQrData({
                                                                banco: '0105',
                                                                telefono: '04121234567',
                                                                cedulaRif: 'J-50462002-3',
                                                                montoBs: targetVal
                                                            });
                                                        }}
                                                        disabled={isBsDisabled}
                                                        style={{
                                                            background: 'rgba(0,230,118,0.1)',
                                                            border: '1px solid rgba(0,230,118,0.3)',
                                                            borderRadius: '10px',
                                                            width: '3.5rem',
                                                            height: '3.5rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'var(--s-neon)',
                                                            cursor: isBsDisabled ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { if (!isBsDisabled) { e.currentTarget.style.background = 'rgba(0,230,118,0.2)'; e.currentTarget.style.borderColor = 'var(--s-neon)'; } }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,230,118,0.1)'; e.currentTarget.style.borderColor = 'rgba(0,230,118,0.3)'; }}
                                                        title="Generar Código QR Pago Móvil"
                                                    >
                                                        <QrCode size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                        </div>
                    </div>

                    <div style={{ padding: '1.25rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={onEditOrder}
                                className="s-btn s-btn-secondary"
                                style={{
                                    flex: 1,
                                    height: '4.2rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 900,
                                    borderRadius: '12px',
                                    letterSpacing: '0.05em'
                                }}
                            >
                                ← EDITAR PEDIDO
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCustomerModal(true)}
                                className="s-btn"
                                style={{
                                    flex: 1.2,
                                    height: '4.2rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 900,
                                    borderRadius: '12px',
                                    letterSpacing: '0.05em',
                                    background: tieneCliente ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    border: tieneCliente ? '1px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.1)',
                                    color: tieneCliente ? 'var(--s-neon)' : '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <User size={18} />
                                {tieneCliente 
                                    ? (nombreCliente === 'CONSUMIDOR FINAL' ? '👤 CONSUMIDOR FINAL' : `👤 ${nombreCliente.slice(0, 16)} ✓`) 
                                    : 'DATOS DEL CLIENTE'}
                            </button>
                            <button
                                type="button"
                                onClick={handleNoData}
                                className="s-btn"
                                style={{
                                    flex: 1,
                                    height: '4.2rem',
                                    fontSize: '1rem',
                                    fontWeight: 900,
                                    borderRadius: '12px',
                                    letterSpacing: '0.03em',
                                    background: 'rgba(255, 179, 0, 0.1)',
                                    border: '1px solid rgba(255, 179, 0, 0.4)',
                                    color: '#ffb300',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    lineHeight: 1.1,
                                    textAlign: 'center'
                                }}
                                title="Asignar automáticamente Consumidor Final (V-99999999-0) según SENIAT"
                            >
                                <User size={18} />
                                CONSUMIDOR FINAL
                            </button>
                            <button
                                type="submit"
                                disabled={!puedeConfirmar || loading}
                                style={{
                                    flex: 1.5,
                                    height: '4.2rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 900,
                                    borderRadius: '12px',
                                    cursor: (!puedeConfirmar || loading) ? 'not-allowed' : 'pointer',
                                    border: 'none',
                                    background: puedeConfirmar ? 'linear-gradient(135deg, var(--s-neon), #00b248)' : 'rgba(255,255,255,0.05)',
                                    color: puedeConfirmar ? '#000' : '#555',
                                    opacity: loading ? 0.7 : 1,
                                    letterSpacing: '0.05em'
                                }}
                            >
                                {loading ? 'PROCESANDO...' : '✓ CONFIRMAR PAGO'}
                            </button>
                        </div>
                    </div>
                </form>
                {pagoMovilQrData && (() => {
                    const { qrUrl } = generarPagoMovilData(pagoMovilQrData);
                    return (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                background: 'rgba(0,0,0,0.9)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 10005
                            }}
                        >
                            <div
                                style={{
                                    background: '#1e1e1e',
                                    border: '2px solid var(--s-neon)',
                                    borderRadius: '20px',
                                    padding: '2rem',
                                    width: '30rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    boxShadow: '0 0 40px rgba(0, 230, 118, 0.3)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: 0 }}>QR PAGO MÓVIL</h3>
                                    <button
                                        type="button"
                                        onClick={() => setPagoMovilQrData(null)}
                                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0.5rem' }}
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div style={{ background: '#fff', padding: '1rem', borderRadius: '14px', marginBottom: '1.5rem' }}>
                                    <img src={qrUrl} alt="Pago Móvil QR" style={{ width: '200px', height: '200px' }} />
                                </div>

                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                                        <span style={{ color: '#888' }}>BANCO:</span>
                                        <span style={{ color: '#fff' }}>0105 - MERCANTIL</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                                        <span style={{ color: '#888' }}>TELÉFONO:</span>
                                        <span style={{ color: '#fff' }}>0412-1234567</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                                        <span style={{ color: '#888' }}>RIF:</span>
                                        <span style={{ color: '#fff' }}>J-50462002-3</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 1000, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.6rem', color: 'var(--s-neon)' }}>
                                        <span>MONTO A PAGAR:</span>
                                        <span>Bs {formatBS(pagoMovilQrData.montoBs)}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textToCopy = `PAGO MOVIL: Banco 0105, Tlf 04121234567, RIF J-50462002-3, Monto: Bs ${formatBS(pagoMovilQrData.montoBs)}`;
                                            navigator.clipboard.writeText(textToCopy);
                                            showToast('Datos de Pago Móvil copiados!', 'success');
                                        }}
                                        style={{
                                            flex: 1,
                                            height: '3.5rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        COPIAR DATOS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleChange('pago_movil', formatBS(pagoMovilQrData.montoBs));
                                            setPagoMovilQrData(null);
                                            showToast('Monto de Pago Móvil aplicado!', 'success');
                                        }}
                                        style={{
                                            flex: 1,
                                            height: '3.5rem',
                                            background: 'linear-gradient(135deg, var(--s-neon), #00b248)',
                                            border: 'none',
                                            borderRadius: '10px',
                                            color: '#000',
                                            fontWeight: 900,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        APLICAR MONTO
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </motion.div>
        </motion.div>
    )
}

export default POS