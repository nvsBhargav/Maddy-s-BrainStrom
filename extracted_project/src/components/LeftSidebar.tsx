import React, { useState } from 'react';
import { 
  Layers, 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Download, 
  FolderPlus,
  BookA,
  StickyNote,
  HardDrive,
  Database,
  Shuffle,
  Pin,
  ExternalLink,
  Compass,
  RefreshCw,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { WorkspaceData, GridNodeData, StickyNoteData } from '../types';
import { WORKSPACE_THEMES, getPalette } from '../palettes';
import { searchDictionary, getRandomWord, DICTIONARY_ENTRIES } from '../dictionaryData';

interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workspaces: WorkspaceData[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (id: string, newName: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onSaveAsWorkspace: (id: string) => void;
  currentNodes: GridNodeData[];
  stickyNotes: StickyNoteData[];
  onCreateNote: () => void;
  onCreateStickyNote: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelectStickyNote: (noteId: string) => void;
  onRenameNode: (nodeId: string, newPrompt: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteStickyNote: (noteId: string) => void;
  onSaveAsNode: (node: GridNodeData) => void;
  onAddDictionaryNode: (word: string, definition: string, frame: string) => void;
  onSyncLocalStorage?: () => void;
  searchHistory: string[];
  onRunSearch: (query: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onToggle,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSaveAsWorkspace,
  currentNodes,
  stickyNotes,
  onCreateNote,
  onCreateStickyNote,
  onSelectNode,
  onSelectStickyNote,
  onRenameNode,
  onDeleteNode,
  onDeleteStickyNote,
  onSaveAsNode,
  onAddDictionaryNode,
  onSyncLocalStorage,
  searchHistory,
  onRunSearch
}) => {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'notes' | 'stickies' | 'dictionary'>('workspaces');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  
  // Workspaces inline rename states
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');

  // Notes inline rename states
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeTitle, setEditingNodeTitle] = useState('');

  // Dictionary search & flashcard state
  const [dictQuery, setDictQuery] = useState('');
  const [flashcardWord, setFlashcardWord] = useState(() => getRandomWord());

  const handleStartRenameWorkspace = (ws: WorkspaceData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspaceId(ws.id);
    setEditingWorkspaceName(ws.name);
  };

  const handleSaveRenameWorkspace = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editingWorkspaceName.trim()) {
      onRenameWorkspace(id, editingWorkspaceName.trim());
    }
    setEditingWorkspaceId(null);
  };

  const handleStartRenameNode = (node: GridNodeData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingNodeTitle(node.prompt);
  };

  const handleSaveRenameNode = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editingNodeTitle.trim()) {
      onRenameNode(id, editingNodeTitle.trim());
    }
    setEditingNodeId(null);
  };

  const searchResults = searchDictionary(dictQuery);

  return (
    <>
      {/* Mobile Backdrop Overlay when sidebar is open */}
      {isOpen && (
        <div 
          onClick={onToggle}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-39 sm:hidden no-print"
        />
      )}

      {/* Floating Toggle Button when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-3 top-20 z-40 bg-[#09090B]/90 hover:bg-[#121215] border border-white/20 text-slate-100 p-2.5 rounded-xl shadow-2xl flex items-center gap-2 font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95 no-print backdrop-blur-xl"
          title="Open Workspaces, Notes, Sticky Notes & Dictionary Panel"
        >
          <Layers size={16} className="text-cyan-300" />
          <span className="hidden sm:inline">PANEL</span>
          <ChevronRight size={14} className="text-slate-400" />
        </button>
      )}

      {/* Slide-out Left Sidebar Drawer with Glassmorphism and Isolated Scroll */}
      <aside 
        data-panel="sidebar"
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 bottom-0 z-40 w-[88vw] sm:w-96 max-w-sm bg-[#030307]/90 backdrop-blur-2xl border-r border-white/15 shadow-[10px_0_40px_rgba(0,0,0,0.85)] flex flex-col transition-transform duration-300 ease-out no-print no-canvas-zoom overscroll-contain ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header of Sidebar */}
        <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center text-cyan-300 shadow-inner backdrop-blur-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 0-4 4c0 .7.2 1.4.5 2C6.6 8.5 5 10.1 5 12c0 1.2.6 2.3 1.5 3-.3.6-.5 1.3-.5 2a4 4 0 0 0 4 4c1 0 1.8-.4 2.5-1 .7.6 1.5 1 2.5 1a4 4 0 0 0 4-4c0-.7-.2-1.4-.5-2 .9-.7 1.5-1.8 1.5-3 0-1.9-1.6-3.5-3.5-4 .3-.6.5-1.3.5-2a4 4 0 0 0-4-4Z"/>
                <path d="M12 2v20"/>
                <path d="M8 8h8"/>
                <path d="M7 14h10"/>
              </svg>
            </div>
            <div>
              <h2 className="font-tomorrow font-bold text-sm tracking-wide text-white">
                BrainVault Studio
              </h2>
              <p className="text-[10px] font-mono text-cyan-300/80">
                Workspaces &bull; Notes &bull; Dictionary
              </p>
            </div>
          </div>

          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/15 cursor-pointer"
            title="Collapse Sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Tab Buttons in Refined Glassmorphism Theme */}
        <div 
          className="p-3 border-b border-white/10 bg-black/30 backdrop-blur-md shrink-0"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/15 font-mono text-[11px] font-bold">
            {/* Workspaces Tab - Glass Indigo */}
            <button
              onClick={() => setActiveTab('workspaces')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                activeTab === 'workspaces' 
                  ? 'bg-white/25 text-white shadow-[0_4px_20px_rgba(255,255,255,0.25)] font-bold scale-[1.03] border border-white/40 backdrop-blur-xl' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Workspaces Management"
            >
              <Layers size={15} className={activeTab === 'workspaces' ? 'text-cyan-300' : 'text-slate-400'} />
              <span className="text-[10px] tracking-wider font-tomorrow">SPACES</span>
            </button>

            {/* Notes Tab - Glass Slate */}
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                activeTab === 'notes' 
                  ? 'bg-white/25 text-white shadow-[0_4px_20px_rgba(255,255,255,0.25)] font-bold scale-[1.03] border border-white/40 backdrop-blur-xl' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Knowledge Notes"
            >
              <FileText size={15} className={activeTab === 'notes' ? 'text-amber-300' : 'text-slate-400'} />
              <span className="text-[10px] tracking-wider font-tomorrow">NOTES</span>
            </button>

            {/* Sticky Notes Tab - Glass Amber */}
            <button
              onClick={() => setActiveTab('stickies')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                activeTab === 'stickies' 
                  ? 'bg-white/25 text-white shadow-[0_4px_20px_rgba(255,255,255,0.25)] font-bold scale-[1.03] border border-white/40 backdrop-blur-xl' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Sticky Notes"
            >
              <StickyNote size={15} className={activeTab === 'stickies' ? 'text-yellow-300' : 'text-slate-400'} />
              <span className="text-[10px] tracking-wider font-tomorrow">STICKY</span>
            </button>

            {/* Dictionary Tab - Glass Amethyst */}
            <button
              onClick={() => setActiveTab('dictionary')}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
                activeTab === 'dictionary' 
                  ? 'bg-white/25 text-white shadow-[0_4px_20px_rgba(255,255,255,0.25)] font-bold scale-[1.03] border border-white/40 backdrop-blur-xl' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Dictionary & Contextual Usage"
            >
              <BookA size={15} className={activeTab === 'dictionary' ? 'text-purple-300' : 'text-slate-400'} />
              <span className="text-[10px] tracking-wider font-tomorrow">DICT</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Workspaces Management (Glassmorphism Styled) */}
        {activeTab === 'workspaces' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onWheel={(e) => e.stopPropagation()}>
            {/* Create Workspace Button */}
            <div className="p-3 border-b border-white/10">
              <button
                onClick={onCreateWorkspace}
                className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xl text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                title="Create a new workspace in a distinct dark theme"
              >
                <FolderPlus size={16} />
                <span>+ NEW WORKSPACE</span>
              </button>
            </div>

            {/* Workspaces List in Glassmorphism Theme */}
            <div 
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {workspaces.map(ws => {
                const isActive = ws.id === activeWorkspaceId;
                const isEditing = editingWorkspaceId === ws.id;

                return (
                  <div
                    key={ws.id}
                    onClick={() => onSelectWorkspace(ws.id)}
                    className={`p-3.5 rounded-2xl border transition-all text-xs flex flex-col gap-2.5 cursor-pointer backdrop-blur-xl shadow-lg ${
                      isActive 
                        ? 'bg-white/15 border-cyan-400/80 shadow-[0_8px_25px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50' 
                        : 'bg-white/[0.07] hover:bg-white/[0.14] border-white/15 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Theme color indicator badge */}
                        <span 
                          className="w-4 h-4 rounded-full border-2 border-white/60 shrink-0 shadow-md"
                          style={{ backgroundColor: ws.bgDarkColor || '#0F0E47' }}
                          title={`Theme Background: ${ws.bgDarkColor}`}
                        />

                        {isEditing ? (
                          <div 
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingWorkspaceName}
                              onChange={(e) => setEditingWorkspaceName(e.target.value)}
                              autoFocus
                              className="w-full bg-black/60 border border-cyan-400 rounded px-2 py-1 text-xs text-white outline-none font-bold font-sans"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameWorkspace(ws.id, e);
                                if (e.key === 'Escape') setEditingWorkspaceId(null);
                              }}
                            />
                            <button
                              onClick={(e) => handleSaveRenameWorkspace(ws.id, e)}
                              className="p-1 text-emerald-400 hover:bg-emerald-950/60 rounded"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingWorkspaceId(null); }}
                              className="p-1 text-slate-400 hover:bg-rose-950/60 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="truncate flex-1">
                            <span className="font-bold text-white text-xs truncate block font-sans">
                              {ws.name}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-200/70 block">
                              {ws.nodes.length} nodes &bull; {ws.bgDarkColor}
                            </span>
                          </div>
                        )}
                      </div>

                      {isActive && !isEditing && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {/* Workspace Action Buttons: Rename, Delete, Save As */}
                    {!isEditing && (
                      <div 
                        className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/10 text-[10px] font-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleStartRenameWorkspace(ws, e)}
                          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 size={11} />
                          <span>Rename</span>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onSaveAsWorkspace(ws.id); }}
                          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 flex items-center gap-1 transition-colors"
                        >
                          <Copy size={11} />
                          <span>Save As</span>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(ws.id); }}
                          disabled={workspaces.length <= 1}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-400/40 flex items-center gap-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={11} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Notes Management (Glassmorphism Styled) */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onWheel={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-white/10">
              <button
                onClick={onCreateNote}
                className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xl text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={3} />
                <span>+ NEW NOTE</span>
              </button>
            </div>

            <div 
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {currentNodes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                  <FileText size={24} className="text-indigo-400/40" />
                  <span>No notes created on this canvas yet.</span>
                </div>
              ) : (
                currentNodes.map(node => {
                  const palette = getPalette(node.color);
                  const version = node.versions[node.versionIndex] || node;
                  const isEditing = editingNodeId === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className="p-3.5 rounded-2xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-xl text-slate-200 transition-all text-xs flex flex-col gap-2 cursor-pointer shadow-md group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span 
                            className="w-3.5 h-3.5 rounded-full border border-black/30 shrink-0 mt-0.5 shadow-xs" 
                            style={{ backgroundColor: palette.bg }}
                          />

                          {isEditing ? (
                            <div 
                              className="flex items-center gap-1 flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingNodeTitle}
                                onChange={(e) => setEditingNodeTitle(e.target.value)}
                                autoFocus
                                className="w-full bg-black/60 border border-indigo-400 rounded px-2 py-1 text-xs text-white outline-none font-bold"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenameNode(node.id, e);
                                  if (e.key === 'Escape') setEditingNodeId(null);
                                }}
                              />
                              <button
                                onClick={(e) => handleSaveRenameNode(node.id, e)}
                                className="p-1 text-emerald-400 hover:bg-emerald-950/60 rounded"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingNodeId(null); }}
                                className="p-1 text-slate-400 hover:bg-rose-950/60 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-white text-xs truncate block group-hover:text-amber-200 transition-colors">
                                {node.prompt}
                              </span>
                              <span className="text-[10px] font-mono text-indigo-300/70 block truncate">
                                {node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node'} &bull; {version.text ? `${version.text.length} chars` : 'Empty'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isEditing && (
                        <div 
                          className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/10 text-[10px] font-mono"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleStartRenameNode(node, e)}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 flex items-center gap-1 transition-colors"
                          >
                            <Edit3 size={11} />
                            <span>Rename</span>
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onSaveAsNode(node); }}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 flex items-center gap-1 transition-colors"
                          >
                            <Download size={11} />
                            <span>Save As</span>
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                            className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-400/40 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={11} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Sticky Notes Management (Glassmorphism Styled) */}
        {activeTab === 'stickies' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onWheel={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-white/10">
              <button
                onClick={onCreateStickyNote}
                className="w-full py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 backdrop-blur-xl text-amber-200 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Plus size={16} strokeWidth={3} />
                <span>+ NEW STICKY NOTE</span>
              </button>
            </div>

            <div 
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {stickyNotes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                  <StickyNote size={24} className="text-amber-400/40" />
                  <span>No sticky notes on this workspace yet.</span>
                  <span className="text-[10px] text-slate-500">Click "+ NEW STICKY NOTE" to add one.</span>
                </div>
              ) : (
                stickyNotes.map(sn => (
                  <div
                    key={sn.id}
                    onClick={() => onSelectStickyNote(sn.id)}
                    className="p-3.5 rounded-2xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-2xl text-slate-100 transition-all text-xs flex flex-col gap-2.5 cursor-pointer shadow-lg hover:shadow-[0_8px_25px_rgba(0,0,0,0.5)] group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-white/50 shrink-0 shadow-xs"
                          style={{ backgroundColor: sn.color || '#FEF08A' }}
                        />
                        <span className="font-mono text-[11px] font-bold text-amber-300">
                          Sticky Memo
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStickyNote(sn.id);
                        }}
                        className="p-1 rounded-lg bg-white/5 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="Delete sticky note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <p className="text-xs line-clamp-2 font-sans font-medium text-slate-200">
                      {sn.text || "(Empty sticky memo)"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-white/10">
                      <span>{sn.width || 260}&times;{sn.height || 220}px</span>
                      <span className="text-cyan-300/80 group-hover:text-cyan-200 transition-colors">Click to focus &rarr;</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Dictionary & Contextual Usage & Glass Flashcards */}
        {activeTab === 'dictionary' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 gap-3" onWheel={(e) => e.stopPropagation()}>
            {/* Search Input - Glassmorphic */}
            <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-xl px-3 py-2 flex items-center gap-2 shadow-inner">
              <BookA size={16} className="text-purple-300 shrink-0" />
              <input
                type="text"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="Search vocabulary term..."
                className="bg-transparent text-xs text-white placeholder:text-purple-200/50 outline-none w-full font-sans"
              />
              {dictQuery && (
                <button onClick={() => setDictQuery('')} className="text-slate-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Scrollable Dictionary Results & Glass Flashcards */}
            <div 
              className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Daily Flashcard Feature in Glassmorphism Theme */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/40 via-indigo-900/25 to-black/50 border border-purple-400/40 backdrop-blur-2xl shadow-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-purple-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    Daily Flash Card
                  </span>
                  <button
                    onClick={() => setFlashcardWord(getRandomWord())}
                    className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-purple-200 transition-colors flex items-center gap-1 text-[10px] font-mono border border-white/15"
                    title="Shuffle Flash Card"
                  >
                    <Shuffle size={11} />
                    <span>Next</span>
                  </button>
                </div>

                <div>
                  <h4 className="font-tomorrow font-bold text-lg text-white">
                    {flashcardWord.word}
                  </h4>
                  <span className="text-[10px] font-mono text-purple-200/80">
                    {flashcardWord.phonetic} &bull; {flashcardWord.partOfSpeech}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {flashcardWord.definition}
                </p>

                {/* Frame of Use Highlight */}
                <div className="p-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-[11px] backdrop-blur-md">
                  <span className="font-mono text-[10px] text-purple-300 uppercase block font-bold">
                    Frame of Use:
                  </span>
                  <span className="text-cyan-200 font-medium block">
                    {flashcardWord.frameOfUse}
                  </span>
                  <span className="text-slate-300 italic text-[11px] block mt-1">
                    "{flashcardWord.exampleSentence}"
                  </span>
                </div>

                <button
                  onClick={() => onAddDictionaryNode(flashcardWord.word, flashcardWord.definition, flashcardWord.frameOfUse)}
                  className="w-full py-2 rounded-xl bg-purple-600/70 hover:bg-purple-600 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg border border-purple-400/40 backdrop-blur-md transition-all cursor-pointer"
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Add Word as Node to Canvas</span>
                </button>
              </div>

              {/* Searched List of Words */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold">
                  Dictionary Terms ({searchResults.length})
                </span>

                {searchResults.map(item => (
                  <div
                    key={item.word}
                    className="p-3 rounded-2xl border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-xl transition-all flex flex-col gap-1.5 text-xs shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm font-tomorrow">
                        {item.word}
                      </span>
                      <button
                        onClick={() => onAddDictionaryNode(item.word, item.definition, item.frameOfUse)}
                        className="px-2 py-0.5 rounded bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/40 text-purple-200 font-mono text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Plus size={11} />
                        <span>Add</span>
                      </button>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed">
                      {item.definition}
                    </p>

                    <div className="text-[10px] font-mono text-cyan-300/80">
                      Frame: {item.frameOfUse}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Request: Bottom Left Corner Local Storage Sync Feature */}
        <div 
          className="p-3 border-t border-white/10 bg-[#030307]/95 backdrop-blur-xl shrink-0 mt-auto flex flex-col gap-2 select-none"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <HardDrive size={13} className="text-cyan-400" />
              <span>LOCAL STORAGE SYNC</span>
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
              <ShieldCheck size={11} />
              <span>Permission Active</span>
            </span>
          </div>

          <button
            onClick={() => {
              setIsSyncing(true);
              setSyncStatusText("Syncing from local storage...");
              if (onSyncLocalStorage) {
                onSyncLocalStorage();
              }
              setTimeout(() => {
                setIsSyncing(false);
                setSyncStatusText("Synced all nodes & workspaces!");
                setTimeout(() => setSyncStatusText(null), 3000);
              }, 600);
            }}
            disabled={isSyncing}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 hover:from-cyan-500/35 hover:via-indigo-500/35 hover:to-purple-500/35 border border-cyan-400/40 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg backdrop-blur-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Sync all nodes and workspace changes from local storage"
          >
            <RefreshCw size={13} className={`${isSyncing ? 'animate-spin text-cyan-300' : 'text-cyan-300'}`} />
            <span>{isSyncing ? 'SYNCING LOCAL DATA...' : 'SYNC FROM LOCAL STORAGE'}</span>
          </button>

          {syncStatusText && (
            <div className="text-[10px] font-mono text-center text-cyan-200 bg-cyan-950/40 border border-cyan-500/30 rounded-lg py-1 px-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span>{syncStatusText}</span>
            </div>
          )}

          <div className="text-[9px] font-mono text-slate-400/80 leading-tight">
            Key: <code className="text-cyan-300">maddys_brainvault_workspaces_v2</code> &bull; All nodes &amp; changes synced locally.
          </div>
        </div>
      </aside>
    </>
  );
};
