/**
 * GOOGLE SHEETS SERVICE v8.1 - Micro Market Express (DIAGNÓSTICO MEJORADO)
 * ===============================================================
 * Punto único de entrada/salida de datos entre React y Apps Script
 */

const getWebAppUrl = () => {
    const url = import.meta?.env?.VITE_GS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwup--lIgu_r4EmGomBJo1fceZIPdWhG1zrNAt-Jud8NpF5E9q719tzrpH0b-Fl7OL88w/exec';
    return String(url || '').trim().replace(/\s+/g, '').replace(/\/+$/, '');
};

const STORAGE_KEY = 'mme_gs_cache_v8';

export const DEFAULT_CONFIG = {
    nombre_empresa: 'MICRO MARKET EXPRESS',
    rif_empresa: 'J-12345678-9',
    direccion_empresa: 'AV. PRINCIPAL, LOCAL 1, CARACAS',
    telefono_empresa: '+58 412-1234567',
    mensaje_ticket: '¡GRACIAS POR SU COMPRA! VUELVA PRONTO.',
    moneda_defecto: 'USD',
    iva_porcentaje: 16,
    igtf_porcentaje: 3,
    stock_alerta_minimo: 5,
    permitir_venta_sin_stock: true,
    impresion_automatica_ticket: false,
    intervalo_bcv_minutos: 1,
    serial_caja_fiscal: 'MME-POS-01',
    providencia_seniat: 'SNAT/2011/00071'
};

