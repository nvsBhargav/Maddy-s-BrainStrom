import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  BookOpen, 
  Search, 
  FileCode, 
  HardDrive, 
  CheckCircle2, 
  Sparkles,
  ExternalLink,
  AlertCircle,
  FileCheck,
  Eye,
  Layers
} from 'lucide-react';
import { GridNodeData, StickyNoteData } from '../types';
import { 
  generateMarkdown, 
  generatePlainText, 
  downloadFile,
  downloadPdfFile,
  downloadWordDoc,
  downloadWordDocx,
  generatePdfBlobUrl
} from '../exportUtils';
import ReactMarkdown from 'react-markdown';

interface ReaderAndExportModalProps {
  nodes: GridNodeData[];
  workspaceName?: string;
  stickyNotes?: StickyNoteData[];
  isOpen: boolean;
  initialTab?: 'reader' | 'export' | 'pdf';
  onClose: () => void;
  onImportNodes?: (nodes: GridNodeData[]) => void;
}

export const ReaderAndExportModal: React.FC<ReaderAndExportModalProps> = ({
  nodes,
  workspaceName = 'Current Workspace',
  stickyNotes = [],
  isOpen,
  initialTab = 'reader',
  onClose,
  onImportNodes
}) => {
  const [activeTab, setActiveTab] = useState<'reader' | 'export' | 'pdf'>('reader');
  const [filterType, setFilterType] = useState<'all' | 'topics' | 'notes'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'pdf') {
      try {
        setPdfGenerating(true);
        const url = generatePdfBlobUrl(nodes, workspaceName, stickyNotes);
        setPdfBlobUrl(url);
      } catch (err) {
        console.warn('PDF preview error:', err);
      } finally {
        setPdfGenerating(false);
      }
    }
  }, [isOpen, activeTab, nodes, workspaceName, stickyNotes]);

  if (!isOpen) return null;

  const filteredNodes = nodes.filter(node => {
    if (filterType === 'topics' && node.isCustom) return false;
    if (filterType === 'notes' && !node.isCustom) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const version = node.versions[node.versionIndex] || node;
      return node.prompt.toLowerCase().includes(q) || (version.text || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleDownloadPdf = () => {
    downloadPdfFile(nodes, workspaceName, stickyNotes);
  };

  const handleDownloadDoc = () => {
    downloadWordDoc(nodes, workspaceName, stickyNotes);
  };

  const handleDownloadDocx = () => {
    downloadWordDocx(nodes, workspaceName, stickyNotes);
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch {}
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown(nodes);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(md, `maddys-brainvault-${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}.md`, 'text/markdown;charset=utf-8');
  };

  const handleDownloadText = () => {
    const txt = generatePlainText(nodes);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(txt, `maddys-brainvault-${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateStr}.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(nodes, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(jsonStr, `maddys-brainvault-${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-backup-${dateStr}.json`, 'application/json');
  };

  const handleCopyAll = async () => {
    const md = generateMarkdown(nodes);
    await navigator.clipboard.writeText(md);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && onImportNodes) {
          onImportNodes(parsed);
          onClose();
        } else {
          setImportError('Invalid backup JSON file format.');
        }
      } catch (err) {
        setImportError('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportTextOrMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const importedNodes: GridNodeData[] = [];
        let parentId: string | undefined = undefined;
        let parentX = 0;
        let parentY = 100;

        lines.forEach((line, idx) => {
          let title = line;
          if (line.startsWith('# ')) {
            title = line.replace('# ', '');
          } else if (line.startsWith('## ')) {
            title = line.replace('## ', '');
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            title = line.replace(/^[-*]\s+/, '');
          }

          const isHeader = line.startsWith('#') || idx === 0 || idx % 5 === 0;
          if (isHeader) {
            parentId = `node-import-${Date.now()}-${idx}`;
            parentX = (importedNodes.length * 480) % 3000;
            parentY = Math.floor(idx / 6) * 450 + 100;
          }

          const newNode: GridNodeData = {
            id: `node-import-${Date.now()}-${idx}`,
            x: isHeader ? parentX : parentX + 460 + ((idx % 2) * 40),
            y: isHeader ? parentY : parentY + ((idx % 3) * 120),
            width: 440,
            height: 380,
            color: isHeader ? '#8686AC' : '#CBCBCB',
            isCustom: true,
            prompt: title.slice(0, 50),
            text: title,
            prompts: [],
            status: 'ready',
            versionIndex: 0,
            versions: [{ prompt: title.slice(0, 50), text: title, prompts: [] }],
            parentId: isHeader ? undefined : parentId
          };
          importedNodes.push(newNode);
        });

        if (importedNodes.length > 0 && onImportNodes) {
          onImportNodes(importedNodes);
          onClose();
        }
      } catch (err) {
        setImportError('Failed to parse uploaded document file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 no-print"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        onWheel={(e) => e.stopPropagation()}
        className="bg-[#030307]/95 backdrop-blur-2xl border border-white/20 w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#8686AC] text-[#0F0E47] flex items-center justify-center font-bold shadow-md shrink-0">
              {activeTab === 'pdf' ? <Printer size={18} /> : <BookOpen size={18} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>Maddy's BrainVault</span>
                <span className="text-cyan-300 text-xs px-2 py-0.5 rounded-full bg-cyan-900/50 border border-cyan-400/40 font-mono">
                  {workspaceName}
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                {nodes.length} nodes &bull; {stickyNotes.length} sticky memos &bull; Only selected workspace data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick PDF Download */}
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Download formatted PDF file"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download .PDF</span>
            </button>

            {/* Quick Print/PDF Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#CBCBCB] hover:bg-white text-[#0F0E47] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Print or Save via Browser Dialog"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print Dialog</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selector & Controls */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-indigo-950 bg-[#161452] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#0F0E47] p-1 rounded-xl border border-indigo-900/50">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pdf'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Printer size={13} />
              <span>PDF &amp; DOC EXPORT</span>
            </button>
            <button
              onClick={() => setActiveTab('reader')}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'reader'
                  ? 'bg-[#8686AC] text-[#0F0E47]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen size={13} />
              <span>READ MATTER ({nodes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-[#8686AC] text-[#0F0E47]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download size={13} />
              <span>OTHER FORMATS</span>
            </button>
          </div>

          {activeTab === 'reader' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 text-[11px] font-mono bg-[#0F0E47] p-1 rounded-lg border border-indigo-900/40">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'all' ? 'bg-[#CBCBCB] text-[#0F0E47] font-bold' : 'text-slate-400'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('topics')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'topics' ? 'bg-[#8686AC] text-[#0F0E47] font-bold' : 'text-slate-400'}`}
                >
                  Topics
                </button>
                <button
                  onClick={() => setFilterType('notes')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'notes' ? 'bg-[#CBCBCB] text-[#0F0E47] font-bold' : 'text-slate-400'}`}
                >
                  Notes
                </button>
              </div>

              <div className="relative flex-1 sm:w-48">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter text..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#0F0E47] border border-indigo-900 text-xs rounded-lg pl-7 pr-2.5 py-1.5 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-[#0C0B3A]">
          
          {/* TAB 1: PDF & DOC EXPORT WITH LIVE PREVIEW */}
          {activeTab === 'pdf' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Workspace Export Scope Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/40 flex items-center justify-center shrink-0">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>Exporting Selected Workspace:</span>
                      <span className="text-cyan-300 font-mono underline decoration-cyan-400/50">
                        {workspaceName}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      Only items from this workspace will be included: {nodes.length} topics &bull; {stickyNotes.length} sticky memos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Download size={14} />
                    <span>Download .PDF</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Printer size={14} />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Download Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. PDF File (.pdf) */}
                <div className="p-4 rounded-xl bg-[#14124a] border border-purple-500/50 flex flex-col justify-between gap-3 hover:border-purple-400 transition-all shadow-md group">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold mb-2">
                      <FileCheck size={18} />
                    </div>
                    <h5 className="font-bold text-white text-sm">Download PDF (.pdf)</h5>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Generates a multi-page PDF document with Table of Contents, headings, matter, and memos.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPdf}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Save .PDF File</span>
                  </button>
                </div>

                {/* 2. Word Doc (.doc) */}
                <div className="p-4 rounded-xl bg-[#14124a] border border-blue-500/50 flex flex-col justify-between gap-3 hover:border-blue-400 transition-all shadow-md group">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold mb-2">
                      <FileText size={18} />
                    </div>
                    <h5 className="font-bold text-white text-sm">Download Word (.doc)</h5>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Microsoft Word formatted document compatible with MS Word, Google Docs, LibreOffice, and Pages.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadDoc}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Save .DOC File</span>
                  </button>
                </div>

                {/* 3. Word Docx (.docx) */}
                <div className="p-4 rounded-xl bg-[#14124a] border border-cyan-500/50 flex flex-col justify-between gap-3 hover:border-cyan-400 transition-all shadow-md group">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold mb-2">
                      <FileText size={18} />
                    </div>
                    <h5 className="font-bold text-white text-sm">Download Word (.docx)</h5>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Modern Office OpenXML format for Microsoft Word, Office 365, and modern word processors.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadDocx}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Download size={13} />
                    <span>Save .DOCX File</span>
                  </button>
                </div>
              </div>

              {/* Document Preview Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#110F3E] border border-white/15 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-purple-300" />
                    <span className="font-bold text-sm text-white font-tomorrow uppercase tracking-wider">
                      Selected Workspace Document Preview
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {nodes.length} Sections
                  </span>
                </div>

                {/* In-app Document Viewer */}
                <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-8 max-h-[500px] overflow-y-auto custom-scrollbar shadow-inner space-y-6">
                  {/* Document Cover */}
                  <div className="border-b-2 border-[#0F0E47] pb-4">
                    <h1 className="text-2xl font-bold text-[#0F0E47] tracking-tight m-0">
                      Maddy's BrainVault
                    </h1>
                    <div className="text-xs text-slate-600 font-mono mt-1 flex flex-wrap gap-2">
                      <span className="font-bold text-[#0F0E47]">Workspace: {workspaceName}</span>
                      <span>&bull;</span>
                      <span>Topics: {nodes.length}</span>
                      <span>&bull;</span>
                      <span>Sticky Memos: {stickyNotes.length}</span>
                    </div>
                  </div>

                  {/* Table of contents */}
                  {nodes.length > 0 && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs font-mono font-bold text-[#0F0E47] uppercase tracking-wider mb-2">
                        Table of Contents
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                        {nodes.map((node, i) => (
                          <div key={node.id} className="flex justify-between items-center gap-2">
                            <span className="truncate">
                              <strong className="text-[#0F0E47]">{i + 1}.</strong> {node.prompt}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 uppercase shrink-0">
                              {node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sticky Notes */}
                  {stickyNotes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
                        Sticky Memos ({stickyNotes.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stickyNotes.map((sticky, idx) => (
                          <div key={sticky.id} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-slate-800">
                            <div className="font-bold text-amber-800 text-[10px] font-mono mb-1">
                              MEMO #{idx + 1}
                            </div>
                            <div className="whitespace-pre-wrap">{sticky.text || '(Empty memo)'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Node sections */}
                  {nodes.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 font-mono text-sm">
                      No nodes currently in this workspace. Create notes or search topics to generate matter.
                    </p>
                  ) : (
                    nodes.map((node, idx) => {
                      const version = node.versions[node.versionIndex] || node;
                      const parent = nodes.find(p => p.id === node.parentId);
                      const isSub = Boolean(node.parentId || node.isCustom);
                      const borderColor = node.isCustom ? '#9E9E9E' : isSub ? '#CBCBCB' : '#8686AC';

                      return (
                        <article key={node.id} className="border-l-4 pl-4 py-1" style={{ borderColor }}>
                          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
                            {node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node'} #{idx + 1}
                            {parent && <span className="ml-2">&bull; Linked to: {parent.prompt}</span>}
                          </div>
                          <h3 className="text-base font-bold text-[#0F0E47] mb-2">
                            {node.prompt}
                          </h3>
                          <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
                            {version.text || 'No additional text recorded.'}
                          </div>

                          {node.codeSnippet?.code && (
                            <div className="mt-2.5 p-2 rounded bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                              <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                                Code Snippet ({node.codeSnippet.language})
                              </div>
                              <pre>{node.codeSnippet.code}</pre>
                            </div>
                          )}

                          {version.prompts && version.prompts.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                                Exploration Branches:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {version.prompts.map((p, pIdx) => (
                                  <span key={pIdx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: READER */}
          {activeTab === 'reader' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {filteredNodes.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-base font-mono">No nodes match your filter or search.</p>
                </div>
              ) : (
                filteredNodes.map((node, idx) => {
                  const version = node.versions[node.versionIndex] || node;
                  const parent = nodes.find(p => p.id === node.parentId);
                  const isSub = Boolean(node.parentId || node.isCustom);
                  const cardBg = isSub ? '#CBCBCB' : '#8686AC';
                  const label = node.isCustom ? 'EXTRA DETAILS NOTE' : (node.parentId ? 'SUB-NODE TOPIC' : 'PRIMARY TOPIC');

                  return (
                    <article
                      key={node.id}
                      className="rounded-xl border-2 shadow-lg overflow-hidden transition-all text-[#0F0E47]"
                      style={{
                        backgroundColor: cardBg,
                        borderColor: isSub ? '#9E9E9E' : '#5C5C85'
                      }}
                    >
                      <div className="px-5 py-3.5 border-b border-black/10 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#0F0E47] text-white">
                              {label} #{idx + 1}
                            </span>
                            {parent && (
                              <span className="text-[11px] font-mono text-slate-800 font-semibold">
                                &larr; Linked to: {parent.prompt}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-[#0F0E47] leading-tight">
                            {node.prompt}
                          </h3>
                        </div>
                      </div>

                      <div className="p-5 text-sm md:text-base leading-relaxed font-sans text-slate-900">
                        {version.text ? (
                          <div className="whitespace-pre-wrap">
                            <ReactMarkdown
                              components={{
                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-2 mb-1 text-[#0F0E47]" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-2 mb-1 text-[#0F0E47]" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed text-slate-900" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-900" {...props} />,
                                a: ({ node, ...props }) => (
                                  <span className="font-bold underline text-[#0F0E47] decoration-2">
                                    {props.children}
                                  </span>
                                )
                              }}
                            >
                              {version.text}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-slate-600 italic">No notes written yet.</p>
                        )}

                        {version.prompts && version.prompts.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-black/10">
                            <span className="text-[11px] font-mono uppercase font-bold text-slate-700 block mb-1.5">
                              Exploration Branches:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {version.prompts.map((p, i) => (
                                <span 
                                  key={i}
                                  className="text-xs bg-[#0F0E47] text-white px-2.5 py-1 rounded font-medium"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: OTHER FORMATS */}
          {activeTab === 'export' && (
            <div className="max-w-2xl mx-auto space-y-6 py-4">
              <div className="p-5 rounded-xl bg-[#14124a] border border-indigo-700/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Saved on Local Machine</h4>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      Your {nodes.length} nodes, custom details, and canvas coordinates are continuously auto-saved.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] font-bold shrink-0">
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Markdown File (.md) */}
                <div className="p-5 rounded-xl bg-[#14124a] border border-indigo-800/80 flex flex-col justify-between gap-4 hover:border-indigo-500 transition-colors">
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-[#8686AC] text-[#0F0E47] flex items-center justify-center font-bold mb-3">
                      <FileText size={18} />
                    </div>
                    <h4 className="font-bold text-white text-base">Markdown (.md)</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      Exports complete structured markdown with Table of Contents, headings, links, and notes. Perfect for Obsidian or Notion.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex-1 py-2.5 bg-[#8686AC] hover:bg-[#9797bd] text-[#0F0E47] font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download .md</span>
                    </button>
                    <label className="py-2.5 px-3 bg-indigo-900/60 hover:bg-indigo-800 text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors border border-indigo-700/50 cursor-pointer" title="Import .md file to create nodes & sub-nodes">
                      <span>Import</span>
                      <input type="file" accept=".md" onChange={handleImportTextOrMarkdown} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Plain Text File (.txt) */}
                <div className="p-5 rounded-xl bg-[#14124a] border border-indigo-800/80 flex flex-col justify-between gap-4 hover:border-indigo-500 transition-colors">
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-indigo-900 text-cyan-300 flex items-center justify-center font-bold mb-3">
                      <FileCode size={18} />
                    </div>
                    <h4 className="font-bold text-white text-base">Plain Text (.txt)</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      A human-readable transcript formatted with ASCII dividers, ready to read in any text editor.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadText}
                      className="flex-1 py-2.5 bg-indigo-800/80 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download .txt</span>
                    </button>
                    <label className="py-2.5 px-3 bg-indigo-900/60 hover:bg-indigo-800 text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors border border-indigo-700/50 cursor-pointer" title="Import .txt file to create nodes & sub-nodes">
                      <span>Import</span>
                      <input type="file" accept=".txt" onChange={handleImportTextOrMarkdown} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Canvas Backup (.json) */}
                <div className="p-5 rounded-xl bg-[#14124a] border border-indigo-800/80 flex flex-col justify-between gap-4 hover:border-indigo-500 transition-colors sm:col-span-2">
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold mb-3">
                      <HardDrive size={18} />
                    </div>
                    <h4 className="font-bold text-white text-base">Canvas Backup (.json)</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      Full structured backup with node positions, colors, notes, and connections. Can be re-imported anytime.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadJSON}
                        className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download size={14} />
                        <span>Backup JSON</span>
                      </button>
                      <label className="py-2.5 px-4 bg-indigo-900/60 hover:bg-indigo-800 text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-indigo-700/50 cursor-pointer">
                        <span>Import Backup</span>
                        <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                      </label>
                    </div>
                    {importError && (
                      <span className="text-[11px] font-mono text-rose-300 flex items-center gap-1">
                        <AlertCircle size={12} /> {importError}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Copy to Clipboard Bar */}
              <div className="p-4 rounded-xl bg-[#14124a] border border-indigo-900/60 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono">
                  Quick copy formatted markdown to clipboard:
                </span>
                <button
                  onClick={handleCopyAll}
                  className="px-4 py-2 bg-indigo-900/80 hover:bg-indigo-800 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {copiedStatus ? <CheckCircle2 size={14} className="text-emerald-400" /> : <FileText size={14} />}
                  <span>{copiedStatus ? 'COPIED TO CLIPBOARD' : 'COPY ALL TEXT'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-indigo-950 bg-[#0F0E47] flex items-center justify-between text-xs font-mono text-slate-400">
          <span>MADDY'S BRAINVAULT &bull; Workspace: {workspaceName} &bull; {nodes.length} nodes</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-white transition-colors font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

