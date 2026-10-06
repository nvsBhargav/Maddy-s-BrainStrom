import React, { useRef, useState } from 'react';
import { GridNodeData, StickyNoteData } from '../types';
import { Maximize2, ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface MinimapProps {
  nodes: GridNodeData[];
  stickyNotes?: StickyNoteData[];
  transform: { x: number; y: number; scale: number };
  onCenterViewport: (x: number, y: number, targetScale?: number) => void;
  onSelectNode?: (nodeId: string) => void;
  onFitAll?: () => void;
  onZoom?: (delta: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ 
  nodes, 
  stickyNotes = [],
  transform, 
  onCenterViewport,
  onSelectNode,
  onFitAll,
  onZoom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ id: string; prompt: string; x: number; y: number } | null>(null);

  if (nodes.length === 0 && stickyNotes.length === 0) return null;

  // Find bounds of all nodes & sticky notes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + (node.width || 440));
    maxY = Math.max(maxY, node.y + (node.height || 380));
  });

  stickyNotes.forEach(sn => {
    minX = Math.min(minX, sn.x);
    minY = Math.min(minY, sn.y);
    maxX = Math.max(maxX, sn.x + sn.width);
    maxY = Math.max(maxY, sn.y + sn.height);
  });

  // Add padding
  const padding = 450;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = Math.max(maxX - minX, 100);
  const height = Math.max(maxY - minY, 100);

  // Slightly increased Minimap dimensions for enhanced right-bottom corner magnification
  const mapWidth = 320;
  const mapHeight = 220;

  // Scale map
  const scaleX = mapWidth / width;
  const scaleY = (mapHeight - 28) / height;
  const mapScale = Math.min(scaleX, scaleY);

  const renderWidth = width * mapScale;
  const renderHeight = height * mapScale;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };

  const updateFromPointer = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - (mapWidth - renderWidth) / 2;
    const y = e.clientY - rect.top - 28 - ((mapHeight - 28) - renderHeight) / 2;

    const targetX = (x / mapScale) + minX;
    const targetY = (y / mapScale) + minY;
    
    onCenterViewport(targetX, targetY);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) {
      updateFromPointer(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Viewport rect
  const viewportWidth = window.innerWidth / transform.scale;
  const viewportHeight = window.innerHeight / transform.scale;
  const viewportX = -transform.x / transform.scale;
  const viewportY = -transform.y / transform.scale;

  const viewRectX = (viewportX - minX) * mapScale;
  const viewRectY = (viewportY - minY) * mapScale;
  const viewRectW = viewportWidth * mapScale;
  const viewRectH = viewportHeight * mapScale;

  return (
    <div 
      className="bg-[#030307]/95 backdrop-blur-2xl border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col overflow-hidden relative cursor-pointer group no-canvas-zoom ring-1 ring-cyan-500/20"
      style={{ width: mapWidth, height: mapHeight }}
    >
      {/* Top Magnification Radar Control Strip */}
      <div 
        className="h-7 px-2.5 bg-black/60 border-b border-white/15 flex items-center justify-between text-[10px] font-mono select-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-cyan-300 font-bold flex items-center gap-1 uppercase tracking-wider">
          <Maximize2 size={10} />
          <span>MAGNIFICATION</span>
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-amber-300 font-bold text-[9px] bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/30">
            {Math.round(transform.scale * 100)}%
          </span>

          {onZoom && (
            <>
              <button
                onClick={() => onZoom(-0.15)}
                className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={9} />
              </button>
              <button
                onClick={() => onZoom(0.15)}
                className="w-4 h-4 rounded bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={9} />
              </button>
            </>
          )}

          {onFitAll && (
            <button
              onClick={onFitAll}
              className="w-4 h-4 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/40 flex items-center justify-center cursor-pointer"
              title="Fit Entire Workspace to Screen"
            >
              <Compass size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Minimap Area */}
      <div 
        ref={containerRef}
        onWheel={(e) => e.stopPropagation()}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div 
          className="relative" 
          style={{ width: renderWidth, height: renderHeight }}
        >
          {/* Draw edges between parent and children */}
          {nodes.filter(n => n.parentId).map(node => {
            const parent = nodes.find(n => n.id === node.parentId);
            if (!parent) return null;
            
            const px = (parent.x + (parent.width || 440) - minX) * mapScale;
            const py = (parent.y + (parent.height ? parent.height / 2 : 190) - minY) * mapScale;
            const cx = (node.x - minX) * mapScale;
            const cy = (node.y + (node.height ? node.height / 2 : 190) - minY) * mapScale;

            return (
              <svg key={`line-${node.id}`} className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
                <line x1={px} y1={py} x2={cx} y2={cy} stroke="#CBCBCB" strokeOpacity="0.6" strokeWidth={1.5} strokeDasharray="2 2" />
              </svg>
            );
          })}

          {/* Draw nodes */}
          {nodes.map(node => {
            const nx = (node.x - minX) * mapScale;
            const ny = (node.y - minY) * mapScale;
            const nw = (node.width || 440) * mapScale;
            const nh = (node.height || 380) * mapScale;
            const isSubnode = Boolean(node.parentId || node.isCustom);
            const nodeColor = node.color || (isSubnode ? '#CBCBCB' : '#8686AC');
            const isHovered = hoveredNode?.id === node.id;

            return (
              <div 
                key={node.id} 
                className={`absolute border border-black/50 rounded-[3px] shadow-sm transition-all cursor-pointer hover:scale-150 hover:z-20 ${
                  isHovered ? 'ring-2 ring-cyan-300 z-30 scale-150' : ''
                }`}
                title={`Click to jump to: ${node.prompt}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (onSelectNode) {
                    onSelectNode(node.id);
                  } else {
                    onCenterViewport(node.x + (node.width || 440) / 2, node.y + (node.height || 380) / 2, 0.8);
                  }
                }}
                onMouseEnter={() => setHoveredNode({ id: node.id, prompt: node.prompt, x: nx, y: ny })}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  left: nx,
                  top: ny,
                  width: Math.max(nw, 8),
                  height: Math.max(nh, 8),
                  backgroundColor: nodeColor,
                }}
              />
            );
          })}

          {/* Draw sticky notes */}
          {stickyNotes.map(sn => {
            const sx = (sn.x - minX) * mapScale;
            const sy = (sn.y - minY) * mapScale;
            const sw = sn.width * mapScale;
            const sh = sn.height * mapScale;

            return (
              <div 
                key={sn.id} 
                className="absolute border border-black/40 rounded-[2px] shadow-xs cursor-pointer hover:scale-125"
                title="Click to jump to sticky memo"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onCenterViewport(sn.x + sn.width / 2, sn.y + sn.height / 2);
                }}
                style={{
                  left: sx,
                  top: sy,
                  width: Math.max(sw, 6),
                  height: Math.max(sh, 6),
                  backgroundColor: sn.color || '#FEF08A',
                }}
              />
            );
          })}

          {/* Magnification Box (Viewport Frame) */}
          <div 
            className="absolute border-[2px] border-amber-300 bg-amber-300/20 rounded-[2px] pointer-events-none transition-all duration-75 shadow-[0_0_12px_rgba(252,211,77,0.6)]"
            style={{
              left: viewRectX,
              top: viewRectY,
              width: Math.max(viewRectW, 14),
              height: Math.max(viewRectH, 12)
            }}
          />

          {/* Hover Node Prompt Tooltip */}
          {hoveredNode && (
            <div 
              className="absolute z-40 bg-[#0A092B]/95 border border-cyan-400 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap max-w-[140px] truncate -translate-y-full -translate-x-1/2"
              style={{
                left: Math.max(20, Math.min(mapWidth - 40, hoveredNode.x)),
                top: Math.max(16, hoveredNode.y - 2)
              }}
            >
              {hoveredNode.prompt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
