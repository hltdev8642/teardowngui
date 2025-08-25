import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useProject } from './store';
import { BaseElement } from './types';

const GRID_SIZE = 8;

export const Canvas: React.FC = () => {
  const canvas = useProject((s:any)=>s.canvas);
  const elements = useProject((s:any)=>s.elements) as Record<string, BaseElement>;
  const selection = useProject((s:any)=>s.selection) as string[];
  const setSel = useProject((s:any)=>s.setSelection) as (ids:string[])=>void;
  const regen = useProject((s:any)=>s.regenCode) as ()=>void;
  const setPos = useProject((s:any)=>s.setElementPos) as (id:string,x:number,y:number)=>void;
  const moveElement = useProject((s:any)=>s.moveElement) as (id:string,dx:number,dy:number)=>void; // fallback for arrows
  const resizeElement = useProject((s:any)=>s.resizeElement) as (id:string,w:number,h:number)=>void;
  const [drag, setDrag] = useState<{ids:string[]; startMouseX:number; startMouseY:number; startRects:Record<string,{x:number,y:number}>; axisLock?:'x'|'y'; dup:boolean}|null>(null);
  const [resizing, setResizing] = useState<{id:string; startW:number; startH:number; startMouseX:number; startMouseY:number}|null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const snap = (v:number) => Math.round(v/GRID_SIZE)*GRID_SIZE;

  const beginDrag = (e: React.MouseEvent, el: BaseElement) => {
    e.stopPropagation();
    const multi = e.shiftKey && selection.includes(el.id) ? selection : [el.id];
    setSel(multi.includes(el.id)? multi : [el.id]);
    const startRects: Record<string,{x:number,y:number}> = {};
    (multi.includes(el.id)? multi : [el.id]).forEach(id=>{ const el2 = elements[id]; if (el2) startRects[id] = {x:el2.x,y:el2.y}; });
    setDrag({ ids: multi.includes(el.id)? multi : [el.id], startMouseX: e.clientX, startMouseY: e.clientY, startRects, dup: e.altKey });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (resizing) {
      const dw = e.clientX - resizing.startMouseX;
      const dh = e.clientY - resizing.startMouseY;
      resizeElement(resizing.id, Math.max(8, resizing.startW + dw), Math.max(8, resizing.startH + dh));
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.startMouseX;
    const dy = e.clientY - drag.startMouseY;
    // Axis lock if shift pressed while dragging (dynamic)
    let axisLock = drag.axisLock;
    if (!axisLock && (e.metaKey || e.ctrlKey)) { // use ctrl/meta for axis lock toggle
      axisLock = Math.abs(dx) > Math.abs(dy) ? 'y' : 'x';
    }
    drag.ids.forEach(id=> {
      const start = drag.startRects[id];
      let nx = start.x + dx;
      let ny = start.y + dy;
      if (axisLock === 'x') ny = start.y; else if (axisLock === 'y') nx = start.x;
      nx = snap(nx); ny = snap(ny);
      setPos(id, nx, ny);
    });
  };

  const endDrag = () => {
    if (resizing) { setResizing(null); regen(); }
    if (drag) {
      setDrag(null); regen();
    }
  };

  // Keyboard nudging
  const onKey = useCallback((e: KeyboardEvent) => {
    if (!selection.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      useProject.getState().removeSelected();
      regen();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    let used = false;
    const dx = (e.key === 'ArrowRight') ? step : (e.key === 'ArrowLeft') ? -step : 0;
    const dy = (e.key === 'ArrowDown') ? step : (e.key === 'ArrowUp') ? -step : 0;
    if (dx || dy) {
      selection.forEach(id=> moveElement(id, dx, dy));
      regen();
      used = true;
    }
    if (used) { e.preventDefault(); }
  }, [selection, moveElement, regen]);

  useEffect(()=> {
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // Render grid
  const gridBg = React.useMemo(()=> {
    const size = GRID_SIZE;
    return {
      backgroundImage: `linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg,#222 1px, transparent 1px)`,
      backgroundSize: `${size}px ${size}px, ${size}px ${size}px`
    } as React.CSSProperties;
  }, []);

  return (
    <div ref={ref}
         onMouseMove={onMouseMove}
         onMouseUp={endDrag}
         onMouseLeave={endDrag}
         onClick={(e)=> { if (e.target === ref.current) setSel([]); }}
         style={{position:'relative', background:'#20252b', overflow:'auto'}}>
      <div style={{position:'relative', width:canvas.width, height:canvas.height, margin:'40px auto', background:'#111', boxShadow:'0 0 0 1px #333', ...gridBg}}>
        {Object.values(elements).map((el:BaseElement) => {
          const selected = selection.includes(el.id);
          return (
            <div key={el.id}
                 onMouseDown={(e)=>beginDrag(e, el)}
                 style={{position:'absolute', left:el.x, top:el.y, width:el.w, height:el.h,
                         border: selected?'2px solid #5af':'1px solid #444',
                         background: el.type==='text'?'#0000': selected? '#324357' : '#2a2f37',
                         color:'#ddd', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center',
                         userSelect:'none', cursor:'move', transition: drag? 'none':'border-color 0.1s'}}>
              {el.type === 'text' || el.type==='button' ? (el.props.text || el.name) :
                el.type === 'slider' ? (el.name) :
                el.type === 'image' ? (el.name) :
                el.type === 'imageButton' ? 'imgBtn' :
                el.type === 'blankButton' ? '' :
                el.type === 'imageBox' ? 'imgBox' :
                el.type === 'mute' ? 'mute' :
                el.type === 'colorFilter' ? 'colorF' :
                el.type === 'color' ? 'color' :
                el.type === 'disableInput' ? 'noInput' :
                el.type === 'buttonHoverColor' ? 'hoverColor' :
                el.type === 'setCursorState' ? 'cursor' :
                el.type === 'ignoreNavigation' ? 'ignoreNav' :
                el.type === 'font' ? 'font' :
                el.type === 'align' ? 'align' :
                el.type === 'textOutline' ? 'txtOutline' :
                el.type === 'wordWrap' ? 'wrap' :
                el.type === 'textAlignment' ? 'txtAlign' :
                el.type === 'drawLater' ? 'drawLater' :
                el.type}
              {selected && (
                <>
                  {/* Resize handle bottom-right */}
                  <div onMouseDown={(e)=> { e.stopPropagation(); setResizing({id:el.id,startW:el.w,startH:el.h,startMouseX:e.clientX,startMouseY:e.clientY}); }} style={{position:'absolute', right:-4, bottom:-4, width:10, height:10, background:'#5af', borderRadius:2, cursor:'nwse-resize'}} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
