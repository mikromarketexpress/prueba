/**
 * Utilidad para generar datos y URLs de código QR para Pago Móvil (C2P)
 */

export function generarPagoMovilData({ banco, telefono, cedulaRif, montoBs }) {
    // Formatear el RIF/CI eliminando guiones y espacios
    const idLimpio = String(cedulaRif || '').replace(/[-_ ]/g, '').toUpperCase();
    
    // Limpiar el teléfono (debe empezar con el código de área, ej. 0412, 0414, etc.)
    const tlfLimpio = String(telefono || '').replace(/[-_ ()+]/g, '');
    
    // El banco debe ser el código de 4 dígitos (ej. 0102, 0105, 0108)
    const bancoCod = String(banco || '').slice(0, 4);

    // Redondear monto a 2 decimales
    const montoFmt = Number(montoBs || 0).toFixed(2);

    // Formato estándar C2P / QR para Pago Móvil (algunos bancos usan este formato de texto delimitado por comas o punto y coma)
    // Estructura común: BANCO,TELÉFONO,RIF/CÉDULA,MONTO
    const qrString = `${bancoCod},${tlfLimpio},${idLimpio},${montoFmt}`;

    // Generar la URL usando qrserver.com para no depender de librerías locales pesadas
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrString)}`;

    return {
        qrString,
        qrUrl,
        bancoCod,
        tlfLimpio,
        idLimpio,
        montoFmt
    };
}
