import { gsService } from './googleSheetsService'

export const GOOGLE_DRIVE_FOLDER_ID = "1Otottj5OHWtAszwKm_MQMIuByt_UBLW8";

// Cadena vacía = sin imagen (cada componente usa su propio placeholder)
export const DEFAULT_PRODUCT_IMAGE = "";

export const isDriveUrl = (url) => {
    if (!url || typeof url !== 'string') return false
    return url.includes('drive.google.com') ||
           url.includes('drive.googleusercontent.com') ||
           url.includes('docs.google.com') ||
           url.includes('lh3.googleusercontent.com') ||
           /^[a-zA-Z0-9_-]{15,50}$/.test(url)
}

export const extractDriveId = (url) => {
    if (!url || typeof url !== 'string') return null
    
    const cleanUrl = url.trim()
    // Si es solo un ID (15-50 chars alfanuméricos)
    if (/^[a-zA-Z0-9_-]{15,50}$/.test(cleanUrl)) {
        return cleanUrl
    }
    
    const patterns = [
        /\/d\/([a-zA-Z0-9_-]{15,50})/,          // /d/FILE_ID
        /[?&]id=([a-zA-Z0-9_-]{15,50})/,         // ?id=FILE_ID or &id=FILE_ID
        /\/file\/d\/([a-zA-Z0-9_-]{15,50})/,      // /file/d/FILE_ID
        /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,50})/ // lh3 CDN
    ]
    
    for (const pattern of patterns) {
        const match = cleanUrl.match(pattern)
        if (match && match[1]) return match[1]
    }
    
    return null
}

/**
 * Convierte cualquier URL de Google Drive a URL directa embebible.
 * 
 * Usa lh3.googleusercontent.com/d/{fileId} que es la CDN directa de Google
 * y funciona sin problemas de referrer, CORS, ni redirecciones.
 * 
 * IMPORTANTE: El archivo debe estar compartido como "Cualquiera con el enlace".
 */
export const formatDriveImageUrl = (url) => {
    if (!url || typeof url !== 'string') return ''
    
    const trimmed = url.trim()
    if (!trimmed) return ''
    
    // Si es blob: o data: (preview local), devolver tal cual
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
    
    // Si ya es una URL de lh3 CDN, devolverla tal cual
    if (trimmed.includes('lh3.googleusercontent.com/d/')) return trimmed
    
    // Si es URL de Drive, extraer ID y convertir a lh3
    if (isDriveUrl(trimmed)) {
        const fileId = extractDriveId(trimmed)
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}=s400`
        }
    }
    
    // Si es cualquier otra URL http, devolverla tal cual
    if (trimmed.startsWith('http')) return trimmed
    
    return ''
}

export const getProductImageUrl = (product) => {
    if (!product) return ''
    
    // 1. Imagen explícita del producto
    const imgUrl = product.imagen_url || product.imagen || product.imagenUrl
    
    // 2. Si no hay imagen explícita, buscar en el mapa de archivos de Drive
    if (!imgUrl || imgUrl === '') {
        const key = String(product.id || '').toLowerCase().trim();
        if (gsService.cache && gsService.cache.driveFiles && gsService.cache.driveFiles[key]) {
            const fileId = gsService.cache.driveFiles[key];
            return `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        }
        return ''
    }
    
    return formatDriveImageUrl(imgUrl)
}