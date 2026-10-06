import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Play, 
  Sparkles, 
  RotateCcw, 
  RotateCw, 
  Plus, 
  Compass, 
  BookOpen, 
  Printer, 
  AlertTriangle, 
  Check, 
  X, 
  Layers, 
  Palette,
  CheckCircle2,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  Grid as GridIcon,
  StickyNote as StickyNoteIcon
} from 'lucide-react';
import { GridNodeData, WorkspaceData, StickyNoteData } from './types';
import { NodeCard } from './components/NodeCard';
import { StickyNoteCard } from './components/StickyNoteCard';
import { ConnectingLines } from './components/ConnectingLines';
import { Minimap } from './components/Minimap';
import { ReaderAndExportModal } from './components/ReaderAndExportModal';
import { PrintDossier } from './components/PrintDossier';
import { LeftSidebar } from './components/LeftSidebar';
import { NodesDropdown } from './components/NodesDropdown';
import { 
  PRIMARY_NODE_COLOR, 
  SUBNODE_COLOR, 
  WORKSPACE_THEMES, 
  getPalette,
  getWorkspacePrimaryNodeColor 
} from './palettes';
import { downloadFile } from './exportUtils';

const DEFAULT_NODE_WIDTH = 440;
const DEFAULT_NODE_HEIGHT = 420;

