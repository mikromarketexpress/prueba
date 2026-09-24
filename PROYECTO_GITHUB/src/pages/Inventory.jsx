import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Package,
  X,
  Filter,
  Layers,
  Camera,
  Trash2,
  Upload,
  CloudUpload,
  Image,
  Coffee,
  Pizza,
  Apple,
  Milk,
  Brush,
  Wrench,
  Hammer,
  Utensils,
  ShoppingBasket,
  Beer,
  Candy,
  IceCream,
  Wine,
  Carrot,
  Construction,
  Lightbulb,
  Pipette,
  Drill,
  Beef,
  Fish,
  Grape,
  Egg,
  Tv,
  Speaker,
  Laptop,
  Headphones,
  Printer,
  Book,
  Pencil,
  Gift,
  Shirt,
  Footprints,
  Trash,
  Droplets,
  Zap,
  ShowerHead,
  Stethoscope,
  Baby,
  Dog,
  Cat,
  Bike,
  Truck,
  Car,
  Smartphone,
  Database,
  Check,
  Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../context/ToastContext";
import { useDatabase } from "../hooks/useDatabase";
import { useImageStorage } from "../hooks/useImageStorage";
import { CategoryDropdown } from "../components/CategoryDropdown";
import CategoryManager from "../components/CategoryManager";
import ImageLinker from "../components/ImageLinker";
import CurrencyInput from "../components/CurrencyInput";
import { formatUSD, formatBS } from "../lib/financialUtils";
import {
  getProductImageUrl,
  DEFAULT_PRODUCT_IMAGE,
  GOOGLE_DRIVE_FOLDER_ID,
} from "../lib/imageUtils";
import defaultPlaceholderImg from "../../assets/img/subir_imagen.png";

const CATEGORY_ICONS = {
  Coffee,
  Pizza,
  Apple,
  Milk,
  Brush,
  Layers,
  Wrench,
  Hammer,
  Utensils,
  ShoppingBasket,
  Beer,
  Candy,
  IceCream,
  Wine,
  Carrot,
  Construction,
  Lightbulb,
  Pipette,
  Drill,
  Beef,
  Fish,
  Grape,
  Egg,
  Tv,
  Speaker,
  Laptop,
  Headphones,
  Printer,
  Book,
  Pencil,
  Gift,
  Shirt,
  Footprints,
  Trash,
  Droplets,
  Zap,
  ShowerHead,
  Stethoscope,
  Baby,
  Dog,
  Cat,
  Bike,
  Truck,
  Car,
  Smartphone,
  Camera,
  Database,
};

const ICON_GALLERY = {
  ALIMENTOS: [
    { name: "Coffee", label: "BEBIDAS" },
    { name: "Apple", label: "FRUTAS" },
    { name: "Carrot", label: "VERDURAS" },
    { name: "Milk", label: "LÁCTEOS" },
    { name: "Egg", label: "HUEVOS" },
    { name: "Beef", label: "CARNES" },
    { name: "Fish", label: "PESCADO" },
    { name: "Pizza", label: "PANADERÍA" },
    { name: "Utensils", label: "COMIDA" },
    { name: "IceCream", label: "CONGELADOS" },
    { name: "Candy", label: "DULCES" },
    { name: "ShoppingBasket", label: "ABARROTES" },
  ],
  "LIMPIEZA Y ASEO": [
    { name: "Brush", label: "LIMPIEZA" },
    { name: "Droplets", label: "ASEO PERSONAL" },
    { name: "ShowerHead", label: "BAÑO" },
    { name: "Shirt", label: "ROPA" },
    { name: "Trash", label: "PAPELERÍA" },
  ],
  OTROS: [
    { name: "Baby", label: "BEBÉ" },
    { name: "Dog", label: "MASCOTAS" },
    { name: "Layers", label: "VARIOS" },
  ],
};

const getIcon = (name = "", iconName = "") => {
  if (iconName && CATEGORY_ICONS[iconName]) {
    const IconComp = CATEGORY_ICONS[iconName];
    return <IconComp size={16} />;
  }
  const n = String(name || "").toLowerCase();
  if (n.includes("bebida")) return <CATEGORY_ICONS.Coffee size={16} />;
  if (n.includes("snack") || n.includes("dulce"))
    return <CATEGORY_ICONS.Candy size={16} />;
  if (n.includes("fruta") || n.includes("verdura"))
    return <CATEGORY_ICONS.Apple size={16} />;
  if (n.includes("lácteo") || n.includes("lacteo") || n.includes("huevo"))
    return <CATEGORY_ICONS.Milk size={16} />;
  if (n.includes("carne") || n.includes("embutido"))
    return <CATEGORY_ICONS.Beef size={16} />;
  if (n.includes("panader")) return <CATEGORY_ICONS.Pizza size={16} />;
  if (n.includes("congelad")) return <CATEGORY_ICONS.IceCream size={16} />;
  if (n.includes("limpieza")) return <CATEGORY_ICONS.Brush size={16} />;
  if (n.includes("aseo") || n.includes("higiene"))
    return <CATEGORY_ICONS.Droplets size={16} />;
  if (n.includes("mascota")) return <CATEGORY_ICONS.Dog size={16} />;
  if (n.includes("bebé")) return <CATEGORY_ICONS.Baby size={16} />;
  return <CATEGORY_ICONS.Layers size={16} />;
};

