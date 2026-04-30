import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, CheckCircle, AlertCircle, Loader2, Trash2, Database } from "lucide-react";

const PRODUCTOS_SELOGAS = [
  // ===== BEBIDAS - CERVEZAS =====
  { codigo: "2210020", nombre: "SHANDY CRUZCAMPO 33 CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210021", nombre: "MAHOU BT 1L X6UND", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2210037", nombre: "MAHOU 5 ESTRELLAS LT 33 X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210040", nombre: "MAHOU 5 ESTRELLAS 50CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210039", nombre: "MAHOU CLASICA LT 33 X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210034", nombre: "MAHOU CLASICALT 50 X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210023", nombre: "MIXTA MAHOU LT 33 X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210008", nombre: "ESTRELLA GALICIA 33CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210082", nombre: "SAN MIGUEL LT 33CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210078", nombre: "SAN MIGUEL 50CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210083", nombre: "AGUILA AMSTEL BT 1L X6UND", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2210084", nombre: "AGUILA AMSTEL 33CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210011", nombre: "HEINEKEN LT 33CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210012", nombre: "VOLLDAMM 33CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210019", nombre: "CORONITA BOTELLA 33 X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2210022", nombre: "BUCKLER LT 33CL X24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  // AGUAS
  { codigo: "2135003", nombre: "AGUA BEZOYA 1,5L X6", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2135004", nombre: "AGUA BEZOYA 0,50CL x24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2140088", nombre: "AQUABONA BOTELLA 50 CL x24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2140089", nombre: "FUENSANTA 1,5L X12", categoria: "Bebidas", multiplo: 12, grupo_visualizacion: "ambas" },
  { codigo: "2140090", nombre: "FUENSANTA 0,50CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2135032", nombre: "S.CAZORLA 0,50 X12", categoria: "Bebidas", multiplo: 12, grupo_visualizacion: "ambas" },
  { codigo: "2135033", nombre: "S.CAZORLA 1,5L X6", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  // REFRESCOS COCA COLA
  { codigo: "2110064", nombre: "COCA COLA ZERO LATA 33 CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2120080", nombre: "COCA COLA CLASICA BT 50 CLx24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2120081", nombre: "COCA COLA ZERO BOT 50 CLx24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110063", nombre: "COCA COLA CLASICA LATA 33 CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110068", nombre: "FANTA NARANJA LATA 33 CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2120086", nombre: "FANTA NARANJA BT 50 CLx24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2120087", nombre: "FANTA LIMON BT 50CL x24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110073", nombre: "SPRITE LATA 33CL x24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110093", nombre: "SCHWEPPES NARANJA LATA 33CL X24UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110094", nombre: "SCHWEPPES LIMON LATA 33 CLx24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110095", nombre: "SCHWEPPES TONICA LATA 33CL x24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2115098", nombre: "AQUARIUS CLASICO LATA 33 CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  // ENERGETICAS
  { codigo: "2110050", nombre: "RED BULL LATA 25 CLx24 UND", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110051", nombre: "RED BULL SIN AZUCAR LATA 25CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110280", nombre: "BURN ENERGY LT 250ML X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110273", nombre: "MONSTER VERDE LT50 X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110274", nombre: "MONSTER ABSOLUT LT50 X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110276", nombre: "MONSTER ULTRA WHITE X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  // ZUMOS
  { codigo: "2150010", nombre: "DON SIMON NARANJA 1L X12", categoria: "Bebidas", multiplo: 12, grupo_visualizacion: "ambas" },
  { codigo: "2150019", nombre: "GRANINI NARANJA BT 33 CLx12 UND", categoria: "Bebidas", multiplo: 12, grupo_visualizacion: "ambas" },
  { codigo: "2150022", nombre: "GRANINI NARANJA BT 1Lx6 UND", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  // LECHE
  { codigo: "2630010", nombre: "PASCUAL ENTERA BRIK 1L X6", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2630011", nombre: "PASCUAL SEMIDESNATADA BRIK 1L X6", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2630012", nombre: "PASCUAL DESNATADA BRIK 1L X6", categoria: "Bebidas", multiplo: 6, grupo_visualizacion: "ambas" },
  // VINOS
  { codigo: "2230001", nombre: "LOS MOLINOS BT 75 CL BLANCO", categoria: "Bebidas", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "2225528", nombre: "BERONIA CRIANZA", categoria: "Bebidas", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "2250006", nombre: "FREIXENET NEVADA PACK3", categoria: "Bebidas", multiplo: 3, grupo_visualizacion: "ambas" },
  // PEPSI
  { codigo: "2110098", nombre: "PEPSI SLEEK 33CL X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  { codigo: "2110099", nombre: "PEPSI MAX 33 X24", categoria: "Bebidas", multiplo: 24, grupo_visualizacion: "ambas" },
  // ===== LICORES =====
  { codigo: "225001601", nombre: "WHISKY DYC BT 70 CL x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225001801", nombre: "WHISKY BALLANTINES BT 70 x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225001501", nombre: "WHISKY JB BT 70 CL x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225003501", nombre: "RON CACIQUE x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225001901", nombre: "GINEBRA BEAFETER x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225002001", nombre: "GINEBRA LARIOS BT 1 L x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "225004901", nombre: "VODKA SMIRNOFF BT 70 CL x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2250091", nombre: "BAILEYS x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  { codigo: "2250087", nombre: "PONCHE CABALLERO x6", categoria: "Licores", multiplo: 6, grupo_visualizacion: "ambas" },
  // ===== ALIMENTACION =====
  { codigo: "2540140", nombre: "AZUCAR BLANQUILLA PQ 1KG", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "253500301", nombre: "NESCAFE NATURAL BT 100 GR", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "cafeteria" },
  { codigo: "262500101", nombre: "LA LECHERA TUBO 170 GR", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "cafeteria" },
  { codigo: "251503001", nombre: "CHAMPIÃON LAMINAS EXTRA 355GR", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "251501301", nombre: "GARBANZO COCIDO 570GR", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "252000401", nombre: "ACEITUNA ANCHOA BT 85 GR", categoria: "AlimentaciÃ³n", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "2515041", nombre: "PASTA CON JAMON CARRETILLA 240 GR x8", categoria: "AlimentaciÃ³n", multiplo: 8, grupo_visualizacion: "ambas" },
  { codigo: "2515042", nombre: "PASTA CANGREJO CARRETILLA x8", categoria: "AlimentaciÃ³n", multiplo: 8, grupo_visualizacion: "ambas" },
  { codigo: "2515056", nombre: "PAELLA MARINERA CARRETILLA x10", categoria: "AlimentaciÃ³n", multiplo: 10, grupo_visualizacion: "ambas" },
  { codigo: "251002501", nombre: "ATUN ACEITE CALVO LT 80 GR PACK 3 UN", categoria: "AlimentaciÃ³n", multiplo: 3, grupo_visualizacion: "ambas" },
  { codigo: "2455300", nombre: "FLAN HUEVO PASCUAL PACK-4", categoria: "AlimentaciÃ³n", multiplo: 4, grupo_visualizacion: "ambas" },
  // ===== GOLOSINAS =====
  { codigo: "2330010", nombre: "FINI CEREZAS ENVUELTAS 80GX12", categoria: "Golosinas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2330011", nombre: "FINI BICOLOR AZUL 80GR X12", categoria: "Golosinas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2335038", nombre: "MENTOS MINT CJ 20 UND", categoria: "Golosinas", multiplo: 20, grupo_visualizacion: "estacion" },
  { codigo: "2335040", nombre: "MENTOS FRUIT CJ 20 UND", categoria: "Golosinas", multiplo: 20, grupo_visualizacion: "estacion" },
  { codigo: "2335063", nombre: "SMINT SPEARMINT TIN X12", categoria: "Golosinas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2335062", nombre: "SMINT PEPPERMINT TIN X12", categoria: "Golosinas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "234502402", nombre: "ORBIT GRAGEA HIERBABUENA X30", categoria: "Golosinas", multiplo: 30, grupo_visualizacion: "estacion" },
  { codigo: "234502602", nombre: "ORBIT GRAGEA MENTA X30", categoria: "Golosinas", multiplo: 30, grupo_visualizacion: "estacion" },
  { codigo: "234500302", nombre: "TRIDENT LAMINA CLOROFILA CJ 24 UND", categoria: "Golosinas", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "232501102", nombre: "CHUPA CHUPS BT 100 UND RUEDA", categoria: "Golosinas", multiplo: 100, grupo_visualizacion: "estacion" },
  { codigo: "233500402", nombre: "HALLS COOL EUCALIPTO CJ 20", categoria: "Golosinas", multiplo: 20, grupo_visualizacion: "estacion" },
  // ===== CHOCOLATES Y GALLETAS =====
  { codigo: "2575163", nombre: "FILIPINO C/NEGRO 100 GRx12", categoria: "Chocolates y Galletas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2575162", nombre: "FILIPINO C/BLANCO 100 GRx12", categoria: "Chocolates y Galletas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2575150", nombre: "NAPOLITANAS 213 GRS x12", categoria: "Chocolates y Galletas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2575152", nombre: "TOSTA RICA 200 GRS x12", categoria: "Chocolates y Galletas", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "257503201", nombre: "PRINCIPE RELLENA PQ 300 GR x24", categoria: "Chocolates y Galletas", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "257501401", nombre: "OREO CLASICO 220 GR", categoria: "Chocolates y Galletas", multiplo: 1, grupo_visualizacion: "estacion" },
  { codigo: "2310006", nombre: "TOBLERONE CHOCO LECHE 50 GR CJ 24 UND", categoria: "Chocolates y Galletas", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2310014", nombre: "KIT KAT LECHE 45 GR CJ 36 UND", categoria: "Chocolates y Galletas", multiplo: 36, grupo_visualizacion: "estacion" },
  { codigo: "2310032", nombre: "FERRERO KINDER BUENO CJ 30 UND", categoria: "Chocolates y Galletas", multiplo: 30, grupo_visualizacion: "estacion" },
  { codigo: "2310008", nombre: "TWIX INDIV 58 GR CJ 25 UND", categoria: "Chocolates y Galletas", multiplo: 25, grupo_visualizacion: "estacion" },
  { codigo: "2310013", nombre: "MARS 51 GR CJ 24 UND", categoria: "Chocolates y Galletas", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2310038", nombre: "SNICKERS 57 GR CJ 24 UND", categoria: "Chocolates y Galletas", multiplo: 24, grupo_visualizacion: "estacion" },
  // ===== SNACKS =====
  { codigo: "2355101", nombre: "SOLDANZA PLATANITOS 71GR X24", categoria: "Snacks", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2355000", nombre: "RISI GUSANITOS BL 85 GRx8 UND", categoria: "Snacks", multiplo: 8, grupo_visualizacion: "estacion" },
  { codigo: "2355001", nombre: "RISI PALOMITAS BL 90 GRx8 UND", categoria: "Snacks", multiplo: 8, grupo_visualizacion: "estacion" },
  { codigo: "2375001", nombre: "PRINGLES CEBOLLA BT 40 GRx12 UND", categoria: "Snacks", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2375002", nombre: "PRINGLES PAPRIKA BT 40 GRx12 UND", categoria: "Snacks", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2375003", nombre: "PRINGLES ORIGINAL BT 40 GRx12 UND", categoria: "Snacks", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2375022", nombre: "LAY'S SAL 125GR X12", categoria: "Snacks", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2375053", nombre: "DORITOS TEX-MEX 90GR X15", categoria: "Snacks", multiplo: 15, grupo_visualizacion: "estacion" },
  { codigo: "2375054", nombre: "DORITOS CHILI 90GR X15", categoria: "Snacks", multiplo: 15, grupo_visualizacion: "estacion" },
  { codigo: "2355047", nombre: "GREFUSA MISTER CORN 115 GRS X18", categoria: "Snacks", multiplo: 18, grupo_visualizacion: "estacion" },
  { codigo: "2355048", nombre: "GREFUSA PIPAS G SAL 115 GRS X14", categoria: "Snacks", multiplo: 14, grupo_visualizacion: "estacion" },
  // ===== EMBUTIDOS Y FUETIS =====
  { codigo: "2650005", nombre: "SNACK FUET EXTRA 90GR (12 und. caja)", categoria: "Embutidos y Fuetis", multiplo: 12, grupo_visualizacion: "estacion" },
  { codigo: "2650002", nombre: "FUETIS DE FUET (14und.caja)", categoria: "Embutidos y Fuetis", multiplo: 14, grupo_visualizacion: "estacion" },
  { codigo: "2650003", nombre: "FUETIS DE SALAMI (14und.caja)", categoria: "Embutidos y Fuetis", multiplo: 14, grupo_visualizacion: "estacion" },
  { codigo: "2650004", nombre: "FUETIS DE POLLO (14und.caja)", categoria: "Embutidos y Fuetis", multiplo: 14, grupo_visualizacion: "estacion" },
  // ===== NUTRISPORT =====
  { codigo: "2337085", nombre: "NUTRISPORT PROTEICA DOBLE CHOCOLATE 44GR (24UD)", categoria: "Nutrisport", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2337086", nombre: "NUTRISPORT PROTEICA GALLETA&CHOCO 44GR (24UD)", categoria: "Nutrisport", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2337092", nombre: "NUTRISPORT PROTEIN BOOM COOKIES&CREAM (24UD)", categoria: "Nutrisport", multiplo: 24, grupo_visualizacion: "estacion" },
  { codigo: "2337100", nombre: "NUTRISPORT BATIDO PROTEIN ZERO CHOCOLATE 330ML (12UD)", categoria: "Nutrisport", multiplo: 12, grupo_visualizacion: "estacion" },
  // ===== DROGUERIA =====
  { codigo: "323404702", nombre: "CRISTASOL AJAX CRISTALINO", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3234065", nombre: "DESENGRASANTE KH 7", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3234017", nombre: "VASO BLANCO DESECHABLE 20U", categoria: "DroguerÃ­a", multiplo: 20, grupo_visualizacion: "ambas" },
  { codigo: "3216014", nombre: "TISU FACIAL SUPERSOL", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3234007", nombre: "SERVILLETAS", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3234003", nombre: "ROLLO COCINA", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3236115", nombre: "CONTROL PRESERVATIVOS 3 UNDS X48", categoria: "DroguerÃ­a", multiplo: 48, grupo_visualizacion: "estacion" },
  { codigo: "321600301", nombre: "COLGATE DENTAL FAMILIAR", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "estacion" },
  { codigo: "321600201", nombre: "GILLETTE DESECHABLE BLUE-II", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "estacion" },
  { codigo: "321600501", nombre: "SANEX JABON 615CC", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "estacion" },
  { codigo: "3238001", nombre: "ENCENDEDOR CLIPPER DIBUJOS", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "estacion" },
  { codigo: "3010011", nombre: "BIDON 5 LITROS", categoria: "DroguerÃ­a", multiplo: 1, grupo_visualizacion: "estacion" },
  // ===== CONSUMIBLES =====
  { codigo: "3320038", nombre: "TOALLA ZZ NATURAL Caja 24*200 uds", categoria: "Consumibles", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3320210", nombre: "PAPEL HIGIENICO JUMBO 18 UNS", categoria: "Consumibles", multiplo: 18, grupo_visualizacion: "ambas" },
  { codigo: "3310027", nombre: "BOLSA BASURA 5258 NEGRA 25 UD X35", categoria: "Consumibles", multiplo: 35, grupo_visualizacion: "ambas" },
  { codigo: "3320050", nombre: "MOCHO FREGONA 250 grs ALGODON", categoria: "Consumibles", multiplo: 1, grupo_visualizacion: "ambas" },
  { codigo: "3320101", nombre: "LEJIA GERPA 1L. X15", categoria: "Consumibles", multiplo: 15, grupo_visualizacion: "ambas" },
  { codigo: "3320110", nombre: "GEL DE MANOS NACARADO 5 L. X4", categoria: "Consumibles", multiplo: 4, grupo_visualizacion: "ambas" },
  { codigo: "3321003", nombre: "TAPAS ALTAS 240ML X100", categoria: "Consumibles", multiplo: 100, grupo_visualizacion: "cafeteria" },
  { codigo: "3321053", nombre: "VASOS CALIENTES 240ML X50", categoria: "Consumibles", multiplo: 50, grupo_visualizacion: "cafeteria" },
  { codigo: "3234010", nombre: "CUCHARA BLANCA X100", categoria: "Consumibles", multiplo: 100, grupo_visualizacion: "cafeteria" },
  { codigo: "3321045", nombre: "AGITADOR CAFE", categoria: "Consumibles", multiplo: 1, grupo_visualizacion: "cafeteria" },
  { codigo: "3320083", nombre: "BAYETA AZUL X12", categoria: "Consumibles", multiplo: 12, grupo_visualizacion: "ambas" },
  { codigo: "2725128", nombre: "BOLSA PAPEL PAN 12+6*51 1 BARRA cja 1000 und", categoria: "Consumibles", multiplo: 1000, grupo_visualizacion: "estacion" },
  { codigo: "3250016", nombre: "PAPEL A4 IMEDISA X5", categoria: "Consumibles", multiplo: 5, grupo_visualizacion: "ambas" },
];

export default function ImportarProductos() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");
  const [borrandoTodo, setBorrandoTodo] = useState(false);

  const handleImportar = async () => {
    if (!confirm("\u00BFImportar " + PRODUCTOS_SELOGAS.length + " productos? As\u00E9g\u00FArate de borrar los existentes primero si quieres reemplazarlos")) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setProgress("Preparando categor\u00EDas...");
      // Get unique category names
      const catNombres = [...new Set(PRODUCTOS_SELOGAS.map(p => p.categoria).filter(Boolean))];
      // Upsert categories
      const catMap = {};
      for (const nombre of catNombres) {
        // Try to find existing category
        let { data: existing } = await supabase.from("categorias").select("id").eq("nombre", nombre).single();
        if (existing) {
          catMap[nombre] = existing.id;
        } else {
          // Create new category
          const { data: created, error: catErr } = await supabase.from("categorias").insert([{ nombre, activa: true }]).select("id").single();
          if (catErr) throw catErr;
          catMap[nombre] = created.id;
        }
      }
      setProgress("Importando productos...");
      let created = 0;
      const total = PRODUCTOS_SELOGAS.length;
      const productos = PRODUCTOS_SELOGAS.map((p, i) => {
        const { categoria, ...rest } = p;
        return {
          ...rest,
          categoria_id: catMap[categoria] || null,
          orden_excel: i,
          disponible: true,
          hoja_excel: categoria,
        };
      });
      for (let i = 0; i < productos.length; i += 50) {
        const batch = productos.slice(i, i + 50);
        const { error: insertError } = await supabase.from("productos").insert(batch);
        if (insertError) throw insertError;
        created += batch.length;
        setProgress("Guardando... " + created + "/" + total);
      }
      setResult({ total: created });
    } catch (e) {
      setError(e.message || "Error al importar");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleBorrarTodo = async () => {
    if (!confirm("Â¿EstÃ¡s seguro? Esto borrarÃ¡ TODOS los productos del catÃ¡logo.")) return;
    setBorrandoTodo(true);
    try {
      const { error: deleteError } = await supabase.from('productos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (deleteError) throw deleteError;
      alert("Productos borrados.");
    } catch(e) {
      alert("Error: " + e.message);
    } finally {
      setBorrandoTodo(false);
    }
  };

  const categorias = [...new Set(PRODUCTOS_SELOGAS.map(p => p.categoria))];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: "var(--color-border)" }}>
        <h1 className="text-2xl font-bold mb-2">Importar CatÃ¡logo SELOGAS</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Carga el catÃ¡logo con {PRODUCTOS_SELOGAS.length} productos de todas las categorÃ­as, con grupos de visualizaciÃ³n (estaciÃ³n/cafeterÃ­a/ambas).
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="font-semibold text-blue-800 mb-2">â¹ï¸ Grupos de visualizaciÃ³n:</div>
          <div className="text-sm text-blue-700 space-y-1">
            <div>â¢ <strong>estacion</strong>: Solo lo ven las tiendas tipo "EstaciÃ³n"</div>
            <div>â¢ <strong>cafeteria</strong>: Solo lo ven las tiendas tipo "CafeterÃ­a"</div>
            <div>â¢ <strong>ambas</strong>: Lo ven todos (bebidas, agua, droguerÃ­a bÃ¡sica, etc.)</div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="font-semibold text-blue-800 mb-2">CategorÃ­as incluidas:</div>
          <div className="flex flex-wrap gap-2">
            {categorias.map(cat => (
              <span key={cat} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {cat} ({PRODUCTOS_SELOGAS.filter(p => p.categoria === cat).length})
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            disabled={loading || borrandoTodo}
            onClick={handleImportar}
            style={{ opacity: (loading || borrandoTodo) ? 0.6 : 1 }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
            {loading ? (progress || "Importando...") : `Importar ${PRODUCTOS_SELOGAS.length} productos`}
          </button>
          <button
            className="px-4 py-3 rounded-xl border-2 text-red-500 border-red-200 hover:bg-red-50 transition-colors flex items-center gap-2 text-sm font-medium"
            onClick={handleBorrarTodo}
            disabled={borrandoTodo || loading}
          >
            <Trash2 size={16} />
            {borrandoTodo ? "Borrando..." : "Borrar todo"}
          </button>
        </div>

        {loading && progress && (
          <div className="mt-3 text-sm text-blue-600 text-center animate-pulse">{progress}</div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-700">Error</div>
              <div className="text-sm text-red-600 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-green-700">Â¡ImportaciÃ³n completada!</div>
              <div className="text-sm text-green-600 mt-0.5">
                {result.total} productos importados con grupos de visualizaciÃ³n.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}