class POSOfflineDB {
    constructor() {
        this.dbName = 'mme_offline_db';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = request.result;
                if (!db.objectStoreNames.contains('pending_actions')) {
                    db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('sales_history')) {
                    db.createObjectStore('sales_history', { keyPath: 'id' });
                }
            };
        });
    }

    async queueAction(action, data) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pending_actions', 'readwrite');
            const store = tx.objectStore('pending_actions');
            const request = store.add({
                action,
                data,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingActions() {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pending_actions', 'readonly');
            const store = tx.objectStore('pending_actions');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removePendingAction(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pending_actions', 'readwrite');
            const store = tx.objectStore('pending_actions');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}

class GoogleSheetsService {
    constructor() {
        this.cache = {};
        this.loading = false;
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.tasaBcv = 0;
        this.tasaBcvEuro = 0;
        this.connectionStatus = 'unknown'; // 'ok' | 'error' | 'unknown' | 'loading'
        this.lastError = null;
        this._init();
    }

    _init() {
        this.offlineDb = new POSOfflineDB();
        this.loadingQueue = false;
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => { 
                this.isOnline = true; 
                this.refresh().then(() => this.syncOfflineQueue()); 
            });
            window.addEventListener('offline', () => { this.isOnline = false; this.connectionStatus = 'error'; });
        }
        this._loadFromLocalStorage();
        // Intentar sincronizar cola inicial después de 3 segundos
        setTimeout(() => this.syncOfflineQueue(), 3000);
    }

    _loadFromLocalStorage() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                this.cache = parsed.data || parsed;
                this.tasaBcv = this.cache?.tasaBCV || 0;
                this.tasaBcvEuro = this.cache?.tasaBCVEuro || Number(localStorage.getItem('mme_tasa_bcv_euro')) || 0;
                console.log('[gs] Cache local cargado:', Object.keys(this.cache).join(', '));
                console.log('[gs] Tasa BCV local USD:', this.tasaBcv, '| EUR:', this.tasaBcvEuro);
                console.log('[gs] Productos en cache:', (this.cache.Productos || []).length);
                console.log('[gs] Categorias en cache:', (this.cache.Categorias || []).length);
            } else {
                this.tasaBcvEuro = Number(localStorage.getItem('mme_tasa_bcv_euro')) || 0;
            }
        } catch(e) {
            console.error('[gs] Error leyendo cache local:', e.message);
            this.cache = {};
        }
    }

    _saveToLocalStorage() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache)); } catch(e) {}
    }

    _notify() { /* deprecated - no-op */ }

    // =========================================================================
    // API METHODS - DIAGNÓSTICO MEJORADO
    // =========================================================================

    async initWithTasa() {
        return this.initialize();
    }

    async initialize() {
        if (this.loading) {
            return new Promise(resolve => setTimeout(() => resolve(this.cache), 500));
        }
        this.loading = true;
        this.connectionStatus = 'loading';

        const url = getWebAppUrl();
        console.log('[gs] Conectando a:', url);

        try {
            // Intento 1: GET con CORS normal y timeout de seguridad de 12s
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
            let response;
            try {
                response = await fetch(url + '?t=' + Date.now(), { 
                    method: 'GET',
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: controller?.signal
                });
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error('Respuesta no es JSON válido. Longitud: ' + text.length + ' chars. Preview: ' + text.substring(0, 300));
            }

            if (json.error) {
                throw new Error('Error del servidor: ' + json.error);
            }

            if (json.success || json.tasaBCV !== undefined) {
                // Preservar ventas locales nuevas que aún no se reflejan en el servidor
                const localVentas = this.cache?.Ventas || [];
                const serverVentas = json.Ventas || [];
                const pendingSales = localVentas.filter(lv => !serverVentas.some(sv => sv.id === lv.id));
                
                this.cache = json;
                this.cache.Ventas = [...pendingSales, ...serverVentas];
                this.cache.Clientes = json.Clientes || this.cache.Clientes || [];
                this.cache.CuentasCobrar = json.CuentasCobrar || this.cache.CuentasCobrar || [];
                this.cache.CuentasPagar = json.CuentasPagar || this.cache.CuentasPagar || [];
                
                this._saveToLocalStorage();
                this.tasaBcv = Number(json.tasaBCV) || 0;
                if (json.tasaBCVEuro || json.tasaEuro || (json.Tasa && json.Tasa.tasa_euro)) {
                    this.tasaBcvEuro = Number(json.tasaBCVEuro || json.tasaEuro || json.Tasa.tasa_euro);
                    this.cache.tasaBCVEuro = this.tasaBcvEuro;
                }
                this.connectionStatus = 'ok';
                this.lastError = null;
                this.syncOfflineQueue();

                const prodCount = (json.Productos || []).length;
                const catCount = (json.Categorias || []).length;
                console.log('[gs] ✅ Conexión exitosa!');
                console.log('[gs]   Tasa BCV USD:', this.tasaBcv, '| EUR:', this.tasaBcvEuro);
                console.log('[gs]   Productos:', prodCount);
                console.log('[gs]   Categorias:', catCount);
                console.log('[gs]   Ventas:', (json.Ventas || []).length);
                console.log('[gs]   Caja:', (json.Caja || []).length);

                return { success: true, tasa: this.tasaBcv, data: this.cache };
            } else {
                throw new Error('Respuesta no contiene datos esperados. Keys: ' + Object.keys(json).join(', '));
            }

        } catch(e) {
            this.connectionStatus = 'error';
            this.lastError = e.message;
            console.error('[gs] ❌ Error de conexión GET:', e.message);
            console.error('[gs]   URL:', url);
            console.error('[gs]   Tipo de error:', e.name);

            // Si hay cache local, usarlo como fallback
            if (this.tasaBcv > 0 || (this.cache.Productos || []).length > 0) {
                console.warn('[gs] ⚠️ Usando datos del cache local como fallback');
                this.connectionStatus = 'error';
                return { success: false, error: e.message, tasa: this.tasaBcv, data: this.cache, fallback: true };
            }

            this.loading = false;
            return { success: false, error: e.message, tasa: 0, data: {} };
        } finally {
            this.loading = false;
        }
    }

    async refresh() {
        return this.initialize();
    }

    async sync() {
        return this.initialize();
    }

    // =========================================================================
    // CRUD OPERATIONS - POST CON DIAGNÓSTICO
    // =========================================================================

    _sanitizeMonetary(obj) {
        const monetaryFields = [
            'precio_usd', 'precio_costo', 'total_costo_usd', 'total_venta_usd', 'total_bs', 'tasa_bcv',
            'pago_efectivo_usd', 'pago_efectivo_bs', 'pago_debito', 'pago_pago_movil', 'pago_bio_pago', 'pago_transferencia',
            'vuelto_entregado_usd', 'vuelto_entregado_bs', 'apertura_usd', 'apertura_bs',
            'cierre_usd', 'cierre_bs', 'cierre_debito', 'cierre_pago_movil', 'cierre_bio_pago', 'cierre_transferencia',
            'base_exenta_usd', 'base_exenta_bs', 'base_imponible_usd', 'base_imponible_bs',
            'iva_usd', 'iva_bs', 'base_igtf_usd', 'base_igtf_bs', 'igtf_usd', 'igtf_bs',
            'total_exento_bs', 'total_base_bs', 'total_iva_bs', 'total_igtf_bs'
        ]
        if (typeof obj !== 'object' || obj === null) return obj
        const cleaned = Array.isArray(obj) ? [] : {}
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && monetaryFields.includes(key)) {
                const normalized = value.replace(/\.(?=\d{3}(\.|,|$))/g, '').replace(',', '.')
                const num = parseFloat(normalized)
                cleaned[key] = isNaN(num) ? 0 : num
            } else if (typeof value === 'object') {
                cleaned[key] = this._sanitizeMonetary(value)
            } else {
                cleaned[key] = value
            }
        }
        return cleaned
    }

    async _post(action, data = {}) {
        const url = getWebAppUrl();
        const sanitized = this._sanitizeMonetary(data)
        const payload = JSON.stringify({ action, data: sanitized });

        try {
            console.log(`[gs] POST → ${action} | Size: ${payload.length} bytes`);

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 20000) : null;
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    body: payload,
                    signal: controller?.signal
                });
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                throw new Error('Respuesta POST no es JSON. Length: ' + text.length + ' Preview: ' + text.substring(0, 200));
            }

            if (result.error) {
                console.error(`[gs] ❌ POST ${action} failed:`, result.error);
                return { success: false, error: result.error };
            }

            console.log(`[gs] ✅ POST ${action} success`);

            // Si la respuesta incluye datos, actualizar cache
            if (result.data) {
                if (result.data.Productos) this.cache.Productos = result.data.Productos;
                if (result.data.Categorias) this.cache.Categorias = result.data.Categorias;
                if (result.data.Caja) this.cache.Caja = result.data.Caja;
                if (result.data.Ventas !== undefined) this.cache.Ventas = result.data.Ventas;
                if (result.data.tasaBCV !== undefined) this.tasaBcv = Number(result.data.tasaBCV);
                if (result.data.driveFiles) this.cache.driveFiles = result.data.driveFiles;
                this._saveToLocalStorage();
            }

            return result;

        } catch(e) {
            console.error(`[gs] ❌ POST ${action} error:`, e.message);
            this.connectionStatus = 'error';
            this.lastError = e.message;

            const actionsQueued = ['SAVE_SALE', 'UPSERT_PRODUCTO', 'UPSERT_CATEGORY', 'DELETE_PRODUCTO', 'DELETE_CATEGORY', 'ABRIR_CAJA', 'CERRAR_CAJA', 'UPSERT_CUENTA_COBRAR', 'UPSERT_CUENTA_PAGAR'];
            if (actionsQueued.includes(action)) {
                try {
                    await this.offlineDb.queueAction(action, data);
                    console.log(`[gs] 📥 Acción ${action} guardada en cola offline.`);
                    
                    if (action === 'SAVE_SALE') {
                        if (!this.cache.Ventas) this.cache.Ventas = [];
                        this.cache.Ventas.unshift(data);
                        this._saveToLocalStorage();
                        return { success: true, offline: true, message: 'Venta registrada localmente' };
                    }
                } catch (dbErr) {
                    console.error('[gs] Error guardando acción offline:', dbErr);
                }
            }
            return { success: false, error: e.message };
        }
    }

    async syncOfflineQueue() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        if (this.loadingQueue) return;
        this.loadingQueue = true;

        try {
            const pending = await this.offlineDb.getPendingActions();
            if (pending.length === 0) return;
            console.log(`[gs] 🔄 Sincronizando ${pending.length} acciones offline pendientes...`);

            for (const item of pending) {
                const url = getWebAppUrl();
                const sanitized = this._sanitizeMonetary(item.data);
                const payload = JSON.stringify({ action: item.action, data: sanitized });

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        redirect: 'follow',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        body: payload
                    });

                    if (response.ok) {
                        const text = await response.text();
                        const result = JSON.parse(text);
                        if (result.success || !result.error) {
                            await this.offlineDb.removePendingAction(item.id);
                            console.log(`[gs] 🌐 Sincronizado con éxito: ${item.action}`);
                        }
                    }
                } catch (err) {
                    console.error(`[gs] Falló intento de sincronización para ${item.action}:`, err.message);
                    break; // Salir del bucle si sigue habiendo error de red
                }
            }
        } catch (e) {
            console.error('[gs] Error sincronizando cola offline:', e);
        } finally {
            this.loadingQueue = false;
        }
    }

    async getProductos() {
        await this.initialize();
        return this.getTable('Productos');
    }

    async getCategorias() {
        await this.initialize();
        return this.getTable('Categorias');
    }

    async getTasaBCV() {
        await this.initialize();
        return this.tasaBcv;
    }

    async upsertProducto(producto) {
        const result = await this._post('UPSERT_PRODUCTO', producto);
        // NO llamar refresh() aquí — useDatabase hace silentRefresh en background
        return result;
    }

    // Alias: update para compatibilidad
    async update(tableName, data) {
        if (tableName === 'Productos' || tableName === 'Productoss') {
            return this.upsertProducto(data);
        }
        if (tableName === 'Categorias' || tableName === 'Categoriass') {
            return this.upsertCategory(data);
        }
        if (tableName === 'Caja') {
            return this.upsertCaja(data);
        }
        if (tableName === 'Usuarios') {
            return this.upsertUsuario(data);
        }
        return this.upsertProducto(data);
    }

    async deleteProducto(id) {
        const result = await this._post('DELETE_PRODUCTO', { id });
        if (result.success) {
            await this.refresh();
        }
        return result;
    }

    // Alias: delete para compatibilidad
    async delete(tableName, id) {
        if (tableName === 'Productos') {
            return this.deleteProducto(id);
        }
        if (tableName === 'Categorias') {
            return this.deleteCategory(id);
        }
        if (tableName === 'Usuarios') {
            return this.deleteUsuario(id);
        }
        return this.deleteProducto(id);
    }

    async upsertCategory(categoria) {
        const result = await this._post('UPSERT_CATEGORY', categoria);
        if (result.success) {
            await this.refresh();
        }
        return result;
    }

    async deleteCategory(id) {
        const result = await this._post('DELETE_CATEGORY', { id });
        if (result.success) {
            await this.refresh();
        }
        return result;
    }

    // Alias: insert para compatibilidad
    async insert(tableName, data) {
        return this.update(tableName, data);
    }

    // Upsert para Caja
    async upsertCaja(caja) {
        const result = await this._post('UPSERT_CAJA', caja);
        return result;
    }

    async abrirSesionCaja(data) {
        // Actualización optimista inmediata en cache y localStorage
        if (!this.cache.Caja) this.cache.Caja = [];
        const existingIdx = this.cache.Caja.findIndex(c => String(c.id) === String(data.id));
        if (existingIdx > -1) {
            this.cache.Caja[existingIdx] = { ...this.cache.Caja[existingIdx], ...data, estado: 'ACTIVA' };
        } else {
            this.cache.Caja.push({ ...data, estado: 'ACTIVA' });
        }
        if (data.tasa_bcv_apertura > 0) {
            this.tasaBcv = Number(data.tasa_bcv_apertura);
            this.cache.tasaBCV = this.tasaBcv;
        }
        this._saveToLocalStorage();

        const result = await this._post('ABRIR_CAJA', data);
        return result;
    }

    async cerrarSesionCaja(data) {
        // Actualización optimista inmediata en cache y localStorage
        try {
            localStorage.removeItem('mme_sesion_caja_id');
        } catch (e) {}
        if (this.cache.Caja) {
            const idx = this.cache.Caja.findIndex(c => String(c.id) === String(data.id));
            if (idx > -1) {
                this.cache.Caja[idx] = { ...this.cache.Caja[idx], ...data, estado: 'CERRADA' };
            }
            this._saveToLocalStorage();
        }

        const result = await this._post('CERRAR_CAJA', data);
        return result;
    }

    async fetchTasaBCV() {
        const result = await this._post('FETCH_TASA_BCV', {});
        if (result.success && result.tasaBCV !== undefined) {
            this.tasaBcv = result.tasaBCV;
            this.cache.tasaBCV = result.tasaBCV;
            this._saveToLocalStorage();
        }
        return result;
    }

    async updateTasaBCV(tasa) {
        const numTasa = parseFloat(tasa) || 0
        if (numTasa < 0) return { success: false, error: 'Tasa inválida' }
        const result = await this._post('UPDATE_TASA', { tasa: numTasa })
        if (result.success) {
            this.tasaBcv = numTasa
            if (result.data?.tasa_bcv !== undefined) this.tasaBcv = Number(result.data.tasa_bcv)
            this.cache.tasaBCV = this.tasaBcv;
            this._saveToLocalStorage()
        }
        return result
    }

    // Alias para compatibilidad
