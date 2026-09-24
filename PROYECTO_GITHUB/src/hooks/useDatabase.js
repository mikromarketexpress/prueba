/**
 * useDatabase.js - Hook Definitivo v8.1 (REFACTORIZADO)
 * ===========================================
 * 
 * 100% Google Sheets
 * Patrón: initialize() -> getTable() -> setState()
 */

import { useState, useEffect, useCallback } from 'react';
import { gsService } from '../lib/googleSheetsService';

export function useDatabase() {
  const [productos, setProductos] = useState(() => gsService.getTable('Productos') || []);
  const [categorias, setCategorias] = useState(() => gsService.getTable('Categorias') || []);
  const [loading, setLoading] = useState(() => {
    const cachedProds = gsService.getTable('Productos') || [];
    return cachedProds.length === 0;
  });
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncingStatus, setSyncingStatus] = useState({});

  // ==========================================================================
  // INICIALIZACIÓN - Async/Await (Segundo Plano si hay Cache)
  // ==========================================================================

  useEffect(function() {
    var init = async function() {
      const cachedProds = gsService.getTable('Productos') || [];
      if (cachedProds.length === 0) {
        setLoading(true);
      }
      try {
        await gsService.initialize();
        setProductos(gsService.getTable('Productos') || []);
        setCategorias(gsService.getTable('Categorias') || []);
      } catch(err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(function() {
    var handleOnline = function() { setIsOnline(true); };
    var handleOffline = function() { setIsOnline(false); };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    
    return function() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Polling automático en segundo plano cada 15 segundos para tener "tiempo real"
  useEffect(function() {
    if (!isOnline) return;

    var timer = setInterval(async function() {
      try {
        await gsService.refresh();
        setProductos(gsService.getTable('Productos') || []);
        setCategorias(gsService.getTable('Categorias') || []);
      } catch(err) {
        console.warn('[useDatabase] Background sync error:', err.message);
      }
    }, 15000);

    return function() {
      clearInterval(timer);
    };
  }, [isOnline]);

  // ==========================================================================
  // PRODUCTOS - CRUD (OPTIMISTA - NO BLOQUEA UI)
  // ==========================================================================

  var silentRefresh = useCallback(async function() {
    try {
      await gsService.refresh();
      setProductos(gsService.getTable('Productos') || []);
      setCategorias(gsService.getTable('Categorias') || []);
    } catch(err) {
      console.warn('[useDatabase] silentRefresh error:', err.message);
    }
  }, []);

  var addProducto = useCallback(async function(producto) {
    // Generate a temporary ID starting with temp_
    const tempId = String(producto.id).startsWith('temp_') ? producto.id : 'temp_' + Date.now();
    const productWithTempId = Object.assign({}, producto, { id: tempId, _isOptimistic: true });

    // Set syncing status to 'saving'
    setSyncingStatus(prev => Object.assign({}, prev, { [tempId]: 'saving' }));

    // Add to list immediately
    setProductos(function(prev) {
      return [productWithTempId, ...prev];
    });

    try {
      // Send upsert to server (Code.gs knows to assign sequential ID to temp_ ids)
      var result = await gsService.upsertProducto(producto);
      
      if (result.success) {
        const realId = result.id || tempId;
        const finalImageUrl = result.imagen_url || '';
        // Update product in local state with real server ID and final image URL
        setProductos(function(prev) {
          return prev.map(function(p) {
            if (String(p.id) !== String(tempId)) return p;
            // Use server URL if valid; otherwise keep local URL only if it's not a blob/data preview
            const localUrl = (p.imagen_url && !p.imagen_url.startsWith('blob:') && !p.imagen_url.startsWith('data:')) ? p.imagen_url : '';
            const bestUrl = finalImageUrl || localUrl;
            return Object.assign({}, p, { id: realId, imagen_url: bestUrl, _isOptimistic: false });
          });
        });
        
        // Remove from syncing status
        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[tempId];
          return next;
        });

        // Trigger background silent refresh to ensure full parity
        setTimeout(function() { silentRefresh(); }, 2000);
      } else {
        // Rollback on failure
        setProductos(function(prev) {
          return prev.filter(function(p) { return String(p.id) !== String(tempId); });
        });
        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[tempId];
          return next;
        });
      }
      return result;
    } catch(err) {
      // Rollback on error
      setProductos(function(prev) {
        return prev.filter(function(p) { return String(p.id) !== String(tempId); });
      });
      setSyncingStatus(prev => {
        const next = Object.assign({}, prev);
        delete next[tempId];
        return next;
      });
      return { success: false, error: err.message };
    }
  }, [silentRefresh]);

  var updateProducto = useCallback(async function(producto) {
    const id = producto.id;
    let originalProduct = null;

    // Set syncing status to 'saving'
    setSyncingStatus(prev => Object.assign({}, prev, { [id]: 'saving' }));

    // Update locally immediately
    setProductos(function(prev) {
      const found = prev.find(p => String(p.id) === String(id));
      if (found) originalProduct = found;
      return prev.map(function(p) {
        return String(p.id) === String(id) 
          ? Object.assign({}, p, producto, { imagen_url: producto.imagen_url || p.imagen_url }) 
          : p;
      });
    });

    try {
      var result = await gsService.upsertProducto(producto);
      
      if (result.success) {
        // Update product locally with response values (like final image URL)
        const finalImageUrl = result.imagen_url || '';
        setProductos(function(prev) {
          return prev.map(function(p) {
            if (String(p.id) !== String(id)) return p;
            // Use server URL if valid; otherwise keep local URL only if it's not a blob/data preview
            const localUrl = (p.imagen_url && !p.imagen_url.startsWith('blob:') && !p.imagen_url.startsWith('data:')) ? p.imagen_url : '';
            const bestUrl = finalImageUrl || localUrl;
            return Object.assign({}, p, { imagen_url: bestUrl });
          });
        });

        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[id];
          return next;
        });

        setTimeout(function() { silentRefresh(); }, 2000);
      } else {
        // Rollback on failure
        if (originalProduct) {
          setProductos(function(prev) {
            return prev.map(p => String(p.id) === String(id) ? originalProduct : p);
          });
        }
        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[id];
          return next;
        });
      }
      return result;
    } catch(err) {
      // Rollback on error
      if (originalProduct) {
        setProductos(function(prev) {
          return prev.map(p => String(p.id) === String(id) ? originalProduct : p);
        });
      }
      setSyncingStatus(prev => {
        const next = Object.assign({}, prev);
        delete next[id];
        return next;
      });
      return { success: false, error: err.message };
    }
  }, [silentRefresh]);

  var deleteProducto = useCallback(async function(id) {
    let originalProduct = null;

    setSyncingStatus(prev => Object.assign({}, prev, { [id]: 'deleting' }));

    // Delete locally immediately
    setProductos(function(prev) {
      const found = prev.find(p => String(p.id) === String(id));
      if (found) originalProduct = found;
      return prev.filter(p => String(p.id) !== String(id));
    });

    try {
      var result = await gsService.deleteProducto(id);
      
      if (result.success) {
        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[id];
          return next;
        });
        setTimeout(function() { silentRefresh(); }, 2000);
      } else {
        // Rollback deletion
        if (originalProduct) {
          setProductos(function(prev) {
            return [originalProduct, ...prev];
          });
        }
        setSyncingStatus(prev => {
          const next = Object.assign({}, prev);
          delete next[id];
          return next;
        });
      }
      return result;
    } catch(err) {
      // Rollback deletion
      if (originalProduct) {
        setProductos(function(prev) {
          return [originalProduct, ...prev];
        });
      }
      setSyncingStatus(prev => {
        const next = Object.assign({}, prev);
        delete next[id];
        return next;
      });
      return { success: false, error: err.message };
    }
  }, [silentRefresh]);

  // ==========================================================================
  // CATEGORÍAS - CRUD (async/await)
  // ==========================================================================

  var addCategory = useCallback(async function(categoria) {
    var result = await gsService.upsertCategory(categoria);
    if (result.success) {
      await gsService.refresh();
      setCategorias(gsService.getTable('Categorias') || []);
    }
    return result;
  }, []);

  var updateCategory = useCallback(async function(categoria) {
    var result = await gsService.upsertCategory(categoria);
    if (result.success) {
      await gsService.refresh();
      setCategorias(gsService.getTable('Categorias') || []);
    }
    return result;
  }, []);

  var deleteCategory = useCallback(async function(id) {
    var result = await gsService.deleteCategory(id);
    if (result.success) {
      await gsService.refresh();
      setCategorias(gsService.getTable('Categorias') || []);
    }
    return result;
  }, []);

  // ==========================================================================
  // BÚSQUEDA - String(dato).trim().toLowerCase()
  // ==========================================================================

  var searchProducts = useCallback(function(query) {
    if (!query || !query.trim()) return productos;
    
    var q = String(query || '').trim().toLowerCase();
    
    return productos.filter(function(p) {
      var nombre = String(p.nombre || '').toLowerCase();
      var desc = String(p.descripcion_corta || '').toLowerCase();
      var categoria = String(p.categoria || p.categoria_nombre || '').toLowerCase();
      var codigo = String(p.codigo_barras || '').toLowerCase();
      
      return nombre.includes(q) || desc.includes(q) || categoria.includes(q) || codigo.includes(q);
    });
  }, [productos]);

  var getProductsByCategory = useCallback(function(categoryName) {
    if (!categoryName) return productos;
    
    var cat = String(categoryName || '').toUpperCase().trim();
    
    return productos.filter(function(p) {
      var c = String(p.categoria || p.categoria_nombre || '').toUpperCase().trim();
      return c === cat;
    });
  }, [productos]);

  var getProductById = useCallback(function(id) {
    return productos.find(function(p) { return p.id === id; }) || null;
  }, [productos]);

  // ==========================================================================
  // REFRESH (async/await)
  // ==========================================================================

  var refresh = useCallback(async function() {
    setLoading(true);
    try {
      await gsService.refresh();
      setProductos(gsService.getTable('Productos') || []);
      setCategorias(gsService.getTable('Categorias') || []);
      return { success: true };
    } catch(err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================================
  // MÉTODOS LEGACY (compatibilidad)
  // ==========================================================================

  var forceSync = refresh;

  var getProductos = useCallback(function() { return productos; }, [productos]);
  var getCategorias = useCallback(function() { return categorias; }, [categorias]);
  var getConfiguracion = useCallback(function() { 
    return gsService.getTable('Configuracion') || { tasa_bcv: gsService.getTasaBcv() || 46.5 }; 
  }, []);
  var getSesionActiva = useCallback(function() { 
    var cajas = gsService.getTable('Caja') || [];
    return cajas.find(function(c) { return c && (c.estado === 'ACTIVA' || c.estado === 'abierta'); }) || null; 
  }, []);
  var getVentas = useCallback(function() { 
    return gsService.getVentas() || []; 
  }, []);
  var getCuentasCobrar = useCallback(function() { 
    return gsService.getCuentasCobrar() || []; 
  }, []);
  var getCuentasPagar = useCallback(function() { 
    return gsService.getCuentasPagar() || []; 
  }, []);
  var getClientes = useCallback(function() { 
    return gsService.getClientes() || []; 
  }, []);
  var saveVenta = useCallback(async function(venta) {
    try {
      var result = await gsService.saveSale(venta);
      if (result.success) {
        setProductos(gsService.getTable('Productos') || []);
        setCategorias(gsService.getTable('Categorias') || []);
      }
      return result;
    } catch(err) {
      return { success: false, error: err.message };
    }
  }, []);
  var updateStock = useCallback(function(id, newStock) {
    var prod = productos.find(function(p) { return p.id === id; });
    if (prod) {
      return gsService.upsertProducto(Object.assign({}, prod, { stock: newStock }));
    }
    return Promise.resolve({ success: false });
  }, [productos]);
  var saveCategoria = useCallback(function(categoria) {
    return gsService.upsertCategory(categoria);
  }, []);
  var dataVersion = useCallback(function() { return Date.now(); }, []);

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  return {
    productos: productos,
    categorias: categorias,
    loading: loading,
    error: error,
    isOnline: isOnline,
    isReady: !loading,
    syncingStatus: syncingStatus,
    addProducto: addProducto,
    updateProducto: updateProducto,
    deleteProducto: deleteProducto,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
    searchProducts: searchProducts,
    getProductsByCategory: getProductsByCategory,
    getProductById: getProductById,
    refresh: refresh,
    forceSync: forceSync,
    getProductos: getProductos,
    getCategorias: getCategorias,
    getConfiguracion: getConfiguracion,
    getSesionActiva: getSesionActiva,
    getVentas: getVentas,
    getCuentasCobrar: getCuentasCobrar,
    getCuentasPagar: getCuentasPagar,
    getClientes: getClientes,
    saveVenta: saveVenta,
    updateStock: updateStock,
    saveCategoria: saveCategoria,
    dataVersion: dataVersion
  };
}

export default useDatabase;