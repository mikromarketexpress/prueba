/**
 * MICRO MARKET EXPRESS - Backend v8.6 (SENIAT FISCAL: CLIENTES, CUENTAS COBRAR Y PAGAR)
 * ======================================================================================
 * Sheet: 1VVejGluaLaGTXsT9F7yl5sx5-ePsL2KEp6pCKK_pkWo
 * Drive: 1Otottj5OHWtAszwKm_MQMIuByt_UBLW8
 */

const SPREADSHEET_ID = '1VVejGluaLaGTXsT9F7yl5sx5-ePsL2KEp6pCKK_pkWo';
const DRIVE_FOLDER_ID = '1Otottj5OHWtAszwKm_MQMIuByt_UBLW8';

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function getDriveFilesMap() {
  var map = {};
  try {
    var folderId = DRIVE_FOLDER_ID;
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      var fallbackIter = DriveApp.getFoldersByName('Micro Market Express Images');
      folder = fallbackIter.hasNext() ? fallbackIter.next() : null;
    }
    if (folder) {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var name = String(file.getName()).toLowerCase().trim();
        var dotIndex = name.lastIndexOf('.');
        var key = dotIndex > -1 ? name.substring(0, dotIndex) : name;
        map[key] = file.getId();
      }
    }
  } catch (e) {
    Logger.log('Error en getDriveFilesMap: ' + e.message);
  }
  return map;
}

function migrarUrlImagen(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.indexOf('drive.google.com/uc') !== -1 || url.indexOf('drive.google.com/file') !== -1) {
    var idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (!idMatch) idMatch = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (idMatch && idMatch[1]) {
      return 'https://drive.google.com/thumbnail?id=' + idMatch[1] + '&sz=w400';
    }
  }
  return url;
}

function getAllSheetsData(includeDriveFiles) {
  var data = { 
    Productos: [], Categorias: [], Caja: [], Ventas: [], Usuarios: [], 
    Clientes: [], CuentasCobrar: [], CuentasPagar: [],
    Configuracion: {}, tasaBCV: 0, fechaTasa: '', Tasa: null, driveFiles: {} 
  };
  
  var sheets = ['Productos', 'Categorias', 'Caja', 'Ventas', 'Usuarios', 'Clientes', 'CuentasCobrar', 'CuentasPagar'];
  sheets.forEach(function(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      if (sheet && sheet.getLastRow() > 1) {
        var sheetData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        data[sheetName] = sheetData.map(function(row) {
          var obj = {};
          headers.forEach(function(h, i) { obj[String(h).toLowerCase().trim()] = row[i]; });
          if (sheetName === 'Productos' && obj.imagen_url) {
            obj.imagen_url = migrarUrlImagen(String(obj.imagen_url));
          }
          if (sheetName === 'Usuarios' && obj.foto_url) {
            obj.foto_url = migrarUrlImagen(String(obj.foto_url));
          }
          return obj;
        });
      }
    } catch(e) { Logger.log('Error ' + sheetName + ': ' + e.message); }
  });
  
  if (data.Usuarios.length === 0) {
    try { data.Usuarios = getUsuarios(); } catch(e) {}
  }

  if (data.Clientes.length === 0) {
    try { data.Clientes = getClientes(); } catch(e) {}
  }

  if (data.CuentasCobrar.length === 0) {
    try { data.CuentasCobrar = getCuentasCobrar(); } catch(e) {}
  }

  if (data.CuentasPagar.length === 0) {
    try { data.CuentasPagar = getCuentasPagar(); } catch(e) {}
  }

  try {
    data.Configuracion = getConfig();
  } catch(e) {
    Logger.log('Error al obtener configuracion: ' + e.message);
  }
  
  try {
    var tasaSheet = getSheet('Tasa');
    if (tasaSheet && tasaSheet.getLastRow() >= 2) {
      data.tasaBCV = Number(tasaSheet.getRange('A2').getValue()) || 0;
      data.fechaTasa = String(tasaSheet.getRange('B2').getValue()) || '';
      data.tasaBCVEuro = Number(tasaSheet.getRange('D2').getValue()) || 0;
      data.Tasa = { tasa_bcv: data.tasaBCV, tasa_euro: data.tasaBCVEuro, tasa_fecha: data.fechaTasa };
    }
  } catch(e) {}

  if (includeDriveFiles === true) {
    try {
      data.driveFiles = getDriveFilesMap();
    } catch(e) {
      Logger.log('Error al mapear imágenes de Drive: ' + e.message);
    }
  }
  
  return data;
}

