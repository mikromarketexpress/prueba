import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Image, Link2, RefreshCw, Check, ExternalLink, Loader, Grid, List, Zap } from 'lucide-react'
import { useDatabase } from '../hooks/useDatabase'
import { getImageForProduct, autoLinkAllImages } from '../lib/imageMapper'

const ImageLinker = ({ isOpen, onClose, onImageLinked }) => {
    const { isReady, getProductos, updateProducto } = useDatabase()
    const [products, setProducts] = useState([])
    const [filteredProducts, setFilteredProducts] = useState([])
    const [search, setSearch] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [linking, setLinking] = useState(false)
    const [viewMode, setViewMode] = useState('grid')
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' })

    useEffect(() => {
        if (isReady && isOpen) {
            loadProducts()
        }
    }, [isReady, isOpen])

    useEffect(() => {
        if (search) {
            const q = String(search || '').toLowerCase()
            setFilteredProducts(products.filter(p => 
                String(p.nombre || '').toLowerCase().includes(q) ||
                String(p.codigo_barras || '').toLowerCase().includes(q)
            ))
        } else {
            setFilteredProducts(products)
        }
    }, [search, products])

    const loadProducts = () => {
        const prods = getProductos()
        setProducts(prods)
        setFilteredProducts(prods)
    }

    const autoLinkAll = async () => {
        setLinking(true)
        setProgress({ current: 0, total: products.length, status: 'Iniciando...' })
        
        let linked = 0
        for (let i = 0; i < products.length; i++) {
            const p = products[i]
            setProgress({ current: i + 1, total: products.length, status: `Vinculando: ${p.nombre}` })
            
            if (!p.imagen_url || p.imagen_url.startsWith('data:') || p.imagen_url === '') {
                const imageUrl = getImageForProduct(p.nombre)
                try {
                    await updateProducto({ ...p, imagen_url: imageUrl });
                    linked++
                } catch (err) {
                    console.error('Error linking:', err)
                }
                await new Promise(r => setTimeout(r, 100))
            }
        }
        
        loadProducts()
        setProgress({ current: products.length, total: products.length, status: `¡Completado! ${linked} imágenes vinculadas` })
        setTimeout(() => {
            setLinking(false)
            onImageLinked?.()
        }, 2000)
    }

    const linkProductImage = async (product) => {
        const imageUrl = getImageForProduct(product.nombre)
        try {
            await updateProducto({ ...product, imagen_url: imageUrl });
            loadProducts()
            setSelectedProduct(null)
        } catch (err) {
            console.error('Error linking:', err)
        }
    }

    if (!isOpen) return null

    const productsWithImages = products.filter(p => p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '').length

    return (
        <div className="s-overlay">
            <motion.div
                className="s-overlay__backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                className="s-modal s-modal--crystal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{ width: 'min(95vw, 1400px)', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
            >
                <div className="s-modal__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#fff' }}>
                            <Image size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            VINCULADOR DE IMÁGENES
                        </h2>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--s-neon)' }}>
                            {productsWithImages} de {products.length} productos con imagen
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            className={`s-btn ${viewMode === 'grid' ? 's-btn-primary' : 's-btn-secondary'}`}
                            onClick={() => setViewMode('grid')}
                            style={{ padding: '0.5rem' }}
                        >
                            <Grid size={16} />
                        </button>
                        <button
                            className={`s-btn ${viewMode === 'list' ? 's-btn-primary' : 's-btn-secondary'}`}
                            onClick={() => setViewMode('list')}
                            style={{ padding: '0.5rem' }}
                        >
                            <List size={16} />
                        </button>
                        <button className="s-btn s-btn-secondary s-btn-icon" onClick={onClose}><X size={18} /></button>
                    </div>
                </div>

                <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--s-glass-border)', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--s-neon)' }} />
                        <input
                            name="buscar"
                            id="imagelinker-buscar"
                            className="s-input"
                            style={{ paddingLeft: '3rem', width: '100%' }}
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        className="s-btn s-btn-primary"
                        onClick={autoLinkAll}
                        disabled={linking}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            background: linking ? undefined : 'linear-gradient(135deg, #00e676 0%, #00c853 100%)',
                            border: 'none'
                        }}
                    >
                        {linking ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                        {linking ? `${progress.current}/${progress.total}` : 'AUTO-VINCULAR TODOS'}
                    </button>
                </div>

                {linking && (
                    <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(0,230,118,0.1)', borderBottom: '1px solid rgba(0,230,118,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ color: 'var(--s-neon)', fontSize: '0.75rem', fontWeight: 800 }}>{progress.status}</span>
                            <span style={{ color: 'var(--s-text-dim)', fontSize: '0.75rem' }}>{progress.current}/{progress.total}</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                style={{ height: '100%', background: 'linear-gradient(90deg, #00e676, #00c853)' }}
                            />
                        </div>
                    </div>
                )}

                <div className="s-scroll" style={{ flex: 1, padding: '1rem 1.5rem' }}>
                    {filteredProducts.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.5 }}>
                            <Image size={60} />
                            <p style={{ marginTop: '1rem', fontWeight: 800 }}>No hay productos</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                            {filteredProducts.map(p => (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="s-panel"
                                    style={{
                                        padding: '0.5rem',
                                        cursor: 'pointer',
                                        border: p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? '1px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.1)',
                                        position: 'relative',
                                        transition: 'all 0.2s'
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setSelectedProduct(p)}
                                >
                                    <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                        {p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? (
                                            <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <Image size={30} style={{ opacity: 0.2 }} />
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                                        {p.nombre?.toUpperCase()}
                                    </p>
                                    {p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? (
                                        <Check size={14} style={{ position: 'absolute', top: '0.3rem', right: '0.3rem', color: '#00e676', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '2px' }} />
                                    ) : (
                                        <Link2 size={14} style={{ position: 'absolute', top: '0.3rem', right: '0.3rem', color: 'var(--s-text-dim)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '2px' }} />
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {filteredProducts.map(p => (
                                <div
                                    key={p.id}
                                    className="s-panel"
                                    style={{
                                        padding: '0.75rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        cursor: 'pointer',
                                        border: p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? '1px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.1)'
                                    }}
                                    onClick={() => setSelectedProduct(p)}
                                >
                                    <div style={{ width: '50px', height: '50px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                                        {p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? (
                                            <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Image size={20} style={{ opacity: 0.2 }} />
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{p.nombre}</p>
                                        <p style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)' }}>{p.codigo_barras || 'Sin SKU'} • ${p.precio_usd || p.precio_venta_usd || 0}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? (
                                            <span style={{ fontSize: '0.6rem', color: '#00e676', fontWeight: 800 }}>VINCULADA</span>
                                        ) : (
                                            <span style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)', fontWeight: 800 }}>SIN IMAGEN</span>
                                        )}
                                        {p.imagen_url && !p.imagen_url.startsWith('data:') && p.imagen_url !== '' ? (
                                            <Check size={16} style={{ color: '#00e676' }} />
                                        ) : (
                                            <Link2 size={16} style={{ color: 'var(--s-text-dim)' }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {selectedProduct && (
                    <div className="s-overlay" style={{ zIndex: 1001 }}>
                        <motion.div
                            className="s-overlay__backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedProduct(null)}
                        />
                        <motion.div
                            className="s-modal s-modal--crystal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{ width: '380px' }}
                        >
                            <div className="s-modal__header" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 1000, color: '#fff' }}>{selectedProduct.nombre}</h3>
                                <button className="s-btn s-btn-secondary s-btn-icon" onClick={() => setSelectedProduct(null)}><X size={16} /></button>
                            </div>
                            <div className="s-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <img src={getImageForProduct(selectedProduct.nombre)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <button className="s-btn s-btn-primary" onClick={() => linkProductImage(selectedProduct)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Check size={16} /> VINCULAR ESTA IMAGEN
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default ImageLinker