const LoadingOverlay = ({ isVisible, message }) => {
  if (!isVisible) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <Loader
        size={40}
        style={{ color: "var(--s-neon)", animation: "spin 1s linear infinite" }}
      />
      <span
        style={{
          color: "var(--s-neon)",
          fontWeight: 900,
          letterSpacing: "0.1em",
        }}
      >
        {message || "CARGANDO..."}
      </span>
    </div>
  );
};

const pluralizarMedida = (medida, cantidad) => {
  const med = String(medida || "UNIDAD").toUpperCase();
  const cant = parseFloat(cantidad) || 0;
  if (cant === 1) {
    if (med === "CENTIMETRO_CUBICO" || med === "CENTIMETRO CUBICO") return "CENTÍMETRO CÚBICO";
    return med;
  }
  if (med === "UNIDAD") return "UNIDADES";
  if (med === "KILOGRAMO") return "KILOGRAMOS";
  if (med === "GRAMO") return "GRAMOS";
  if (med === "MILIGRAMO") return "MILIGRAMOS";
  if (med === "LITRO") return "LITROS";
  if (med === "MILILITRO") return "MILILITROS";
  if (med === "CENTIMETRO_CUBICO" || med === "CENTIMETRO CUBICO") return "CENTÍMETROS CÚBICOS";
  if (med === "PAQUETE") return "PAQUETES";
  if (med === "CAJA") return "CAJAS";
  return med + "S";
};

const formatStockDisponible = (stock) => {
  const stockActual = parseInt(stock) || 0;
  return `${stockActual} UNIDAD(ES) DISPONIBLE(S)`;
};

const formatDescripcionTecnica = (p) => {
  const desc = String(p.descripcion_corta || "").trim().toUpperCase();
  const numUnid = parseFloat(p.numero_unid) || 1;
  const unidadMed = String(p.unidad_medida || "UNIDAD").toUpperCase();
  
  const unitFormatted = pluralizarMedida(unidadMed, numUnid);
  const showUnidades = numUnid > 1 || ["KILOGRAMO", "GRAMO", "MILIGRAMO", "LITRO", "MILILITRO", "CENTIMETRO_CUBICO", "CENTIMETRO CUBICO"].includes(unidadMed);
  
  if (showUnidades) {
    const unidStr = `${numUnid} ${unitFormatted}`;
    return desc ? `${desc} - ${unidStr}` : unidStr;
  }
  
  return desc || "—";
};