function doGet(e) {
   try {
     try {
       var syncResult = syncTasaBCV();
       if (syncResult && syncResult.success) {
         Logger.log('Tasa sincronizada automáticamente en doGet');
       }
     } catch(err) {
       Logger.log('Error auto-sync tasa: ' + err);
     }
     
     var includeDrive = (e && e.parameter && (e.parameter.drive === 'true' || e.parameter.drive === '1'));
     var data = getAllSheetsData(includeDrive);
     return ContentService.createTextOutput(JSON.stringify({
       success: true,
       status: 'ready',
       service: 'Micro Market Express v8.6 (SENIAT FISCAL COMPLETO)',
       tasaBCV: data.tasaBCV,
       tasaBCVEuro: data.tasaBCVEuro,
       fecha: data.fechaTasa,
       Productos: data.Productos,
       Categorias: data.Categorias,
       Ventas: data.Ventas,
       Caja: data.Caja,
       Usuarios: data.Usuarios,
       Clientes: data.Clientes,
       CuentasCobrar: data.CuentasCobrar,
       CuentasPagar: data.CuentasPagar,
       Configuracion: data.Configuracion,
       driveFiles: data.driveFiles
     })).setMimeType(ContentService.MimeType.JSON);
   } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var parsed = {};
    if (e && e.postData && e.postData.contents) {
      try {
        parsed = JSON.parse(e.postData.contents);
      } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'JSON invalido en el cuerpo de la peticion' })).setMimeType(ContentService.MimeType.JSON);
      }
    } else if (e && e.parameter) {
      parsed = e.parameter;
    }
    
    var action = parsed.action;
    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No se especifico ninguna accion' })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = parsed.data || parsed;
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var result = { success: false };
    
    switch(action) {
      case 'GET_ALL': result = getAllSheetsData(); break;
      case 'SAVE_SALE': result = saveSale(ss, data); break;
      case 'GET_SALES': result = getSales(ss); break;
      case 'GUARDAR_PRODUCTO_CON_IMAGEN':
      case 'UPSERT_PRODUCTO': result = upsertProducto(ss, data); break;
      case 'DELETE_PRODUCTO': result = deleteProducto(ss, data); break;
      case 'UPSERT_CATEGORY': result = upsertCategory(ss, data); break;
      case 'DELETE_CATEGORY': result = deleteCategory(ss, data); break;
      case 'FETCH_TASA_BCV': result = syncTasaBCV(); break;
      case 'UPLOAD_IMAGE': result = uploadImage(data); break;
      case 'GET_CLIENTES': result = { success: true, data: getClientes() }; break;
      case 'UPSERT_CLIENTE': result = upsertCliente(ss, data); break;
      case 'DELETE_CLIENTE': result = deleteCliente(ss, data); break;
      case 'GET_CUENTAS_COBRAR': result = { success: true, data: getCuentasCobrar() }; break;
      case 'UPSERT_CUENTA_COBRAR': result = upsertCuentaCobrar(ss, data); break;
      case 'DELETE_CUENTA_COBRAR': result = deleteCuentaCobrar(ss, data); break;
      case 'REGISTRAR_ABONO_COBRAR': result = registrarAbonoCobrar(ss, data); break;
      case 'GET_CUENTAS_PAGAR': result = { success: true, data: getCuentasPagar() }; break;
      case 'UPSERT_CUENTA_PAGAR': result = upsertCuentaPagar(ss, data); break;
      case 'DELETE_CUENTA_PAGAR': result = deleteCuentaPagar(ss, data); break;
      case 'REGISTRAR_PAGO_PAGAR': result = registrarPagoPagar(ss, data); break;
      case 'GET_CAJA': result = { success: true, data: getCaja() }; break;
      case 'UPSERT_CAJA': result = upsertCaja(ss, data); break;
      case 'ABRIR_CAJA': result = abrirCaja(ss, data); break;
      case 'CERRAR_CAJA': result = cerrarCaja(ss, data); break;
      case 'UPDATE_TASA': result = updateTasa(ss, data); break;
      case 'REPAIR_DATABASE': result = repararVentasSheet(ss); break;
      case 'CLEAR_SALES': result = clearSales(ss); break;
      case 'GET_USUARIOS': result = { success: true, data: getUsuarios() }; break;
      case 'UPSERT_USUARIO': result = upsertUsuario(ss, data); break;
      case 'DELETE_USUARIO': result = deleteUsuario(ss, data); break;
      case 'GET_CONFIG': result = { success: true, data: getConfig() }; break;
      case 'SET_CONFIG': result = setConfig(ss, data); break;
      default: result = { success: false, error: 'Accion no reconocida: ' + action };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function uploadImage(data) {
  try {
    if (!data) return { success: false, error: 'No se recibió data' };
    if (!data.data) return { success: false, error: 'No se recibió imagen (data.data vacío)' };
    if (!data.filename) return { success: false, error: 'No se recibió filename' };
    
    var folderId = data.folderId ? data.folderId : DRIVE_FOLDER_ID;
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      var fallbackIter = DriveApp.getFoldersByName('Micro Market Express Images');
      folder = fallbackIter.hasNext() ? fallbackIter.next() : DriveApp.createFolder('Micro Market Express Images');
    }
    
    var decodedBytes = Utilities.base64Decode(data.data);
    var ext = data.filename && data.filename.endsWith('.png') ? 'image/png' : 'image/webp';
    var file = folder.createFile(Utilities.newBlob(decodedBytes, ext, data.filename));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return { 
      success: true, 
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400', 
      webViewLink: file.getUrl(), 
      fileId: file.getId() 
    };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

function saveSale(ss, data) {
  try {
    var sheet = ss.getSheetByName('Ventas') || ss.insertSheet('Ventas');
    var defaultHeaders = [
      'id', 'numero_factura', 'tipo_documento',
      'cliente_tipo_doc', 'cliente_cedula_rif', 'cliente_nombre', 'cliente_direccion',
      'productos_json', 'total_costo_usd', 'total_venta_usd', 'tasa_bcv', 'total_bs',
      'base_exenta_usd', 'base_exenta_bs', 'base_imponible_usd', 'base_imponible_bs',
      'iva_usd', 'iva_bs', 'base_igtf_usd', 'base_igtf_bs', 'igtf_usd', 'igtf_bs',
      'utilidad_neta_usd', 'sesion_caja_id',
      'pago_efectivo_usd', 'pago_efectivo_bs', 'pago_debito', 'pago_pago_movil', 'pago_bio_pago', 'pago_transferencia',
      'fecha', 'vuelto_entregado_usd', 'vuelto_entregado_bs', 'vuelto_efectivo_bs', 'vuelto_pago_movil', 'vuelto_transferencia'
    ];
    ensureHeaders(sheet, defaultHeaders);
    
    var actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).toLowerCase().trim();
    });
    
    var saleData = Object.assign({}, data);
    saleData.id = data.id || Utilities.getUuid();

    if (!saleData.numero_factura) {
      var nextNum = Math.max(1, sheet.getLastRow());
      saleData.numero_factura = ('00000000' + nextNum).slice(-8);
    }
    saleData.tipo_documento = data.tipo_documento || 'FACTURA';
    saleData.cliente_tipo_doc = data.cliente_tipo_doc || ((data.cliente_identificacion || data.cliente_cedula_rif || '').toString().toUpperCase().startsWith('J') || (data.cliente_identificacion || data.cliente_cedula_rif || '').toString().toUpperCase().startsWith('G') ? 'J' : 'V');
    saleData.cliente_cedula_rif = data.cliente_cedula_rif || data.cliente_identificacion || 'V-99999999-0';
    saleData.cliente_nombre = data.cliente_nombre || 'CONSUMIDOR FINAL';
    saleData.cliente_direccion = data.cliente_direccion || 'CIUDAD';

    // Auto-registrar cliente en la tabla Clientes si no es Consumidor Final
    var rifCheck = String(saleData.cliente_cedula_rif).toUpperCase();
    if (rifCheck && rifCheck !== '99999999-0' && rifCheck !== 'V-99999999-0' && saleData.cliente_nombre !== 'CONSUMIDOR FINAL') {
      try {
        upsertCliente(ss, {
          cedula_rif: saleData.cliente_cedula_rif,
          nombre_razon_social: saleData.cliente_nombre,
          direccion_fiscal: saleData.cliente_direccion,
          telefono: data.cliente_celular || '',
          tipo_persona: saleData.cliente_tipo_doc === 'J' || saleData.cliente_tipo_doc === 'G' ? 'Jurídica' : 'Natural'
        });
      } catch(eCli) {
        Logger.log('Auto-registro cliente warning: ' + eCli.message);
      }
    }

    saleData.productos_json = JSON.stringify(data.productos || []);
    saleData.total_costo_usd = Number(data.total_costo_usd) || 0;
    saleData.total_venta_usd = Number(data.total_venta_usd) || 0;
    saleData.tasa_bcv = Number(data.tasa_bcv) || 0;
    saleData.total_bs = Number(data.total_bs) || 0;

    saleData.base_exenta_usd = Number(data.base_exenta_usd) || 0;
    saleData.base_exenta_bs = Number(data.base_exenta_bs) || 0;
    saleData.base_imponible_usd = Number(data.base_imponible_usd) || 0;
    saleData.base_imponible_bs = Number(data.base_imponible_bs) || 0;
    saleData.iva_usd = Number(data.iva_usd) || 0;
    saleData.iva_bs = Number(data.iva_bs) || 0;
    saleData.base_igtf_usd = Number(data.base_igtf_usd) || 0;
    saleData.base_igtf_bs = Number(data.base_igtf_bs) || 0;
    saleData.igtf_usd = Number(data.igtf_usd) || 0;
    saleData.igtf_bs = Number(data.igtf_bs) || 0;

    saleData.utilidad_neta_usd = saleData.total_venta_usd - saleData.total_costo_usd;
    saleData.fecha = data.fecha || new Date().toISOString();
    
    var stringKeys = ['id', 'numero_factura', 'tipo_documento', 'cliente_tipo_doc', 'cliente_cedula_rif', 'cliente_nombre', 'cliente_direccion', 'productos_json', 'fecha', 'sesion_caja_id'];
    
    var rowData = actualHeaders.map(function(h) {
      var key = String(h).toLowerCase().trim();
      var val = saleData[key];
      if (stringKeys.indexOf(key) > -1) {
        return val !== undefined && val !== null ? String(val) : '';
      }
      if (val === undefined || val === null || val === '') return 0;
      return Number(val) || 0;
    });
    
    sheet.appendRow(rowData);
    
    var prodSheet = ss.getSheetByName('Productos');
    if (prodSheet && prodSheet.getLastRow() > 1 && data.productos) {
      var prodIds = prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 1).getValues().map(function(r) { return String(r[0]).trim(); });
      var headersProd = prodSheet.getRange(1, 1, 1, prodSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var stockColIndex = headersProd.indexOf('stock') + 1;
      
      if (stockColIndex > 0) {
        var soldList = Array.isArray(data.productos) ? data.productos : JSON.parse(data.productos || '[]');
        soldList.forEach(function(soldItem) {
          var soldId = String(soldItem.id).trim();
          var quantity = parseFloat(soldItem.cantidad) || 0;
          var rowIndex = prodIds.indexOf(soldId);
          if (rowIndex > -1 && quantity > 0) {
            var cell = prodSheet.getRange(rowIndex + 2, stockColIndex);
            var currentStock = parseFloat(cell.getValue()) || 0;
            cell.setValue(Math.max(0, currentStock - quantity));
          }
        });
      }
    }
    
    return { success: true, data: getAllSheetsData(false) };
  } catch(e) { return { success: false, error: e.message }; }
}

