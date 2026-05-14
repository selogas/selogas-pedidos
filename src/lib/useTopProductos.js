import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const CACHE_KEY = "selogas_top_productos";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

let cache = null;
let cacheTs = 0;

export function invalidateTopProductosCache() {
  cache = null;
  cacheTs = 0;
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export function useTopProductos() {
  const { perfil } = useAuth();
  const [topSet, setTopSet] = useState(new Set());

  useEffect(() => {
    if (!perfil?.tienda_id) return;

    const cargar = async () => {
      // Caché en memoria
      if (cache && Date.now() - cacheTs < CACHE_TTL) {
        setTopSet(cache);
        return;
      }
      // Caché en localStorage
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL) {
            const s = new Set(data);
            cache = s; cacheTs = ts;
            setTopSet(s);
            return;
          }
        }
      } catch {}

      // Cargar top 15 productos más pedidos en últimos 90 días
      try {
        const desde = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
          .from("pedido_items")
          .select("producto_id, pedidos!inner(tienda_id, created_at)")
          .eq("pedidos.tienda_id", perfil.tienda_id)
          .gte("pedidos.created_at", desde);

        if (data?.length) {
          const counts = {};
          for (const row of data) {
            counts[row.producto_id] = (counts[row.producto_id] || 0) + 1;
          }
          const top = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([id]) => id);
          const s = new Set(top);
          cache = s; cacheTs = Date.now();
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: cacheTs, data: top })); } catch {}
          setTopSet(s);
        }
      } catch {}
    };

    cargar();
  }, [perfil?.tienda_id]);

  return { topSet };
}
