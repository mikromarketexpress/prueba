import React, { useState, useEffect } from 'react'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDatabase } from '../hooks/useDatabase'

const StockAlertBanner = ({ onNavigateInventory }) => {
    const { isReady, getProductos } = useDatabase()
    const [alertas, setAlertas] = useState([])
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        if (isReady) {
            const productos = getProductos()
            const criticos = productos.filter(p => {
                const min = p.stock_minimo || 5
                return (p.stock || 0) <= min
            })
            setAlertas(criticos)
        }
    }, [isReady])

    if (!visible || alertas.length === 0) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                style={{
                    background: 'rgba(255, 152, 0, 0.08)',
                    border: '1px solid rgba(255, 152, 0, 0.35)',
                    borderRadius: '10px',
                    padding: '0.75rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: '0 0 20px rgba(255, 152, 0, 0.1)',
                    cursor: 'pointer',
                    flexShrink: 0
                }}
                onClick={onNavigateInventory}
            >
                <AlertTriangle size={18} style={{ color: '#ff9800', flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(255,152,0,0.6))' }} />
                <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 900, fontSize: '0.8rem', color: '#ff9800' }}>
                        ⚠ STOCK CRÍTICO: {alertas.length} producto{alertas.length !== 1 ? 's' : ''} bajo mínimo —{' '}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,152,0,0.7)', fontWeight: 700 }}>
                        {alertas.slice(0, 3).map(a => a.nombre).join(', ')}{alertas.length > 3 ? ` y ${alertas.length - 3} más...` : ''}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ff9800', fontSize: '0.7rem', fontWeight: 800 }}>
                    VER INVENTARIO <ChevronRight size={14} />
                </div>
                <button
                    onClick={e => { e.stopPropagation(); setVisible(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,152,0,0.5)', padding: '0.25rem' }}
                >
                    <X size={14} />
                </button>
            </motion.div>
        </AnimatePresence>
    )
}

export default StockAlertBanner
