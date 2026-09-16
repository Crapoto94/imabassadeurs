import { useMemo, useRef, useState } from 'react';

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  author_name?: string;
  direction?: string | null;
  service?: string | null;
  [key: string]: any;
}
export interface GraphEdge { source: string; target: string; kind: string; }

const TYPE_STYLE: Record<string, { color: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'hex' }> = {
  resource: { color: '#0055A4', shape: 'circle' },
  risk: { color: '#dc2626', shape: 'square' },
  experiment: { color: '#d97706', shape: 'triangle' },
  principle: { color: '#059669', shape: 'diamond' },
  comment: { color: '#64748b', shape: 'circle' },
  cluster: { color: '#7c3aed', shape: 'hex' },
};

// Layout force-directed simple, calculé de façon déterministe.
function layout(nodes: GraphNode[], edges: GraphEdge[], width = 900, height = 600) {
  const n = nodes.length;
  const pos = nodes.map((_, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    return { x: width / 2 + Math.cos(a) * 220 + (Math.sin(i) * 20), y: height / 2 + Math.sin(a) * 220 + (Math.cos(i) * 20) };
  });
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links: [number, number][] = edges
    .map((e) => [idx.get(e.source), idx.get(e.target)] as [number, number])
    .filter(([a, b]) => a !== undefined && b !== undefined);
  const k = 3200;
  for (let iter = 0; iter < 220; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy + 0.01;
        const d = Math.sqrt(d2);
        const f = k / d2;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        pos[i].x += fx; pos[i].y += fy; pos[j].x -= fx; pos[j].y -= fy;
      }
    }
    for (const [a, b] of links) {
      if (a === undefined || b === undefined) continue;
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
      const d = Math.hypot(dx, dy) + 0.01;
      const f = (d - 90) * 0.03;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      pos[a].x += fx; pos[a].y += fy; pos[b].x -= fx; pos[b].y -= fy;
    }
    for (let i = 0; i < n; i++) {
      pos[i].x += (width / 2 - pos[i].x) * 0.01;
      pos[i].y += (height / 2 - pos[i].y) * 0.01;
    }
  }
  return pos;
}

function NodeShape({ x, y, style, r } : { x: number; y: number; style: { color: string; shape: string }; r: number }) {
  const fill = style.color;
  if (style.shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={fill} />;
  if (style.shape === 'triangle') return <polygon points={`0,${-r} ${r},${r} ${-r},${r}`} fill={fill} />;
  if (style.shape === 'diamond') return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} />;
  if (style.shape === 'hex') return <polygon points={`${-r},0 ${-r / 2},${-r} ${r / 2},${-r} ${r},0 ${r / 2},${r} ${-r / 2},${r}`} fill={fill} />;
  return <circle r={r} fill={fill} />;
}

export default function ForceGraph({
  nodes, edges, onSelect, selectedId,
}: { nodes: GraphNode[]; edges: GraphEdge[]; onSelect?: (n: GraphNode) => void; selectedId?: string }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const positions = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const posMap = useMemo(() => new Map(nodes.map((nd, i) => [nd.id, positions[i]])), [nodes, positions]);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 900 600"
        className="w-full rounded-lg border border-slate-200 bg-white"
        style={{ height: 520, touchAction: 'none' }}
        role="img"
        aria-label={`Graphe de connaissances : ${nodes.length} éléments`}
        onWheel={(e) => setScale((s) => Math.min(4, Math.max(0.4, s - e.deltaY * 0.001)))}
        onMouseDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY }; }}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseMove={(e) => {
          if (!dragRef.current) return;
          setTx((v) => v + (e.clientX - dragRef.current!.x));
          setTy((v) => v + (e.clientY - dragRef.current!.y));
          dragRef.current = { x: e.clientX, y: e.clientY };
        }}
      >
        <g transform={`translate(${tx} ${ty}) translate(450 300) scale(${scale}) translate(-450 -300)`}>
          {edges.map((e, i) => {
            const a = posMap.get(e.source); const b = posMap.get(e.target);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.kind === 'cluster' ? '#c4b5fd' : '#e2e8f0'} strokeWidth={e.kind === 'cluster' ? 2 : 1} />;
          })}
          {nodes.map((nd, i) => {
            const p = positions[i];
            const style = TYPE_STYLE[nd.type] || TYPE_STYLE.comment;
            const r = nd.type === 'cluster' ? 16 : nd.type === 'comment' ? 6 : 10;
            const selected = selectedId === nd.id;
            return (
              <g
                key={nd.id}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                onClick={() => onSelect?.(nd)}
                tabIndex={0}
                role="button"
                aria-label={`${nd.type} : ${nd.label}`}
                onKeyDown={(e) => e.key === 'Enter' && onSelect?.(nd)}
              >
                <NodeShape x={0} y={0} style={style} r={r} />
                {(nd.type === 'cluster' || nd.type === 'principle' || selected) && (
                  <text y={nd.type === 'cluster' ? 0 : r + 12} textAnchor="middle" fontSize={nd.type === 'cluster' ? 11 : 10} fill={nd.type === 'cluster' ? '#fff' : '#334155'}>
                    {(nd.label || '').slice(0, 24)}
                  </text>
                )}
                {selected && <circle r={r + 5} fill="none" stroke="#0f172a" strokeWidth={2} />}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="no-print absolute right-4 top-4 flex gap-2">
        <button onClick={() => setScale((s) => Math.min(4, s + 0.2))} className="rounded bg-white px-2 py-1 text-sm shadow" aria-label="Zoomer">+</button>
        <button onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} className="rounded bg-white px-2 py-1 text-sm shadow" aria-label="Dézoomer">−</button>
        <button onClick={() => { setScale(1); setTx(0); setTy(0); }} className="rounded bg-white px-2 py-1 text-sm shadow" aria-label="Réinitialiser la vue">⟳</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600" aria-label="Légende">
        {Object.entries(TYPE_STYLE).map(([type, style]) => (
          <span key={type} className="inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden>
              <NodeShape x={0} y={0} style={style} r={6} />
            </svg>
            {{ resource: 'Ressource', risk: 'Risque', experiment: 'Expérimentation', principle: 'Principe', comment: 'Commentaire', cluster: 'Thème IA' }[type as keyof typeof TYPE_STYLE] || type}
          </span>
        ))}
      </div>
    </div>
  );
}
