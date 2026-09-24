/**
 * CategoryManager v5.0 - Modal de Gestión de Categorías (DEFINITIVO)
 * 
 * - Serialización JSON de iconos al guardar
 * - Deserialización segura al leer
 * - setCategorias con datos del servidor instantáneamente
 * - Validaciones robustas sin undefined
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Edit2, Trash2, X, Plus, Layers, Loader, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { gsService } from '../lib/googleSheetsService';

// ============================================================================
// ICONOS SVG
// ============================================================================

const ICONS = {
    Coffee: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/></svg>,
    Apple: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/></svg>,
    Milk: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/></svg>,
    Beef: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12.5" cy="8.5" r="2.5"/><circle cx="16.5" cy="13.5" r="2.5"/><path d="M6 12a6 6 0 0 0 12 0c0-3-2-4-3-6s-4-5-6-5-4 2-3 5-3 3-3 6Z"/></svg>,
    Pizza: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>,
    Candy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="12" r="3"/><circle cx="15" cy="12" r="3"/></svg>,
    IceCream: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 11v4a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-4Z"/></svg>,
    Brush: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/></svg>,
    Droplets: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/></svg>,
    Dog: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>,
    Baby: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
    Wrench: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    UtensilsCrossed: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Z"/></svg>,
    ShoppingBasket: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 11 4-7"/><path d="m19 11-4-7"/><path d="M2 11h20"/></svg>,
    Layers: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
};

const ICON_OPTIONS = [
    { name: 'Coffee', label: 'BEBIDAS' },
    { name: 'Apple', label: 'FRUTAS' },
    { name: 'Milk', label: 'LÁCTEOS' },
    { name: 'Beef', label: 'CARNES' },
    { name: 'Pizza', label: 'PANADERÍA' },
    { name: 'Candy', label: 'DULCES' },
    { name: 'IceCream', label: 'CONGELADOS' },
    { name: 'Brush', label: 'LIMPIEZA' },
    { name: 'Droplets', label: 'ASEO' },
    { name: 'Dog', label: 'MASCOTAS' },
    { name: 'Baby', label: 'BEBÉ' },
    { name: 'Wrench', label: 'FERRETERÍA' },
    { name: 'Package', label: 'ENLATADOS' },
    { name: 'UtensilsCrossed', label: 'COMIDA' },
    { name: 'ShoppingBasket', label: 'ABARROTES' },
    { name: 'Layers', label: 'VARIOS' }
];

const IconDisplay = ({ name, size = 20 }) => {
    const Icon = ICONS[name] || ICONS['Package'];
    return Icon ? <Icon /> : <ICONS.Package />;
};

// ============================================================================
// COMPONENTE
// ============================================================================

const CategoryManager = ({ isOpen, onClose, products = [], onToast }) => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [editingNamePrevious, setEditingNamePrevious] = useState('');
    const [editingIcon, setEditingIcon] = useState(ICON_OPTIONS[15]);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState(ICON_OPTIONS[15]);
    const [deletingId, setDeletingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // ============================================================================
    // CARGAR CATEGORÍAS DESDE EL SERVICIO (async/await)
    // ============================================================================

    const loadCategories = useCallback(async () => {
        try {
            await gsService.initialize();
            return gsService.getTable('Categorias') || [];
        } catch (err) {
            console.error('[CategoryManager] Error cargando:', err);
            return [];
        }
    }, []);

    // ============================================================================
    // CICLO DE VIDA
    // ============================================================================

    useEffect(() => {
        if (!isOpen) return;

        console.log('[CategoryManager] Abriendo...');
        setIsLoading(true);
        
        const init = async () => {
            const cats = await loadCategories();
            setCategories(cats);
            setIsLoading(false);
        };
        init();
    }, [isOpen, loadCategories]);

    // ============================================================================
    // HELPERS
    // ============================================================================

    const getProductCount = useCallback((catId) => {
        if (!products || !Array.isArray(products)) return 0;
        return products.filter(p => p && p.categoria_id === catId).length;
    }, [products]);

    const isDuplicateName = (name, excludeId = null) => {
        if (!categories || !Array.isArray(categories)) return false;
        const upper = name.trim().toUpperCase();
        return categories.some(c => c && c.id !== excludeId && c.nombre === upper);
    };

    // ============================================================================
    // EDITAR
    // ============================================================================

    const handleEdit = (cat) => {
        setEditingId(cat?.id);
        setEditingName(cat?.nombre || '');
        setEditingNamePrevious(cat?.nombre || '');
        const iconOpt = ICON_OPTIONS.find(i => i.name === (cat?.icono?.name || cat?.icono_nombre)) || ICON_OPTIONS[15];
        setEditingIcon(iconOpt);
        setError('');
    };

    // ============================================================================
    // GUARDAR EDICIÓN (Serialización JSON del icono)
    // ============================================================================

    const handleSaveEdit = async () => {
        if (!editingName?.trim()) {
            setError('NOMBRE REQUERIDO');
            return;
        }

        const trimmed = editingName.trim().toUpperCase();

        if (isDuplicateName(trimmed, editingId)) {
            setError('NOMBRE YA EXISTE');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            // Serialización JSON del icono
            const iconoJSON = JSON.stringify({ name: editingIcon.name, color: '#808080' });
            
            const payload = {
                id: editingId,
                nombre: trimmed,
                categoria_nombre_anterior: editingNamePrevious,
                icono: iconoJSON,
                icono_nombre: editingIcon.name,
                icono_color: '#808080',
                modificado: new Date().toISOString()
            };

            console.log('[CategoryManager] EDITANDO категорию:', payload);

            onToast?.('Actualizando...', 'info');

            // Usar update() en lugar de upsertCategory para más confiabilidad
            const result = await gsService.update('Categorias', payload);
            
            console.log('[CategoryManager] Resultado:', result);
            
            if (!result.success && !result.pending) {
                throw new Error('Error al guardar');
            }

            // Recargar categorías desde el servicio
            const nuevasCategorias = await loadCategories();
            setCategories(nuevasCategorias);
            
            setEditingId(null);
            setEditingName('');
            setEditingNamePrevious('');
            setEditingIcon(ICON_OPTIONS[15]);

            onToast?.('¡Cambios guardados!', 'success');

        } catch (err) {
            console.error('[CategoryManager] Error:', err);
            setError('ERROR AL ACTUALIZAR');
            onToast?.('ERROR AL ACTUALIZAR', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ============================================================================
    // ELIMINAR
    // ============================================================================

    const handleDelete = async (cat) => {
        const count = getProductCount(cat?.id);
        
        if (!window.confirm(`¿ELIMINAR "${cat?.nombre}"?\n${count > 0 ? `${count} producto(s) serán eliminados.` : ''}`)) {
            return;
        }
        
        if (!window.confirm('⚠️ CONFIRMACIÓN FINAL')) return;

        setDeletingId(cat?.id);
        setIsSaving(true);

        try {
            if (count > 0) {
                const prods = gsService.getTable('Productos') || [];
                const toDelete = prods.filter(p => p && p.categoria_id === cat?.id);
                
                for (const prod of toDelete) {
                    await gsService.delete('Productos', prod.id);
                }
            }

            await gsService.delete('Categorias', cat?.id);
            const nuevasCategorias = await loadCategories();
            setCategories(nuevasCategorias);
            onToast?.('CATEGORÍA ELIMINADA', 'success');

        } catch (err) {
            console.error('[CategoryManager] Delete error:', err);
            onToast?.('ERROR AL ELIMINAR', 'error');
        } finally {
            setDeletingId(null);
            setIsSaving(false);
        }
    };

    // ============================================================================
    // CREAR NUEVA
    // ============================================================================

    const handleCreateNew = async () => {
        if (!newCategoryName?.trim()) {
            setError('NOMBRE REQUERIDO');
            return;
        }

        const trimmed = newCategoryName.trim().toUpperCase();

        if (isDuplicateName(trimmed)) {
            setError('NOMBRE YA EXISTE');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const payload = {
                nombre: trimmed,
                icono: JSON.stringify({ name: newCategoryIcon.name, color: '#808080' }),
                icono_nombre: newCategoryIcon.name,
                icono_color: '#808080',
                orden: (categories?.length || 0) + 1,
                creado: new Date().toISOString(),
                modificado: new Date().toISOString()
            };

            console.log('[CategoryManager] Creando (icono serializado):', payload.icono);

            const result = await gsService.upsertCategory(payload);
            
            if (!result.success && !result.pending) {
                throw new Error('Error al crear');
            }

            const categoriasDelServidor = result.categorias || await loadCategories();
            setCategories(categoriasDelServidor);
            
            setNewCategoryName('');
            setNewCategoryIcon(ICON_OPTIONS[15]);
            setShowNewForm(false);

            onToast?.('CATEGORÍA CREADA', 'success');

        } catch (err) {
            console.error('[CategoryManager] Create error:', err);
            setError('ERROR AL CREAR');
            onToast?.('ERROR AL CREAR', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditingName('');
        setEditingNamePrevious('');
        setEditingIcon(ICON_OPTIONS[15]);
        setShowNewForm(false);
        setNewCategoryName('');
        setNewCategoryIcon(ICON_OPTIONS[15]);
        setError('');
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    if (!isOpen) return null;

    const categorias = categories || [];
    const totalCategorias = categorias.length;

    return (
        <div className="s-overlay" style={{ zIndex: 99999 }}>
            <motion.div
                className="s-overlay__backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="s-modal s-modal--crystal"
                style={{ width: 'min(560px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div style={{ 
                    padding: '1.25rem 1.5rem',
                    background: 'linear-gradient(135deg, rgba(0,230,118,0.08) 0%, rgba(0,230,118,0.02) 100%)',
                    borderBottom: '1px solid rgba(0, 230, 118, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '2.5rem', height: '2.5rem', borderRadius: '10px',
                            background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Sparkles size={18} style={{ color: 'var(--s-neon)' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#fff', margin: 0 }}>
                                GESTIÓN DE CATEGORÍAS
                            </h2>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--s-neon)' }}>
                                {totalCategorias} CATEGORÍA{totalCategorias !== 1 ? 'S' : ''} • GOOGLE SHEETS
                            </span>
                        </div>
                    </div>
                    <button className="s-btn s-btn-secondary s-btn-icon" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--s-neon)' }}>
                            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: '0.5rem' }}>Cargando categorías...</p>
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            {showNewForm ? (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        padding: '1.25rem', marginBottom: '1.5rem',
                                        background: 'rgba(0,230,118,0.05)',
                                        border: '1px solid rgba(0,230,118,0.2)',
                                        borderRadius: '12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <Plus size={14} style={{ color: 'var(--s-neon)' }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--s-neon)' }}>
                                            NUEVA CATEGORÍA
                                        </span>
                                    </div>
                                    
                                    <input
                                        name="nombre"
                                        id="nueva-categoria-nombre"
                                        className={`s-input ${error ? 's-input--error' : ''}`}
                                        value={newCategoryName}
                                        onChange={e => { setNewCategoryName(e.target.value.toUpperCase()); setError(''); }}
                                        placeholder="NOMBRE DE LA CATEGORÍA"
                                        style={{ marginBottom: '1rem', fontWeight: 800 }}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); if (e.key === 'Escape') handleCancel(); }}
                                        autoFocus
                                    />

                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.65rem', color: 'var(--s-text-dim)', display: 'block', marginBottom: '0.5rem' }}>ICONO</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {ICON_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.name}
                                                    onClick={() => setNewCategoryIcon(opt)}
                                                    style={{
                                                        width: '2.75rem', height: '2.75rem', borderRadius: '10px',
                                                        background: newCategoryIcon.name === opt.name ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.03)',
                                                        border: newCategoryIcon.name === opt.name ? '2px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.08)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', transition: 'all 0.2s',
                                                        color: newCategoryIcon.name === opt.name ? 'var(--s-neon)' : '#fff'
                                                    }}
                                                >
                                                    <IconDisplay name={opt.name} size={18} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {error && <div style={{ color: '#ff5252', marginBottom: '1rem', fontSize: '0.7rem' }}>{error}</div>}

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="s-btn s-btn-secondary" onClick={handleCancel} style={{ flex: 1 }}>CANCELAR</button>
                                        <button className="s-btn s-btn-primary" onClick={handleCreateNew} disabled={isSaving} style={{ flex: 1 }}>
                                            {isSaving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'CREAR'}
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <button
                                    onClick={() => setShowNewForm(true)}
                                    className="s-btn s-btn-secondary"
                                    style={{ width: '100%', marginBottom: '1.5rem', border: '2px dashed rgba(0,230,118,0.3)' }}
                                >
                                    <Plus size={16} style={{ color: 'var(--s-neon)' }} />
                                    AGREGAR NUEVA CATEGORÍA
                                </button>
                            )}

                            {/* Lista */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {totalCategorias === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--s-text-dim)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                                        <Layers size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                                        <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>No hay categorías</p>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>Crea tu primera categoría desde el botón de arriba</p>
                                    </div>
                                ) : (
                                    categorias.map(cat => {
                                        const count = getProductCount(cat?.id);
                                        const isEditing = editingId === cat?.id;
                                        const isDeleting = deletingId === cat?.id;
                                        const nombreIcono = cat?.icono?.name || cat?.icono_nombre || 'Package';

                                        return (
                                            <motion.div
                                                key={cat?.id || Math.random()}
                                                layout
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                style={{
                                                    padding: '1rem 1.25rem',
                                                    background: isDeleting ? 'rgba(255,82,82,0.08)' : isEditing ? 'rgba(0,230,118,0.05)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${isDeleting ? 'rgba(255,82,82,0.3)' : isEditing ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                                    borderRadius: '12px'
                                                }}
                                            >
                                                {isEditing ? (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                                            <div style={{ color: 'var(--s-neon)', padding: '0.5rem', background: 'rgba(0,230,118,0.1)', borderRadius: '8px' }}>
                                                                <IconDisplay name={editingIcon.name} size={24} />
                                                            </div>
                                                            <input
                                                                name="nombre"
                                                                id="categoria-editar-nombre"
                                                                className="s-input"
                                                                value={editingName}
                                                                onChange={e => setEditingName(e.target.value.toUpperCase())}
                                                                style={{ flex: 1, fontWeight: 800 }}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancel(); }}
                                                                autoFocus
                                                            />
                                                        </div>

                                                        <div style={{ marginBottom: '1rem' }}>
                                                            <label style={{ fontSize: '0.6rem', color: 'var(--s-text-dim)', display: 'block', marginBottom: '0.5rem' }}>ICONO</label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                                {ICON_OPTIONS.map(opt => (
                                                                    <button
                                                                        key={opt.name}
                                                                        onClick={() => setEditingIcon(opt)}
                                                                        style={{
                                                                            width: '2.5rem', height: '2.5rem', borderRadius: '8px',
                                                                            background: editingIcon.name === opt.name ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.03)',
                                                                            border: editingIcon.name === opt.name ? '2px solid var(--s-neon)' : '1px solid rgba(255,255,255,0.06)',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            color: editingIcon.name === opt.name ? 'var(--s-neon)' : '#fff'
                                                                        }}
                                                                    >
                                                                        <IconDisplay name={opt.name} size={16} />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {error && <div style={{ color: '#ff5252', marginBottom: '1rem', fontSize: '0.7rem' }}>{error}</div>}

                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button className="s-btn s-btn-secondary" onClick={handleCancel} disabled={isSaving} style={{ flex: 1 }}>CANCELAR</button>
                                                            <button className="s-btn s-btn-primary" onClick={handleSaveEdit} disabled={isSaving} style={{ flex: 1 }}>
                                                                {isSaving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'GUARDAR'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ 
                                                            width: '3rem', height: '3rem', borderRadius: '10px',
                                                            background: 'rgba(0,230,118,0.1)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'var(--s-neon)'
                                                        }}>
                                                            <IconDisplay name={nombreIcono} size={22} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>{cat?.nombre || 'SIN NOMBRE'}</span>
                                                            <span style={{ fontSize: '0.65rem', color: count > 0 ? 'var(--s-neon)' : 'var(--s-text-dim)', display: 'block' }}>
                                                                {count} producto{count !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={() => handleEdit(cat)}
                                                                disabled={isDeleting || isSaving}
                                                                style={{
                                                                    width: '2.25rem', height: '2.25rem', borderRadius: '8px',
                                                                    background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
                                                                    opacity: isDeleting || isSaving ? 0.5 : 1
                                                                }}
                                                            >
                                                                <Edit2 size={14} style={{ color: 'var(--s-neon)' }} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(cat)}
                                                                disabled={isDeleting || isSaving}
                                                                style={{
                                                                    width: '2.25rem', height: '2.25rem', borderRadius: '8px',
                                                                    background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.2)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
                                                                    opacity: isDeleting || isSaving ? 0.5 : 1
                                                                }}
                                                            >
                                                                {isDeleting ? <Loader size={14} style={{ color: '#ff5252', animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} style={{ color: '#ff5252' }} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="s-btn s-btn-secondary" onClick={onClose}>CERRAR</button>
                </div>
            </motion.div>
        </div>
    );
};

export default CategoryManager;