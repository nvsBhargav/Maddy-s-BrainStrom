import React, { useState, useRef, useEffect } from 'react';
import { Palette, Trash2, CornerDownRight, Check, Pin } from 'lucide-react';
import { StickyNoteData } from '../types';

interface StickyNoteCardProps {
  note: StickyNoteData;
  scale: number;
  isDragging?: boolean;
  onUpdateText: (id: string, text: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

const PRESET_STICKY_COLORS = [
  { name: 'Classic Yellow', hex: '#FEF08A', text: '#713F12' },
  { name: 'Sky Mist', hex: '#BAE6FD', text: '#0C4A6E' },
  { name: 'Blush Pink', hex: '#FBCFE8', text: '#831843' },
  { name: 'Mint Green', hex: '#BBF7D0', text: '#14532D' },
  { name: 'Lavender', hex: '#E9D5FF', text: '#581C87' },
  { name: 'Warm Coral', hex: '#FED7AA', text: '#7C2D12' },
  { name: 'Obsidian Dark', hex: '#1E293B', text: '#F8FAFC' }
];

export const StickyNoteCard: React.FC<StickyNoteCardProps> = React.memo(({
  note,
  scale,
  isDragging = false,
  onUpdateText,
  onUpdateColor,
  onDelete,
  onResize,
  onPointerDown
}) => {
  const [text, setText] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(note.text);
  }, [note.text]);

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
    const startW = note.width || 260;
    const startH = note.height || 220;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const dw = (moveEvt.clientX - startX) / scale;
      const dh = (moveEvt.clientY - startY) / scale;
      const newW = Math.max(180, Math.min(800, Math.round(startW + dw)));
      const newH = Math.max(140, Math.min(800, Math.round(startH + dh)));
      onResize(note.id, newW, newH);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Check if dark background
  const hex = (note.color || '#FEF08A').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 250;
  const g = parseInt(hex.substring(2, 4), 16) || 240;
  const b = parseInt(hex.substring(4, 6), 16) || 138;
  const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 130;
  const textColor = isDark ? '#F8FAFC' : '#1E1E2F';

  const isInteracting = isDragging || isResizing;
  const stickyTransition = isInteracting
    ? 'none'
    : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease';

  return (
    <div
      style={{
        position: 'absolute',
        transform: `translate3d(${note.x}px, ${note.y}px, 0)`,
        width: note.width || 260,
        height: note.height || 220,
        zIndex: showColorPicker ? 9999 : 15,
        backgroundColor: note.color || '#FEF08A',
        color: textColor,
        transition: stickyTransition,
        willChange: 'transform, width, height'
      }}
      className="rounded-xl shadow-2xl flex flex-col border border-black/15 group/sticky select-none hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative"
    >
      {/* Top Header Drag Bar with Pin Icon */}
      <div
        className="px-3 py-2 flex items-center justify-between border-b border-black/10 cursor-grab active:cursor-grabbing touch-none select-none bg-black/5 rounded-t-xl"
        onPointerDown={(e) => onPointerDown(e)}
      >
        <div className="flex items-center gap-1.5 opacity-80">
          <Pin size={13} className="rotate-45" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
            Sticky Memo
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Color Picker Button */}
          <div className="relative z-50" ref={colorPickerRef}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
              title="Adjust Sticky Note Color"
            >
              <Palette size={13} />
            </button>

            {showColorPicker && (
              <div 
                className="absolute top-full right-0 mt-2 bg-[#0A092B] border-2 border-indigo-400/80 rounded-xl p-3 shadow-[0_25px_50px_rgba(0,0,0,0.9)] z-[9999] flex flex-col gap-2.5 min-w-[210px] text-slate-100 ring-1 ring-cyan-400/30"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] font-mono text-indigo-300 uppercase font-bold border-b border-indigo-800 pb-1">
                  Adjust Memo Color
                </div>

                {/* Manual color picker */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={note.color || '#FEF08A'}
                    onChange={(e) => onUpdateColor(note.id, e.target.value)}
                    className="w-8 h-7 rounded border border-indigo-400 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={note.color || '#FEF08A'}
                    onChange={(e) => {
                      if (/^#[0-9A-Fa-f]{3,8}$/.test(e.target.value)) {
                        onUpdateColor(note.id, e.target.value);
                      }
                    }}
                    className="flex-1 bg-indigo-950 border border-indigo-600 rounded px-2 py-0.5 text-xs font-mono text-white outline-none"
                  />
                </div>

                {/* Swatches */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {PRESET_STICKY_COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        onUpdateColor(note.id, c.hex);
                        setShowColorPicker(false);
                      }}
                      className="w-6 h-6 rounded-md border border-black/30 hover:scale-110 transition-transform cursor-pointer shadow-xs"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-600 transition-colors cursor-pointer text-black/60"
            title="Delete Sticky Note"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Note Content Area */}
      <div 
        className="flex-1 p-3 overflow-hidden cursor-text"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onUpdateText(note.id, e.target.value);
          }}
          placeholder="Jot down a quick thought, formula, reminder or key idea..."
          className="w-full h-full bg-transparent resize-none outline-none font-sans text-sm leading-relaxed placeholder:opacity-50"
          style={{ color: textColor }}
        />
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-40 hover:opacity-100 transition-opacity p-0.5"
        onPointerDown={handleResizePointerDown}
        title="Drag to resize note"
      >
        <CornerDownRight size={13} />
      </div>
    </div>
  );
});

StickyNoteCard.displayName = 'StickyNoteCard';
