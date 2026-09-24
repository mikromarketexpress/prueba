import React from 'react'
import { Filter, ChevronRight, Layers, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Coffee, Pizza, Apple, Milk, Brush, Beef, Droplets, UtensilsCrossed, 
    Candy, IceCream, Dog, Baby, Package, Utensils, Fish, Egg, ShoppingBasket,
    Hammer, Wrench, Truck, Stethoscope
} from 'lucide-react'

const ICON_MAP = {
    Coffee, Pizza, Apple, Milk, Brush, Beef, Droplets, UtensilsCrossed, 
    Candy, IceCream, Dog, Baby, Package, Utensils, Fish, Egg, ShoppingBasket,
    Hammer, Wrench, Truck, Stethoscope, Layers
}

const CATEGORY_KEYWORDS_FOR_ICON = {
    'BEBIDAS': 'Coffee',
    'ALIMENTOS': 'UtensilsCrossed',
    'VÍVERES': 'UtensilsCrossed',
    'VIVERES': 'UtensilsCrossed',
    'FRUTAS': 'Apple',
    'VERDURAS': 'Carrot',
    'LÁCTEOS': 'Milk',
    'LACTEOS': 'Milk',
    'HUEVOS': 'Egg',
    'CARNES': 'Beef',
    'EMBUTIDOS': 'Beef',
    'PANADERÍA': 'Pizza',
    'PANADERIA': 'Pizza',
    'SNACKS': 'Candy',
    'DULCES': 'Candy',
    'CHUCHERÍAS': 'Candy',
    'CHUCHERIAS': 'Candy',
    'CONGELADOS': 'IceCream',
    'LIMPIEZA': 'Brush',
    'ASEO PERSONAL': 'Droplets',
    'CUIDADO PERSONAL': 'Droplets',
    'CUIDADOS DEL HOGAR': 'Brush',
    'MASCOTAS': 'Dog',
    'BEBÉ': 'Baby',
    'VARIOS': 'Layers',
    'FERRETERÍA': 'Wrench',
    'FERRETERIA': 'Wrench',
    'HARINAS': 'ShoppingBasket',
    'ENLATADOS': 'Package',
    'PASTAS': 'Utensils'
}

export const getCategoryIcon = (catNombre = '', icono_nombre = '', iconoColor = null) => {
    // Manejar nuevo formato de icono como objeto
    let iconName = icono_nombre;
    
    if (typeof icono_nombre === 'object' && icono_nombre !== null) {
        iconName = icono_nombre.name || icono_nombre.icono_nombre || 'Layers';
    }
    
    if (iconName && ICON_MAP[iconName]) {
        const IconComp = ICON_MAP[iconName]
        return <IconComp size={16} />
    }
    
    const upper = (catNombre || '').toUpperCase()
    
    for (const [keyword, iconNameFallback] of Object.entries(CATEGORY_KEYWORDS_FOR_ICON)) {
        if (upper.includes(keyword)) {
            const IconComp = ICON_MAP[iconNameFallback]
            if (IconComp) return <IconComp size={16} />
        }
    }
    
    return <Layers size={16} />
}

export const CategoryDropdown = ({ 
    categories, 
    products, 
    selectedCategory, 
    onSelectCategory,
    onManageCategories,
    isDropdownOpen,
    setIsDropdownOpen
}) => {
    return (
        <div className="category-dropdown" style={{ position: 'relative' }}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                className="s-btn s-btn-secondary"
                style={{
                    height: '3.8rem',
                    padding: '0 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    minWidth: '16rem',
                    border: selectedCategory && selectedCategory !== 'all' ? '1px solid var(--s-neon)' : undefined
                }}
            >
                <Filter size={18} style={{ color: 'var(--s-neon)' }} />
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    {!selectedCategory || selectedCategory === 'all'
                        ? 'TODAS LAS CATEGORÍAS'
                        : (categories.find(c => c.id === selectedCategory)?.nombre?.toUpperCase() || 'CATEGORÍA')}
                </span>
                <ChevronRight size={16} style={{ 
                    transform: isDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)', 
                    transition: 'transform 0.2s',
                    marginLeft: 'auto'
                }} />
            </button>

            <AnimatePresence>
                {isDropdownOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            minWidth: '280px',
                            maxHeight: '420px',
                            overflowY: 'auto',
                            background: 'rgba(13, 18, 32, 0.98)',
                            border: '1px solid rgba(0, 230, 118, 0.3)',
                            borderRadius: '12px',
                            padding: '0.5rem',
                            zIndex: 1000,
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        {/* TODOS LOS PRODUCTOS */}
                        <div
                            onClick={() => { onSelectCategory('all'); setIsDropdownOpen(false); }}
                            style={{
                                padding: '0.875rem 1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                background: (!selectedCategory || selectedCategory === 'all') ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                                color: (!selectedCategory || selectedCategory === 'all') ? 'var(--s-neon)' : '#fff',
                                fontWeight: 900,
                                fontSize: '0.85rem',
                                marginBottom: '0.25rem',
                                borderBottom: '1px solid rgba(0, 230, 118, 0.1)',
                                paddingBottom: '1rem'
                            }}
                        >
                            <Layers size={18} />
                            TODOS LOS PRODUCTOS
                            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7, background: 'rgba(0,230,118,0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                {products.length}
                            </span>
                        </div>

                        {/* CATEGORÍAS */}
                        {categories.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--s-text-dim)', fontSize: '0.8rem' }}>
                                Sin categorías
                            </div>
                        ) : (
                            categories.map(cat => {
                                const count = products.filter(p => p.categoria_id === cat.id).length
                                // Obtener nombre del icono de forma flexible
                                const iconName = cat.icono_nombre || cat.icono?.name || 'Layers';
                                const iconColor = cat.icono_color || cat.icono?.color || null;
                                return (
                                    <div
                                        key={cat.id}
                                        onClick={() => { onSelectCategory(cat.id); setIsDropdownOpen(false); }}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            background: selectedCategory === cat.id ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                                            color: selectedCategory === cat.id ? 'var(--s-neon)' : '#fff',
                                            fontWeight: selectedCategory === cat.id ? 900 : 700,
                                            fontSize: '0.85rem',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedCategory !== cat.id) {
                                                e.currentTarget.style.background = 'rgba(0, 230, 118, 0.1)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedCategory !== cat.id) {
                                                e.currentTarget.style.background = 'transparent'
                                            }
                                        }}
                                    >
                                        {getCategoryIcon(cat.nombre, iconName, iconColor)}
                                        {cat.nombre.toUpperCase()}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7, background: selectedCategory === cat.id ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                            {count}
                                        </span>
                                    </div>
                                )
                            })
                        )}

                        {/* BOTÓN EDITAR CATEGORÍAS */}
                        {onManageCategories && (
                            <div
                                onClick={() => { onManageCategories(); setIsDropdownOpen(false); }}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    color: 'var(--s-neon)',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    borderTop: '1px solid rgba(0, 230, 118, 0.2)',
                                    marginTop: '0.5rem',
                                    paddingTop: '1rem',
                                    transition: 'background 0.2s',
                                    background: 'rgba(0, 230, 118, 0.05)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 230, 118, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 230, 118, 0.05)'}
                            >
                                <Settings size={16} />
                                EDITAR CATEGORÍAS
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default CategoryDropdown