function repararVentasSheet(ss) {
  try {
    var sheet = ss.getSheetByName('Ventas');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, message: 'No hay ventas que reparar' };
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).toLowerCase().trim();
    });
    
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    var values = dataRange.getValues();
    var repCount = 0;
    
    var colIdx = {};
    headers.forEach(function(h, idx) { colIdx[h] = idx; });
    
    if (colIdx['fecha'] === undefined || colIdx['vuelto_entregado_usd'] === undefined) {
      return { success: false, error: 'No se encontraron columnas fecha o vuelto_entregado_usd' };
    }
    
    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var fechaVal = row[colIdx['fecha']];
      var vueltoUsdVal = row[colIdx['vuelto_entregado_usd']];
      
      var esDesfasado = (fechaVal === 0 || fechaVal === '' || String(fechaVal) === '0' || String(fechaVal) === '0.0' || String(fechaVal) === '0,00') && 
                        (typeof vueltoUsdVal === 'string' && vueltoUsdVal.indexOf('-') > -1);
      
      if (esDesfasado) {
        var fechaReal = vueltoUsdVal;
        var vueltoUsdReal = Number(fechaVal) || 0;
        var totalBsReal = Number(row[colIdx['vuelto_entregado_bs']]) || 0;
        var vueltoBsReal = Number(row[colIdx['total_bs']]) || 0;
        
        row[colIdx['fecha']] = fechaReal;
        row[colIdx['vuelto_entregado_usd']] = vueltoUsdReal;
        row[colIdx['total_bs']] = totalBsReal;
        row[colIdx['vuelto_entregado_bs']] = vueltoBsReal;
        repCount++;
      }
    }
    
    if (repCount > 0) {
      dataRange.setValues(values);
    }

    var lastRow = sheet.getLastRow();
    var idColIdx = colIdx['id'] !== undefined ? colIdx['id'] : 0;
    var currentValues = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
    var deleteCount = 0;
    
    for (var i = currentValues.length - 1; i >= 0; i--) {
      var idVal = String(currentValues[i][0]).trim();
      if (idVal === '') {
        sheet.deleteRow(i + 2);
        deleteCount++;
      }
    }
    
    return { success: true, message: 'Se repararon ' + repCount + ' ventas desfasadas y se eliminaron ' + deleteCount + ' filas vacías.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getSales(ss) {
  try {
    var sheet = ss.getSheetByName('Ventas');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return { success: true, data: data.map(function(row) {
      var obj = {}; headers.forEach(function(h, i) { obj[String(h).toLowerCase().trim()] = row[i]; }); return obj;
    })};
  } catch(e) { return { success: false, error: e.message }; }
}

function guardarImagenEnDrive(idProducto, imagenBase64, extension) {
  var folderId = DRIVE_FOLDER_ID || "1Otottj5OHWtAszwKm_MQMIuByt_UBLW8";
  if (!imagenBase64) return "";
  
  try {
    var carpeta;
    try {
      carpeta = DriveApp.getFolderById(folderId);
    } catch (e) {
      var fallbackIter = DriveApp.getFoldersByName('Micro Market Express Images');
      carpeta = fallbackIter.hasNext() ? fallbackIter.next() : DriveApp.createFolder('Micro Market Express Images');
    }
    
    var contenidoLimpio = imagenBase64;
    if (imagenBase64.indexOf(",") !== -1) {
      contenidoLimpio = imagenBase64.split(",")[1];
    }
    
    var deccodedBytes = Utilities.base64Decode(contenidoLimpio);
    var ext = (extension || "jpg").toLowerCase().replace('.', '');
    var mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    var nombreArchivo = idProducto + "." + ext;
    
    var archivos = carpeta.getFilesByName(nombreArchivo);
    while (archivos.hasNext()) {
      try {
        archivos.next().setTrashed(true);
      } catch (errTrash) {}
    }
    
    var blob = Utilities.newBlob(deccodedBytes, mime, nombreArchivo);
    var nuevoArchivo = carpeta.createFile(blob);
    nuevoArchivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return "https://drive.google.com/thumbnail?id=" + nuevoArchivo.getId() + "&sz=w400";
  } catch (error) {
    throw new Error("No se pudo guardar la imagen en Google Drive: " + error.toString());
  }
}

function upsertProducto(ss, data) {
  try {
    var sheet = ss.getSheetByName('Productos') || ss.insertSheet('Productos');
    ensureHeaders(sheet, ['id', 'nombre', 'descripcion_corta', 'numero_unid', 'unidad_medida', 'categoria', 'categoria_nombre', 'precio_usd', 'precio_costo', 'stock', 'stock_minimo', 'imagen_url', 'tasa_bcv', 'codigo_barras', 'alicuota_iva']);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];    
    var idProducto = data.id;
    
    var rowIndex = -1;
    if (idProducto && sheet.getLastRow() > 1) {
      var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(idProducto).trim(); });
    }
    
    var isNew = !idProducto || idProducto === 'new' || String(idProducto).startsWith('temp_') || rowIndex === -1;
    
    if (isNew && rowIndex === -1) {
      var maxIdNum = 0;
      if (sheet.getLastRow() > 1) {
        var allExistingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < allExistingIds.length; i++) {
          var currentIdNum = parseInt(allExistingIds[i][0]);
          if (!isNaN(currentIdNum) && currentIdNum > maxIdNum) {
            maxIdNum = currentIdNum;
          }
        }
      }
      idProducto = String(maxIdNum + 1);
      data.id = idProducto;
    }
    
    var errorImagen = null;
    if (data.imagenBase64) {
      try {
        var urlDirecta = guardarImagenEnDrive(idProducto, data.imagenBase64, data.extension);
        if (urlDirecta) {
          data.imagen_url = urlDirecta;
        }
      } catch (errImg) {
        errorImagen = errImg.message;
      }
    }

    var rowData = headers.map(function(h) {
      var key = String(h).toLowerCase().trim();
      if (key === 'alicuota_iva') return data.alicuota_iva || 'G';
      var val = data[key] !== undefined ? data[key] : '';
      if (['precio_usd', 'precio_costo', 'stock', 'stock_minimo', 'numero_unid'].indexOf(key) > -1) return parseFloat(val) || 0;
      return val;
    });
    if (rowIndex === -1) sheet.appendRow(rowData); else sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    return { success: true, id: String(idProducto), imagen_url: data.imagen_url || '', error_imagen: errorImagen, data: getAllSheetsData(false) };
  } catch(e) { return { success: false, error: e.message }; }
}

function deleteProducto(ss, data) {
  try {
    var sheet = ss.getSheetByName('Productos');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: getAllSheetsData(false) };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]) === String(data.id); });
    if (rowIndex > -1) sheet.deleteRow(rowIndex + 2);
    return { success: true, data: getAllSheetsData(false) };
  } catch(e) { return { success: false, error: e.message }; }
}

function upsertCategory(ss, data) {
  try {
    var sheet = ss.getSheetByName('Categorias') || ss.insertSheet('Categorias');
    if (sheet.getLastRow() === 0) { 
      sheet.appendRow(['id', 'nombre', 'icono', 'icono_nombre', 'icono_color', 'orden']); 
      sheet.getRange(1, 1, 1, 6).setFontWeight('bold'); 
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var idCategoria = data.id;
    var rowIndex = -1;
    if (idCategoria && sheet.getLastRow() > 1) {
      var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(idCategoria).trim(); });
    }
    
    var isNew = !idCategoria || idCategoria === 'new' || String(idCategoria).startsWith('temp_') || rowIndex === -1;
    if (isNew && rowIndex === -1) {
      idCategoria = 'cat_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      data.id = idCategoria;
    }
    
    var rowData = headers.map(function(h) {
      var key = String(h).toLowerCase().trim();
      if (key === 'orden') return parseFloat(val) || 0;
      return val;
    });
    if (rowIndex === -1) sheet.appendRow(rowData); else sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    return { success: true, data: getAllSheetsData(false) };
  } catch(e) { return { success: false, error: e.message }; }
}

