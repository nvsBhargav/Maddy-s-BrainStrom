import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Palette, 
  FileText, 
  Edit3, 
  Check, 
  CornerDownRight,
  Plus,
  GitBranch,
  Code2,
  Copy,
  CheckCheck,
  Minimize2,
  Maximize2,
  Link2,
  Eye,
  EyeOff
} from 'lucide-react';
import { GridNodeData } from '../types';
import { NODE_PALETTES, getPalette, PRIMARY_NODE_COLOR, SUBNODE_COLOR } from '../palettes';
import ReactMarkdown from 'react-markdown';

const Typewriter = ({ text, onExpand, nodeId }: { text: string, onExpand: (prompt: string, parentId: string) => void, nodeId: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  const processedText = (text || '').replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (match, p1, p2) => {
    return `[${p1}](${p2.replace(/\s/g, '%20')})`;
  });
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const charsPerTick = Math.max(1, Math.floor(processedText.length / 100));
    const interval = setInterval(() => {
      if (i >= processedText.length) {
        clearInterval(interval);
      } else {
        setDisplayedText(processedText.slice(0, i + charsPerTick));
        i += charsPerTick;
      }
    }, 16);
    return () => clearInterval(interval);
  }, [processedText]);

  return (
    <div className="whitespace-pre-wrap leading-relaxed text-[#0F0E47] font-sans">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <button 
              type="button"
              className="font-bold underline decoration-[#0F0E47] decoration-2 text-[#0F0E47] hover:bg-[#0F0E47]/15 rounded px-1 transition-colors mx-0.5 inline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                let promptText = props.href || "";
                if (promptText.startsWith('#')) promptText = promptText.substring(1);
                promptText = decodeURIComponent(promptText);
                
                if (Array.isArray(props.children) && typeof props.children[0] === 'string') {
                  promptText = props.children[0];
                } else if (typeof props.children === 'string') {
                  promptText = props.children;
                }
                onExpand(promptText, nodeId);
              }}
            >
              {props.children}
            </button>
          ),
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 text-[#0F0E47]" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2 text-[#0F0E47]" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-2 mb-1 text-[#0F0E47]" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0 text-[#0F0E47] leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[#0F0E47]" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[#0F0E47]" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-[#0F0E47] pl-3 my-2 italic text-[#0F0E47]/90 bg-black/5 py-1 rounded-r" {...props} />
          )
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};

const LOADING_MESSAGES = [
  "Synthesizing concept dimensions...",
  "Traversing knowledge nodes...",
  "Formatting deep explanatory matter...",
  "Mapping contextual relations...",
  "Refining structured perspectives..."
];

const FunLoader = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[300px]">
      <div className="relative h-6 w-full flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute font-mono text-xs uppercase tracking-wider text-[#0F0E47] w-full text-center font-bold"
          >
            {LOADING_MESSAGES[index]}
          </motion.div>
        </AnimatePresence>
      </div>
      <Loader2 className="w-7 h-7 animate-spin text-[#0F0E47]" />
      <span className="text-[11px] font-mono text-[#0F0E47]/80 uppercase tracking-widest font-semibold">
        AI Matter Generation in progress...
      </span>
    </div>
  );
};

const CODE_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'sql',
  'html',
  'css',
  'bash',
  'json'
];

