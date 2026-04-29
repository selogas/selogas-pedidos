import { useState } from "react";
import { productosApi } from "../api";
import { Loader2, Database, Trash2, CheckCircle, AlertCircle } from "lucide-react";

// Muestra de productos SELOGAS (versión reducida para el repo)
const PRODUCTOS_SELOGAS = [
  { codigo: "2210020", nombre: "SHANDY CRUZCAMPO 33 CL X24", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2210037", nombre: "MAHOU 5 ESTRELLAS LT 33 X24UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2210040", nombre: "MAHOU 5 ESTRELLAS 50CL X24UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2210082", nombre: "SAN MIGUEL LT 33CL X24UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2110064", nombre: "COCA COLA ZERO LATA 33 CL X24UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2120080", nombre: "COCA COLA CLASICA BT 50 CLx24 UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2110050", nombre: "RED BULL LATA 25 CLx24 UND", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2110273", nombre: "MONSTER VERDE LT50 X24", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2135003", nombre: "AGUA BEZOYA 1,5L X6", categoria: "Bebidas", multiplo: 6, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2135004", nombre: "AGUA BEZOYA 0,50CL x24", categoria: "Bebidas", multiplo: 24, hoja_excel: "Bebidas", disponible: true },
  { codigo: "2330010", nombre: "FINI CEREZAS ENVUELTAS 80GX12", categoria: "Golosinas", multiplo: 12, hoja_excel: "Golosinas", disponible: true },
  { codigo: "2335038", nombre: "MENTOS MINT CJ 20 UND", categoria: "Golosinas", multiplo: 20, hoja_excel: "Golosinas", disponible: true },
  { codigo: "2345030", nombre: "ORBIT BOX FRESA 60 GRAG X6", categoria: "Golosinas", multiplo: 6, hoja_excel: "Golosinas", disponible: true },
  { codigo: "2575163", nombre: "FILIPINO C/NEGRO 100 GRx12", categoria: "Chocolates y Galletas", multiplo: 12, hoja_excel: "Chocolates y Galletas", disponible: true },
  { codigo: "2310014", nombre: "KIT KAT LECHE 45 GR CJ 36 UND", categoria: "Chocolates y Galletas", multiplo: 36, hoja_excel: "Chocolates y Galletas", disponible: true },
  { codigo: "2310032", nombre: "FERRERO KINDER BUENO CJ 30 UND", categoria: "Chocolates y Galletas", multiplo: 30, hoja_excel: "Chocolates y Galletas", disponible: true },
  { codigo: "2375022", nombre: "LAY S SAL 125GR X12", categoria: "Snacks", multiplo: 12, hoja_excel: "Snacks", disponible: true },
  { codigo: "2375053", nombre: "DORITOS TEX-MEX 90GR X15", categoria: "Snacks", multiplo: 15, hoja_excel: "Snacks", disponible: true },
  { codigo: "2375001", nombre: "PRINGLES CEBOLLA BT 40 GRx12 UND", categoria: "Snacks", multiplo: 12, hoja_excel: "Snacks", disponible: true },
  { codigo: "2650005", nombre: "SNACK FUET EXTRA 90GR", categoria: "Embutidos y Fuetis", multiplo: 12, hoja_excel: "Embutidos y Fuetis", disponible: true },
  { codigo: "2337085", nombre: "NUTRISPORT PROTEICA DOBLE CHOCO 44GR 24UD", categoria: "Nutrisport", multiplo: 24, hoja_excel: "Nutrisport", disponible: true },
  { codigo: "323404702", nombre: "CRISTASOL AJAX CRISTALINO", categoria: "Drogueria", multiplo: 1, hoja_excel: "Drogueria", disponible: true },
  { codigo: "3234065", nombre: "DESENGRASANTE KH 7", categoria: "Drogueria", multiplo: 1, hoja_excel: "Drogueria", disponible: true },
  { codigo: "3320038", nombre: "TOALLA ZZ NAT. Caja 24x200 uds", categoria: "Consumibles", multiplo: 1, hoja_excel: "Consumibles", disponible: true },
  { codigo: "3310027", nombre: "BOLSA BASURA 5258 NEGRA 25 UD X35", categoria: "Consumibles", multiplo: 35, hoja_excel: "Consumibles", disponible: true },
];

export default function ImportarProductos() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");
  const [borrandoTodo, setBorrandoTodo] = useState(false);

  const handleImportar = async () => {
    if (!confirm(`¿Importar ${PRODUCTOS_SELOGAS.length} productos de muestra?`)) return;
    setLoading(true); setError(null); setResult(null);
    try {
      let created = 0;
      const total = PRODUCTOS_SELOGAS.length;
      const productos = PRODUCTOS_SELOGAS.map((p, i) => ({ ...p, orden_excel: i }));
      for (let i = 0; i < productos.length; i += 25) {
        const batch = productos.slice(i, i + 25);
        await productosApi.bulkCreate(batch);
        created += batch.length;
        setProgress(`Guardando... ${created}/${total}`);
      }
      setResult({ total: created });
    } catch (e) {
      setError(e.message || "Error al importar");
    } finally {
      setLoading(false); setProgress("");
    }
  };

  const handleBorrarTodo = async () => {
    if (!confirm("¿Borrar TODOS los productos?")) return;
    setBorrandoTodo(true);
    try {
      const all = await productosApi.list('orden_excel', 1000);
      for (const p of all) await productosApi.delete(p.id);
      alert("Productos borrados.");
    } finally { setBorrandoTodo(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold mb-2">Importar Catálogo SELOGAS</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Carga el catálogo de muestra con {PRODUCTOS_SELOGAS.length} productos representativos.
          Para el catálogo completo, contacta al administrador.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="font-semibold text-blue-800 mb-2">Categorías incluidas:</div>
          <div className="flex flex-wrap gap-2">
            {[...new Set(PRODUCTOS_SELOGAS.map(p => p.categoria))].map(cat => (
              <span key={cat} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {cat} ({PRODUCTOS_SELOGAS.filter(p => p.categoria === cat).length})
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            disabled={loading || borrandoTodo} onClick={handleImportar}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
            {loading ? (progress || "Importando...") : `Importar ${PRODUCTOS_SELOGAS.length} productos`}
          </button>
          <button className="px-4 py-3 rounded-xl border-2 text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-2 text-sm font-medium"
            onClick={handleBorrarTodo} disabled={borrandoTodo || loading}>
            <Trash2 size={16} />
            {borrandoTodo ? "Borrando..." : "Borrar todo"}
          </button>
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}
        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <div className="text-sm text-green-600 font-medium">{result.total} productos importados correctamente.</div>
          </div>
        )}
      </div>
    </div>
  );
}