const Inventory = () => {
  const {
    isReady,
    productos: dbProductos,
    categorias: dbCategorias,
    addProducto,
    updateProducto,
    deleteProducto,
    addCategory,
    deleteCategory,
    refresh,
    syncingStatus,
  } = useDatabase();
  const { uploadImage, uploading: isUploadingImage } = useImageStorage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [formErrors, setFormErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Layers");
  const [activeIconGroup, setActiveIconGroup] = useState("ALIMENTOS");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showImageLinker, setShowImageLinker] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const { showToast } = useToast();

  const TASA_BCV = 46.5;

  useEffect(() => {
    if (isReady) {
      setProducts(dbProductos || []);
      const catsWithAll = [
        { id: "all", nombre: "TODAS", icono_nombre: "Layers" },
        ...(dbCategorias || []).map((c) => ({
          id: c.id,
          nombre: c.nombre,
          icono_nombre: c.icono_nombre || "Layers",
        })),
      ];
      setCategories(catsWithAll);
      setLoading(false);
    }
  }, [isReady, dbProductos, dbCategorias]);

  const handleEdit = (p) => {
    setIsAdding(false);
    setEditingId(p.id);
    setFormErrors([]);
    setEditForm({
      ...p,
      precio_costo: p.precio_costo || 0,
      precio_usd: p.precio_usd || 0,
      stock: p.stock || 0,
      numero_unid: p.numero_unid || 1,
      tasa_bcv: p.tasa_bcv ?? "",
      alicuota_iva: p.alicuota_iva || "G",
    });
  };

  const handleNew = () => {
    setIsAdding(true);
    setEditingId("new");
    setFormErrors([]);
    setEditForm({
      nombre: "",
      precio_costo: 0,
      precio_usd: 0,
      codigo_barras: "",
      categoria_id: categories[1]?.id || "",
      categoria: "",
      categoria_nombre: "",
      stock: 0,
      numero_unid: 1,
      unidad_medida: "UNIDAD",
      descripcion_corta: "",
      tasa_bcv: "",
      alicuota_iva: "G",
    });
  };

  const manejarSubidaImagen = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const optimizarImagen = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 500;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = file.type || "image/jpeg";
          const base64Data = canvas.toDataURL(mimeType, 0.8);
          resolve(base64Data);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEditForm((prev) => ({
      ...prev,
      _imageFile: file,
      _uploadingImage: true,
      _uploadProgress: "CONVIRTIENDO IMAGEN...",
    }));

    try {
      const base64Data = await manejarSubidaImagen(file);
      const previewUrl = URL.createObjectURL(file);
      const ext = file.type ? file.type.split("/")[1] : "webp";
      setEditForm((prev) => ({
        ...prev,
        imagen_url: previewUrl,
        _imageBase64: base64Data,
        _imageExtension: ext,
        _uploadingImage: false,
        _uploadProgress: null,
      }));
    } catch (error) {
      setEditForm((prev) => ({
        ...prev,
        _uploadingImage: false,
        _uploadProgress: null,
      }));
      showToast("ERROR AL LEER ARCHIVO LOCAL", "error");
    }
  };

  const handleImageUpload = async () => {
    if (!editForm._imageFile) return false;

    setEditForm((prev) => ({
      ...prev,
      _uploadingImage: true,
      _uploadProgress: "SUBIENDO A GOOGLE DRIVE...",
    }));

    const result = await uploadImage(
      editForm._imageFile,
      editingId === "new" ? `prod_${Date.now()}` : editingId,
    );

    if (result && result.success) {
      setEditForm((prev) => ({
        ...prev,
        imagen_url: result.url,
        _uploadingImage: false,
        _uploadProgress: null,
        _imageFile: null,
      }));
      showToast("IMAGEN SUBIDA A GOOGLE DRIVE", "success");
      return result.url;
    } else {
      setEditForm((prev) => ({
        ...prev,
        _uploadingImage: false,
        _uploadProgress: null,
      }));
      showToast(result?.error || "FALLO AL SUBIR LA IMAGEN", "error");
      return null;
    }
  };

  const validateForm = (form) => {
    const errors = [];
    if (!form.nombre?.trim()) errors.push("nombre");
    if (!form.precio_usd && form.precio_usd !== 0) errors.push("precio_usd");
    if (!form.stock && form.stock !== 0) errors.push("stock");
    return errors;
  };

  // =========================================================================
  // COMPRESIÓN FORZADA A JPEG ≤30KB (canvas 500px, quality 0.7)
  // =========================================================================
  const comprimirImagenForzado = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width,
            h = img.height;
          const MAX = 500;
          if (w > h) {
            if (w > MAX) {
              h = Math.round((h * MAX) / w);
              w = MAX;
            }
          } else {
            if (h > MAX) {
              w = Math.round((w * MAX) / h);
              h = MAX;
            }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          // Force JPEG at 0.7 quality for smallest payload
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(null);
        img.src = ev.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const saveEdit = async () => {
  if (editForm._uploadingImage) {
    showToast("ESPERA A QUE TERMINE DE PROCESAR LA IMAGEN", "warning");
    return;
  }

  setFormErrors([]);

  try {
    const currentErrors = validateForm(editForm);
    if (currentErrors.length > 0) {
      setFormErrors(currentErrors);
      showToast("COMPLETA LOS CAMPOS REQUERIDOS", "error");
      return;
    }

    if (!editForm.nombre?.trim()) {
      showToast("EL NOMBRE ES OBLIGATORIO", "error");
      return;
    }

    if (!editForm.precio_usd && editForm.precio_usd !== 0) {
      showToast("EL PRECIO DE VENTA ES OBLIGATORIO", "error");
      return;
    }

    // Determinar ID del producto
    const productId = editingId === "new" ? "temp_" + Date.now() : editingId;
    const selectedCat = categories.find((c) => c.id === editForm.categoria_id);
    const categoriaNombre = editForm.categoria_nombre || editForm.categoria || selectedCat?.nombre || "";
    if (!categoriaNombre.trim()) {
      showToast("DEBES SELECCIONAR UNA CATEGORÍA", "error");
      return;
    }

    const tasaBCV = parseFloat(editForm.tasa_bcv) || 0;

    // Procesar compresión local de la imagen
    let base64Optimizado = null;
    let extensionOptimizado = null;
    let cleanImageUrl = String(editForm.imagen_url || "");

    // Si es un Blob local (previsualización), no lo mandamos como URL directa
    if (cleanImageUrl.startsWith("blob:") || cleanImageUrl.startsWith("data:")) {
      cleanImageUrl = "";
    }

    if (editForm._imageFile) {
      try {
        base64Optimizado = await comprimirImagenForzado(editForm._imageFile);
        extensionOptimizado = "jpeg";
      } catch (err) {
        console.warn("[saveEdit] Compresión falló, continuando sin imagen:", err);
      }
    } else if (editForm._imageBase64) {
      base64Optimizado = editForm._imageBase64;
      extensionOptimizado = editForm._imageExtension || "jpeg";
    }

    const payload = {
      id: productId,
      nombre: String(editForm.nombre || "").trim().toUpperCase(),
      descripcion_corta: String(editForm.descripcion_corta || "").trim(),
      numero_unid: parseFloat(editForm.numero_unid) || 1,
      unidad_medida: String(editForm.unidad_medida || "UNIDAD"),
      categoria: String(categoriaNombre).trim().toUpperCase(),
      categoria_nombre: String(categoriaNombre).trim().toUpperCase(),
      precio_usd: parseFloat(editForm.precio_usd) || 0,
      precio_costo: parseFloat(editForm.precio_costo) || 0,
      stock: parseInt(editForm.stock) || 0,
      stock_minimo: parseInt(editForm.stock_minimo) || 5,
      imagen_url: cleanImageUrl,
      tasa_bcv: String(tasaBCV),
      codigo_barras: String(editForm.codigo_barras || ""),
      alicuota_iva: String(editForm.alicuota_iva || "G").toUpperCase(),
      imagenBase64: base64Optimizado,
      extension: extensionOptimizado,
      imagenNombre: base64Optimizado ? `${productId}.${extensionOptimizado}` : null,
    };

    // Cerrar modal optimísticamente antes de la llamada
    const wasAdding = isAdding;
    setEditingId(null);
    setIsAdding(false);
    setEditForm({ nombre: "", precio_costo: 0, precio_usd: 0, codigo_barras: "", categoria_id: "", categoria: "", categoria_nombre: "", stock: 0, numero_unid: 1, unidad_medida: "UNIDAD", descripcion_corta: "", tasa_bcv: "", alicuota_iva: "G", imagen_url: "", _imageFile: null, _imageBase64: null, _imageExtension: null });
    showToast(wasAdding ? "⚡ GUARDANDO PRODUCTO..." : "⚡ ACTUALIZANDO...", "info");

    const result = wasAdding ? await addProducto(payload) : await updateProducto(payload);
    if (!result.success) {
      showToast(result.error || "ERROR EN GOOGLE SHEETS", "error");
    } else {
      showToast(wasAdding ? "✅ ¡PRODUCTO CREADO!" : "✅ ¡PRODUCTO ACTUALIZADO!", "success");
      if (result.error_imagen) {
        showToast(`⚠️ IMAGEN NO GUARDADA: ${result.error_imagen}`, "warning");
      }
    }
  } catch (error) {
    showToast(error.message || "ERROR AL GUARDAR", "error");
  }
};



  const deleteProduct = async (id, name) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    setEditingId(null);
    try {
      const result = await deleteProducto(id);
      if (result && !result.success) {
        showToast(result.error || "ERROR AL ELIMINAR", "error");
      } else {
        showToast("Producto eliminado");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  const handleCategoryAction = async () => {
    if (!categoryName.trim()) return;
    setIsSaving(true);
    try {
      await addCategory({
        id: editingCategory?.id || crypto.randomUUID(),
        nombre: String(categoryName || "")
          .trim()
          .toUpperCase(),
        icono_nombre: selectedIcon,
        icono: JSON.stringify({ name: selectedIcon, color: "#808080" }),
        icono_color: "#808080",
        orden: categories.length + 1,
      });
      showToast(editingCategory ? "Categoría actualizada" : "Categoría creada");
      setCategoryName("");
      setSelectedIcon("Layers");
      setEditingCategory(null);
      setIsAddingCategory(false);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = String(search || "").toLowerCase();
    const nombre = String(p.nombre || "").toLowerCase();
    const codigo = String(p.codigo_barras || "").toLowerCase();
    const catName = String(
      p.categoria || p.categoria_nombre || "",
    ).toUpperCase();
    const selectedCatUpper = String(selectedCategory).toUpperCase();

    const matchesSearch = nombre.includes(q) || codigo.includes(q);
    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === "TODAS" ||
      catName === selectedCatUpper;

    return matchesSearch && matchesCategory;
  });

  const getStockColor = (stock, stockMin = 5) => {
    if (stock < 5 || stock < stockMin * 0.1) return "#ff3131";
    if (stock < stockMin * 0.3) return "#ffc107";
    return "var(--s-neon)";
  };

  const formatPrice = (precioUsd, tasaBcv) => {
    const precio = parseFloat(precioUsd) || 0;
    const tasa = parseFloat(tasaBcv) || TASA_BCV;
    const bs = precio * tasa;
    return {
      usd: formatUSD(precio),
      bs: formatBS(bs),
    };
  };

  const producto = editForm;
  let imageSrc =
    producto.imagen_url?.startsWith("blob:") ||
    producto.imagen_url?.startsWith("data:")
      ? producto.imagen_url
      : getProductImageUrl(producto);

  if (!imageSrc || imageSrc === DEFAULT_PRODUCT_IMAGE) {
    imageSrc = defaultPlaceholderImg;
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap-3)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <LoadingOverlay
        isVisible={isSaving || (loading && products.length === 0)}
        message={isSaving ? "Guardando..." : "Sincronizando..."}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--gap-3)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 1000, color: "#fff" }}>
              CENTRO DE INVENTARIO
            </h2>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 900,
                color: "var(--s-neon)",
                letterSpacing: "0.2em",
              }}
            >
              {filtered.length} PRODUCTOS • GOOGLE SHEETS v8.0
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--gap-2)" }}>
            <button
              className="s-btn s-btn-secondary"
              onClick={() => setShowImageLinker(true)}
              style={{
                height: "3.5rem",
                padding: "0 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Image size={18} /> VINCULAR IMÁGENES
            </button>
            <button
              className="s-btn s-btn-primary"
              onClick={() => setIsAddingCategory(true)}
              style={{ height: "3.5rem", padding: "0 2rem" }}
            >
              <Plus size={20} strokeWidth={3} /> CATEGORÍA
            </button>
            <button
              className="s-btn s-btn-primary"
              onClick={handleNew}
              style={{ height: "3.5rem", padding: "0 2.5rem" }}
            >
              <Plus size={20} strokeWidth={3} /> PRODUCTO
            </button>
          </div>
        </div>

        <div
          style={{ display: "flex", gap: "var(--gap-2)", alignItems: "center" }}
        >
          <CategoryDropdown
            categories={categories}
            products={products}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onManageCategories={() => setShowCategoryManager(true)}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
          />

          <div
            className="s-panel"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0 1.5rem",
              height: "3.8rem",
              borderColor: "rgba(0, 230, 118, 0.2)",
            }}
          >
            <Search size={22} style={{ color: "var(--s-neon)" }} />
            <input
              name="buscar"
              id="inventory-buscar"
              className="s-input"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                backdropFilter: "none",
                fontSize: "1.2rem",
                color: "var(--s-neon)",
                fontWeight: "800",
              }}
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="s-liquid-header" style={{ flexShrink: 0 }}>
        <span />
        <span>PRODUCTO</span>
        <span>DESCRIPCIÓN</span>
        <span>CATEGORÍA</span>
        <span style={{ textAlign: "center" }}>STOCK</span>
        <span style={{ textAlign: "right" }}>COSTO</span>
        <span style={{ textAlign: "right" }}>PRECIO</span>
        <span />
      </div>

      <div className="s-scroll" style={{ flex: 1, paddingRight: "1rem" }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            initial="hidden"
            animate="visible"
            className="s-liquid-list"
          >
            {filtered.map((p, idx) => {
              const stockMin = parseInt(p.stock_minimo) || 5;
              const stockActual = parseInt(p.stock) || 0;
              const stockColor = getStockColor(stockActual, stockMin);
              const pct = Math.min(100, (stockActual / (stockMin * 4)) * 100);

              const catName = String(
                p.categoria || p.categoria_nombre || "SIN CATEGORÍA",
              );
              const cat = categories.find((c) => c.nombre === catName);
              const prices = formatPrice(p.precio_usd, p.tasa_bcv);
              const unidadMed = String(p.unidad_medida || "UNIDAD");
              const isSyncingThis = syncingStatus && syncingStatus[p.id];

              return (
                <motion.div
                  key={String(p.id) || idx}
                  layout
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: {
                      opacity: 1,
                      x: 0,
                      transition: { delay: idx * 0.04 },
                    },
                  }}
                  className="s-liquid-row"
                  onClick={isSyncingThis ? null : () => handleEdit(p)}
                  style={{
                    opacity: isSyncingThis ? 0.6 : 1,
                    pointerEvents: isSyncingThis ? "none" : "auto",
                    borderLeft:
                      isSyncingThis === "deleting"
                        ? "4px solid #ff3131"
                        : isSyncingThis === "saving"
                          ? "4px solid #ff9100"
                          : "none",
                  }}
                >
                  <div
                    className="s-liquid-row__img"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={getProductImageUrl(p) || defaultPlaceholderImg}
                      alt={String(p.nombre || "")}
                      style={{
                        objectFit: "cover",
                        width: "100%",
                        height: "100%",
                      }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.src = defaultPlaceholderImg;
                      }}
                    />
                  </div>
                  <div className="s-liquid-row__info">
                    <h4
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {String(p.nombre || "").toUpperCase()}
                      {isSyncingThis === "saving" && (
                        <Loader
                          size={12}
                          style={{
                            color: "#ff9100",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      )}
                      {isSyncingThis === "deleting" && (
                        <Loader
                          size={12}
                          style={{
                            color: "#ff3131",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                      )}
                    </h4>
                    <p>
                      {isSyncingThis
                        ? isSyncingThis === "deleting"
                          ? "ELIMINANDO..."
                          : "SINCRO EN COLA..."
                        : String(p.codigo_barras || "SIN SKU")}
                    </p>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {formatDescripcionTecnica(p)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        color: cat?.icono_nombre
                          ? "var(--s-neon)"
                          : "var(--s-text-dim)",
                      }}
                    >
                      {getIcon(cat?.nombre, cat?.icono_nombre)}
                    </div>
                    <span
                      className="s-badge s-badge-neon"
                      style={{ fontSize: "0.6rem" }}
                    >
                      {catName}
                    </span>
                  </div>
                  <div className="s-liquid-row__stock-bar">
                    <span style={{ color: "#fff", fontSize: "0.7rem" }}>
                      {formatStockDisponible(stockActual)}
                    </span>
                    <div className="s-liquid-row__bar-track">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className="s-liquid-row__bar-fill"
                        style={{ background: stockColor }}
                      />
                    </div>
                  </div>
                  <div
                    className="s-liquid-row__price"
                    style={{ color: "#fff", opacity: 0.8 }}
                  >
                    ${parseFloat(p.precio_costo || 0).toFixed(2)}
                  </div>
                  <div className="s-liquid-row__price">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "5px" }}>
                      <span>${prices.usd}</span>
                      {p.alicuota_iva === "E" ? (
                        <span style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "3px", background: "rgba(0, 230, 118, 0.15)", color: "#00e676", border: "1px solid #00e676", fontWeight: "bold" }} title="Exento de IVA">
                          (E)
                        </span>
                      ) : p.alicuota_iva === "R" ? (
                        <span style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "3px", background: "rgba(255, 183, 77, 0.15)", color: "#ffb74d", border: "1px solid #ffb74d", fontWeight: "bold" }} title="Alícuota Reducida 8%">
                          (R 8%)
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.55rem", padding: "1px 4px", borderRadius: "3px", background: "rgba(33, 150, 243, 0.15)", color: "#42a5f5", border: "1px solid #42a5f5", fontWeight: "bold" }} title="Alícuota General 16%">
                          (G 16%)
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.55rem",
                        color: "#888",
                      }}
                    >
                      {prices.bs} BS
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {isSyncingThis ? (
                      <Loader
                        size={16}
                        style={{
                          color: "var(--s-neon)",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                    ) : (
                      <button
                        className="s-btn s-btn-secondary s-btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(p);
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
          <div
            style={{
              height: "60%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2rem",
              opacity: 0.2,
            }}
          >
            <Package size={120} strokeWidth={1} />
            <h2 style={{ fontWeight: 1000, letterSpacing: "0.3em" }}>
              INVENTARIO VACÍO
            </h2>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingId && (
          <div className="s-overlay" style={{ padding: "0.5rem" }}>
            <motion.div
              className="s-overlay__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingId(null)}
            />
            <motion.div
              className="s-modal s-modal--crystal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "min(46rem, 98vw)" }}
            >
              <div
                className="s-modal__header"
                style={{ padding: "0.875rem 1.5rem" }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 1000,
                      color: "#fff",
                    }}
                  >
                    {isAdding ? "REGISTRO DE PRODUCTO" : "GESTIÓN DE PRODUCTO"}
                  </h2>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 900,
                      color: "var(--s-neon)",
                    }}
                  >
                    GOOGLE SHEETS v8.0
                  </span>
                </div>
                <button
                  className="s-btn s-btn-secondary s-btn-icon"
                  onClick={() => {
                    setEditingId(null);
                    setEditForm({});
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                className="s-modal__body"
                style={{ padding: "1rem 1.5rem", gap: "0.875rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    className="s-modal__img-preview"
                    style={{
                      width: "100px",
                      height: "100px",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={editForm._uploadingImage}
                    />
                    {editForm._uploadingImage || isUploadingImage ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          gap: "0.5rem",
                          background: "rgba(0,0,0,0.8)",
                          borderRadius: "12px",
                        }}
                      >
                        <Loader
                          size={28}
                          style={{
                            color: "var(--s-neon)",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.55rem",
                            color: "var(--s-neon)",
                            textAlign: "center",
                          }}
                        >
                          {editForm._uploadProgress || "SUBIENDO..."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <img
  src={imageSrc}
  alt={producto.nombre || "Nuevo Producto"}
  referrerPolicy="no-referrer"
  onError={(e) => { e.target.onerror = null; e.target.src = defaultPlaceholderImg; }}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "12px",
  }}
  className="object-cover w-full h-full rounded"
/>
                        {editForm._imageBase64 && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: -8,
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: "rgba(0,230,118,0.2)",
                              border: "1px solid var(--s-neon)",
                              borderRadius: "4px",
                              padding: "2px 8px",
                              fontSize: "0.5rem",
                              color: "var(--s-neon)",
                              whiteSpace: "nowrap",
                              fontWeight: "bold",
                              textShadow: "0 0 5px var(--s-neon)",
                            }}
                          >
                            NUEVA IMAGEN
                          </div>
                        )}
                      </>
                    )}
                  </label>
                  <span
                    style={{ fontSize: "0.6rem", color: "var(--s-text-dim)" }}
                  >
                    Click para seleccionar imagen
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>NOMBRE</label>
                    <input
                      name="nombre"
                      id="producto-nombre"
                      className={`s-input ${formErrors.includes("nombre") ? "s-input--error" : ""}`}
                      value={editForm.nombre || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nombre: e.target.value })
                      }
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>CATEGORÍA</label>
                    <select
                      name="categoria"
                      id="producto-categoria"
                      className="s-select"
                      value={editForm.categoria_id || ""}
                      onChange={(e) => {
                        const cat = categories.find(
                          (c) => c.id === e.target.value,
                        );
                        setEditForm({
                          ...editForm,
                          categoria_id: e.target.value,
                          categoria: cat?.nombre || "",
                          categoria_nombre: cat?.nombre || "",
                        });
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">-- SELECCIONAR --</option>
                      {categories
                        .filter((c) => c.id !== "all")
                        .map((c) => (
                          <option key={String(c.id)} value={String(c.id)}>
                            {String(c.nombre || "").toUpperCase()}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="s-field">
                  <label style={{ color: "#fff" }}>DESCRIPCIÓN</label>
                  <input
                    name="descripcion"
                    id="producto-descripcion"
                    className="s-input"
                    value={editForm.descripcion_corta || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        descripcion_corta: e.target.value,
                      })
                    }
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>PRECIO (USD)</label>
                    <CurrencyInput
                      currency="USD"
                      name="precio_usd"
                      id="producto-precio"
                      value={editForm.precio_usd}
                      onChange={(v) =>
                        setEditForm({ ...editForm, precio_usd: v })
                      }
                      color="#00e676"
                      style={{ textAlign: "center", fontSize: "1.2rem" }}
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>COSTO (USD)</label>
                    <CurrencyInput
                      currency="USD"
                      name="precio_costo"
                      id="producto-costo"
                      value={editForm.precio_costo}
                      onChange={(v) =>
                        setEditForm({ ...editForm, precio_costo: v })
                      }
                      style={{ textAlign: "center" }}
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>TASA BCV</label>
                    <CurrencyInput
                      currency="USD"
                      name="tasa_bcv"
                      id="producto-tasa"
                      value={editForm.tasa_bcv ?? ""}
                      onChange={(v) =>
                        setEditForm({ ...editForm, tasa_bcv: v })
                      }
                      style={{ textAlign: "center" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>STOCK</label>
                    <input
                      name="stock"
                      id="producto-stock"
                      className="s-input"
                      type="number"
                      value={editForm.stock ?? 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm({ ...editForm, stock: val === "" ? "" : parseInt(val) });
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{
                        textAlign: "center",
                        fontSize: "1.2rem",
                        color: "var(--s-neon)",
                      }}
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>NÚMERO UNID.</label>
                    <input
                      name="numero_unid"
                      id="producto-numero"
                      className="s-input"
                      type="number"
                      value={editForm.numero_unid ?? 1}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm({
                          ...editForm,
                          numero_unid: val === "" ? "" : parseFloat(val),
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{ textAlign: "center" }}
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>UNIDAD MED.</label>
                    <select
                      name="unidad_medida"
                      id="producto-unidad"
                      className="s-select"
                      value={editForm.unidad_medida || "UNIDAD"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          unidad_medida: e.target.value,
                        })
                      }
                    >
                      <option value="UNIDAD">UNIDAD(ES)</option>
                      <option value="KILOGRAMO">KILOGRAMO(S)</option>
                      <option value="GRAMO">GRAMO(S)</option>
                      <option value="MILIGRAMO">MILIGRAMO(S)</option>
                      <option value="LITRO">LITRO(S)</option>
                      <option value="MILILITRO">MILILITRO(S)</option>
                      <option value="CENTIMETRO_CUBICO">CENTÍMETRO(S) CÚBICO(S) (CC)</option>
                      <option value="PAQUETE">PAQUETE(S)</option>
                      <option value="CAJA">CAJA(S)</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.2fr 1.2fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>STOCK MÍNIMO</label>
                    <input
                      name="stock_minimo"
                      id="producto-stock-min"
                      className="s-input"
                      type="number"
                      value={editForm.stock_minimo ?? 5}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm({
                          ...editForm,
                          stock_minimo: val === "" ? "" : parseInt(val),
                        });
                      }}
                      onFocus={(e) => e.target.select()}
                      style={{ textAlign: "center" }}
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>CÓDIGO / SKU</label>
                    <input
                      name="codigo_barras"
                      id="producto-sku"
                      className="s-input"
                      value={editForm.codigo_barras || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          codigo_barras: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="s-field">
                    <label style={{ color: "#fff" }}>ALÍCUOTA IVA (SENIAT)</label>
                    <select
                      name="alicuota_iva"
                      id="producto-alicuota"
                      className="s-select"
                      value={editForm.alicuota_iva || "G"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          alicuota_iva: e.target.value,
                        })
                      }
                      style={{ fontWeight: "700" }}
                    >
                      <option value="G">GENERAL 16% (G)</option>
                      <option value="E">EXENTO 0% (E)</option>
                      <option value="R">REDUCIDO 8% (R)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                className="s-modal__footer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  padding: "1rem 1.5rem",
                }}
              >
                {!isAdding && (
                  <button
                    type="button"
                    className="s-btn"
                    onClick={() => deleteProduct(editingId, editForm.nombre)}
                    title="Eliminar este producto"
                    style={{
                      width: "3.6rem",
                      height: "3.2rem",
                      minWidth: "3.6rem",
                      color: "#ff3b30",
                      background: "rgba(255, 59, 48, 0.12)",
                      border: "1.5px solid rgba(255, 59, 48, 0.4)",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 59, 48, 0.25)";
                      e.currentTarget.style.borderColor = "#ff3b30";
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.boxShadow = "0 0 16px rgba(255, 59, 48, 0.4)";
                      e.currentTarget.style.transform = "scale(1.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 59, 48, 0.12)";
                      e.currentTarget.style.borderColor = "rgba(255, 59, 48, 0.4)";
                      e.currentTarget.style.color = "#ff3b30";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Trash2 size={24} strokeWidth={2.2} />
                  </button>
                )}
                <button
                  className="s-btn s-btn-secondary"
                  onClick={() => setEditingId(null)}
                  style={{ flex: 1, height: "3.2rem", fontSize: "0.9rem", fontWeight: 800 }}
                >
                  CANCELAR
                </button>
                <button
                  className="s-btn s-btn-primary"
                  onClick={saveEdit}
                  disabled={isSaving}
                  style={{ flex: 1, height: "3.2rem", fontSize: "0.9rem", fontWeight: 900 }}
                >
                  {isSaving ? (
                    <Loader
                      size={20}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    "GUARDAR"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingCategory && (
          <div className="s-overlay" style={{ padding: "0.5rem" }}>
            <motion.div
              className="s-overlay__backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCategory(false)}
            />
            <motion.div
              className="s-modal s-modal--crystal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "min(36rem, 98vw)" }}
            >
              <div className="s-modal__header" style={{ borderBottom: "1px solid rgba(0, 230, 118, 0.15)" }}>
                <h2
                  style={{ fontSize: "1rem", fontWeight: 1000, color: "#fff" }}
                >
                  NUEVA CATEGORÍA
                </h2>
                <button
                  className="s-btn s-btn-secondary s-btn-icon"
                  onClick={() => setIsAddingCategory(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="s-modal__body">
                <div className="s-field">
                  <label style={{ color: "#fff" }}>NOMBRE</label>
                  <input
                    name="categoria"
                    id="inventory-nueva-categoria"
                    className="s-input"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value.toUpperCase())}
                    placeholder="EJ: ALIMENTOS"
                  />
                </div>
                <div className="s-field">
                  <label style={{ color: "#fff" }}>ICONO</label>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      marginTop: "0.5rem",
                    }}
                  >
                    {Object.keys(CATEGORY_ICONS)
                      .slice(0, 12)
                      .map((iconName) => {
                        const IconComp = CATEGORY_ICONS[iconName];
                        return (
                          <button
                            key={iconName}
                            onClick={() => setSelectedIcon(iconName)}
                            style={{
                              width: "2.5rem",
                              height: "2.5rem",
                              borderRadius: "8px",
                              background:
                                selectedIcon === iconName
                                  ? "rgba(0,230,118,0.2)"
                                  : "rgba(255,255,255,0.05)",
                              border:
                                selectedIcon === iconName
                                  ? "2px solid var(--s-neon)"
                                  : "1px solid rgba(255,255,255,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              color:
                                selectedIcon === iconName
                                  ? "var(--s-neon)"
                                  : "#fff",
                            }}
                          >
                            <IconComp size={18} />
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div className="s-modal__footer" style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  className="s-btn s-btn-primary"
                  onClick={handleCategoryAction}
                  disabled={isSaving}
                  style={{ flex: 1 }}
                >
                  {isSaving ? (
                    <Loader
                      size={18}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    "CREAR"
                  )}
                </button>
                <button
                  className="s-btn s-btn-secondary"
                  onClick={() => setIsAddingCategory(false)}
                  style={{ flex: 1 }}
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showImageLinker && (
        <ImageLinker isOpen={showImageLinker} onClose={() => setShowImageLinker(false)} />
      )}
      {showCategoryManager && (
        <CategoryManager
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          products={products}
          onToast={showToast}
        />
      )}
    </div>
  );
};

export default Inventory;
