import React from 'react';
import { GridNodeData, RelationshipLink } from '../types';
import { X } from 'lucide-react';

interface ConnectingLinesProps {
  nodes: GridNodeData[];
  links?: RelationshipLink[];
  onDeleteLink?: (linkId: string) => void;
}

export const ConnectingLines: React.FC<ConnectingLinesProps> = React.memo(({ nodes, links = [], onDeleteLink }) => {
  return (
    <svg 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible'
      }}
    >
      {/* Parent-child tree lines */}
      {nodes.map(node => {
        if (!node.parentId) return null;
        
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return null;

        const startX = parent.x + (parent.width || 440);
        const parentCenterY = parent.height ? parent.height / 2 : 190;
        const nodeCenterY = node.height ? node.height / 2 : 190;
        const startY = parent.y + parentCenterY; 
        const endX = node.x; 
        const endY = node.y + nodeCenterY;

        const cp1X = startX + (endX - startX) / 2;
        const cp1Y = startY;
        const cp2X = cp1X;
        const cp2Y = endY;

        return (
          <g key={`line-group-${node.id}`}>
            <path
              d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
            />
            <circle cx={startX} cy={startY} r="5" fill="#FFFFFF" />
            <circle cx={endX} cy={endY} r="5" fill="#FFFFFF" />
          </g>
        );
      })}

      {/* Explicit Relationship Links */}
      {links.map(link => {
        const source = nodes.find(n => n.id === link.sourceId);
        const target = nodes.find(n => n.id === link.targetId);
        if (!source || !target) return null;

        const startX = source.x + (source.width || 440) / 2;
        const startY = source.y + (source.height || 380) / 2;
        const endX = target.x + (target.width || 440) / 2;
        const endY = target.y + (target.height || 380) / 2;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
          <g key={`rel-link-${link.id}`}>
            <path
              d={`M ${startX} ${startY} Q ${midX} ${midY - 60} ${endX} ${endY}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeDasharray="8 4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_10px_rgba(6,182,212,0.7)]"
            />
            <circle cx={startX} cy={startY} r="6" fill="#06b6d4" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx={endX} cy={endY} r="6" fill="#06b6d4" stroke="#FFFFFF" strokeWidth="2" />
            
            {/* Delete link button at midpoint */}
            {onDeleteLink && (
              <foreignObject x={midX - 12} y={midY - 45} width="24" height="24" style={{ overflow: 'visible', pointerEvents: 'auto' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLink(link.id);
                  }}
                  className="w-6 h-6 rounded-full bg-[#0F0E47] border border-cyan-400 text-cyan-300 hover:bg-rose-600 hover:text-white hover:border-rose-400 flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  title="Remove Relationship Link"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
});

ConnectingLines.displayName = 'ConnectingLines';