interface NodeCardProps {
  index: number;
  node: GridNodeData;
  scale: number;
  isGlassTheme?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (nodeId: string) => void;
  onExpand: (prompt: string, parentId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onClose: (nodeId: string) => void;
  setVersion: (nodeId: string, versionIndex: number) => void;
  onUpdateColor: (nodeId: string, colorId: string) => void;
  onResize: (nodeId: string, width: number, height: number) => void;
  onSaveResize?: (nodeId: string, width: number, height: number) => void;
  onUpdateCustomNode?: (nodeId: string, prompt: string, text: string) => void;
  onRenameNode?: (nodeId: string, newTitle: string) => void;
  onUpdateCodeSnippet?: (nodeId: string, code: string, language: string) => void;
  onAddCustomNode?: (parentId?: string) => void;
  onToggleMinimize?: (nodeId: string) => void;
  onZoomToNode?: (nodeId: string, x: number, y: number, width?: number, height?: number) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  isLinkingMode?: boolean;
  isLinkingSource?: boolean;
  onStartLinking?: (nodeId: string) => void;
  onToggleHideLabel?: (nodeId: string) => void;
  onRenameSubNodePrompt?: (nodeId: string, promptIndex: number, newPrompt: string) => void;
}

const NodeCardComponent: React.FC<NodeCardProps> = ({ 
  index,
  node, 
  scale,
  isGlassTheme = true,
  isDragging = false,
  isSelected = false,
  onToggleSelect,
  onExpand, 
  onRegenerate, 
  onClose,
  setVersion,
  onUpdateColor,
  onResize,
  onSaveResize,
  onUpdateCustomNode,
  onRenameNode,
  onUpdateCodeSnippet,
  onAddCustomNode,
  onToggleMinimize,
  onZoomToNode,
  onPointerDown,
  isLinkingMode = false,
  isLinkingSource = false,
  onStartLinking,
  onToggleHideLabel,
  onRenameSubNodePrompt
}) => {
  const version = node.versions[node.versionIndex] || node;
  const isGenerating = node.status === 'generating';
  
  const isSubnode = Boolean(node.parentId || node.isCustom);
  const defaultColor = isSubnode ? SUBNODE_COLOR : PRIMARY_NODE_COLOR;
  const palette = getPalette(node.color || defaultColor);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [manualColor, setManualColor] = useState(palette.bg);
  const [isResizing, setIsResizing] = useState(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [renameText, setRenameText] = useState(node.prompt);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Sub-node prompt rename state
  const [editingSubNodeIdx, setEditingSubNodeIdx] = useState<number | null>(null);
  const [editingSubNodeText, setEditingSubNodeText] = useState('');

  // Code Block State
  const [showCodeBlock, setShowCodeBlock] = useState(Boolean(node.codeSnippet?.code));
  const [codeContent, setCodeContent] = useState(node.codeSnippet?.code || '');
  const [codeLanguage, setCodeLanguage] = useState(node.codeSnippet?.language || 'typescript');
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  useEffect(() => {
    setManualColor(palette.bg);
  }, [palette.bg]);

  useEffect(() => {
    if (node.codeSnippet?.code) {
      setCodeContent(node.codeSnippet.code);
      setCodeLanguage(node.codeSnippet.language || 'typescript');
    }
  }, [node.codeSnippet]);

  // Custom node editing state
  const [isEditing, setIsEditing] = useState(node.isCustom && !node.text);
  const [editTitle, setEditTitle] = useState(node.prompt);
  const [editText, setEditText] = useState(node.text);

  useEffect(() => {
    setEditTitle(node.prompt);
    setEditText(node.text);
  }, [node.prompt, node.text]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showColorPicker]);

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = node.width || 440;
    const startHeight = node.height || 380;
    let latestW = startWidth;
    let latestH = startHeight;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dw = (moveEvent.clientX - startX) / scale;
      const dh = (moveEvent.clientY - startY) / scale;
      latestW = Math.max(340, Math.min(1200, Math.round(startWidth + dw)));
      latestH = Math.max(260, Math.min(1400, Math.round(startHeight + dh)));
      onResize(node.id, latestW, latestH);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (onSaveResize) {
        onSaveResize(node.id, latestW, latestH);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleSaveCustomNode = () => {
    if (onUpdateCustomNode) {
      onUpdateCustomNode(node.id, editTitle.trim() || 'Untitled Note', editText);
    }
    setIsEditing(false);
  };

  const handleSaveCodeSnippet = (newCode: string, newLang: string) => {
    setCodeContent(newCode);
    setCodeLanguage(newLang);
    if (onUpdateCodeSnippet) {
      onUpdateCodeSnippet(node.id, newCode, newLang);
    }
  };

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!codeContent) return;
    await navigator.clipboard.writeText(codeContent);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  const versionText = `${index + 1}.${node.versionIndex}`;
  const cardHeight = node.height ? `${node.height}px` : 'auto';

  // Smooth subtle transition when position or size changes, disabled during active drag/resize for instant response
  const isInteracting = isDragging || isResizing;
  const nodeTransition = isInteracting 
    ? 'none' 
    : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease';

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        width: node.width || 440,
        zIndex: showColorPicker ? 9999 : 10,
        willChange: 'transform, width',
        transition: nodeTransition
      }}
      className="flex flex-col gap-2 origin-top-left group/node max-w-[95vw] relative"
    >
      {/* Node Header Toolbar ("Node Head Ear" - Enlarged, Tactile, Front-Layered Z-Index) */}
      <div 
        className="flex items-center gap-2 text-xs font-mono canvas-pen active:canvas-pen-active w-fit select-none touch-none relative z-50"
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        <div className="bg-[#0B0A33]/95 backdrop-blur-md text-slate-100 border border-indigo-400/50 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-2">
          {/* Select Node for Align / Multi-organize */}
          {onToggleSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(node.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isSelected 
                  ? 'bg-cyan-400 border-white text-[#0F0E47] shadow-sm' 
                  : 'border-white/40 hover:border-white text-transparent'
              }`}
              title={isSelected ? "Selected (Click to deselect)" : "Click to select for Align/Organize"}
            >
              <Check size={10} strokeWidth={3} />
            </button>
          )}

          {/* Node Category & Version Label */}
          <span className="font-bold text-white text-xs tracking-wide flex items-center gap-1.5 shrink-0">
            {node.isCustom ? (
              <span className="text-amber-300 flex items-center gap-1 font-bold">
                <FileText size={13} /> NOTE {versionText}
              </span>
            ) : isSubnode ? (
              <span className="text-[#CBCBCB] flex items-center gap-1 font-bold">
                <GitBranch size={13} /> SUB-NODE {versionText}
              </span>
            ) : (
              <span className="text-white flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                NODE {versionText}
              </span>
            )}
          </span>
          
          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Version controls for AI nodes */}
          {!node.isCustom && (
            <>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => setVersion(node.id, Math.max(0, node.versionIndex - 1))}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={node.versionIndex === 0}
                  className="hover:bg-indigo-900/90 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors text-slate-300 hover:text-white"
                  title="Previous Version"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="text-[10px] text-slate-300 font-mono w-5 text-center font-bold">
                  {node.versionIndex + 1}/{node.versions.length || 1}
                </span>
                <button 
                  onClick={() => setVersion(node.id, Math.min(node.versions.length - 1, node.versionIndex + 1))}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={node.versionIndex === (node.versions.length - 1)}
                  className="hover:bg-indigo-900/90 p-0.5 rounded disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors text-slate-300 hover:text-white"
                  title="Next Version"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="h-3.5 w-px bg-indigo-700/70" />
            </>
          )}

          {/* Top Menu: + NOTE button */}
          {onAddCustomNode && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAddCustomNode(node.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-[#CBCBCB] hover:bg-white text-[#0F0E47] transition-all cursor-pointer px-2.5 py-1 rounded-md font-mono font-bold flex items-center gap-1 text-xs shadow-sm shrink-0"
              title="Add a custom note branched from this topic"
            >
              <Plus size={13} strokeWidth={3} />
              <span>+ NOTE</span>
            </button>
          )}

          {/* User Request: Theme colour button popping up in front (comes first, never behind) */}
          <div className="relative" ref={colorPickerRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-amber-300 flex items-center gap-1.5 text-slate-200 transition-colors cursor-pointer px-2.5 py-1 rounded-md hover:bg-indigo-900/70 border border-indigo-500/40 text-xs font-mono font-bold shrink-0 shadow-xs"
              title="Change Node Block Color (Appears in front)"
            >
              <Palette size={13} />
              <span 
                className="w-3 h-3 rounded-full border border-black/40 inline-block shadow-xs" 
                style={{ backgroundColor: palette.bg }} 
              />
              <span>COLOR</span>
            </button>

            {/* Front-Facing Color Picker Popover with Highest z-[9999] - Visual Color Palettes (No Hex Codes) */}
            {showColorPicker && (
              <div 
                className="absolute top-full left-0 mt-2 bg-[#0A092B]/95 backdrop-blur-2xl border-2 border-indigo-400/80 rounded-2xl p-4 shadow-[0_30px_70px_rgba(0,0,0,0.95)] z-[9999] flex flex-col gap-3 min-w-[290px] text-slate-100 pointer-events-auto ring-1 ring-cyan-400/40 animate-in fade-in zoom-in-95"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-200 font-bold uppercase tracking-wider pb-2 border-b border-indigo-800">
                  <span className="flex items-center gap-1.5">
                    <Palette size={14} className="text-cyan-300" />
                    Select Card Color Palette
                  </span>
                  <button 
                    onClick={() => setShowColorPicker(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Curated Color Palettes Matrix - User Request: "Don't show me the colour code pattern... Show me the colour palettes of all colours" */}
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider font-semibold block mb-1.5">
                      Vault Core Shades
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {NODE_PALETTES.slice(0, 6).map(p => (
                        <button
                          key={p.id}
                          title={p.name}
                          onClick={() => {
                            setManualColor(p.bg);
                            onUpdateColor(node.id, p.bg);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center shadow-sm ${
                            (palette.bg.toLowerCase() === p.bg.toLowerCase()) ? 'border-cyan-300 ring-2 ring-cyan-400/80 scale-105 shadow-md' : 'border-indigo-700/60'
                          }`}
                          style={{ backgroundColor: p.bg }}
                        >
                          {palette.bg.toLowerCase() === p.bg.toLowerCase() && (
                            <Check size={14} className={p.bg === '#FFFFFF' || p.bg === '#CBCBCB' ? 'text-[#0F0E47]' : 'text-white'} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider font-semibold block mb-1.5">
                      Soft Pastels &amp; Muted
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {NODE_PALETTES.slice(6, 12).map(p => (
                        <button
                          key={p.id}
                          title={p.name}
                          onClick={() => {
                            setManualColor(p.bg);
                            onUpdateColor(node.id, p.bg);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center shadow-sm ${
                            (palette.bg.toLowerCase() === p.bg.toLowerCase()) ? 'border-cyan-300 ring-2 ring-cyan-400/80 scale-105 shadow-md' : 'border-indigo-700/60'
                          }`}
                          style={{ backgroundColor: p.bg }}
                        >
                          {palette.bg.toLowerCase() === p.bg.toLowerCase() && (
                            <Check size={14} className="text-[#0F0E47]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider font-semibold block mb-1.5">
                      Vibrant &amp; Sleek Deep Tones
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        ...NODE_PALETTES.slice(12),
                        { id: 'ruby', name: 'Ruby Wine', bg: '#F43F5E' },
                        { id: 'violet', name: 'Cosmic Violet', bg: '#8B5CF6' },
                        { id: 'teal', name: 'Teal Tide', bg: '#14B8A6' },
                        { id: 'gold', name: 'Sun Gold', bg: '#F59E0B' }
                      ].slice(0, 6).map(p => (
                        <button
                          key={p.id}
                          title={p.name}
                          onClick={() => {
                            setManualColor(p.bg);
                            onUpdateColor(node.id, p.bg);
                            setShowColorPicker(false);
                          }}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center shadow-sm ${
                            (palette.bg.toLowerCase() === p.bg.toLowerCase()) ? 'border-cyan-300 ring-2 ring-cyan-400/80 scale-105 shadow-md' : 'border-indigo-700/60'
                          }`}
                          style={{ backgroundColor: p.bg }}
                        >
                          {palette.bg.toLowerCase() === p.bg.toLowerCase() && (
                            <Check size={14} className="text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Palette Color Swatch without text codes */}
                  <div className="pt-2 border-t border-indigo-900/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-300">Custom Palette Swatch:</span>
                    <input
                      type="color"
                      value={manualColor.startsWith('#') ? manualColor : '#8686AC'}
                      onChange={(e) => {
                        setManualColor(e.target.value);
                        onUpdateColor(node.id, e.target.value);
                      }}
                      className="w-10 h-7 rounded-lg border border-indigo-400 cursor-pointer bg-transparent"
                      title="Pick any color visually"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* User Request: Code block insert option on every node */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCodeBlock(!showCodeBlock);
              if (!codeContent && !showCodeBlock) {
                const starter = `// Code snippet for ${node.prompt}\nfunction processTopic() {\n  return "Spatial knowledge architecture";\n}`;
                handleSaveCodeSnippet(starter, 'typescript');
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 ${
              showCodeBlock 
                ? 'bg-amber-400 text-[#0F0E47] shadow-sm' 
                : 'hover:bg-indigo-900/60 text-slate-200 border border-indigo-500/40'
            }`}
            title="Insert Code Block in Node"
          >
            <Code2 size={13} />
            <span>CODE</span>
          </button>

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Relationship Link Tool Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartLinking?.(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 border ${
              isLinkingSource
                ? 'bg-cyan-400 text-[#0F0E47] border-white animate-pulse'
                : 'hover:bg-indigo-900/60 text-cyan-300 border-cyan-500/40 bg-cyan-950/40'
            }`}
            title="Relationship Line Tool: Click to connect to another node"
          >
            <Link2 size={13} />
            <span>LINK</span>
          </button>

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Toggle Label Visibility Button */}
          {onToggleHideLabel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHideLabel(node.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`hover:text-cyan-300 transition-colors cursor-pointer px-2.5 py-1 rounded-md text-xs font-mono font-bold border shrink-0 flex items-center gap-1 ${
                node.isLabelHidden
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : 'hover:bg-indigo-900/60 text-slate-300 border-indigo-500/30'
              }`}
              title={node.isLabelHidden ? "Show Node Label" : "Hide Node Label"}
            >
              {node.isLabelHidden ? <EyeOff size={13} /> : <Eye size={13} />}
              <span className="hidden sm:inline">{node.isLabelHidden ? 'SHOW' : 'LABEL'}</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Edit Custom Note Toggle */}
          {node.isCustom ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (isEditing) {
                  handleSaveCustomNode();
                } else {
                  setIsEditing(true);
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-emerald-400 flex items-center gap-1 text-slate-200 transition-colors cursor-pointer px-2.5 py-1 rounded-md hover:bg-indigo-900/60 text-xs font-mono font-bold shrink-0 border border-indigo-500/30"
              title={isEditing ? "Save Note Details" : "Edit Note Details"}
            >
              {isEditing ? <Check size={13} className="text-emerald-400" /> : <Edit3 size={13} />}
              <span>{isEditing ? 'DONE' : 'EDIT'}</span>
            </button>
          ) : (
            <button 
              onClick={() => onRegenerate(node.id)}
              onPointerDown={(e) => e.stopPropagation()}
              className="hover:text-cyan-300 transition-colors cursor-pointer px-2 py-1 text-slate-300 hover:bg-indigo-900/60 rounded-md shrink-0 flex items-center gap-1 text-xs font-mono font-bold border border-indigo-500/30"
              title="Regenerate with AI"
            >
              <Sparkles size={13} />
              <span>REGEN</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Minimize / Maximize Button */}
          {onToggleMinimize && <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleMinimize(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-amber-300 transition-colors cursor-pointer p-1 text-slate-300 hover:bg-indigo-900/60 rounded shrink-0"
            title={node.isMinimized ? "Maximize Node Card" : "Minimize Node Card - Collapsed"}
          >
            {node.isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>}

          <div className="h-3.5 w-px bg-indigo-700/70" />

          {/* Delete Node */}
          <button 
            onClick={() => onClose(node.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:text-rose-400 transition-colors cursor-pointer p-1 text-slate-400 hover:bg-indigo-900/60 rounded shrink-0"
            title="Delete Node"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Node Card Body: Refined Glassmorphism with Smooth Height Transition */}
      <div 
        className={`flex flex-col border-2 rounded-xl relative z-10 overflow-hidden backdrop-blur-2xl shadow-[0_16px_36px_rgba(0,0,0,0.45)] transition-shadow ${
          isSelected ? 'ring-4 ring-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.55)]' : 'ring-1 ring-white/30'
        }`}
        style={{
          backgroundColor: `${palette.bg}E0`,
          borderColor: 'rgba(255, 255, 255, 0.4)',
          color: palette.textColor,
          height: cardHeight,
          minHeight: '280px',
          transition: isInteracting ? 'none' : 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease'
        }}
        onPointerDown={(e) => onPointerDown?.(e)}
      >
        {/* Top accent line */}
        <div 
          className="h-1.5 w-full shrink-0" 
          style={{ backgroundColor: palette.accent, opacity: 0.85 }} 
        />

        {node.status === 'error' ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[280px]">
            <div className="w-10 h-10 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center mb-1">
              <X size={20} />
            </div>
            <div className="font-mono text-xs uppercase tracking-wider text-rose-800 font-bold">
              GENERATION_FAULT
            </div>
            <div className="text-xs text-[#0F0E47] max-w-xs leading-relaxed">
              Unable to generate text for this concept. Click retry to regenerate.
            </div>
            <button 
              onClick={() => onRegenerate(node.id)}
              className="mt-2 text-xs font-mono font-bold bg-[#0F0E47] text-white px-3 py-1.5 rounded hover:bg-[#1a1966] transition-colors cursor-pointer"
            >
              RETRY GENERATION
            </button>
          </div>
        ) : isGenerating ? (
          <FunLoader />
        ) : (
          <div className="flex flex-col flex-1 min-h-0 p-5 overflow-hidden">
            {/* Header: Toggleable Label Title */}
            {!node.isLabelHidden && (
              <div className="shrink-0 mb-3 pb-2.5 border-b border-[#0F0E47]/20 flex items-start justify-between gap-3">
              {isEditing ? (
                <div className="w-full flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#0F0E47] font-bold">
                      Topic Title / Header
                    </label>
                    <span className="text-[10px] font-mono text-[#0F0E47]/70">Custom Note</span>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter topic or extra details title..."
                    className="w-full text-base font-bold bg-white/90 border border-[#0F0E47]/40 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F0E47] text-[#0F0E47]"
                    onPointerDown={(e) => e.stopPropagation()}
                    autoFocus
                  />
                </div>
              ) : isRenamingTitle ? (
                <div className="flex-1 flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (renameText.trim()) {
                          onRenameNode?.(node.id, renameText.trim());
                        }
                        setIsRenamingTitle(false);
                      } else if (e.key === 'Escape') {
                        setRenameText(node.prompt);
                        setIsRenamingTitle(false);
                      }
                    }}
                    autoFocus
                    className="flex-1 text-sm md:text-base font-bold bg-white/95 border-2 border-[#0F0E47] rounded-lg px-2.5 py-1 text-[#0F0E47] outline-none shadow-sm font-sans"
                  />
                  <button
                    onClick={() => {
                      if (renameText.trim()) {
                        onRenameNode?.(node.id, renameText.trim());
                      }
                      setIsRenamingTitle(false);
                    }}
                    className="p-1.5 rounded-lg bg-[#0F0E47] text-white hover:bg-indigo-900 cursor-pointer shadow-xs"
                    title="Save Node Name"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setRenameText(node.prompt);
                      setIsRenamingTitle(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-300 text-slate-700 hover:bg-slate-400 cursor-pointer"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-start justify-between gap-2 group/title">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 
                        onDoubleClick={() => {
                          setRenameText(node.prompt);
                          setIsRenamingTitle(true);
                        }}
                        className="font-bold text-lg md:text-xl leading-tight uppercase tracking-tight text-[#0F0E47] font-sans cursor-text"
                        title="Double-click to rename node name"
                      >
                        {node.prompt}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameText(node.prompt);
                          setIsRenamingTitle(true);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-40 hover:opacity-100 p-1 rounded hover:bg-black/10 text-[#0F0E47] transition-all cursor-pointer shrink-0"
                        title="Rename Node Name"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                    {node.parentId && (
                      <div className="text-[10px] font-mono text-[#0F0E47]/75 mt-1 flex items-center gap-1 font-semibold">
                        <span>SUB-NODE &bull; BRANCHED FROM PARENT</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Matter Content: Full scrollable text area for reading */}
            <div 
              className="flex-1 min-h-0 overflow-y-auto custom-scrollbar text-sm leading-relaxed cursor-text selection:bg-amber-200/80 pr-1"
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={() => {
                if (node.isCustom) setIsEditing(true);
              }}
            >
              {isEditing ? (
                <div className="flex flex-col h-full gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#0F0E47] font-bold">
                      Notes &amp; Markdown
                    </label>
                    <span className="text-[10px] font-mono text-[#0F0E47]/70">Auto-saved</span>
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Write your research notes, findings, formulas, or markdown here..."
                    className="w-full flex-1 min-h-[140px] text-sm bg-white/95 border border-[#0F0E47]/30 rounded-lg p-3 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0F0E47] text-[#0F0E47] resize-none"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={handleSaveCustomNode}
                      className="px-3.5 py-1.5 bg-[#0F0E47] text-white rounded-lg text-xs font-mono font-bold hover:bg-[#1a1966] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={13} />
                      <span>SAVE DETAILS</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {node.isCustom ? (
                    node.text ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-[#0F0E47] font-sans">
                        <ReactMarkdown>{node.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setIsEditing(true)}
                        className="p-5 border-2 border-dashed border-[#0F0E47]/40 rounded-xl text-center text-[#0F0E47]/80 hover:bg-black/5 transition-colors cursor-pointer"
                      >
                        <p className="font-mono text-xs font-bold uppercase tracking-wider mb-1">
                          Empty Custom Note
                        </p>
                        <p className="text-xs">
                          Click here to write notes, formulas, or documentation.
                        </p>
                      </div>
                    )
                  ) : (
                    <Typewriter 
                      text={version.text} 
                      onExpand={onExpand} 
                      nodeId={node.id} 
                    />
                  )}

                  {/* Inserted Code Block Section */}
                  {showCodeBlock && (
                    <div 
                      className="mt-3 rounded-xl overflow-hidden border border-indigo-950/60 bg-[#080724] text-slate-200 shadow-md"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {/* Code Header Bar */}
                      <div className="px-3 py-1.5 bg-[#05041A] border-b border-indigo-900/60 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <Code2 size={13} className="text-amber-400" />
                          <select
                            value={codeLanguage}
                            onChange={(e) => handleSaveCodeSnippet(codeContent, e.target.value)}
                            className="bg-[#100E3D] text-indigo-200 border border-indigo-600/40 rounded px-2 py-0.5 text-[11px] font-bold outline-none cursor-pointer"
                          >
                            {CODE_LANGUAGES.map(lang => (
                              <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyCode}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {isCopiedCode ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{isCopiedCode ? 'COPIED' : 'COPY'}</span>
                          </button>
                          <button
                            onClick={() => setShowCodeBlock(false)}
                            className="p-0.5 hover:text-rose-400 text-slate-400 transition-colors"
                            title="Hide Code Block"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Code Editor Textarea */}
                      <div className="p-3">
                        <textarea
                          value={codeContent}
                          onChange={(e) => handleSaveCodeSnippet(e.target.value, codeLanguage)}
                          placeholder="// Type or paste your code snippet here..."
                          className="w-full min-h-[110px] bg-transparent text-xs font-mono text-cyan-200 leading-relaxed outline-none resize-y selection:bg-indigo-600/60"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Footer: Stats & Dynamic Resize Grip Handle */}
            <div className="mt-3 pt-2.5 border-t border-[#0F0E47]/20 flex items-center justify-between text-[11px] font-mono text-[#0F0E47]/80 shrink-0">
              <span className="font-semibold uppercase tracking-wider">
                {version.text ? `${version.text.length} chars` : '0 chars'} &bull; {node.width || 440}&times;{node.height || 380}
              </span>

              {/* Dynamic Resize Handle on EVERY Node (Saves to local disc) */}
              <div 
                className="w-7 h-7 flex items-center justify-center cursor-se-resize bg-black/15 hover:bg-black/30 text-[#0F0E47] p-1.5 rounded-tl-xl transition-all group/resize border-t border-l border-black/20 shadow-sm"
                onPointerDown={handleResizePointerDown}
                title="Drag to dynamically resize node and persist changes to local disc"
              >
                <CornerDownRight size={15} className="group-hover/resize:scale-125 transition-transform" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Sub-Nodes Side-tray */}
      <AnimatePresence>
        {!isGenerating && version.prompts && version.prompts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.15 } }}
            className="absolute left-full bottom-2 ml-[24px] flex flex-col gap-2.5 w-64 select-none z-20"
          >
            {version.prompts.map((prompt: string, idx: number) => (
              <div key={idx} className="relative group/prompt">
                <div className="absolute top-1/2 right-full w-[24px] h-[2px] bg-[#CBCBCB]/70" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(prompt, node.id);
                  }}
                  className="w-full relative bg-[#CBCBCB] hover:bg-white text-[#0F0E47] border border-[#0F0E47]/40 p-2.5 text-left rounded-lg shadow-md hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all text-xs font-semibold cursor-pointer block leading-snug group-hover/prompt:shadow-lg"
                >
                  <span className="text-[10px] font-mono text-[#0F0E47]/70 uppercase tracking-widest block mb-0.5 font-bold">
                    Sub-Node Branch
                  </span>
                  {prompt}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const NodeCard = React.memo(NodeCardComponent);
