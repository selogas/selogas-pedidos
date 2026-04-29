import { useState, useRef } from 'react';
import { productosApi, categoriasApi } from '../api';
import { Loader2, Database, Trash2, CheckCircle, AlertCircle, Upload, FileSpreadsheet } from 'lucide-react';

function parseMultiplo(nombre) {
  const m = nombre?.match(/[xX](\d+)\s*(?:UND|und|u)?\s*$/);
  return m ? parseInt(m[1]) : 1;
}

export default function ImportarProductos() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [borrandoTodo, setBorrandoTodo] = useState(false);
  const [preview, setPreview] = useState([]);
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const fileRef = useRef();

  // Cargar xlsx dinámicamente
  const loadXlsx = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => { setXlsxLoaded(true); resolve(window.XLSX); };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview([]);

    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const allProducts = [];
      let globalOrder = 0;

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Detectar fila de cabecera
        let headerRow = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i].map(c => String(c).toLowerCase());
          if (row.some(c => c.includes('nombre') || c.includes('codigo') || c.includes('ref') || c.includes('descripcion'))) {
            headerRow = i;
            break;
          }
        }

        if (headerRow === -1) {
          // Sin cabecera - tratar primera fila como datos
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const nombre = String(row[1] || row[0] || '').trim();
            const codigo = String(row[0] || '').trim();
            if (!nombre || nombre.length < 3) continue;
            const multiplo = parseMultiplo(nombre);
            allProducts.push({
              codigo: codigo || '',
              nombre,
              categoria: sheetName,
              multiplo,
              minimo: multiplo,
              hoja_excel: sheetName,
              orden_excel: globalOrder++,
              disponible: true,
              favorito: false,
              visibilidad_grupo: 'ambos',
            });
          }
          continue;
        }

        const headers = rows[headerRow].map(c => String(c).toLowerCase().trim());
        const colIdx = {
          codigo: headers.findIndex(h => h.includes('cod') || h.includes('ref') || h === 'codigo'),
          nombre: headers.findIndex(h => h.includes('nombre') || h.includes('descrip') || h.includes('product')),
          categoria: headers.findIndex(h => h.includes('categ') || h.includes('familia') || h.includes('grupo')),
          multiplo: headers.findIndex(h => h.includes('multiplo') || h.includes('multiple') || h.includes('unid')),
          orden: headers.findIndex(h => h.includes('orden') || h.includes('order') || h === 'ord'),
          formato: headers.findIndex(h => h.includes('formato') || h.includes('presentac')),
          imagen: headers.findIndex(h => h.includes('imagen') || h.includes('image') || h.includes('foto')),
        };

        if (colIdx.nombre === -1) colIdx.nombre = 1; // fallback col B

        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          const nombre = colIdx.nombre >= 0 ? String(row[colIdx.nombre] || '').trim() : '';
          if (!nombre || nombre.length < 2) continue;

          const codigo = colIdx.codigo >= 0 ? String(row[colIdx.codigo] || '').trim() : '';
          const rawMultiplo = colIdx.multiplo >= 0 ? Number(row[colIdx.multiplo]) : 0;
          const multiplo = rawMultiplo > 0 ? rawMultiplo : parseMultiplo(nombre);
          const ordenExcel = colIdx.orden >= 0 && row[colIdx.orden] ? Number(row[colIdx.orden]) : globalOrder;
          const categoriaExcel = colIdx.categoria >= 0 ? String(row[colIdx.categoria] || '').trim() : sheetName;
          const formato = colIdx.formato >= 0 ? String(row[colIdx.formato] || '').trim() : '';
          const imagen_url = colIdx.imagen >= 0 ? String(row[colIdx.imagen] || '').trim() : '';

          allProducts.push({
            codigo,
            nombre,
            categoria: categoriaExcel || sheetName,
            formato: formato || '',
            imagen_url: imagen_url || '',
            multiplo,
            minimo: multiplo,
            hoja_excel: sheetName,
            orden_excel: ordenExcel,
            disponible: true,
            favorito: false,
            visibilidad_grupo: 'ambos',
          });
          globalOrder++;
        }
      }

      // Ordenar por orden_excel
      allProducts.sort((a, b) => (a.orden_excel || 0) - (b.orden_excel || 0));
      setPreview(allProducts.slice(0, 10));
      window.__xlsxProducts = allProducts;
    } catch(e) {
      setError('Error al leer el Excel: ' + e.message);
    }
  };

  const handleImportar = async () => {
    const products = window.__xlsxProducts;
    if (!products || products.length === 0) return alert('Primero selecciona un archivo Excel');
    if (!confirm(`¿Importar ${products.length} productos? Los productos actuales se borrarán.`)) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Borrar todos los productos actuales
      setProgress('Borrando productos anteriores...');
      await productosApi.deleteAll();

      // Crear categorías automáticamente
      setProgress('Creando categorías...');
      const catNames = [...new Set(products.map(p => p.categoria).filter(Boolean))];
      const existingCats = await categoriasApi.list();
      const catMap = {};
      existingCats.forEach(c => { catMap[c.nombre] = c; });

      for (let i = 0; i < catNames.length; i++) {
        if (!catMap[catNames[i]]) {
          const newCat = await categoriasApi.create({ nombre: catNames[i], grupo: 'ambos', orden: i });
          catMap[catNames[i]] = newCat;
        }
      }

      // Importar en lotes
      let created = 0;
      const batchSize = 50;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await productosApi.bulkCreate(batch);
        created += batch.length;
        setProgress(`Importando... ${created}/${products.length} productos`);
        if (i + batchSize < products.length) await new Promise(r => setTimeout(r, 300));
      }

      setResult({ total: created, categorias: catNames.length });
      window.__xlsxProducts = null;
      setPreview([]);
    } catch(e) {
      setError(e.message || 'Error al importar');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleBorrarTodo = async () => {
    if (!confirm('¿Borrar TODOS los productos?')) return;
    setBorrandoTodo(true);
    try {
      await productosApi.deleteAll();
      alert('Todos los productos han sido eliminados.');
    } catch(e) { alert('Error: ' + e.message); }
    finally { setBorrandoTodo(false); }
  };

  const productCount = window.__xlsxProducts?.length || 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold mb-2">Importar Catálogo</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Sube tu Excel con el catálogo completo. El sistema preserva el orden exacto.
        </p>

        {/* Upload zone */}
        <label className="block border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all mb-4">
          <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300" />
          <div className="font-semibold text-gray-700 mb-1">Selecciona tu Excel (.xlsx, .xls)</div>
          <div className="text-sm text-gray-400">o arrastra el archivo aquí</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        </label>

        {productCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="font-semibold text-blue-800 mb-1">✅ {productCount} productos detectados</div>
            <div className="text-xs text-blue-600 mb-2">Vista previa (primeros 10):</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {preview.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-800 bg-white rounded-lg px-3 py-1.5">
                  <span className="font-mono text-blue-400 w-16 flex-shrink-0">{p.codigo || '-'}</span>
                  <span className="flex-1 truncate">{p.nombre}</span>
                  <span className="text-blue-400">{p.categoria}</span>
                  <span className="font-semibold">x{p.multiplo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-60"
            disabled={loading || borrandoTodo || productCount === 0}
            onClick={handleImportar}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {loading ? (progress || 'Importando...') : `Importar ${productCount > 0 ? productCount + ' productos' : 'catálogo'}`}
          </button>
          <button className="px-4 py-3 rounded-xl border-2 text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-2 text-sm font-medium"
            onClick={handleBorrarTodo} disabled={borrandoTodo || loading}>
            <Trash2 size={16} />
            {borrandoTodo ? 'Borrando...' : 'Borrar todo'}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}
        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-700 font-medium">
              ✅ {result.total} productos importados en {result.categorias} categorías.
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-xs font-semibold text-gray-700 mb-2">Formato soportado:</div>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Columnas: Código, Nombre/Descripción, Categoría, Múltiplo (opcionales)</li>
            <li>• Múltiples hojas: cada hoja = una categoría</li>
            <li>• El orden de filas se respeta exactamente</li>
            <li>• Múltiplos auto-detectados del nombre (ej: "COCA COLA x24" → 24)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
