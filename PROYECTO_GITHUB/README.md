# 🛒 Micro Market Express (TPV) - Versión 2.1 (Producción)

**Micro Market Express** es un sistema inteligente de Punto de Venta (POS) e Inventario diseñado con una arquitectura React moderna (Vite) conectada a un backend serverless en Supabase. Cuenta con un diseño avanzado en *Glassmorphism* y efectos *Neon* reactivos que proporcionan una experiencia de usuario inmersiva, ágil y atractiva visualmente.

---

## 🚀 Novedades y Características (V2.1)

*   **Módulo de Caja (Gestión de Sesiones):** Control total de apertura y cierre de caja con conteo de efectivo y resumen de ventas por sesión.
*   **Alertas de Stock Crítico:** Banner dinámico en el Dashboard que alerta en tiempo real sobre productos con bajo inventario.
*   **Descripción Técnica Detallada:** Nueva columna inteligente en Inventario y TPV que combina automáticamente `Nombre + Descripción + Unidades + Medida` con pluralización inteligente (Ej: "24 KILOGRAMOS").
*   **Efectos Neón de Agotado:** Los productos con stock 0 ahora brillan en **Rojo Neón** en el TPV para una identificación instantánea, manteniendo su visibilidad para el cajero.
*   **Control de Inventario Riguroso:** El TPV bloquea automáticamente cualquier intento de vender más de lo que existe físicamente en stock.
*   **TPV Optimizado:** Visualización mejorada de SKUs y códigos de barras en blanco puro para máxima legibilidad.
*   **Diseño Reactivo y Animado:** Desarrollado usando **Framer Motion** para modales suaves y confirmaciones visuales.
*   **Sistema de Ayuda Contextual (F1):** Manual de usuario dinámico que detecta en qué pantalla te encuentras.

---

## ⌨️ Atajos de Comando (Productividad)

| Comando Teclado | Acción Estándar Mapeada |
| :--- | :--- |
| **`F1`** | Abre el **Manual Dinámico del Sistema** (Contexto según la pestaña visitada). |
| **`F5`** | Refresca la ventana limpiando la caché instantánea o procesos atascados. |
| **`ESC`** | Cierra inmediatamente ventanas modales sin guardar e interrumpe búsquedas. |

---

## 🛠️ Tecnologías Principales

- **Frontend:** React.js 18 + Vite + Framer Motion.
- **Iconografía:** Lucide React (Estilo Neón).
- **Base de Datos:** Supabase (PostgreSQL) + Realtime.
- **Utilidades:** Day.js (Fechas) + Recharts (Gráficas Dashboard).

---

## 📦 Instrucciones para Despliegue Manual (Producción)

Este repositorio ha sido preparado para ser **"Llave en Mano"**. La carpeta `dist/` contiene la aplicación optimizada y minificada lista para subir.

### Pasos para Subir a GitHub (Vía Upload Manual):
1.  **NO SUBAS TODO EL PROYECTO**. GitHub tiene límites de archivos y muchos de estos son solo para desarrollo.
2.  Ve a tu repositorio en GitHub.
3.  Haz clic en **"Add file" > "Upload files"**.
4.  **ARRASTRA SOLO EL CONTENIDO DE LA CARPETA `dist/`**.
5.  Asegúrate de incluir también el archivo `.nojekyll` (si vas a usar GitHub Pages) para que las carpetas de assets carguen correctamente.

### Archivos/Carpetas a IGNORAR (NO SUBIR):
❌ `node_modules/` (Carpeta pesada de librerías).
❌ `.env` (**CRÍTICO**: Contiene tus llaves privadas de Supabase).
❌ `src/`, `public/`, `vite.config.js` (Solo necesarios para programar, no para que la app funcione).

---
*Compilado y optimizado por Antigravity para Micro Market Express.*
