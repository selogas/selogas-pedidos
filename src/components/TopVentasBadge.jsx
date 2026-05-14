// TopVentasBadge.jsx
// Badge animado "Top Ventas" — Opción C premium
// Diseño: moderno, limpio, no intrusivo, fácil de identificar.
//
// Variantes:
//   "badge"  (default) → chip "Top Ventas" con destello sutil en la esquina
//   "corner"           → versión compacta solo con el número de posición
//   "glow"             → halo dorado detrás de la imagen del producto

export default function TopVentasBadge({ variant = 'badge', rank = null, className = '' }) {
  if (variant === 'corner') {
    return (
      <div
        className={`absolute top-1 right-1 z-10 ${className}`}
        title="Top Ventas"
        aria-label="Producto top ventas"
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            boxShadow: '0 1px 6px rgba(245,158,11,0.55)',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'topventa-pulse 2.4s ease-in-out infinite',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      </div>
    );
  }

  if (variant === 'glow') {
    return (
      <div
        className={`absolute inset-0 rounded-t-2xl pointer-events-none ${className}`}
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.18) 0%, transparent 72%)',
          animation: 'topventa-glow 3s ease-in-out infinite',
        }}
      />
    );
  }

  // Variante "badge" — chip premium
  return (
    <div
      className={`absolute top-1.5 left-1.5 z-10 select-none ${className}`}
      aria-label="Top Ventas"
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
          color: 'white',
          fontSize: '9.5px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          padding: '2.5px 7px 2.5px 5px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          boxShadow: '0 1px 8px rgba(245,158,11,0.45)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          animation: 'topventa-shine 3.5s ease-in-out infinite',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Destellos internos */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)',
            backgroundSize: '200% 100%',
            animation: 'topventa-shimmer 2.8s ease-in-out infinite',
            borderRadius: 'inherit',
          }}
        />
        {/* Estrella */}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="white"
          style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span style={{ position: 'relative', zIndex: 1 }}>
          Top{rank ? ` #${rank}` : ' Ventas'}
        </span>
      </div>
    </div>
  );
}

// Inyectar los keyframes CSS una sola vez en el DOM
if (typeof document !== 'undefined' && !document.getElementById('top-ventas-styles')) {
  const style = document.createElement('style');
  style.id = 'top-ventas-styles';
  style.textContent = `
    @keyframes topventa-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 1px 6px rgba(245,158,11,0.55); }
      50%       { transform: scale(1.12); box-shadow: 0 2px 10px rgba(245,158,11,0.8); }
    }
    @keyframes topventa-shine {
      0%, 100% { box-shadow: 0 1px 8px rgba(245,158,11,0.45); }
      50%       { box-shadow: 0 2px 14px rgba(245,158,11,0.75); }
    }
    @keyframes topventa-shimmer {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
    @keyframes topventa-glow {
      0%, 100% { opacity: 0.7; }
      50%       { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