function deleteCategory(ss, data) {
  try {
    var sheet = getSheet('Categorias');
    if (!sheet) return { success: true };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]) === String(data.id); });
    if (rowIndex > -1) sheet.deleteRow(rowIndex + 2);
    return { success: true, data: getAllSheetsData(false) };
  } catch(e) { return { success: false, error: e.message }; }
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold'); return; }
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  headers.forEach(function(h) { if (existing.indexOf(h.toLowerCase()) === -1) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h).setFontWeight('bold'); } });
}

// =============================================================
// BASE DE DATOS DE CLIENTES (SENIAT)
// =============================================================

function getClientes() {
  try {
    var sheet = getSheet('Clientes');
    var headers = ['id', 'cedula_rif', 'nombre_razon_social', 'tipo_persona', 'tipo_contribuyente', 'porcentaje_retencion', 'direccion_fiscal', 'telefono', 'email', 'limite_credito_usd', 'dias_credito', 'saldo_actual_usd', 'estado', 'fecha_registro'];
    if (!sheet) {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.insertSheet('Clientes');
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.appendRow([
        'cli_consumidor_final',
        'V-99999999-0',
        'CONSUMIDOR FINAL',
        'Natural',
        'CONSUMIDOR FINAL',
        0,
        'CIUDAD',
        'N/A',
        '',
        0,
        0,
        0,
        'activo',
        new Date().toISOString()
      ]);
      SpreadsheetApp.flush();
    }
    if (sheet.getLastRow() <= 1) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).toLowerCase().trim();
    });
    return data.map(function(row) {
      var obj = {};
      sheetHeaders.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    }).filter(function(c) { return c.id && c.cedula_rif; });
  } catch(e) {
    Logger.log('Error en getClientes: ' + e.message);
    return [];
  }
}

function upsertCliente(ss, data) {
  try {
    var sheet = ss.getSheetByName('Clientes') || ss.insertSheet('Clientes');
    var headers = ['id', 'cedula_rif', 'nombre_razon_social', 'tipo_persona', 'tipo_contribuyente', 'porcentaje_retencion', 'direccion_fiscal', 'telefono', 'email', 'limite_credito_usd', 'dias_credito', 'saldo_actual_usd', 'estado', 'fecha_registro'];
    ensureHeaders(sheet, headers);
    var id = data.id || ('cli_' + new Date().getTime());
    var allIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(id).trim(); });
    
    if (rowIndex === -1 && data.cedula_rif && sheet.getLastRow() > 1) {
      var allRifs = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
      var cleanRif = String(data.cedula_rif).trim().toUpperCase();
      rowIndex = allRifs.findIndex(function(r) { return String(r[0]).trim().toUpperCase() === cleanRif; });
      if (rowIndex > -1) {
        id = String(allIds[rowIndex][0]);
      }
    }

    var rowData = [
      id,
      String(data.cedula_rif || '').trim().toUpperCase(),
      String(data.nombre_razon_social || data.nombre || '').trim().toUpperCase(),
      data.tipo_persona || 'Natural',
      data.tipo_contribuyente || 'ORDINARIO',
      parseFloat(data.porcentaje_retencion) || 0,
      String(data.direccion_fiscal || data.direccion || 'CIUDAD').trim().toUpperCase(),
      String(data.telefono || data.celular || '').trim(),
      String(data.email || '').trim().toLowerCase(),
      parseFloat(data.limite_credito_usd) || 0,
      parseInt(data.dias_credito) || 15,
      parseFloat(data.saldo_actual_usd) || 0,
      data.estado || 'activo',
      data.fecha_registro || new Date().toISOString()
    ];

    if (rowIndex === -1) {
      sheet.appendRow(rowData);
    } else {
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    }
    SpreadsheetApp.flush();
    return { success: true, data: getClientes() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteCliente(ss, data) {
  try {
    var sheet = ss.getSheetByName('Clientes');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(data.id).trim(); });
    if (rowIndex > -1) {
      sheet.deleteRow(rowIndex + 2);
      SpreadsheetApp.flush();
    }
    return { success: true, data: getClientes() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================
// CUENTAS POR COBRAR (SENIAT)
// =============================================================

function getCuentasCobrar() {
  var sheet = getSheet('CuentasCobrar');
  var headers = ['id', 'cliente_id', 'cliente_nombre', 'cliente_rif', 'numero_factura', 'numero_control', 'fecha_emision', 'fecha_vencimiento', 'tasa_bcv_emision', 'monto_exento_usd', 'monto_exento_bs', 'base_imponible_usd', 'base_imponible_bs', 'iva_usd', 'iva_bs', 'monto_total_usd', 'monto_total_bs', 'retencion_iva_porcentaje', 'retencion_iva_monto_bs', 'comprobante_retencion', 'saldo_pendiente_usd', 'saldo_pendiente_bs', 'estado', 'observaciones', 'historial_abonos_json'];
  if (!sheet) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet('CuentasCobrar');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  if (sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  return data.map(function(row) {
    var obj = {};
    sheetHeaders.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function(c) { return c.id; });
}

function upsertCuentaCobrar(ss, data) {
  try {
    var sheet = ss.getSheetByName('CuentasCobrar') || ss.insertSheet('CuentasCobrar');
    var headers = ['id', 'cliente_id', 'cliente_nombre', 'cliente_rif', 'numero_factura', 'numero_control', 'fecha_emision', 'fecha_vencimiento', 'tasa_bcv_emision', 'monto_exento_usd', 'monto_exento_bs', 'base_imponible_usd', 'base_imponible_bs', 'iva_usd', 'iva_bs', 'monto_total_usd', 'monto_total_bs', 'retencion_iva_porcentaje', 'retencion_iva_monto_bs', 'comprobante_retencion', 'saldo_pendiente_usd', 'saldo_pendiente_bs', 'estado', 'observaciones', 'historial_abonos_json'];
    ensureHeaders(sheet, headers);
    var id = data.id || ('cc_' + new Date().getTime());
    var allIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(id).trim(); });
    
    var tasa = parseFloat(data.tasa_bcv_emision) || 1;
    var totalUSD = parseFloat(data.monto_total_usd) || 0;
    var totalBS = parseFloat(data.monto_total_bs) || (totalUSD * tasa);
    var saldoUSD = data.saldo_pendiente_usd !== undefined ? parseFloat(data.saldo_pendiente_usd) : totalUSD;
    var saldoBS = data.saldo_pendiente_bs !== undefined ? parseFloat(data.saldo_pendiente_bs) : (saldoUSD * tasa);

    var estado = data.estado || (saldoUSD <= 0 ? 'PAGADO' : 'PENDIENTE');

    var rowData = [
      id,
      data.cliente_id || '',
      String(data.cliente_nombre || '').toUpperCase(),
      String(data.cliente_rif || '').toUpperCase(),
      String(data.numero_factura || ''),
      String(data.numero_control || ''),
      data.fecha_emision || new Date().toISOString(),
      data.fecha_vencimiento || '',
      tasa,
      parseFloat(data.monto_exento_usd) || 0,
      parseFloat(data.monto_exento_bs) || 0,
      parseFloat(data.base_imponible_usd) || 0,
      parseFloat(data.base_imponible_bs) || 0,
      parseFloat(data.iva_usd) || 0,
      parseFloat(data.iva_bs) || 0,
      totalUSD,
      totalBS,
      parseFloat(data.retencion_iva_porcentaje) || 0,
      parseFloat(data.retencion_iva_monto_bs) || 0,
      String(data.comprobante_retencion || ''),
      saldoUSD,
      saldoBS,
      estado,
      String(data.observaciones || ''),
      typeof data.historial_abonos_json === 'object' ? JSON.stringify(data.historial_abonos_json) : (data.historial_abonos_json || '[]')
    ];

    if (rowIndex === -1) {
      sheet.appendRow(rowData);
    } else {
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    }
    SpreadsheetApp.flush();
    return { success: true, data: getCuentasCobrar() };
  } catch(e) { return { success: false, error: e.message }; }
}

function registrarAbonoCobrar(ss, data) {
  try {
    var sheet = ss.getSheetByName('CuentasCobrar');
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, error: 'No hay cuentas por cobrar registradas' };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(data.id).trim(); });
    if (rowIndex === -1) return { success: false, error: 'Cuenta no encontrada: ' + data.id };
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var colMap = {};
    headers.forEach(function(h, idx) { colMap[h] = idx; });

    var rowValues = sheet.getRange(rowIndex + 2, 1, 1, sheet.getLastColumn()).getValues()[0];
    var saldoActualUSD = parseFloat(rowValues[colMap['saldo_pendiente_usd']]) || 0;
    var tasaActual = parseFloat(data.tasa_bcv) || parseFloat(rowValues[colMap['tasa_bcv_emision']]) || 1;
    
    var abonoUSD = parseFloat(data.monto_abono_usd) || 0;
    if (data.monto_abono_bs && !data.monto_abono_usd && tasaActual > 0) {
      abonoUSD = parseFloat(data.monto_abono_bs) / tasaActual;
    }
    var abonoBS = parseFloat(data.monto_abono_bs) || (abonoUSD * tasaActual);

    var retencionBS = parseFloat(data.retencion_iva_monto_bs) || 0;
    var retencionUSD = tasaActual > 0 ? (retencionBS / tasaActual) : 0;

    var nuevoSaldoUSD = Math.max(0, saldoActualUSD - abonoUSD - retencionUSD);
    var nuevoSaldoBS = nuevoSaldoUSD * tasaActual;
    var nuevoEstado = nuevoSaldoUSD <= 0.01 ? 'PAGADO' : 'PARCIAL';

    var historial = [];
    try {
      historial = JSON.parse(rowValues[colMap['historial_abonos_json']] || '[]');
    } catch(eh) { historial = []; }

    historial.push({
      fecha: new Date().toISOString(),
      monto_usd: abonoUSD,
      monto_bs: abonoBS,
      tasa_bcv: tasaActual,
      metodo_pago: data.metodo_pago || 'EFECTIVO',
      referencia: data.referencia || '',
      comprobante_retencion: data.comprobante_retencion || '',
      retencion_iva_monto_bs: retencionBS
    });

    rowValues[colMap['saldo_pendiente_usd']] = nuevoSaldoUSD;
    rowValues[colMap['saldo_pendiente_bs']] = nuevoSaldoBS;
    rowValues[colMap['estado']] = nuevoEstado;
    if (data.comprobante_retencion) rowValues[colMap['comprobante_retencion']] = data.comprobante_retencion;
    if (retencionBS > 0) rowValues[colMap['retencion_iva_monto_bs']] = (parseFloat(rowValues[colMap['retencion_iva_monto_bs']]) || 0) + retencionBS;
    rowValues[colMap['historial_abonos_json']] = JSON.stringify(historial);

    sheet.getRange(rowIndex + 2, 1, 1, sheet.getLastColumn()).setValues([rowValues]);
    SpreadsheetApp.flush();
    return { success: true, data: getCuentasCobrar() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteCuentaCobrar(ss, data) {
  try {
    var sheet = getSheet('CuentasCobrar');
    if (!sheet) return { success: true, data: [] };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]) === String(data.id); });
    if (rowIndex > -1) sheet.deleteRow(rowIndex + 2);
    return { success: true, data: getCuentasCobrar() };
  } catch(e) { return { success: false, error: e.message }; }
}