async fetchAndUpdateTasaBcv() {
        let result = { success: false };
        try {
            result = await this._post('FETCH_TASA_BCV', {});
            if (result.success && result.data?.tasa_bcv !== undefined && Number(result.data.tasa_bcv) > 0) {
                this.tasaBcv = Number(result.data.tasa_bcv);
                this.cache.tasaBCV = this.tasaBcv;
                this._saveToLocalStorage();
                return result;
            }
        } catch (e) {
            console.warn('[gs] Error consultando tasa BCV desde Sheets, intentando fallback de DolarApi:', e.message);
        }

        // Fallback: ve.dolarapi.com
        try {
            console.log('[gs] Consultando DolarApi oficial...');
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                const tasaVal = Number(data.promedio || data.venta || 0);
                if (tasaVal > 0) {
                    this.tasaBcv = tasaVal;
                    if (!this.cache) this.cache = {};
                    this.cache.tasaBCV = this.tasaBcv;
                    this._saveToLocalStorage();
                    console.log('[gs] ✅ Tasa obtenida de DolarApi:', this.tasaBcv);
                    
                    // Guardar la tasa obtenida en Google Sheets en background
                    this._post('UPDATE_TASA', { tasa: this.tasaBcv }).catch(err => {
                        console.warn('[gs] No se pudo sincronizar la tasa de DolarApi con Sheets:', err.message);
                    });

                    return { success: true, data: { tasa_bcv: this.tasaBcv }, source: 'dolarapi' };
                }
            }
        } catch (apiErr) {
            console.error('[gs] Error en fallback de DolarApi:', apiErr.message);
        }

        return result;
    }

    async fetchAndUpdateTasaEuro() {
        let result = { success: false };
        try {
            console.log('[gs] Consultando tasa oficial Euro en DolarApi...');
            const response = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                const tasaVal = Number(data.promedio || data.venta || 0);
                if (tasaVal > 0) {
                    const anterior = this.tasaBcvEuro;
                    this.tasaBcvEuro = tasaVal;
                    if (!this.cache) this.cache = {};
                    this.cache.tasaBCVEuro = this.tasaBcvEuro;
                    this._saveToLocalStorage();
                    try { localStorage.setItem('mme_tasa_bcv_euro', this.tasaBcvEuro.toString()); } catch(e) {}
                    console.log('[gs] ✅ Tasa Euro obtenida de DolarApi:', this.tasaBcvEuro);

                    return { 
                        success: true, 
                        data: { tasa_euro: this.tasaBcvEuro }, 
                        cambio: anterior > 0 && Math.abs(anterior - this.tasaBcvEuro) > 0.001,
                        anterior,
                        source: 'dolarapi' 
                    };
                }
            }
        } catch (apiErr) {
            console.error('[gs] Error consultando tasa Euro de DolarApi:', apiErr.message);
        }

        // Si falló DolarApi oficial, probar endpoint general de euros
        try {
            const fallbackResp = await fetch('https://ve.dolarapi.com/v1/euros', { cache: 'no-store' });
            if (fallbackResp.ok) {
                const list = await fallbackResp.json();
                if (Array.isArray(list)) {
                    const oficial = list.find(item => item.fuente === 'oficial') || list[0];
                    const tasaVal = Number(oficial?.promedio || oficial?.venta || 0);
                    if (tasaVal > 0) {
                        const anterior = this.tasaBcvEuro;
                        this.tasaBcvEuro = tasaVal;
                        if (!this.cache) this.cache = {};
                        this.cache.tasaBCVEuro = this.tasaBcvEuro;
                        this._saveToLocalStorage();
                        try { localStorage.setItem('mme_tasa_bcv_euro', this.tasaBcvEuro.toString()); } catch(e) {}
                        return { 
                            success: true, 
                            data: { tasa_euro: this.tasaBcvEuro }, 
                            cambio: anterior > 0 && Math.abs(anterior - this.tasaBcvEuro) > 0.001,
                            anterior,
                            source: 'dolarapi_fallback' 
                        };
                    }
                }
            }
        } catch (e2) {}

        return result;
    }

    async fetchAndUpdateTasas() {
        const [usdRes, eurRes] = await Promise.allSettled([
            this.fetchAndUpdateTasaBcv(),
            this.fetchAndUpdateTasaEuro()
        ]);

        const usdData = usdRes.status === 'fulfilled' && usdRes.value?.success ? usdRes.value : null;
        const eurData = eurRes.status === 'fulfilled' && eurRes.value?.success ? eurRes.value : null;

        const tasaUsd = usdData?.data?.tasa_bcv || this.tasaBcv;
        const tasaEur = eurData?.data?.tasa_euro || this.tasaBcvEuro;

        const hayCambio = (usdData && usdData.cambio) || (eurData && eurData.cambio);

        // Notificar a toda la aplicación en tiempo real mediante evento personalizado
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mme_tasas_updated', {
                detail: {
                    tasaBcv: tasaUsd,
                    tasaBcvEuro: tasaEur,
                    cambioUsd: !!usdData?.cambio,
                    cambioEur: !!eurData?.cambio,
                    timestamp: Date.now()
                }
            }));
        }

        return {
            success: Boolean(tasaUsd > 0 || tasaEur > 0),
            data: {
                tasa_bcv: tasaUsd,
                tasa_euro: tasaEur
            },
            cambio: hayCambio
        };
    }

    // =========================================================================
    // CLIENTES & CUENTAS POR COBRAR / PAGAR (SENIAT)
    // =========================================================================

    // --- CLIENTES ---
    getClientes() {
        const list = this.getTable('Clientes');
        if (!Array.isArray(list)) return [];
        return list.filter(Boolean).map(c => ({
            ...c,
            nombre: c.nombre_razon_social || c.nombre || '',
            nombre_razon_social: c.nombre_razon_social || c.nombre || ''
        }));
    }

    async upsertCliente(cliente) {
        const result = await this._post('UPSERT_CLIENTE', cliente);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.Clientes = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async deleteCliente(id) {
        const result = await this._post('DELETE_CLIENTE', { id });
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.Clientes = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    // --- CUENTAS POR COBRAR ---
    getCuentasCobrar() {
        const list = this.getTable('CuentasCobrar');
        return Array.isArray(list) ? list.filter(Boolean) : [];
    }

    async upsertCuentaCobrar(cuenta) {
        const result = await this._post('UPSERT_CUENTA_COBRAR', cuenta);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasCobrar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async deleteCuentaCobrar(id) {
        const result = await this._post('DELETE_CUENTA_COBRAR', { id });
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasCobrar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async registrarAbonoCobrar(abonoData) {
        const result = await this._post('REGISTRAR_ABONO_COBRAR', abonoData);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasCobrar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    // --- CUENTAS POR PAGAR ---
    getCuentasPagar() {
        const list = this.getTable('CuentasPagar');
        return Array.isArray(list) ? list.filter(Boolean) : [];
    }

    async upsertCuentaPagar(cuenta) {
        const result = await this._post('UPSERT_CUENTA_PAGAR', cuenta);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasPagar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async deleteCuentaPagar(id) {
        const result = await this._post('DELETE_CUENTA_PAGAR', { id });
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasPagar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async registrarPagoPagar(pagoData) {
        const result = await this._post('REGISTRAR_PAGO_PAGAR', pagoData);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.CuentasPagar = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    getTable(tableName) {
        // Mapear nombres de tablas
        const mapping = {
            'Productos': 'Productos',
            'Productoss': 'Productos',
            'Categorias': 'Categorias',
            'Categoriass': 'Categorias',
            'Caja': 'Caja',
            'Ventas': 'Ventas',
            'Usuarios': 'Usuarios',
            'Tasa': 'Tasa',
            'Clientes': 'Clientes',
            'CuentasCobrar': 'CuentasCobrar',
            'CuentasPagar': 'CuentasPagar'
        };
        const key = mapping[tableName] || tableName;
        return this.cache?.[key] || this.cache?.[tableName] || [];
    }

    getProductoById(id) {
        const productos = this.getTable('Productos');
        return productos.find(p => String(p.id) === String(id));
    }

    async saveSale(sale) {
        const result = await this._post('SAVE_SALE', sale);
        if (result.success) {
            try {
                if (!this.cache.Ventas) this.cache.Ventas = [];
                
                const mappedSale = {
                    id: sale.id,
                    fecha: sale.fecha || new Date().toISOString(),
                    total_venta_usd: sale.total_venta_usd,
                    total_costo_usd: sale.total_costo_usd,
                    total_bs: sale.total_bs,
                    pago_efectivo_usd: sale.pago_efectivo_usd,
                    pago_efectivo_bs: sale.pago_efectivo_bs,
                    pago_debito: sale.pago_debito,
                    pago_pago_movil: sale.pago_pago_movil,
                    pago_bio_pago: sale.pago_bio_pago,
                    pago_transferencia: sale.pago_transferencia,
                    cliente_nombre: sale.cliente_nombre,
                    cliente_identificacion: sale.cliente_identificacion
                };

                const exists = this.cache.Ventas.some(v => v && v.id === sale.id);
                if (!exists) {
                    this.cache.Ventas.unshift(mappedSale);
                    this._saveToLocalStorage();
                    console.log('[gs] 📥 Venta agregada al cache local de Ventas:', sale.id);
                }
            } catch (cacheErr) {
                console.warn('[gs] Error actualizando cache de ventas local:', cacheErr.message);
            }
        }
        return result;
    }

    // Obtener tasa BCV (sync)
    getTasaBcv() {
        return this.tasaBcv || this.cache?.tasaBCV || 0;
    }

    // Obtener tasa BCV Euro (sync)
    getTasaBcvEuro() {
        return this.tasaBcvEuro || this.cache?.tasaBCVEuro || Number(localStorage.getItem('mme_tasa_bcv_euro')) || 0;
    }

    // Obtener categorías (sync)
    getCategorias() {
        return this.getTable('Categorias');
    }

    // Obtener ventas
    getVentas() {
        return this.getTable('Ventas');
    }

    // Obtener caja
    getCaja() {
        return this.getTable('Caja');
    }

    // Obtener usuarios
    getUsuarios() {
        const users = this.getTable('Usuarios');
        if (!users || users.length === 0) {
            return [{
                id: 'usr_1790269997647',
                username: 'edsondesigner',
                password: 'York1604',
                nombre_completo: 'Edson Designer',
                cargo: 'Administrador Master',
                rol: 'admin_master',
                foto_url: 'https://drive.google.com/thumbnail?id=1JLaEUIVJxwpE4q3D980RW41fYGzHTwJR&sz=w400',
                permisos: ['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'usuarios', 'configuracion'],
                estado: 'activo'
            }];
        }
        return users.map(u => ({
            ...u,
            permisos: typeof u.permisos === 'string' && u.permisos.startsWith('[') 
                ? (() => { try { return JSON.parse(u.permisos); } catch(e) { return []; } })()
                : (Array.isArray(u.permisos) ? u.permisos : [])
        }));
    }

    async upsertUsuario(usuario) {
        const result = await this._post('UPSERT_USUARIO', usuario);
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.Usuarios = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    async deleteUsuario(id) {
        const result = await this._post('DELETE_USUARIO', { id });
        if (result.success && result.data) {
            if (!this.cache) this.cache = {};
            this.cache.Usuarios = result.data;
            this._saveToLocalStorage();
        } else {
            await this.refresh();
        }
        return result;
    }

    // =========================================================================
    // CONFIGURACIÓN DEL SISTEMA
    // =========================================================================
    getConfig() {
        let cached = this.cache?.Configuracion;
        if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
            return { ...DEFAULT_CONFIG, ...cached };
        }
        try {
            const saved = localStorage.getItem('mme_config_v1');
            if (saved) {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }
        } catch (e) {}
        return { ...DEFAULT_CONFIG };
    }

    async saveConfig(configData) {
        const current = this.getConfig();
        const merged = { ...current, ...configData };
        try {
            localStorage.setItem('mme_config_v1', JSON.stringify(merged));
        } catch (e) {}
        
        if (!this.cache) this.cache = {};
        this.cache.Configuracion = merged;
        this._saveToLocalStorage();

        try {
            const result = await this._post('SET_CONFIG', merged);
            if (result && result.success && result.data) {
                this.cache.Configuracion = result.data;
                try {
                    localStorage.setItem('mme_config_v1', JSON.stringify(result.data));
                } catch (e) {}
                this._saveToLocalStorage();
                return result;
            }
            return { success: true, data: merged };
        } catch (err) {
            console.warn('[gs] Error guardando config en servidor, guardado localmente:', err.message);
            return { success: true, data: merged, localOnly: true };
        }
    }

    // Estado de conexión
    getConnectionStatus() {
        return {
            status: this.connectionStatus,
            lastError: this.lastError,
            url: getWebAppUrl(),
            hasCache: Object.keys(this.cache).length > 0,
            productsInCache: (this.cache.Productos || []).length,
            categoriesInCache: (this.cache.Categorias || []).length
        };
    }

    // Diagnóstico completo
    async runDiagnostic() {
        const results = {
            url: getWebAppUrl(),
            urlValid: false,
            networkOk: false,
            sheetReachable: false,
            productsLoaded: false,
            cacheFallback: false,
            errors: []
        };

        // Check URL
        try {
            new URL(results.url);
            results.urlValid = true;
        } catch {
            results.errors.push('URL inválida: ' + results.url);
            return results;
        }

        // Check network
        if (!navigator.onLine) {
            results.errors.push('Sin conexión a internet');
            return results;
        }
        results.networkOk = true;

        // Try connection
        try {
            const result = await this.initialize();
            if (result.success) {
                results.sheetReachable = true;
                results.productsLoaded = (this.cache.Productos || []).length > 0;
            } else if (result.fallback) {
                results.cacheFallback = true;
                results.errors.push('Usando cache local (servidor no accesible)');
            } else {
                results.errors.push(result.error || 'Error desconocido');
            }
        } catch(e) {
            results.errors.push(e.message);
        }

        return results;
    }
}

// Export singleton
export const gsService = new GoogleSheetsService();
export default gsService;