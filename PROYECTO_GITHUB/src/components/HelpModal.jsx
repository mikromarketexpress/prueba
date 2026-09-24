import React, { useState, useEffect } from 'react'
import { X, HelpCircle, Package, ShoppingCart, BarChart2, CheckCircle2, AlertTriangle, Search, Info, Trash2, Camera, Layers, Keyboard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const SECTIONS = {
    pos: {
        id: 'pos',
        title: 'TPV (Punto de Venta)',
        icon: ShoppingCart,
        items: [
            { icon: Search, title: 'Buscador', desc: 'Escanea el código o escribe el nombre. Presiona Enter para añadir al carrito.' },
            { icon: Keyboard, title: 'Comandos de Teclado', desc: 'F1: Ayuda\nF5: Refrescar Sistema\nEnter: Aprobar Cobro\nESC: Cerrar Carrito/Modales' },
            { icon: ShoppingCart, title: 'Carrito de Compras', desc: 'Usa los botones +/- para modificar cantidades. Usa la papelera roja para eliminar un item del pedido. El total al final se calcula en tiempo real.' }
        ]
    },
    registry: {
        id: 'registry',
        title: 'Registro de Productos',
        icon: Camera,
        items: [
            { icon: Camera, title: 'Imagen Interactiva', desc: 'Haz clic sobre el recuadro para subir la foto. Aparecerá un botón rojo para eliminarla si te equivocas al cargarla.' },
            { icon: AlertTriangle, title: 'Código de Barras/SKU', desc: 'Campo obligatorio. Si el código ya existe, el sistema brillará en Amarillo y no permitirá el duplicado en la base de datos.' },
            { icon: Package, title: 'Stock y Unidades', desc: 'El Stock es la cantidad física. El Número de Unid. es cuánto trae el empaque. El sistema activa por defecto una alerta de reposición al llegar a 5 unidades.' },
            { icon: Info, title: 'Tipos de Precios', desc: 'Ingrese el precio en USD. El sistema valida automáticamente que sea un formato numérico con o sin decimales (Ej: 1.50).' },
            { icon: CheckCircle2, title: 'Validación Visual', desc: 'Borde Rojo = Campo vacío/error que bloquea el registro.\nBorde Verde = Campo activo para edición.' }
        ]
    },
    inventory: {
        id: 'inventory',
        title: 'Inventario y Categorías',
        icon: Layers,
        items: [
            { icon: Layers, title: 'Gestión de Filas', desc: 'Cada fila en tu inventario permite Editar (icono lápiz) o Borrar (icono papelera roja).' },
            { icon: Trash2, title: 'Borrado en Cascada', desc: 'Al borrar un producto de la tabla principal, se elimina su historial de precios y lotes automáticamente tras confirmar en el aviso rojo.' },
            { icon: Package, title: 'Nueva Categoría', desc: 'Cómo crear grupos (Ej: Víveres, Charcutería) utilizando el botón "+". Útil para organizar el buscador.' },
            { icon: BarChart2, title: 'Gráficas', desc: 'Próximamente: Visualización de productos más vendidos y niveles de stock crítico del local.' }
        ]
    }
}

const HelpModal = ({ onClose, activePage = 'pos' }) => {
    // Escoger pestaña inicial según donde esté el usuario
    const initialTab = activePage === 'pos' ? 'pos' : (activePage === 'inventory' ? 'registry' : 'pos');
    const [activeTab, setActiveTab] = useState(initialTab);

    return (
        <div className="s-overlay" style={{ zIndex: 10000 }}>
            <motion.div
                className="s-overlay__backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="s-modal s-modal--crystal"
                style={{ width: '48rem', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
            >
                {/* Header Global Fijo */}
                <div className="s-modal__header" style={{ borderBottomColor: 'rgba(0, 230, 118, 0.2)', padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '2.5rem', height: '2.5rem', borderRadius: '10px',
                            background: 'rgba(0, 230, 118, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--s-neon)',
                            border: '1px solid var(--s-neon-glow)'
                        }}>
                            <HelpCircle size={20} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 1000, color: '#fff', textShadow: '0 0 10px rgba(0, 230, 118, 0.3)' }}>MANUAL DEL SISTEMA (F1)</h2>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--s-neon)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                ASISTENTE INTELIGENTE
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="s-btn s-btn-secondary s-btn-icon" style={{ border: 'none', background: 'transparent' }}>
                        <X size={24} style={{ color: 'var(--s-text-primary)' }} />
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Panel Izquierdo: Pestañas */}
                    <div style={{ width: '16rem', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem 1rem', background: 'rgba(0,0,0,0.1)' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)', fontWeight: 800, letterSpacing: '0.1em', paddingLeft: '0.5rem', marginBottom: '0.5rem' }}>SECCIONES</span>
                        {Object.values(SECTIONS).map(tab => {
                            const active = activeTab === tab.id
                            const IconCmp = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.85rem 1rem',
                                        borderRadius: '8px',
                                        background: active ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                                        border: `1px solid ${active ? 'var(--s-neon-glow)' : 'transparent'}`,
                                        color: active ? 'var(--s-neon)' : 'var(--s-text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'left'
                                    }}
                                >
                                    <IconCmp size={18} style={{ color: active ? 'var(--s-neon)' : 'inherit' }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{tab.title}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Panel Derecho: Contenido Activo (Scrollable) */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                            >
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                    {SECTIONS[activeTab].title}
                                </h3>

                                {SECTIONS[activeTab].items.map((item, index) => {
                                    const ItIcon = item.icon
                                    return (
                                        <div key={index} className="s-panel" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'rgba(255,255,255,0.02)' }}>
                                            <div style={{
                                                width: '2.5rem', height: '2.5rem', borderRadius: '8px', flexShrink: 0,
                                                background: 'rgba(0, 230, 118, 0.05)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: '1px solid rgba(0, 230, 118, 0.15)'
                                            }}>
                                                <ItIcon size={18} style={{ color: 'var(--s-neon)' }} />
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--s-text-primary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {item.title}
                                                </h4>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--s-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                                                    {item.desc}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default HelpModal
