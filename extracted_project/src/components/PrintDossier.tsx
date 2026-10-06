import React from 'react';
import { GridNodeData, StickyNoteData } from '../types';

interface PrintDossierProps {
  nodes: GridNodeData[];
  workspaceName?: string;
  stickyNotes?: StickyNoteData[];
}

export const PrintDossier: React.FC<PrintDossierProps> = ({ 
  nodes, 
  workspaceName = 'Current Workspace',
  stickyNotes = [] 
}) => {
  const now = new Date().toLocaleString();

  return (
    <div className="hidden print:block bg-white text-slate-900 p-8 max-w-4xl mx-auto font-sans print-only">
      {/* Dossier Header */}
      <div className="border-b-2 border-[#0F0E47] pb-6 mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-[#0F0E47] tracking-tight m-0">
            Maddy's BrainVault
          </h1>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Knowledge &amp; Research Dossier
          </span>
        </div>
        <div className="text-xs font-mono text-slate-600 flex items-center gap-3 flex-wrap">
          <span className="bg-[#0F0E47] text-white px-2 py-0.5 rounded font-bold">
            Workspace: {workspaceName}
          </span>
          <span>&bull;</span>
          <span>Exported: {now}</span>
          <span>&bull;</span>
          <span>Topics &amp; Notes: {nodes.length}</span>
          <span>&bull;</span>
          <span>Sticky Memos: {stickyNotes.length}</span>
        </div>
      </div>

      {/* Table of Contents */}
      {nodes.length > 0 && (
        <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="text-sm font-mono uppercase font-bold text-[#0F0E47] mb-3 tracking-wider">
            Table of Contents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex items-center justify-between text-slate-700">
                <span className="truncate pr-2">
                  <span className="font-bold text-[#0F0E47]">{i + 1}.</span> {node.prompt}
                </span>
                <span className="font-mono text-[10px] shrink-0 text-slate-500 uppercase">
                  {node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node Sections */}
      <div className="space-y-8">
        {nodes.map((node, i) => {
          const version = node.versions[node.versionIndex] || node;
          const parent = nodes.find(p => p.id === node.parentId);
          const isSubnode = Boolean(node.parentId || node.isCustom);
          const borderColor = node.isCustom ? '#CBCBCB' : isSubnode ? '#CBCBCB' : '#8686AC';

          return (
            <article 
              key={node.id} 
              className="page-break-inside-avoid border-l-4 pl-5 py-1 mb-6"
              style={{ borderColor }}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                <span className="font-bold text-[#0F0E47]">
                  {node.isCustom ? 'Custom Note / Extra Details' : node.parentId ? 'Sub-Node' : 'Primary Node'} #{i + 1}
                </span>
                {parent && (
                  <span>Branched from: <strong>{parent.prompt}</strong></span>
                )}
              </div>

              <h2 className="text-xl font-bold text-[#0F0E47] mt-0 mb-3 tracking-tight">
                {node.prompt}
              </h2>

              <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
                {version.text || 'No additional text recorded.'}
              </div>

              {version.prompts && version.prompts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Suggested Exploration Branches:
                  </div>
                  <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                    {version.prompts.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-4 border-t border-slate-200 text-center font-mono text-[10px] text-slate-500">
        Maddy's BrainVault &bull; Fast Interactive Spatial Knowledge Canvas &bull; Saved locally to machine
      </footer>
    </div>
  );
};