// =============================================================
// CUENTAS POR PAGAR (PROVEEDORES SENIAT)
// =============================================================

function getCuentasPagar() {
  var sheet = getSheet('CuentasPagar');
  var headers = ['id', 'proveedor_nombre', 'proveedor_rif', 'numero_factura', 'numero_control', 'fecha_emision', 'fecha_vencimiento', 'tasa_bcv_emision', 'monto_exento_usd', 'monto_exento_bs', 'base_imponible_usd', 'base_imponible_bs', 'iva_usd', 'iva_bs', 'monto_total_usd', 'monto_total_bs', 'retencion_iva_porcentaje', 'retencion_iva_monto_bs', 'comprobante_retencion', 'saldo_pendiente_usd', 'saldo_pendiente_bs', 'estado', 'observaciones', 'historial_pagos_json'];
  if (!sheet) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet('CuentasPagar');
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  if (sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
  return data.map(function(row) {
    var obj = {};
    sheetHeaders.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).filter(function(c) { return c.id; });
}

function upsertCuentaPagar(ss, data) {
  try {
    var sheet = ss.getSheetByName('CuentasPagar') || ss.insertSheet('CuentasPagar');
    var headers = ['id', 'proveedor_nombre', 'proveedor_rif', 'numero_factura', 'numero_control', 'fecha_emision', 'fecha_vencimiento', 'tasa_bcv_emision', 'monto_exento_usd', 'monto_exento_bs', 'base_imponible_usd', 'base_imponible_bs', 'iva_usd', 'iva_bs', 'monto_total_usd', 'monto_total_bs', 'retencion_iva_porcentaje', 'retencion_iva_monto_bs', 'comprobante_retencion', 'saldo_pendiente_usd', 'saldo_pendiente_bs', 'estado', 'observaciones', 'historial_pagos_json'];
    ensureHeaders(sheet, headers);
    var id = data.id || ('cp_' + new Date().getTime());
    var allIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(id).trim(); });
    
    var tasa = parseFloat(data.tasa_bcv_emision) || 1;
    var totalUSD = parseFloat(data.monto_total_usd) || 0;
    var totalBS = parseFloat(data.monto_total_bs) || (totalUSD * tasa);
    var saldoUSD = data.saldo_pendiente_usd !== undefined ? parseFloat(data.saldo_pendiente_usd) : totalUSD;
    var saldoBS = data.saldo_pendiente_bs !== undefined ? parseFloat(data.saldo_pendiente_bs) : (saldoUSD * tasa);

    var estado = data.estado || (saldoUSD <= 0 ? 'PAGADA' : 'PENDIENTE');

    var rowData = [
      id,
      String(data.proveedor_nombre || '').toUpperCase(),
      String(data.proveedor_rif || '').toUpperCase(),
      String(data.numero_factura || ''),
      String(data.numero_control || ''),
      data.fecha_emision || new Date().toISOString(),
      data.fecha_vencimiento || '',
      tasa,
      parseFloat(data.monto_exento_usd) || 0,
      parseFloat(data.monto_exento_bs) || 0,
      parseFloat(data.base_imponible_usd) || 0,
      parseFloat(data.base_imponible_bs) || 0,
      parseFloat(data.iva_usd) || 0,
      parseFloat(data.iva_bs) || 0,
      totalUSD,
      totalBS,
      parseFloat(data.retencion_iva_porcentaje) || 0,
      parseFloat(data.retencion_iva_monto_bs) || 0,
      String(data.comprobante_retencion || ''),
      saldoUSD,
      saldoBS,
      estado,
      String(data.observaciones || ''),
      typeof data.historial_pagos_json === 'object' ? JSON.stringify(data.historial_pagos_json) : (data.historial_pagos_json || '[]')
    ];

    if (rowIndex === -1) {
      sheet.appendRow(rowData);
    } else {
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    }
    SpreadsheetApp.flush();
    return { success: true, data: getCuentasPagar() };
  } catch(e) { return { success: false, error: e.message }; }
}