export default function App() {
  // Vault Branding (Fixed title, redirects to home on click)
  const vaultTitle = "Maddy's BrainVault";
  const vaultSubtitle = "SPATIAL KNOWLEDGE ENGINE";

  // Glassmorphism Theme (Permanently active as requested: "keep only glass morphology. Remove the solid material")
  const isGlassTheme = true;

  // Workspaces State
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(() => {
    try {
      const saved = localStorage.getItem('maddys_brainvault_workspaces_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const oldNodes = localStorage.getItem('maddys_brainvault_nodes_v1');
      const initialNodes = oldNodes ? JSON.parse(oldNodes) : [];
      return [
        {
          id: 'ws-default',
          name: "Main Research Space",
          themeId: 'deep-cobalt',
          bgDarkColor: '#0F0E47',
          nodes: Array.isArray(initialNodes) ? initialNodes : [],
          stickyNotes: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
    } catch (e) {
      console.warn('Failed to load workspaces', e);
      return [
        {
          id: 'ws-default',
          name: "Main Research Space",
          themeId: 'deep-cobalt',
          bgDarkColor: '#0F0E47',
          nodes: [],
          stickyNotes: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
    }
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    try {
      return localStorage.getItem('maddys_brainvault_active_ws_v2') || workspaces[0]?.id || 'ws-default';
    } catch {
      return 'ws-default';
    }
  });

  // Active workspace object & its nodes/stickies
  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  const nodes = activeWorkspace?.nodes || [];
  const stickyNotes = activeWorkspace?.stickyNotes || [];
  const links = activeWorkspace?.links || [];

  const [undoStack, setUndoStack] = useState<GridNodeData[][]>([]);
  const [redoStack, setRedoStack] = useState<GridNodeData[][]>([]);

  // Helper to update current workspace's nodes with undo history recording
  const setNodes = useCallback((updater: GridNodeData[] | ((prev: GridNodeData[]) => GridNodeData[])) => {
    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(ws => {
        if (ws.id === activeWorkspaceId) {
          const currentNodes = ws.nodes;
          const newNodes = typeof updater === 'function' ? updater(currentNodes) : updater;
          if (JSON.stringify(currentNodes) !== JSON.stringify(newNodes)) {
            setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentNodes))]);
            setRedoStack([]);
          }
          return { ...ws, nodes: newNodes, updatedAt: Date.now() };
        }
        return ws;
      });
    });
  }, [activeWorkspaceId]);

  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);

  const setLinks = useCallback((updater: WorkspaceData['links'] | ((prev: WorkspaceData['links']) => WorkspaceData['links'])) => {
    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(ws => {
        if (ws.id === activeWorkspaceId) {
          const currentLinks = ws.links || [];
          const newLinks = typeof updater === 'function' ? updater(currentLinks) : updater;
          return { ...ws, links: newLinks, updatedAt: Date.now() };
        }
        return ws;
      });
    });
  }, [activeWorkspaceId]);

  const handleAddLink = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const exists = links.some(l => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId));
    if (exists) return;
    const newLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceId,
      targetId
    };
    setLinks(prev => [...prev, newLink]);
  }, [links, setLinks]);

  const handleDeleteLink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  }, [setLinks]);

  const handleStartLinking = useCallback((nodeId: string) => {
    if (!isLinkingMode) {
      setIsLinkingMode(true);
      setLinkingSourceId(nodeId);
    } else {
      if (!linkingSourceId) {
        setLinkingSourceId(nodeId);
      } else if (linkingSourceId === nodeId) {
        setLinkingSourceId(null);
      } else {
        handleAddLink(linkingSourceId, nodeId);
        setLinkingSourceId(null);
        setIsLinkingMode(false);
      }
    }
  }, [isLinkingMode, linkingSourceId, handleAddLink]);

  const handleToggleHideLabel = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isLabelHidden: !n.isLabelHidden } : n));
  }, [setNodes]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    setRedoStack(prev => [JSON.parse(JSON.stringify(nodes)), ...prev]);
    setUndoStack(newUndoStack);

    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return { ...ws, nodes: previousState, updatedAt: Date.now() };
        }
        return ws;
      });
    });
  }, [undoStack, nodes, activeWorkspaceId]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[0];
    const newRedoStack = redoStack.slice(1);

    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(nodes))]);
    setRedoStack(newRedoStack);

    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(ws => {
        if (ws.id === activeWorkspaceId) {
          return { ...ws, nodes: nextState, updatedAt: Date.now() };
        }
        return ws;
      });
    });
  }, [redoStack, nodes, activeWorkspaceId]);

  // Keyboard Undo/Redo listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Helper to update current workspace's sticky notes
  const setStickyNotes = useCallback((updater: StickyNoteData[] | ((prev: StickyNoteData[]) => StickyNoteData[])) => {
    setWorkspaces(prevWorkspaces => {
      return prevWorkspaces.map(ws => {
        if (ws.id === activeWorkspaceId) {
          const currentStickies = ws.stickyNotes || [];
          const newStickies = typeof updater === 'function' ? updater(currentStickies) : updater;
          return { ...ws, stickyNotes: newStickies, updatedAt: Date.now() };
        }
        return ws;
      });
    });
  }, [activeWorkspaceId]);

  // Persist workspaces
  useEffect(() => {
    try {
      localStorage.setItem('maddys_brainvault_workspaces_v2', JSON.stringify(workspaces));
      localStorage.setItem('maddys_brainvault_active_ws_v2', activeWorkspaceId);
      if (activeWorkspace) {
        localStorage.setItem('maddys_brainvault_nodes_v1', JSON.stringify(activeWorkspace.nodes));
      }
    } catch (e) {
      console.warn('Failed to persist workspaces', e);
    }
  }, [workspaces, activeWorkspaceId, activeWorkspace]);

  // UI Panels state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNodesDropdownOpen, setIsNodesDropdownOpen] = useState(false);
  const [isWorkspaceColorPickerOpen, setIsWorkspaceColorPickerOpen] = useState(false);
  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState(false);
  const [isReaderModalOpen, setIsReaderModalOpen] = useState(false);
  const [readerInitialTab, setReaderInitialTab] = useState<'reader' | 'export' | 'pdf'>('reader');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Double-Click Drag Selection Box & Multi-Node Moving State
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const isBoxSelecting = useRef(false);
  const isMultiMoving = useRef(false);
  const lastCanvasClickTime = useRef(0);
  const lastCanvasClickPos = useRef({ x: 0, y: 0 });
  const multiMoveStart = useRef<{ clientX: number; clientY: number; initialPositions: Map<string, { x: number; y: number }> }>({
    clientX: 0,
    clientY: 0,
    initialPositions: new Map()
  });

  // Smooth Viewport Transition State
  const [isSmoothAnimating, setIsSmoothAnimating] = useState(false);

  // Canvas Transform State (Pan & Zoom) - user request: "Make workspace bigger"
  const [transform, setTransform] = useState(() => {
    try {
      const saved = localStorage.getItem('maddys_brainvault_transform_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === 'number') return parsed;
      }
    } catch {}
    return { 
      x: 0, 
      y: 70, 
      scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.85 
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartInfo = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeDragStartInfo = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Sticky note dragging state
  const [draggingStickyId, setDraggingStickyId] = useState<string | null>(null);
  const stickyDragStartInfo = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Ultra-fast RAF latch (no starvation)
  const latestPointerCoords = useRef({ x: 0, y: 0 });
  const isRafActive = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3200);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('maddys_brainvault_transform_v1', JSON.stringify(transform));
    } catch {}
  }, [transform]);

  // High-performance Canvas Panning with Ink Pen cursor & Double-Click Drag Selection
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      const now = Date.now();
      const distFromLastClick = Math.hypot(e.clientX - lastCanvasClickPos.current.x, e.clientY - lastCanvasClickPos.current.y);
      const isDoubleClick = now - lastCanvasClickTime.current < 450 && distFromLastClick < 25;

      lastCanvasClickTime.current = now;
      lastCanvasClickPos.current = { x: e.clientX, y: e.clientY };

      e.currentTarget.setPointerCapture(e.pointerId);

      if (isDoubleClick) {
        // Double-click drag: initiate multi-selection box
        isBoxSelecting.current = true;
        setIsDragging(false);
        setSelectionBox({
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY
        });
        showToast("Double-click drag: Drag over nodes to select multiple at once!");
      } else {
        // Single pointer down: initiate workspace pan
        isBoxSelecting.current = false;
        setIsDragging(true);
        dragStartInfo.current = {
          x: e.clientX,
          y: e.clientY,
          transformX: transform.x,
          transformY: transform.y,
        };
      }
      e.preventDefault();
    }
  };

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // If node is part of active multi-selection, drag all selected nodes together!
    if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
      isMultiMoving.current = true;
      const initialMap = new Map<string, { x: number; y: number }>();
      nodes.filter(n => selectedNodeIds.includes(n.id)).forEach(n => {
        initialMap.set(n.id, { x: n.x, y: n.y });
      });
      multiMoveStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        initialPositions: initialMap
      };
      setDraggingNodeId(nodeId);
      return;
    }

    isMultiMoving.current = false;
    setDraggingNodeId(nodeId);
    nodeDragStartInfo.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  }, [nodes, selectedNodeIds]);

  const handleStickyPointerDown = useCallback((e: React.PointerEvent, stickyId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const sn = stickyNotes.find(s => s.id === stickyId);
    if (!sn) return;
    setDraggingStickyId(stickyId);
    stickyDragStartInfo.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: sn.x,
      nodeY: sn.y,
    };
  }, [stickyNotes]);

  // Lag-free pointer move throttled to display refresh rate
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging && !draggingNodeId && !draggingStickyId && !isBoxSelecting.current) return;

    latestPointerCoords.current = { x: e.clientX, y: e.clientY };

    if (!isRafActive.current) {
      isRafActive.current = true;
      requestAnimationFrame(() => {
        isRafActive.current = false;
        const { x: clientX, y: clientY } = latestPointerCoords.current;

        if (isBoxSelecting.current) {
          setSelectionBox(prev => prev ? { ...prev, currentX: clientX, currentY: clientY } : null);
          return;
        }

        if (isDragging) {
          const dx = clientX - dragStartInfo.current.x;
          const dy = clientY - dragStartInfo.current.y;
          setTransform(prev => ({
            ...prev,
            x: dragStartInfo.current.transformX + dx,
            y: dragStartInfo.current.transformY + dy,
          }));
        } else if (draggingNodeId) {
          if (isMultiMoving.current) {
            // Move all selected nodes in unison
            const dx = (clientX - multiMoveStart.current.clientX) / transform.scale;
            const dy = (clientY - multiMoveStart.current.clientY) / transform.scale;
            const initialMap = multiMoveStart.current.initialPositions;

            setNodes(prev => prev.map(n => {
              const init = initialMap.get(n.id);
              if (init) {
                return {
                  ...n,
                  x: Math.round(init.x + dx),
                  y: Math.round(init.y + dy)
                };
              }
              return n;
            }));
          } else {
            const dx = (clientX - nodeDragStartInfo.current.x) / transform.scale;
            const dy = (clientY - nodeDragStartInfo.current.y) / transform.scale;
            const targetX = Math.round(nodeDragStartInfo.current.nodeX + dx);
            const targetY = Math.round(nodeDragStartInfo.current.nodeY + dy);

            setNodes(prev => prev.map(n => 
              n.id === draggingNodeId ? { ...n, x: targetX, y: targetY } : n
            ));
          }
        } else if (draggingStickyId) {
          const dx = (clientX - stickyDragStartInfo.current.x) / transform.scale;
          const dy = (clientY - stickyDragStartInfo.current.y) / transform.scale;
          const targetX = Math.round(stickyDragStartInfo.current.nodeX + dx);
          const targetY = Math.round(stickyDragStartInfo.current.nodeY + dy);

          setStickyNotes(prev => prev.map(sn => 
            sn.id === draggingStickyId ? { ...sn, x: targetX, y: targetY } : sn
          ));
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isRafActive.current = false;
    setIsDragging(false);

    if (isBoxSelecting.current && selectionBox) {
      isBoxSelecting.current = false;
      const left = Math.min(selectionBox.startX, selectionBox.currentX);
      const right = Math.max(selectionBox.startX, selectionBox.currentX);
      const top = Math.min(selectionBox.startY, selectionBox.currentY);
      const bottom = Math.max(selectionBox.startY, selectionBox.currentY);

      // Convert selection screen coordinates to canvas coordinates
      const canvasLeft = (left - transform.x) / transform.scale;
      const canvasRight = (right - transform.x) / transform.scale;
      const canvasTop = (top - transform.y) / transform.scale;
      const canvasBottom = (bottom - transform.y) / transform.scale;

      // Detect nodes intersecting the drag box
      const newlySelected = nodes.filter(n => {
        const nw = n.width || DEFAULT_NODE_WIDTH;
        const nh = n.height || DEFAULT_NODE_HEIGHT;
        return (
          n.x < canvasRight &&
          n.x + nw > canvasLeft &&
          n.y < canvasBottom &&
          n.y + nh > canvasTop
        );
      }).map(n => n.id);

      if (newlySelected.length > 0) {
        setSelectedNodeIds(newlySelected);
        showToast(`Selected ${newlySelected.length} nodes! Drag any selected node to move all together.`);
      }
      setSelectionBox(null);
    }

    isMultiMoving.current = false;
    setDraggingNodeId(null);
    setDraggingStickyId(null);
    if ((e.target as HTMLElement).hasPointerCapture && (e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Direct mouse wheel zooming: Canvas zooms in/out normally where cursor is present
  const handleWheel = (e: React.WheelEvent) => {
    // User Request: "Adjust the scroll zoom in and out animation speed normal it should zoom in and zoom out where my course is present"
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('aside') || 
      target?.closest('[data-panel="sidebar"]') || 
      target?.closest('.no-canvas-zoom') || 
      target?.closest('[role="dialog"]') ||
      target?.closest('.custom-scrollbar') ||
      target?.closest('header')
    ) {
      // Do not zoom workspace, allow native list scrolling inside sidebar panel
      return;
    }

    e.preventDefault();
    // Normal, comfortable zoom delta (0.0009 factor provides smooth, natural speed)
    const zoomDelta = -e.deltaY * 0.0009;
    handleZoom(zoomDelta, e.clientX, e.clientY);
  };

  const handleZoom = (delta: number, originX?: number, originY?: number) => {
    setTransform(prev => {
      // Clean, stable zoom range: 0.08x to 3.5x
      const newScale = Math.min(Math.max(0.08, prev.scale + delta), 3.5);
      if (Math.abs(newScale - prev.scale) < 0.0001) return prev;
      
      const ox = originX !== undefined ? originX : window.innerWidth / 2;
      const oy = originY !== undefined ? originY : window.innerHeight / 2;

      // Perfectly pinned to cursor coordinates (originX, originY)
      const scaleRatio = newScale / prev.scale;
      const newX = ox - (ox - prev.x) * scaleRatio;
      const newY = oy - (oy - prev.y) * scaleRatio;

      return { x: newX, y: newY, scale: newScale };
    });
  };

  const centerOnPosition = useCallback((x: number, y: number, width: number = DEFAULT_NODE_WIDTH, height: number = DEFAULT_NODE_HEIGHT) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - (x + width / 2) * prev.scale,
      y: hh - (y + height / 2) * prev.scale + 30
    }));
  }, []);

  const handleCenterViewport = useCallback((x: number, y: number) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform(prev => ({
      ...prev,
      x: hw - x * prev.scale,
      y: hh - y * prev.scale
    }));
  }, []);

  const toggleMinimizeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isMinimized: !n.isMinimized } : n));
  }, [setNodes]);

  const handleZoomToNode = useCallback((nodeId: string, x: number, y: number, width: number = DEFAULT_NODE_WIDTH, height: number = DEFAULT_NODE_HEIGHT) => {
    const targetScale = 0.8;
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    setTransform({
      x: hw - (x + width / 2) * targetScale,
      y: hh - (y + height / 2) * targetScale,
      scale: targetScale
    });
  }, []);

  const handleFitAllNodes = useCallback(() => {
    if (nodes.length === 0 && stickyNotes.length === 0) {
      setTransform({
        x: 0,
        y: 70,
        scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.85
      });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (n.width || DEFAULT_NODE_WIDTH));
      maxY = Math.max(maxY, n.y + (n.height || DEFAULT_NODE_HEIGHT));
    });

    stickyNotes.forEach(sn => {
      minX = Math.min(minX, sn.x);
      minY = Math.min(minY, sn.y);
      maxX = Math.max(maxX, sn.x + (sn.width || 260));
      maxY = Math.max(maxY, sn.y + (sn.height || 220));
    });

    const padding = 140;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 75;

    const targetScale = Math.min(1.4, Math.max(0.2, Math.min(screenW / contentW, screenH / contentH)));
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    setTransform({
      x: screenW / 2 - centerX * targetScale,
      y: screenH / 2 - centerY * targetScale + 45,
      scale: targetScale
    });
  }, [nodes, stickyNotes]);

  // Align in Tidy Horizontal Row - User Request: "Implement a 'Snap to Grid' or 'Align Nodes' utility for the canvas that allows users to quickly organise multiple selected nodes into tidy horizontal or vertical rows."
  const handleAlignHorizontal = useCallback(() => {
    if (nodes.length === 0) return;
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : nodes.map(n => n.id);
    const targetNodes = nodes.filter(n => targetIds.includes(n.id));
    if (targetNodes.length === 0) return;

    // Sort by current X position
    const sorted = [...targetNodes].sort((a, b) => a.x - b.x);
    const baselineY = sorted[0].y;
    let currentX = sorted[0].x;

    const newPositions = new Map<string, { x: number, y: number }>();
    sorted.forEach((n) => {
      newPositions.set(n.id, { x: currentX, y: baselineY });
      currentX += (n.width || DEFAULT_NODE_WIDTH) + 80;
    });

    setNodes(prev => prev.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));

    showToast(`Organized ${targetNodes.length} nodes into a tidy horizontal row!`);
    setIsAlignMenuOpen(false);
  }, [nodes, selectedNodeIds, showToast]);

  // Align in Tidy Vertical Column / Row
  const handleAlignVertical = useCallback(() => {
    if (nodes.length === 0) return;
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : nodes.map(n => n.id);
    const targetNodes = nodes.filter(n => targetIds.includes(n.id));
    if (targetNodes.length === 0) return;

    // Sort by current Y position
    const sorted = [...targetNodes].sort((a, b) => a.y - b.y);
    const baselineX = sorted[0].x;
    let currentY = sorted[0].y;

    const newPositions = new Map<string, { x: number, y: number }>();
    sorted.forEach((n) => {
      newPositions.set(n.id, { x: baselineX, y: currentY });
      currentY += (n.height || DEFAULT_NODE_HEIGHT) + 80;
    });

    setNodes(prev => prev.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));

    showToast(`Organized ${targetNodes.length} nodes into a tidy vertical row!`);
    setIsAlignMenuOpen(false);
  }, [nodes, selectedNodeIds, showToast]);

  // Organize in Tidy Multi-Column Grid
  const handleOrganizeGrid = useCallback(() => {
    if (nodes.length === 0) return;
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : nodes.map(n => n.id);
    const targetNodes = nodes.filter(n => targetIds.includes(n.id));
    if (targetNodes.length === 0) return;

    const sorted = [...targetNodes].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(sorted.length))));
    const startX = sorted[0].x;
    const startY = sorted[0].y;
    const gapX = DEFAULT_NODE_WIDTH + 80;
    const gapY = DEFAULT_NODE_HEIGHT + 80;

    const newPositions = new Map<string, { x: number, y: number }>();
    sorted.forEach((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      newPositions.set(n.id, { x: startX + col * gapX, y: startY + row * gapY });
    });

    setNodes(prev => prev.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));

    showToast(`Organized ${targetNodes.length} nodes into a tidy grid (${cols} columns)!`);
    setIsAlignMenuOpen(false);
  }, [nodes, selectedNodeIds, showToast]);

  // Snap to Grid (40px step)
  const handleSnapToGrid = useCallback(() => {
    if (nodes.length === 0) return;
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : nodes.map(n => n.id);
    const gridSize = 40;

    setNodes(prev => prev.map(n => {
      if (targetIds.includes(n.id)) {
        return {
          ...n,
          x: Math.round(n.x / gridSize) * gridSize,
          y: Math.round(n.y / gridSize) * gridSize
        };
      }
      return n;
    }));

    showToast(`Snapped ${targetIds.length} nodes to 40px grid!`);
    setIsAlignMenuOpen(false);
  }, [nodes, selectedNodeIds, showToast]);

  const toggleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeIds(prev => 
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
  }, []);

  const selectAllNodes = useCallback(() => {
    setSelectedNodeIds(nodes.map(n => n.id));
    showToast(`Selected all ${nodes.length} nodes.`);
  }, [nodes, showToast]);

  const clearNodeSelection = useCallback(() => {
    setSelectedNodeIds([]);
    showToast("Cleared node selection.");
  }, [showToast]);

  // Generate an AI Content Node - User Request: "make for every new node creation the node name and colour the same. You can increment the node name with numbers beside it"
  const generateNode = async (prompt: string, x: number, y: number, parentId?: string, isRegenerationOf?: string) => {
    const id = isRegenerationOf || `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const assignedColor = parentId ? SUBNODE_COLOR : PRIMARY_NODE_COLOR;
    
    // Increment node name with numbers beside it, uniform name and color
    let finalPrompt = prompt;
    if (!isRegenerationOf) {
      if (parentId) {
        const subCount = nodes.filter(n => n.parentId).length + 1;
        finalPrompt = prompt.trim() ? (prompt.startsWith('Sub-Node') ? prompt : `Sub-Node ${subCount}: ${prompt}`) : `Sub-Node ${subCount}`;
      } else {
        const primaryCount = nodes.filter(n => !n.parentId && !n.isCustom).length + 1;
        finalPrompt = prompt.trim() ? (prompt.startsWith('Node') ? prompt : `Node ${primaryCount}: ${prompt}`) : `Node ${primaryCount}`;
      }
    }

    if (isRegenerationOf) {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'generating' } : n));
    } else {
      const newNode: GridNodeData = {
        id, 
        x, 
        y,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
        color: assignedColor,
        isCustom: false,
        prompt: finalPrompt,
        text: '',
        prompts: [],
        status: 'generating',
        versionIndex: 0,
        versions: [],
        parentId
      };
      setNodes(prev => [...prev, newNode]);
    }
    
    setTimeout(() => centerOnPosition(x, y, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT), 50);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      let insertIndex = 0;

      setNodes(prev => prev.map(node => {
        if (node.id === id) {
          insertIndex = isRegenerationOf ? node.versions.length : 0;
          const newVersion = {
            prompt: finalPrompt,
            text: data.text || 'No content generated.',
            prompts: data.prompts || [],
          };
          
          return {
            ...node,
            status: 'ready',
            versions: isRegenerationOf ? [...node.versions, newVersion] : [newVersion],
            versionIndex: insertIndex,
            text: newVersion.text,
            prompts: newVersion.prompts,
          };
        }
        return node;
      }));

    } catch (error) {
      console.warn("Generation notice:", error);
      setNodes(prev => prev.map(node => node.id === id ? { ...node, status: 'error' } : node));
    }
  };

  // Create Custom Note for extra details - User Request: "make for every new node creation the node name and colour the same. You can increment the node name with numbers beside it"
  const handleAddCustomNode = useCallback((parentId?: string) => {
    const id = `custom-node-${Date.now()}`;
    const assignedColor = parentId ? SUBNODE_COLOR : PRIMARY_NODE_COLOR;

    let targetX = 0;
    let targetY = 0;

    if (parentId) {
      const parent = nodes.find(n => n.id === parentId);
      if (parent) {
        targetX = parent.x + (parent.width || DEFAULT_NODE_WIDTH) + 380;
        targetY = parent.y + 40;
        
        while (nodes.some(n => Math.abs(n.x - targetX) < 160 && Math.abs(n.y - targetY) < 360)) {
          targetY += 380;
        }
      }
    } else {
      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      targetX = Math.round((hw - transform.x) / transform.scale - DEFAULT_NODE_WIDTH / 2);
      targetY = Math.round((hh - transform.y) / transform.scale - DEFAULT_NODE_HEIGHT / 2);
    }

    const noteCount = nodes.filter(n => n.isCustom).length + 1;
    const defaultTitle = parentId ? `Sub-Node ${noteCount}` : `Node ${noteCount}`;

    const newCustomNode: GridNodeData = {
      id,
      x: targetX,
      y: targetY,
      width: DEFAULT_NODE_WIDTH,
      height: 380,
      color: assignedColor,
      isCustom: true,
      prompt: defaultTitle,
      text: '',
      prompts: [],
      status: 'ready',
      versionIndex: 0,
      versions: [
        {
          prompt: defaultTitle,
          text: '',
          prompts: []
        }
      ],
      parentId
    };

    setNodes(prev => [...prev, newCustomNode]);
    showToast(`Created ${defaultTitle} with consistent theme color!`);
    setTimeout(() => centerOnPosition(targetX, targetY, DEFAULT_NODE_WIDTH, 380), 50);
  }, [nodes, transform, centerOnPosition, setNodes, showToast]);

  // Create Sticky Note on workspace
  const handleCreateStickyNote = useCallback(() => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    const targetX = Math.round((hw - transform.x) / transform.scale - 130 + (Math.random() * 80 - 40));
    const targetY = Math.round((hh - transform.y) / transform.scale - 110 + (Math.random() * 80 - 40));

    const stickyColors = ['#FEF08A', '#BAE6FD', '#FBCFE8', '#BBF7D0', '#E9D5FF', '#FED7AA'];
    const assignedColor = stickyColors[stickyNotes.length % stickyColors.length];

    const newSticky: StickyNoteData = {
      id: `sticky-${Date.now()}`,
      x: targetX,
      y: targetY,
      width: 260,
      height: 220,
      text: '',
      color: assignedColor,
      createdAt: Date.now()
    };

    setStickyNotes(prev => [...prev, newSticky]);
    showToast(`Added sticky memo to workspace!`);
  }, [transform, stickyNotes.length, setStickyNotes, showToast]);

  const handleUpdateStickyText = useCallback((id: string, text: string) => {
    setStickyNotes(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  }, [setStickyNotes]);

  const handleUpdateStickyColor = useCallback((id: string, color: string) => {
    setStickyNotes(prev => prev.map(s => s.id === id ? { ...s, color } : s));
  }, [setStickyNotes]);

  const handleDeleteSticky = useCallback((id: string) => {
    setStickyNotes(prev => prev.filter(s => s.id !== id));
    showToast("Deleted sticky note.");
  }, [setStickyNotes, showToast]);

  const handleResizeSticky = useCallback((id: string, width: number, height: number) => {
    setStickyNotes(prev => prev.map(s => s.id === id ? { ...s, width, height } : s));
  }, [setStickyNotes]);

  const handleUpdateCustomNode = useCallback((nodeId: string, prompt: string, text: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const updatedVersion = {
          prompt,
          text,
          prompts: n.prompts || []
        };
        return {
          ...n,
          prompt,
          text,
          versions: [updatedVersion],
          versionIndex: 0
        };
      }
      return n;
    }));
    showToast("Saved note details locally!");
  }, [setNodes, showToast]);

  // Code snippet update on node
  const handleUpdateCodeSnippet = useCallback((nodeId: string, code: string, language: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          codeSnippet: { code, language }
        };
      }
      return n;
    }));
    showToast(`Saved code snippet (${language})!`);
  }, [setNodes, showToast]);

  const handleUpdateColor = useCallback((nodeId: string, colorId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, color: colorId } : n));
    showToast(`Updated node color to ${colorId}`);
  }, [setNodes, showToast]);

  const handleResizeNode = useCallback((nodeId: string, width: number, height: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, width, height } : n));
  }, [setNodes]);

  // Persistent resize to local disc
  const handleSaveResize = useCallback((nodeId: string, width: number, height: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, width, height } : n));
    showToast(`Persisted node size (${width}×${height}) to local storage.`);
  }, [setNodes, showToast]);

  // Change active workspace theme background color
  const handleChangeWorkspaceBgColor = useCallback((newColor: string) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id === activeWorkspaceId) {
        return { ...ws, bgDarkColor: newColor, updatedAt: Date.now() };
      }
      return ws;
    }));
    showToast(`Workspace background color updated to ${newColor}`);
  }, [activeWorkspaceId, showToast]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    let startX = 0;
    let startY = 100;

    if (nodes.length > 0) {
      const rightmost = [...nodes].sort((a, b) => (b.x + (b.width || DEFAULT_NODE_WIDTH)) - (a.x + (a.width || DEFAULT_NODE_WIDTH)))[0];
      startX = rightmost.x + (rightmost.width || DEFAULT_NODE_WIDTH) + 380;
      startY = rightmost.y;
    }

    generateNode(searchQuery, startX, startY);
    setSearchQuery('');
  };

  const handleMagicWand = async () => {
    const ideas = [
      "Quantum Entanglement & Non-Locality",
      "Evolution of Neural Architecture Search",
      "James Webb Deep Field Cosmological Discoveries",
      "Biomimetic Architectural Engineering",
      "The Fall of the Western Roman Empire",
      "Synthetic Biology & Programmable Cells",
      "Non-Euclidean Geometry in General Relativity",
      "Neuroplasticity & Synaptic Pruning"
    ];
    const text = ideas[Math.floor(Math.random() * ideas.length)];

    let startX = 0;
    let startY = 100;

    if (nodes.length > 0) {
      const rightmost = [...nodes].sort((a, b) => (b.x + (b.width || DEFAULT_NODE_WIDTH)) - (a.x + (a.width || DEFAULT_NODE_WIDTH)))[0];
      startX = rightmost.x + (rightmost.width || DEFAULT_NODE_WIDTH) + 380;
      startY = rightmost.y;
    }

    generateNode(text, startX, startY);
  };

  const handleExpand = useCallback((prompt: string, parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    const newX = parent.x + (parent.width || DEFAULT_NODE_WIDTH) + 380;
    const initialOffset = Math.random() > 0.5 ? 160 : -160;
    let newY = parent.y + initialOffset;
    const estimatedHeight = 500;
    
    let isOccupied = true;
    let offsetMultiplier = 1;
    let direction = Math.random() > 0.5 ? 1 : -1;
    
    while (isOccupied) {
      isOccupied = nodes.some(n => 
        Math.abs(n.x - newX) < 180 && 
        Math.abs(n.y - newY) < estimatedHeight
      );
      
      if (isOccupied) {
        newY = parent.y + initialOffset + (estimatedHeight * offsetMultiplier * direction);
        direction *= -1;
        if (direction === 1) {
          offsetMultiplier++;
        }
      }
    }
    
    generateNode(prompt, newX, newY, parentId);
  }, [nodes]);

  const handleRegenerate = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      generateNode(node.prompt, node.x, node.y, node.parentId, nodeId);
    }
  }, [nodes]);

  const handleDelete = useCallback((nodeId: string) => {
    const getDescendants = (id: string, allNodes: GridNodeData[]): string[] => {
      const children = allNodes.filter(n => n.parentId === id).map(n => n.id);
      let desc = [...children];
      for (const childId of children) {
        desc = [...desc, ...getDescendants(childId, allNodes)];
      }
      return desc;
    };
    
    setNodes(prev => {
      const toDelete = [nodeId, ...getDescendants(nodeId, prev)];
      return prev.filter(n => !toDelete.includes(n.id));
    });
    showToast("Deleted node.");
  }, [setNodes, showToast]);

  const setVersion = useCallback((nodeId: string, versionIndex: number) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, versionIndex } : n));
  }, [setNodes]);

  const handleImportNodes = useCallback((importedNodes: GridNodeData[]) => {
    setNodes(importedNodes);
    handleFitAllNodes();
    showToast("Imported backup and saved locally!");
  }, [handleFitAllNodes, setNodes, showToast]);

  // Clean in-app Reset
  const handleExecuteReset = () => {
    setNodes([]);
    setStickyNotes([]);
    setTransform({ 
      x: 0, 
      y: 70, 
      scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.85 
    });
    setIsResetConfirmOpen(false);
    showToast("Workspace canvas cleared.");
  };

  // Header "Read Matter" Button: book symbol only
  const handleOpenReader = () => {
    setReaderInitialTab('reader');
    setIsReaderModalOpen(true);
    showToast("Opening reader view...");
  };

  // Header "PDF" Button: printer symbol only - Functional PDF view & download (.pdf, .doc, .docx)
  const handleOpenPdfDirectly = () => {
    setReaderInitialTab('pdf');
    setIsReaderModalOpen(true);
    showToast("Opening PDF preview & document exports...");
  };

  // Workspaces Management Handlers
  const handleCreateWorkspace = () => {
    const themeIndex = workspaces.length % WORKSPACE_THEMES.length;
    const theme = WORKSPACE_THEMES[themeIndex];
    const newWsId = `ws-${Date.now()}`;
    const newWs: WorkspaceData = {
      id: newWsId,
      name: `Workspace #${workspaces.length + 1} (${theme.name})`,
      themeId: theme.id,
      bgDarkColor: theme.bgDarkColor,
      nodes: [],
      stickyNotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWsId);
    setTransform({ x: 0, y: 70, scale: 0.85 });
    showToast(`Created workspace in ${theme.name} theme!`);
  };

  const handleRenameWorkspace = (id: string, newName: string) => {
    setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name: newName, updatedAt: Date.now() } : ws));
    showToast("Workspace renamed.");
  };

  const handleDeleteWorkspace = (id: string) => {
    if (workspaces.length <= 1) {
      showToast("Cannot delete the only remaining workspace.");
      return;
    }
    const remaining = workspaces.filter(w => w.id !== id);
    setWorkspaces(remaining);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(remaining[0].id);
    }
    showToast("Workspace deleted.");
  };

  const handleSaveAsWorkspace = (id: string) => {
    const targetWs = workspaces.find(w => w.id === id);
    if (!targetWs) return;

    const dupWs: WorkspaceData = {
      ...targetWs,
      id: `ws-${Date.now()}`,
      name: `${targetWs.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setWorkspaces(prev => [...prev, dupWs]);
    showToast("Duplicated and saved workspace copy!");
  };

  // Single Note Actions in Left Sidebar
  const handleRenameNote = (nodeId: string, newPrompt: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, prompt: newPrompt } : n));
    showToast("Note renamed.");
  };

  const handleRenameSubNodePrompt = useCallback((nodeId: string, promptIndex: number, newPrompt: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const updatedPrompts = [...(n.prompts || [])];
        updatedPrompts[promptIndex] = newPrompt;
        const updatedVersions = n.versions.map((v, vIdx) => {
          if (vIdx === n.versionIndex) {
            const vPrompts = [...(v.prompts || [])];
            vPrompts[promptIndex] = newPrompt;
            return { ...v, prompts: vPrompts };
          }
          return v;
        });
        return {
          ...n,
          prompts: updatedPrompts,
          versions: updatedVersions
        };
      }
      return n;
    }));
    showToast("Sub-node branch prompt renamed!");
  }, [setNodes, showToast]);

  const handleDeleteNote = (nodeId: string) => {
    handleDelete(nodeId);
  };

  const handleSaveAsNote = (node: GridNodeData) => {
    const version = node.versions[node.versionIndex] || node;
    const content = `# ${node.prompt}\n\n*Type: ${node.isCustom ? 'Custom Note' : 'AI Topic'}*\n\n${version.text || ''}\n`;
    const filename = `${node.prompt.toLowerCase().replace(/[^a-z0-9]/g, '-')}-note.md`;
    downloadFile(content, filename, 'text/markdown;charset=utf-8');
    showToast(`Exported "${node.prompt}" as Markdown file.`);
  };

  // Add Dictionary term directly to Canvas
  const handleAddDictionaryNode = useCallback((word: string, definition: string, frame: string) => {
    const hw = window.innerWidth / 2;
    const hh = window.innerHeight / 2;
    const targetX = Math.round((hw - transform.x) / transform.scale - DEFAULT_NODE_WIDTH / 2);
    const targetY = Math.round((hh - transform.y) / transform.scale - DEFAULT_NODE_HEIGHT / 2);

    const termNode: GridNodeData = {
      id: `dict-${Date.now()}`,
      x: targetX,
      y: targetY,
      width: DEFAULT_NODE_WIDTH,
      height: 380,
      color: '#E3EDF6',
      isCustom: true,
      prompt: word,
      text: `### Definition\n${definition}\n\n### Frame of Use\n**${frame}**`,
      prompts: [],
      status: 'ready',
      versionIndex: 0,
      versions: [
        {
          prompt: word,
          text: `### Definition\n${definition}\n\n### Frame of Use\n**${frame}**`,
          prompts: []
        }
      ]
    };

    setNodes(prev => [...prev, termNode]);
    showToast(`Added "${word}" to workspace!`);
    setTimeout(() => centerOnPosition(targetX, targetY, DEFAULT_NODE_WIDTH, 380), 50);
  }, [transform, setNodes, showToast, centerOnPosition]);

  // Focus on node / sticky
  const handleSelectNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      centerOnPosition(node.x, node.y, node.width, node.height);
      showToast(`Focused on: ${node.prompt}`);
    }
  };

  const handleSelectStickyNote = (stickyId: string) => {
    const sn = stickyNotes.find(s => s.id === stickyId);
    if (sn) {
      centerOnPosition(sn.x, sn.y, sn.width, sn.height);
      showToast(`Focused on sticky memo.`);
    }
  };

  // Redirect to Main Home Page on title click (User request)
  const handleRedirectHome = useCallback(() => {
    setTransform({ 
      x: 0, 
      y: 70, 
      scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.85 
    });
    setIsSidebarOpen(false);
    setIsNodesDropdownOpen(false);
    setIsWorkspaceColorPickerOpen(false);
    showToast("Redirected to Maddy's BrainVault Home");
  }, [showToast]);

  const currentDarkBg = activeWorkspace?.bgDarkColor || '#0F0E47';

  return (
    <div 
      className={`relative w-screen h-screen overflow-hidden text-slate-100 dot-grid canvas-bg ${isDragging ? 'canvas-pen-active' : 'canvas-pen'}`}
      style={{ backgroundColor: currentDarkBg }}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Header Bar with Black Glass Morphology & Responsive Separate Buttons */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 px-2 sm:px-4 md:px-6 flex items-center justify-between gap-1.5 sm:gap-2.5 select-none transition-all no-print bg-[#030307]/85 backdrop-blur-2xl border-b border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-x-auto no-scrollbar">
        
        {/* Zone 1: Vault Title Logo, Separate Nodes Button, and Align/Grid Utility */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Maddy's BrainVault Title & Logo - Clicking redirects to main home page */}
          <div 
            onClick={handleRedirectHome}
            className="flex items-center gap-2 cursor-pointer group/title p-1 rounded-xl hover:bg-white/10 transition-all shrink-0"
            title="Click to redirect to Maddy's BrainVault Home"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center text-cyan-300 shadow-md backdrop-blur-xl group-hover/title:border-cyan-300 group-hover/title:scale-105 transition-all shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 0-4 4c0 .7.2 1.4.5 2C6.6 8.5 5 10.1 5 12c0 1.2.6 2.3 1.5 3-.3.6-.5 1.3-.5 2a4 4 0 0 0 4 4c1 0 1.8-.4 2.5-1 .7.6 1.5 1 2.5 1a4 4 0 0 0 4-4c0-.7-.2-1.4-.5-2 .9-.7 1.5-1.8 1.5-3 0-1.9-1.6-3.5-3.5-4 .3-.6.5-1.3.5-2a4 4 0 0 0-4-4Z"/>
                <path d="M12 2v20"/>
                <path d="M8 8h8"/>
                <path d="M7 14h10"/>
              </svg>
            </div>

            <div className="flex flex-col hidden sm:flex">
              <span className="font-tomorrow font-bold text-sm sm:text-base md:text-lg tracking-wider text-white whitespace-nowrap group-hover/title:text-cyan-200 transition-colors">
                {vaultTitle}
              </span>
              <span className="text-[9px] font-mono tracking-widest uppercase text-indigo-300/80 -mt-0.5 block truncate">
                {vaultSubtitle}
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-white/20 hidden md:block" />

          {/* Separate Glass Nodes Button */}
          <button
            onClick={() => setIsNodesDropdownOpen(!isNodesDropdownOpen)}
            className={`text-xs font-mono font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border backdrop-blur-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md ${
              isNodesDropdownOpen
                ? 'bg-cyan-500/30 text-white border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg'
                : 'bg-white/10 hover:bg-white/20 text-slate-100 hover:text-white border-white/20'
            }`}
            title="View all created nodes in dropdown"
          >
            <Layers size={14} className="text-cyan-300" />
            <span className="hidden md:inline tracking-wide font-tomorrow">NODES</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/25 border border-cyan-400/50 text-cyan-200 text-[10px] font-mono font-bold">
              {nodes.length}
            </span>
          </button>

          {/* Separate Snap to Grid & Align Nodes Utility Button */}
          <div className="relative">
            <button
              onClick={() => setIsAlignMenuOpen(!isAlignMenuOpen)}
              className={`text-xs font-mono font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border backdrop-blur-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md ${
                isAlignMenuOpen || selectedNodeIds.length > 0
                  ? 'bg-indigo-500/30 text-white border-indigo-400 ring-2 ring-indigo-400/40 shadow-lg'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100 hover:text-white border-white/20'
              }`}
              title="Organize / Align Nodes & Snap to Grid"
            >
              <GridIcon size={14} className="text-indigo-300" />
              <span className="hidden lg:inline tracking-wide font-tomorrow">ALIGN &amp; GRID</span>
              {selectedNodeIds.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-400/30 border border-indigo-300 text-cyan-200 text-[10px] font-mono font-bold">
                  {selectedNodeIds.length}
                </span>
              )}
            </button>

            {/* Align & Snap to Grid Popover */}
            {isAlignMenuOpen && (
              <div 
                className="absolute top-full left-0 mt-2 bg-[#09082B]/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 flex flex-col gap-2 min-w-[260px] text-slate-100 animate-in fade-in zoom-in-95 ring-1 ring-indigo-400/40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-tomorrow font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <GridIcon size={13} className="text-cyan-300" />
                    Align &amp; Grid Organizer
                  </span>
                  <button 
                    onClick={() => setIsAlignMenuOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="text-[10px] font-mono text-indigo-300">
                  {selectedNodeIds.length > 0 ? (
                    <span className="text-cyan-300 font-bold">Applies to {selectedNodeIds.length} selected nodes</span>
                  ) : (
                    <span>Applies to all {nodes.length} workspace nodes</span>
                  )}
                </div>

                {/* Align Actions */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    onClick={handleAlignHorizontal}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-mono font-bold transition-all cursor-pointer border border-white/15"
                  >
                    <AlignHorizontalJustifyStart size={14} className="text-cyan-300" />
                    <span>Align Horizontal Row</span>
                  </button>

                  <button
                    onClick={handleAlignVertical}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-mono font-bold transition-all cursor-pointer border border-white/15"
                  >
                    <AlignVerticalJustifyStart size={14} className="text-cyan-300" />
                    <span>Align Vertical Column</span>
                  </button>

                  <button
                    onClick={handleOrganizeGrid}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-mono font-bold transition-all cursor-pointer border border-white/15"
                  >
                    <GridIcon size={14} className="text-amber-300" />
                    <span>Organize Tidy Grid</span>
                  </button>

                  <button
                    onClick={handleSnapToGrid}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-left flex items-center gap-2 text-xs font-mono font-bold transition-all cursor-pointer border border-white/15"
                  >
                    <Compass size={14} className="text-emerald-300" />
                    <span>Snap All to 40px Grid</span>
                  </button>
                </div>

                {/* Selection Helpers */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono">
                  <button
                    onClick={selectAllNodes}
                    className="text-cyan-300 hover:text-white cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearNodeSelection}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Search Bar + Separate Explore Button + Right Grey Explore Button (Fit Screen) + Random + Note */}
        <div className="flex-1 max-w-xl flex items-center gap-1.5 sm:gap-2 min-w-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                handleSearchSubmit(e);
              } else {
                handleFitAllNodes();
                showToast("Workspace magnification: Complete view fitted to screen!");
              }
            }}
            className="flex-1 flex items-center bg-white/10 hover:bg-white/[0.14] focus-within:bg-white/20 focus-within:border-cyan-400/80 border border-white/25 backdrop-blur-2xl rounded-2xl shadow-lg pl-3 pr-1 py-1 transition-all min-w-[120px]"
          >
            <Search className="text-slate-300 shrink-0 mr-1.5" size={15} />
            <input
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-300/70 outline-none font-sans font-medium min-w-0"
              placeholder="Search topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {/* Explore Button */}
            <button 
              type="submit"
              className="px-2.5 sm:px-3 py-1.5 bg-cyan-500/40 hover:bg-cyan-500/60 border border-cyan-300/40 text-white rounded-xl shadow-md transition-all font-sans font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 backdrop-blur-xl"
              title={searchQuery.trim() ? "Explore entered topic" : "Explore complete workspace"}
            >
              <Play size={11} fill="currentColor" />
              <span className="hidden sm:inline tracking-wide">EXPLORE</span>
            </button>
          </form>

          {/* User Request: Right grey explore button - shows complete nodes that fit screen & focuses bottom-right magnification screen */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFitAllNodes();
              showToast("Workspace fitted to screen! Magnification radar in bottom right.");
            }}
            className="px-2 sm:px-2.5 py-1.5 bg-slate-400/25 hover:bg-slate-400/40 text-slate-200 hover:text-white border border-slate-300/35 rounded-xl shadow-md transition-all font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 backdrop-blur-xl active:scale-95"
            title="Right Explore Button: Fit complete nodes to screen with bottom-right magnification"
          >
            <Compass size={14} className="text-cyan-300" />
            <span className="hidden md:inline text-[11px] font-mono">FIT SCREEN</span>
          </button>

          {/* Separate Random Note Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMagicWand();
            }}
            className="w-9 h-9 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 hover:text-amber-200 border border-amber-400/40 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md backdrop-blur-xl active:scale-95"
            title="Generate Random Concept Note (Random)"
          >
            <Sparkles size={15} />
          </button>

          {/* Separate Add Custom Note Button */}
          <button 
            onClick={() => handleAddCustomNode()}
            className="w-9 h-9 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 hover:text-emerald-200 border border-emerald-400/40 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md backdrop-blur-xl active:scale-95"
            title="Create Incremented Note (+ Note)"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>

          {/* Separate Add Sticky Note Button */}
          <button 
            onClick={handleCreateStickyNote}
            className="w-9 h-9 bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-300 hover:text-yellow-200 border border-yellow-400/40 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md backdrop-blur-xl active:scale-95"
            title="Create Sticky Memo (+ Sticky)"
          >
            <StickyNoteIcon size={15} />
          </button>
        </div>

        {/* Zone 3: Separate Glass Morphology Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Read Matter Button (Sky Glass) */}
          <button
            onClick={handleOpenReader}
            className="w-9 h-9 bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 hover:text-sky-200 border border-sky-400/40 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer backdrop-blur-xl active:scale-95"
            title="Read all matter created in selected workspace (Book)"
          >
            <BookOpen size={16} />
          </button>

          {/* PDF Button (Purple Glass) - User Request: Functional PDF view & download (.pdf, .doc, .docx) */}
          <button
            onClick={handleOpenPdfDirectly}
            className="w-9 h-9 bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 hover:text-purple-200 border border-purple-400/40 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer backdrop-blur-xl active:scale-95"
            title="Open PDF Preview & Save / Download as .pdf, .doc, .docx (Printer)"
          >
            <Printer size={15} />
          </button>

          {/* Reset Button (Rose Glass) */}
          <button 
            onClick={() => setIsResetConfirmOpen(true)}
            className="w-9 h-9 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 hover:text-rose-200 border border-rose-400/40 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer backdrop-blur-xl active:scale-95"
            title="Reset Canvas & Notes (Reset)"
          >
            <RotateCcw size={15} />
          </button>

          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md backdrop-blur-xl ${
              undoStack.length > 0
                ? 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 cursor-pointer active:scale-95'
                : 'bg-white/5 text-slate-500 border-white/5 opacity-40 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={15} />
          </button>

          {/* Redo Button */}
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md backdrop-blur-xl ${
              redoStack.length > 0
                ? 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 cursor-pointer active:scale-95'
                : 'bg-white/5 text-slate-500 border-white/5 opacity-40 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <RotateCw size={15} />
          </button>

          {/* Theme Color Changing Button (Amber Glass) - User Request: Show Visual Palettes, No Hex Code Patterns */}
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceColorPickerOpen(!isWorkspaceColorPickerOpen)}
              className="w-9 h-9 bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 hover:text-amber-200 border border-amber-400/40 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer backdrop-blur-xl active:scale-95"
              title="Change Workspace Background Theme Color (Color Palettes)"
            >
              <Palette size={15} />
            </button>

            {/* Workspace Color Changer Popover with Visual Color Palettes (No Code Pattern) */}
            {isWorkspaceColorPickerOpen && (
              <div 
                className="absolute top-full right-0 mt-2 bg-[#09082B]/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-50 flex flex-col gap-3 min-w-[290px] text-slate-100 animate-in fade-in zoom-in-95 ring-1 ring-cyan-400/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-tomorrow font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Palette size={14} className="text-cyan-300" />
                    Workspace Theme Color
                  </span>
                  <button 
                    onClick={() => setIsWorkspaceColorPickerOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Visual Workspace Palettes Grid - User Request: "Don't show me the colour code pattern... Show me the colour palettes of all colours" */}
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="text-[10px] font-mono text-indigo-300 uppercase font-semibold block mb-1.5">
                      Curated Workspace Themes
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {WORKSPACE_THEMES.map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => {
                            handleChangeWorkspaceBgColor(theme.bgDarkColor);
                            setIsWorkspaceColorPickerOpen(false);
                          }}
                          className={`p-2 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer backdrop-blur-md ${
                            currentDarkBg.toLowerCase() === theme.bgDarkColor.toLowerCase()
                              ? 'border-cyan-400 ring-2 ring-cyan-400/60 bg-white/20 shadow-md'
                              : 'border-white/10 bg-white/5 hover:bg-white/15'
                          }`}
                        >
                          <span 
                            className="w-4 h-4 rounded-full border border-white/40 shadow-xs"
                            style={{ backgroundColor: theme.bgDarkColor }}
                          />
                          <span className="text-[9px] font-mono text-slate-200 truncate font-semibold">
                            {theme.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Extended Color Palette Swatches */}
                  <div>
                    <label className="text-[10px] font-mono text-indigo-300 uppercase font-semibold block mb-1.5">
                      Rich Canvas Background Swatches
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { name: 'Deep Cobalt', bg: '#0F0E47' },
                        { name: 'Midnight Obsidian', bg: '#0B0F19' },
                        { name: 'Galactic Nebula', bg: '#1A0B2E' },
                        { name: 'Cyber Emerald', bg: '#0A1F1C' },
                        { name: 'Crimson Abyss', bg: '#1F0A12' },
                        { name: 'Charcoal Titanium', bg: '#12151E' },
                        { name: 'Royal Navy', bg: '#0A192F' },
                        { name: 'Deep Forest', bg: '#061C14' },
                        { name: 'Dark Slate', bg: '#1E293B' },
                        { name: 'Amethyst Night', bg: '#2E1065' },
                        { name: 'Espresso Black', bg: '#1C1917' },
                        { name: 'Pure Obsidian', bg: '#09090B' },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          title={item.name}
                          onClick={() => {
                            handleChangeWorkspaceBgColor(item.bg);
                            setIsWorkspaceColorPickerOpen(false);
                          }}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 cursor-pointer flex items-center justify-center shadow-xs ${
                            currentDarkBg.toLowerCase() === item.bg.toLowerCase()
                              ? 'border-cyan-300 ring-2 ring-cyan-400/80 scale-105 shadow-md'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: item.bg }}
                        >
                          {currentDarkBg.toLowerCase() === item.bg.toLowerCase() && (
                            <Check size={14} className="text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Color Spectrum Swatch (No Hex Code) */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-300">Visual Palette Picker:</span>
                    <input
                      type="color"
                      value={currentDarkBg}
                      onChange={(e) => handleChangeWorkspaceBgColor(e.target.value)}
                      className="w-10 h-7 rounded-lg border border-white/30 cursor-pointer bg-transparent"
                      title="Choose any workspace background visually"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fit All in View Button */}
          <button 
            onClick={handleFitAllNodes}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer backdrop-blur-xl active:scale-95"
            title="Fit All in View"
          >
            <Compass size={15} />
          </button>
        </div>
      </header>

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0B0A33]/95 backdrop-blur-md border border-emerald-400/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-mono pointer-events-none transition-all no-print">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left-Side Panel: Workspaces, Notes, Stickies & Dictionary Drawer */}
      <LeftSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={(id) => {
          setActiveWorkspaceId(id);
          setIsSidebarOpen(false);
          showToast(`Switched workspace!`);
        }}
        onCreateWorkspace={handleCreateWorkspace}
        onRenameWorkspace={handleRenameWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        onSaveAsWorkspace={handleSaveAsWorkspace}
        currentNodes={nodes}
        stickyNotes={stickyNotes}
        onCreateNote={() => handleAddCustomNode()}
        onCreateStickyNote={handleCreateStickyNote}
        onSelectNode={handleSelectNode}
        onSelectStickyNote={handleSelectStickyNote}
        onRenameNode={handleRenameNote}
        onDeleteNode={handleDeleteNote}
        onDeleteStickyNote={handleDeleteSticky}
        onSaveAsNode={handleSaveAsNote}
        onAddDictionaryNode={handleAddDictionaryNode}
      />

      {/* Header "Nodes" Dropdown Popover */}
      <NodesDropdown
        isOpen={isNodesDropdownOpen}
        onClose={() => setIsNodesDropdownOpen(false)}
        nodes={nodes}
        onSelectNode={handleSelectNode}
        onFitAll={handleFitAllNodes}
      />

      {/* Infinite Canvas - User Request: "Make the workspace bigger so that I can add more nodes" */}
      <div 
        className="absolute top-0 left-0 origin-top-left canvas-bg no-print"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: '200000px',
          height: '200000px',
          minWidth: '200000px',
          minHeight: '200000px'
        }}
      >
        <ConnectingLines nodes={nodes} links={links} onDeleteLink={handleDeleteLink} />

        {/* Regular AI and Custom Concept Nodes */}
        {nodes.map((node, index) => (
          <NodeCard 
            key={node.id} 
            index={index}
            node={node} 
            scale={transform.scale}
            isGlassTheme={true}
            isDragging={draggingNodeId === node.id}
            isSelected={selectedNodeIds.includes(node.id)}
            onToggleSelect={toggleSelectNode}
            onExpand={handleExpand}
            onRegenerate={handleRegenerate}
            onClose={handleDelete}
            setVersion={setVersion}
            onUpdateColor={handleUpdateColor}
            onResize={handleResizeNode}
            onSaveResize={handleSaveResize}
            onUpdateCustomNode={handleUpdateCustomNode}
            onRenameNode={handleRenameNote}
            onUpdateCodeSnippet={handleUpdateCodeSnippet}
            onAddCustomNode={handleAddCustomNode}
            onToggleMinimize={toggleMinimizeNode}
            onZoomToNode={handleZoomToNode}
            isLinkingMode={isLinkingMode}
            isLinkingSource={linkingSourceId === node.id}
            onStartLinking={handleStartLinking}
            onToggleHideLabel={handleToggleHideLabel}
            onRenameSubNodePrompt={handleRenameSubNodePrompt}
            onPointerDown={(e) => handleNodePointerDown(e, node.id)}
          />
        ))}

        {/* Sticky Notes on Canvas */}
        {stickyNotes.map((sn) => (
          <StickyNoteCard
            key={sn.id}
            note={sn}
            scale={transform.scale}
            isDragging={draggingStickyId === sn.id}
            onUpdateText={handleUpdateStickyText}
            onUpdateColor={handleUpdateStickyColor}
            onDelete={handleDeleteSticky}
            onResize={handleResizeSticky}
            onPointerDown={(e) => handleStickyPointerDown(e, sn.id)}
          />
        ))}
      </div>

      {/* Zero-State UI when canvas is empty - Glass Morphology Theme & Mobile Responsive */}
      {nodes.length === 0 && stickyNotes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 pt-20 no-print">
          <div className="max-w-2xl w-full flex flex-col items-center text-center">
            
            {/* Interactive Vector Brain Logo + Vault Title (Redirects to Home) */}
            <div 
              onClick={handleRedirectHome}
              className="pointer-events-auto cursor-pointer group flex flex-col items-center gap-2 mb-2 p-2 rounded-2xl hover:bg-white/10 transition-all"
              title="Click to redirect to Maddy's BrainVault Home"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-cyan-300 shadow-xl backdrop-blur-xl group-hover:scale-105 group-hover:border-cyan-300 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 0-4 4c0 .7.2 1.4.5 2C6.6 8.5 5 10.1 5 12c0 1.2.6 2.3 1.5 3-.3.6-.5 1.3-.5 2a4 4 0 0 0 4 4c1 0 1.8-.4 2.5-1 .7.6 1.5 1 2.5 1a4 4 0 0 0 4-4c0-.7-.2-1.4-.5-2 .9-.7 1.5-1.8 1.5-3 0-1.9-1.6-3.5-3.5-4 .3-.6.5-1.3.5-2a4 4 0 0 0-4-4Z"/>
                  <path d="M12 2v20"/>
                  <path d="M8 8h8"/>
                  <path d="M7 14h10"/>
                </svg>
              </div>

              <h1 className="font-tomorrow font-bold text-3xl sm:text-5xl md:text-6xl tracking-tight text-white select-none">
                {vaultTitle}
              </h1>

              <span className="text-xs font-mono tracking-widest uppercase text-cyan-200/90 bg-white/10 border border-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                {vaultSubtitle}
              </span>
            </div>

            <p className="text-slate-300 text-sm md:text-base font-sans max-w-lg mb-8 leading-relaxed">
              Explore interconnected concepts on an infinite spatial canvas with white links, sticky notes, code blocks, dictionary, and persistent local storage.
            </p>

            {/* Central Search Box - Glass Morphology Theme */}
            <div className="pointer-events-auto w-full max-w-xl bg-white/10 hover:bg-white/[0.12] border border-white/25 rounded-2xl p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl flex flex-col sm:flex-row gap-2 transition-all">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex px-3 items-center">
                <Search className="text-slate-300 mr-3 shrink-0" size={18} />
                <input
                  autoFocus
                  className="flex-1 outline-none font-sans text-sm md:text-base py-2 w-full bg-transparent text-white placeholder:text-slate-300/70"
                  placeholder="What concept do you want to explore?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={handleSearchSubmit}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-cyan-500/40 to-blue-600/40 hover:from-cyan-500/60 hover:to-blue-600/60 border border-cyan-300/40 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-xl"
                >
                  <Play fill="currentColor" size={14} />
                  <span>EXPLORE</span>
                </button>
                <button 
                  onClick={handleMagicWand}
                  className="w-10 h-10 border border-amber-400/40 text-amber-300 bg-amber-500/20 hover:bg-amber-500/35 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-xl"
                  title="Random Concept"
                >
                  <Sparkles size={16} />
                </button>
              </div>
            </div>

            {/* Starter Pills in Glass Morphology Theme */}
            <div className="pointer-events-auto mt-6 flex flex-wrap justify-center items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider mr-1">Try Topics:</span>
              {[
                "Quantum Computing", 
                "Dark Matter & Energy", 
                "Renaissance Philosophy",
                "Neural Architecture",
                "Black Hole Thermodynamics"
              ].map(topic => (
                <button
                  key={topic}
                  onClick={() => generateNode(topic, 0, 100)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-100 hover:text-white transition-all cursor-pointer backdrop-blur-xl shadow-xs active:scale-95"
                >
                  {topic}
                </button>
              ))}
              <button
                onClick={() => handleAddCustomNode()}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 transition-all cursor-pointer font-bold flex items-center gap-1.5 shadow-md backdrop-blur-xl active:scale-95"
              >
                <Plus size={12} strokeWidth={3} />
                <span>+ Note</span>
              </button>
              <button
                onClick={handleCreateStickyNote}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 transition-all cursor-pointer font-bold flex items-center gap-1.5 shadow-md backdrop-blur-xl active:scale-95"
              >
                <Plus size={12} strokeWidth={3} />
                <span>+ Sticky Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Minimap with Full Workspace Fit & Magnification Radar */}
      {(nodes.length > 0 || stickyNotes.length > 0) && (
        <div className="absolute bottom-6 right-6 pointer-events-auto hidden md:block z-30 no-print">
          <Minimap
            nodes={nodes}
            stickyNotes={stickyNotes}
            transform={transform}
            onCenterViewport={handleCenterViewport}
            onFitAll={handleFitAllNodes}
            onZoom={handleZoom}
          />
        </div>
      )}

      {/* In-App Reset Confirmation Modal - User Request: Light Red Theme with Matching Buttons */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-[#FFF1F2] border-2 border-[#FDA4AF] w-full max-w-md rounded-2xl shadow-[0_25px_60px_rgba(225,29,72,0.25)] p-6 text-[#881337] flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFE4E6] border border-[#FB7185] text-[#E11D48] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-tomorrow font-bold text-lg text-[#9F1239]">Reset Canvas &amp; Notes?</h3>
                <p className="text-xs text-[#BE123C] font-mono font-medium">This will remove all nodes &amp; sticky notes from this workspace</p>
              </div>
            </div>

            <p className="text-xs text-[#881337] leading-relaxed font-sans font-medium">
              Are you sure you want to clear the canvas? All current items on this workspace will be cleared. If you want to keep them, click <strong>PDF</strong> first to save a backup dossier.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-[#FECDD3] font-mono text-xs">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#9F1239] border border-[#FDA4AF] font-bold transition-colors cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold transition-colors shadow-md shadow-[#E11D48]/30 cursor-pointer"
              >
                Clear &amp; Reset Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Reader & Export Modal - PDF Preview & Save / Download as .pdf, .doc, .docx */}
      <ReaderAndExportModal
        nodes={nodes}
        stickyNotes={stickyNotes}
        workspaceName={activeWorkspace?.name || 'Current Workspace'}
        isOpen={isReaderModalOpen}
        initialTab={readerInitialTab}
        onClose={() => setIsReaderModalOpen(false)}
        onImportNodes={handleImportNodes}
      />

      {/* Publication-Grade Printable Dossier for Browser Print / PDF */}
      <PrintDossier 
        nodes={nodes} 
        workspaceName={activeWorkspace?.name || 'Current Workspace'}
        stickyNotes={stickyNotes}
      />
    </div>
  );
}
