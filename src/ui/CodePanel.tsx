import React, { useState, useRef, useCallback } from 'react';
import { useProject } from './store';

export const CodePanel: React.FC<{code: string}> = ({ code }: {code:string}) => {
  const parseCode = useProject((s:any)=>s.parseCode) as (code:string)=>void;
  const regen = useProject((s:any)=>s.regenCode) as ()=>void;
  const [local, setLocal] = useState(code);
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  React.useEffect(()=> { setLocal(code); }, [code]);

  const apply = () => { parseCode(local); regen(); };

  const onFile = (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const text = String(e.target?.result || '');
      setLocal(text);
      parseCode(text);
      regen();
    };
    reader.readAsText(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onFile(e.dataTransfer.files);
  }, []);
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column'}} onDrop={onDrop} onDragOver={onDragOver}>
      <div style={{padding:8, borderBottom:'1px solid #333', display:'flex', alignItems:'center', gap:8}}>
        <h3 style={{margin:0, flex:1}}>Lua Code</h3>
        <button onClick={()=>fileInputRef.current?.click()} style={{padding:'4px 8px'}}>Import Lua</button>
        <button onClick={apply} style={{padding:'4px 8px'}}>Apply</button>
        <input ref={fileInputRef} type='file' accept='.lua,.txt' style={{display:'none'}} onChange={(e)=>onFile(e.target.files)} />
      </div>
      <textarea value={local} onChange={e=>setLocal(e.target.value)} onBlur={apply} placeholder={'Paste or drag & drop a Lua file with Ui* calls here. \nClick Import Lua to load a file.'} style={{flex:1, background:'#0e1114', color:'#c9d1d9', fontFamily:'monospace', fontSize:12, border:'none', padding:8, resize:'none'}} />
      <div style={{padding:'4px 8px', fontSize:11, opacity:0.6, borderTop:'1px solid #222'}}>Drag & drop .lua file to load. Only immediate-mode Ui blocks (UiPush/UiTranslate/.../UiPop) are parsed.</div>
    </div>
  );
};