function registrarPagoPagar(ss, data) {
  try {
    var sheet = ss.getSheetByName('CuentasPagar');
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, error: 'No hay cuentas por pagar registradas' };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(data.id).trim(); });
    if (rowIndex === -1) return { success: false, error: 'Cuenta por pagar no encontrada: ' + data.id };
    
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var colMap = {};
    headers.forEach(function(h, idx) { colMap[h] = idx; });

    var rowValues = sheet.getRange(rowIndex + 2, 1, 1, sheet.getLastColumn()).getValues()[0];
    var saldoActualUSD = parseFloat(rowValues[colMap['saldo_pendiente_usd']]) || 0;
    var tasaActual = parseFloat(data.tasa_bcv) || parseFloat(rowValues[colMap['tasa_bcv_emision']]) || 1;
    
    var pagoUSD = parseFloat(data.monto_pago_usd) || 0;
    if (data.monto_pago_bs && !data.monto_pago_usd && tasaActual > 0) {
      pagoUSD = parseFloat(data.monto_pago_bs) / tasaActual;
    }
    var pagoBS = parseFloat(data.monto_pago_bs) || (pagoUSD * tasaActual);

    var retencionBS = parseFloat(data.retencion_iva_monto_bs) || 0;
    var retencionUSD = tasaActual > 0 ? (retencionBS / tasaActual) : 0;

    var nuevoSaldoUSD = Math.max(0, saldoActualUSD - pagoUSD - retencionUSD);
    var nuevoSaldoBS = nuevoSaldoUSD * tasaActual;
    var nuevoEstado = nuevoSaldoUSD <= 0.01 ? 'PAGADA' : 'PARCIAL';

    var historial = [];
    try {
      historial = JSON.parse(rowValues[colMap['historial_pagos_json']] || '[]');
    } catch(eh) { historial = []; }

    historial.push({
      fecha: new Date().toISOString(),
      monto_usd: pagoUSD,
      monto_bs: pagoBS,
      tasa_bcv: tasaActual,
      metodo_pago: data.metodo_pago || 'TRANSFERENCIA',
      referencia: data.referencia || '',
      comprobante_retencion: data.comprobante_retencion || '',
      retencion_iva_monto_bs: retencionBS
    });

    rowValues[colMap['saldo_pendiente_usd']] = nuevoSaldoUSD;
    rowValues[colMap['saldo_pendiente_bs']] = nuevoSaldoBS;
    rowValues[colMap['estado']] = nuevoEstado;
    if (data.comprobante_retencion) rowValues[colMap['comprobante_retencion']] = data.comprobante_retencion;
    if (retencionBS > 0) rowValues[colMap['retencion_iva_monto_bs']] = (parseFloat(rowValues[colMap['retencion_iva_monto_bs']]) || 0) + retencionBS;
    rowValues[colMap['historial_pagos_json']] = JSON.stringify(historial);

    sheet.getRange(rowIndex + 2, 1, 1, sheet.getLastColumn()).setValues([rowValues]);
    SpreadsheetApp.flush();
    return { success: true, data: getCuentasPagar() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteCuentaPagar(ss, data) {
  try {
    var sheet = getSheet('CuentasPagar');
    if (!sheet) return { success: true, data: [] };
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]) === String(data.id); });
    if (rowIndex > -1) sheet.deleteRow(rowIndex + 2);
    return { success: true, data: getCuentasPagar() };
  } catch(e) { return { success: false, error: e.message }; }
}

function getCaja() {
  var sheet = getSheet('Caja');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h).toLowerCase().trim()] = row[i]; });
    return obj;
  }).filter(function(c) { return c.id; });
}

function upsertCaja(ss, data) {
  try {
    var sheet = ss.getSheetByName('Caja') || ss.insertSheet('Caja');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['id', 'fecha_apertura', 'apertura_usd', 'apertura_bs', 'tasa_bcv_apertura', 'estado', 'fecha_cierre', 'cierre_usd', 'cierre_bs', 'cierre_debito', 'cierre_pago_movil', 'cierre_bio_pago', 'cierre_transferencia', 'observaciones']);
      sheet.getRange(1, 1, 1, 14).setFontWeight('bold');
    }
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]) === String(data.id); });
    var rowData = [
      data.id,
      data.fecha_apertura,
      parseFloat(data.apertura_usd) || 0,
      parseFloat(data.apertura_bs) || 0,
      parseFloat(data.tasa_bcv_apertura) || 0,
      data.estado || 'ACTIVA',
      data.fecha_cierre,
      parseFloat(data.cierre_usd) || 0,
      parseFloat(data.cierre_bs) || 0,
      parseFloat(data.cierre_debito) || 0,
      parseFloat(data.cierre_pago_movil) || 0,
      parseFloat(data.cierre_bio_pago) || 0,
      parseFloat(data.cierre_transferencia) || 0,
      data.observaciones
    ];
    if (rowIndex === -1) sheet.appendRow(rowData); else sheet.getRange(rowIndex + 2, 1, 1, 14).setValues([rowData]);
    return { success: true, data: { Caja: getCaja() } };
  } catch(e) { return { success: false, error: e.message }; }
}

function abrirCaja(ss, data) {
  try {
    var tasaFinal = parseFloat(data.tasa_bcv_apertura) || 0;
    
    var sheet = ss.getSheetByName('Caja') || ss.insertSheet('Caja');
    var headers = [
      'id', 'fecha_apertura', 'apertura_usd', 'apertura_bs', 'tasa_bcv_apertura', 'estado', 
      'fecha_cierre', 'cierre_usd', 'cierre_bs', 'cierre_debito', 'cierre_pago_movil', 
      'cierre_bio_pago', 'cierre_transferencia', 'observaciones', 'numero_reporte_z', 
      'factura_inicial', 'factura_final', 'total_exento_bs', 'total_base_bs', 'total_iva_bs', 'total_igtf_bs',
      'usuario_id', 'usuario_nombre', 'usuario_foto', 'usuario_cargo',
      'usuario_cierre_id', 'usuario_cierre_nombre', 'usuario_cierre_foto'
    ];
    ensureHeaders(sheet, headers);
    var actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).toLowerCase().trim(); });
    
    var rowObj = {
      id: data.id,
      fecha_apertura: data.fecha_apertura || new Date().toISOString(),
      apertura_usd: parseFloat(data.apertura_usd) || 0,
      apertura_bs: parseFloat(data.apertura_bs) || 0,
      tasa_bcv_apertura: tasaFinal,
      estado: 'ACTIVA',
      fecha_cierre: '',
      cierre_usd: 0,
      cierre_bs: 0,
      cierre_debito: 0,
      cierre_pago_movil: 0,
      cierre_bio_pago: 0,
      cierre_transferencia: 0,
      observaciones: '',
      numero_reporte_z: '',
      factura_inicial: data.factura_inicial || '',
      factura_final: '',
      total_exento_bs: 0,
      total_base_bs: 0,
      total_iva_bs: 0,
      total_igtf_bs: 0,
      usuario_id: data.usuario_id || '',
      usuario_nombre: data.usuario_nombre || '',
      usuario_foto: data.usuario_foto || '',
      usuario_cargo: data.usuario_cargo || '',
      usuario_cierre_id: '',
      usuario_cierre_nombre: '',
      usuario_cierre_foto: ''
    };
    
    var newRow = actualHeaders.map(function(h) {
      var val = rowObj[h];
      return val !== undefined ? val : '';
    });
    sheet.appendRow(newRow);
    
    if (tasaFinal > 0) {
      try {
        var tasaSheet = ss.getSheetByName('Tasa') || ss.insertSheet('Tasa');
        if (tasaSheet.getLastRow() === 0) {
          tasaSheet.appendRow(['tasa_actual', 'fecha_vigencia', 'ultima_sincronizacion']);
          tasaSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
        }
        tasaSheet.getRange('A2').setValue(tasaFinal);
        tasaSheet.getRange('B2').setValue(new Date().toLocaleDateString('es-VE'));
        tasaSheet.getRange('C2').setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
      } catch(e_tasa) {
        Logger.log('Error al actualizar tasa global en abrirCaja: ' + e_tasa.message);
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true, data: { Caja: getCaja(), tasaBCV: tasaFinal } };
  } catch(e) { return { success: false, error: e.message }; }
}

