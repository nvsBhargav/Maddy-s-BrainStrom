import React, { useState } from 'react';
import { Search, Compass, ChevronRight, FileText, GitBranch, Sparkles, X } from 'lucide-react';
import { GridNodeData } from '../types';
import { getPalette } from '../palettes';

interface NodesDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GridNodeData[];
  onSelectNode: (nodeId: string) => void;
  onFitAll: () => void;
}

export const NodesDropdown: React.FC<NodesDropdownProps> = ({
  isOpen,
  onClose,
  nodes,
  onSelectNode,
  onFitAll,
}) => {
  const [filterText, setFilterText] = useState('');

  if (!isOpen) return null;

  const filtered = nodes.filter(n => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    const version = n.versions[n.versionIndex] || n;
    return n.prompt.toLowerCase().includes(q) || (version.text || '').toLowerCase().includes(q);
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-start pt-18 pl-4 sm:pl-20 bg-black/50 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div 
        onWheel={(e) => e.stopPropagation()}
        className="bg-[#030307]/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md max-h-[80vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-top-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dropdown Header */}
        <div className="p-3.5 border-b border-white/10 bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <h3 className="font-tomorrow font-bold text-sm text-white">
              All Created Nodes
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-200">
              {nodes.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Filter Input & Quick Actions */}
        <div className="p-3 border-b border-white/10 bg-white/5 flex items-center gap-2">
          <div className="flex-1 flex items-center bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-400 transition-colors">
            <Search size={14} className="text-slate-300 mr-2 shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter nodes..."
              className="bg-transparent text-xs text-white placeholder:text-slate-400 outline-none w-full font-sans"
              autoFocus
            />
          </div>

          <button
            onClick={() => {
              onFitAll();
              onClose();
            }}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer text-cyan-200"
            title="Fit all nodes in viewport"
          >
            <Compass size={13} className="text-cyan-300" />
            <span className="hidden sm:inline">FIT ALL</span>
          </button>
        </div>

        {/* Nodes Scrollable List */}
        <div 
          className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2 overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-mono text-xs">
              {nodes.length === 0 ? "No nodes created on canvas yet." : "No matching nodes found."}
            </div>
          ) : (
            filtered.map((node, i) => {
              const palette = getPalette(node.color);
              const version = node.versions[node.versionIndex] || node;

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    onSelectNode(node.id);
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.14] hover:border-cyan-400/40 backdrop-blur-xl transition-all cursor-pointer flex items-center justify-between gap-2.5 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Node theme color dot */}
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0 shadow-xs" 
                      style={{ backgroundColor: palette.bg }} 
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate group-hover:text-cyan-200 transition-colors">
                          {node.prompt}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-300/70 block truncate">
                        {node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node'} &bull; {version.text ? `${version.text.length} chars` : 'Empty'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-white shrink-0">
                    <span className="text-[10px] font-mono text-cyan-300">View</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Dropdown Footer */}
        <div className="p-2.5 border-t border-white/10 bg-black/40 text-center font-mono text-[10px] text-slate-400">
          Click any node to navigate and focus canvas on it
        </div>
      </div>
    </div>
  );
};