function cerrarCaja(ss, data) {
  try {
    var sheet = ss.getSheetByName('Caja');
    if (!sheet || sheet.getLastRow() <= 1) return { success: false, error: 'Sheet Caja no encontrado o vacío' };
    
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0].map(function(h) { return String(h).toLowerCase().trim(); });
    
    var idIndex = headers.indexOf('id');
    if (idIndex === -1) idIndex = 0;
    
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idIndex]) === String(data.id)) {
        rowIndex = i;
        break;
      }
    }
    if (rowIndex === -1) return { success: false, error: 'Sesion de caja no encontrada: ' + data.id };

    var rowValues = values[rowIndex];
    var colMap = {};
    headers.forEach(function(h, idx) { colMap[h] = idx; });

    if (colMap['estado'] !== undefined) rowValues[colMap['estado']] = 'CERRADA';
    if (colMap['fecha_cierre'] !== undefined) rowValues[colMap['fecha_cierre']] = data.fecha_cierre || new Date().toISOString();
    if (colMap['cierre_usd'] !== undefined) rowValues[colMap['cierre_usd']] = parseFloat(data.cierre_usd) || 0;
    if (colMap['cierre_bs'] !== undefined) rowValues[colMap['cierre_bs']] = parseFloat(data.cierre_bs) || 0;
    if (colMap['cierre_debito'] !== undefined) rowValues[colMap['cierre_debito']] = parseFloat(data.cierre_debito) || 0;
    if (colMap['cierre_pago_movil'] !== undefined) rowValues[colMap['cierre_pago_movil']] = parseFloat(data.cierre_pago_movil) || 0;
    if (colMap['cierre_bio_pago'] !== undefined) rowValues[colMap['cierre_bio_pago']] = parseFloat(data.cierre_bio_pago) || 0;
    if (colMap['cierre_transferencia'] !== undefined) rowValues[colMap['cierre_transferencia']] = parseFloat(data.cierre_transferencia) || 0;
    if (colMap['observaciones'] !== undefined) rowValues[colMap['observaciones']] = data.observaciones || '';

    if (colMap['numero_reporte_z'] !== undefined) rowValues[colMap['numero_reporte_z']] = data.numero_reporte_z || '';
    if (colMap['factura_inicial'] !== undefined) rowValues[colMap['factura_inicial']] = data.factura_inicial || '';
    if (colMap['factura_final'] !== undefined) rowValues[colMap['factura_final']] = data.factura_final || '';
    if (colMap['total_exento_bs'] !== undefined) rowValues[colMap['total_exento_bs']] = parseFloat(data.total_exento_bs) || 0;
    if (colMap['total_base_bs'] !== undefined) rowValues[colMap['total_base_bs']] = parseFloat(data.total_base_bs) || 0;
    if (colMap['total_iva_bs'] !== undefined) rowValues[colMap['total_iva_bs']] = parseFloat(data.total_iva_bs) || 0;
    if (colMap['total_igtf_bs'] !== undefined) rowValues[colMap['total_igtf_bs']] = parseFloat(data.total_igtf_bs) || 0;

    if (colMap['usuario_cierre_id'] !== undefined) rowValues[colMap['usuario_cierre_id']] = data.usuario_cierre_id || '';
    if (colMap['usuario_cierre_nombre'] !== undefined) rowValues[colMap['usuario_cierre_nombre']] = data.usuario_cierre_nombre || '';
    if (colMap['usuario_cierre_foto'] !== undefined) rowValues[colMap['usuario_cierre_foto']] = data.usuario_cierre_foto || '';

    sheet.getRange(rowIndex + 1, 1, 1, lastCol).setValues([rowValues]);
    SpreadsheetApp.flush();

    return { success: true, data: { Caja: getCaja() } };
  } catch(e) { return { success: false, error: e.message }; }
}

function fetchBcvFromWeb() {
  try {
    var response = UrlFetchApp.fetch('https://www.bcv.org.ve/', { 
      muteHttpExceptions: true, 
      timeout: 15000,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });
    var html = response.getContentText();
    
    var usdMatch = html.match(/<div[^>]*id="dolar"[^>]*>[\s\S]*?<strong[^>]*>(\d+[,.]?\d{1,4})<\/strong>/i);
    if (usdMatch && usdMatch[1]) {
      var tasaStr = usdMatch[1].replace(',', '.');
      var tasa = parseFloat(tasaStr);
      if (tasa > 0 && tasa < 10000) {
        return tasa.toFixed(2);
      }
    }
    
    var altMatch = html.match(/USD[\s\S]{0,200}?(\d+[,.]\d{1,4})/i);
    if (altMatch && altMatch[1]) {
      var tasaStr = altMatch[1].replace(',', '.');
      var tasa = parseFloat(tasaStr);
      if (tasa > 0 && tasa < 10000) {
        return tasa.toFixed(2);
      }
    }
    
    var divMatches = html.match(/<div[^>]*>\s*(\d+[,.]\d{1,4})\s*<\/div>/g);
    if (divMatches) {
      for (var i = 0; i < divMatches.length; i++) {
        var numMatch = divMatches[i].match(/(\d+[,.]\d{1,4})/);
        if (numMatch) {
          var tasa = parseFloat(numMatch[1].replace(',', '.'));
          if (tasa > 40 && tasa < 10000) {
            return tasa.toFixed(2);
          }
        }
      }
    }
    return null;
  } catch(e) {
    Logger.log('Error scraping BCV: ' + e.message);
    return null;
  }
}

function syncTasaBCV() {
   try {
     var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
     var sheet = ss.getSheetByName('Tasa') || ss.insertSheet('Tasa');
     if (sheet.getLastRow() === 0) { sheet.appendRow(['tasa_actual', 'fecha_vigencia', 'ultima_sincronizacion']); sheet.getRange(1, 1, 1, 3).setFontWeight('bold'); }
     
     var tasa = fetchBcvFromWeb();
     
     if (!tasa || tasa <= 0) {
       var fuentes = [
         { url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?moneda=bcv', parser: function(json) { 
             if (json && json.monedas && json.monedas.bcv && json.monedas.bcv.price) {
               return parseFloat(String(json.monedas.bcv.price).replace(',', '.')).toFixed(2);
             }
             if (json && json.monedasc && json.monedasc.bcv) {
               return parseFloat(String(json.monedasc.bcv.price).replace(',', '.')).toFixed(2);
             }
             return 0;
         }},
         { url: 'https://ve.dolarapi.com/v1/dolares/oficial', parser: function(json) {
             if (json && json.promedio) return parseFloat(json.promedio).toFixed(2);
             if (json && json.valor) return parseFloat(json.valor).toFixed(2);
             return 0;
         }},
         { url: 'https://s3.amazonaws.com/dolartoday/data.json', parser: function(json) { 
             return json && json.promedio ? parseFloat(json.promedio).toFixed(2) : 0; 
         }}
       ];
       
       for (var i = 0; i < fuentes.length; i++) {
         try {
           var response = UrlFetchApp.fetch(fuentes[i].url, { muteHttpExceptions: true, timeout: 10000 });
           var json = JSON.parse(response.getContentText());
           tasa = fuentes[i].parser(json);
           if (tasa > 0) break;
         } catch(e) {}
       }
     }
     
     var tasaEuro = 0;
     try {
       var euroResp = UrlFetchApp.fetch('https://ve.dolarapi.com/v1/euros/oficial', { muteHttpExceptions: true, timeout: 8000 });
       if (euroResp && euroResp.getResponseCode() === 200) {
         var euroJson = JSON.parse(euroResp.getContentText());
         tasaEuro = parseFloat(euroJson.promedio || euroJson.venta || 0);
       }
     } catch(eEuro) {}
     
     if (tasa && tasa > 0) {
       var tasaNum = parseFloat(tasa);
       var fechaHoy = new Date().toLocaleDateString('es-VE');
       var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
       
       sheet.getRange('A2').setValue(tasaNum);
       sheet.getRange('B2').setValue(fechaHoy);
       sheet.getRange('C2').setValue(timestamp);
       if (tasaEuro > 0) {
         sheet.getRange('D1').setValue('tasa_euro');
         sheet.getRange('D2').setValue(tasaEuro);
       }
       SpreadsheetApp.flush();
       return { success: true, data: { tasa_bcv: tasaNum, tasa_euro: tasaEuro, tasa_fecha: fechaHoy } };
     }
     return { success: false, error: 'Tasa no disponible' };
   } catch(e) { return { success: false, error: e.message }; }
 }

function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) { if (triggers[i].getHandlerFunction() === 'sincronizarTasaBCVAutomatica') return 'Ya existe'; }
  ScriptApp.newTrigger('sincronizarTasaBCVAutomatica').timeBased().everyHours(4).create();
  return 'Trigger creado';
}

function sincronizarTasaBCVAutomatica() {
  try { syncTasaBCV(); } catch(e) { Logger.log('Error: ' + e.message); }
}

function updateTasa(ss, data) {
  try {
    var tasa = parseFloat(data.tasa) || 0;
    if (tasa < 0) return { success: false, error: 'Tasa invalida' };
    var sheet = ss.getSheetByName('Tasa') || ss.insertSheet('Tasa');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['tasa_actual', 'fecha_vigencia', 'ultima_sincronizacion']);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    }
    sheet.getRange('A2').setValue(tasa);
    sheet.getRange('B2').setValue(new Date().toLocaleDateString('es-VE'));
    sheet.getRange('C2').setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
    SpreadsheetApp.flush();
    return { success: true, data: { tasa_bcv: tasa, tasa_fecha: new Date().toLocaleDateString('es-VE') } };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function clearSales(ss) {
  try {
    var sheet = ss.getSheetByName('Ventas');
    if (!sheet) return { success: true, data: getAllSheetsData(false) };
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    return { success: true, message: 'Tabla de ventas vaciada con éxito', data: getAllSheetsData(false) };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================
// GESTION DE USUARIOS Y ROLES
// =============================================================

function getUsuarios() {
  try {
    var sheet = getSheet('Usuarios');
    var headers = ['id', 'username', 'password', 'nombre_completo', 'cargo', 'rol', 'foto_url', 'permisos', 'estado', 'fecha_creacion'];
    
    if (!sheet) {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.insertSheet('Usuarios');
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      
      var defaultAdmin = [
        'usr_admin_1',
        'admin',
        'admin123',
        'ADMINISTRADOR',
        'Gerente de Tienda',
        'admin',
        '',
        JSON.stringify(['pos', 'dashboard', 'inventory', 'cuentas-por-cobrar', 'cuentas-por-pagar', 'reportes', 'usuarios']),
        'activo',
        new Date().toISOString()
      ];
      sheet.appendRow(defaultAdmin);
      SpreadsheetApp.flush();
    }
    
    if (sheet.getLastRow() <= 1) return [];
    
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
      return String(h).toLowerCase().trim();
    });
    
    return data.map(function(row) {
      var obj = {};
      sheetHeaders.forEach(function(h, i) { obj[h] = row[i]; });
      if (obj.foto_url) {
        obj.foto_url = migrarUrlImagen(String(obj.foto_url));
      }
      if (typeof obj.permisos === 'string' && obj.permisos.indexOf('[') === 0) {
        try { obj.permisos = JSON.parse(obj.permisos); } catch(e) {}
      }
      return obj;
    }).filter(function(u) { return u.id && u.username; });
  } catch(e) {
    Logger.log('Error en getUsuarios: ' + e.message);
    return [];
  }
}

function upsertUsuario(ss, data) {
  try {
    var sheet = ss.getSheetByName('Usuarios') || ss.insertSheet('Usuarios');
    var headers = ['id', 'username', 'password', 'nombre_completo', 'cargo', 'rol', 'foto_url', 'permisos', 'estado', 'fecha_creacion'];
    ensureHeaders(sheet, headers);
    
    var id = data.id || ('usr_' + new Date().getTime());
    var fotoUrl = data.foto_url || '';
    
    if (data.foto_base64 && typeof data.foto_base64 === 'string' && data.foto_base64.indexOf('data:image') === 0) {
      try {
        fotoUrl = guardarImagenEnDrive('user_' + id, data.foto_base64, data.foto_ext || 'jpg');
      } catch(eFoto) {
        Logger.log('Error al guardar foto en Drive: ' + eFoto.message);
      }
    }
    
    var permisosVal = Array.isArray(data.permisos) ? JSON.stringify(data.permisos) : (data.permisos || '[]');
    var allIds = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(id).trim(); });
    
    var rowData = [
      id,
      String(data.username || '').trim().toLowerCase(),
      String(data.password || ''),
      String(data.nombre_completo || ''),
      String(data.cargo || ''),
      String(data.rol || 'cajero'),
      fotoUrl,
      permisosVal,
      data.estado || 'activo',
      data.fecha_creacion || new Date().toISOString()
    ];
    
    if (rowIndex === -1) {
      sheet.appendRow(rowData);
    } else {
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rowData]);
    }
    SpreadsheetApp.flush();
    return { success: true, data: getUsuarios() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function deleteUsuario(ss, data) {
  try {
    var sheet = ss.getSheetByName('Usuarios');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };
    
    var allIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var rowIndex = allIds.findIndex(function(r) { return String(r[0]).trim() === String(data.id).trim(); });
    
    if (rowIndex > -1) {
      var list = getUsuarios();
      var admins = list.filter(function(u) { return u.rol === 'admin'; });
      var target = list.find(function(u) { return String(u.id) === String(data.id); });
      
      if (target && target.rol === 'admin' && admins.length <= 1) {
        return { success: false, error: 'No se puede eliminar el único administrador del sistema.' };
      }
      
      sheet.deleteRow(rowIndex + 2);
      SpreadsheetApp.flush();
    }
    return { success: true, data: getUsuarios() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// =============================================================
// GESTION DE CONFIGURACION DEL SISTEMA
// =============================================================

var DEFAULT_CONFIG_DATA = {
  nombre_empresa: 'MICRO MARKET EXPRESS',
  rif_empresa: 'J-12345678-9',
  direccion_empresa: 'AV. PRINCIPAL, LOCAL 1, CARACAS',
  telefono_empresa: '+58 412-1234567',
  mensaje_ticket: '¡GRACIAS POR SU COMPRA! VUELVA PRONTO.',
  moneda_defecto: 'USD',
  iva_porcentaje: '16',
  igtf_porcentaje: '3',
  stock_alerta_minimo: '5',
  permitir_venta_sin_stock: 'true',
  impresion_automatica_ticket: 'false',
  intervalo_bcv_minutos: '1',
  serial_caja_fiscal: 'MME-POS-01',
  providencia_seniat: 'SNAT/2011/00071'
};

function getConfig() {
  try {
    var sheet = getSheet('Configuracion');
    if (!sheet) {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = ss.insertSheet('Configuracion');
    }
    
    var headers = ['clave', 'valor', 'actualizado_el'];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      
      var now = new Date().toISOString();
      Object.keys(DEFAULT_CONFIG_DATA).forEach(function(k) {
        sheet.appendRow([k, DEFAULT_CONFIG_DATA[k], now]);
      });
      SpreadsheetApp.flush();
    }
    
    if (sheet.getLastRow() <= 1) return DEFAULT_CONFIG_DATA;
    
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    var cfg = {};
    Object.keys(DEFAULT_CONFIG_DATA).forEach(function(k) {
      cfg[k] = DEFAULT_CONFIG_DATA[k];
    });
    
    rows.forEach(function(r) {
      var key = String(r[0]).trim();
      var val = r[1];
      if (key) {
        cfg[key] = val;
      }
    });
    
    return cfg;
  } catch(e) {
    Logger.log('Error en getConfig: ' + e.message);
    return DEFAULT_CONFIG_DATA;
  }
}

function setConfig(ss, data) {
  try {
    var sheet = ss.getSheetByName('Configuracion') || ss.insertSheet('Configuracion');
    var headers = ['clave', 'valor', 'actualizado_el'];
    ensureHeaders(sheet, headers);
    
    var existingRows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues() : [];
    var keyMap = {};
    existingRows.forEach(function(r, idx) {
      var k = String(r[0]).trim();
      if (k) keyMap[k] = idx + 2;
    });
    
    var now = new Date().toISOString();
    Object.keys(data).forEach(function(key) {
      if (key === 'action') return;
      var val = data[key];
      if (typeof val === 'object') val = JSON.stringify(val);
      
      if (keyMap[key]) {
        sheet.getRange(keyMap[key], 2, 1, 2).setValues([[val, now]]);
      } else {
        sheet.appendRow([key, val, now]);
        keyMap[key] = sheet.getLastRow();
      }
    });
    
    SpreadsheetApp.flush();
    return { success: true, data: getConfig() };
  } catch(e) {
    Logger.log('Error en setConfig: ' + e.message);
    return { success: false, error: e.message };
  }
}
