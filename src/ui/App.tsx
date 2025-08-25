import React, { useEffect } from 'react';
import { useProject } from './store';
import { ElementType } from './types';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { CodePanel } from './CodePanel';

export const App: React.FC = () => {
  const addElement = useProject((s:any)=>s.addElement);
  const regen = useProject((s:any)=>s.regenCode);
  const code = useProject((s:any)=>s.code);

  useEffect(()=>{ regen(); }, [regen]);

  const add = (type: ElementType) => { addElement(type); regen(); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'220px 1fr 400px', height:'100vh'}}>
      <div style={{borderRight:'1px solid #333', padding:8, display:'flex', flexDirection:'column', gap:8}}>
        <h3>Palette</h3>
        {['text','rect','roundrect','image','button','slider'].map(t=> (
          <button key={t} onClick={()=>add(t as ElementType)} style={{padding:'6px 8px'}}>{t}</button>
        ))}
        <button onClick={()=>regen()} style={{marginTop:12}}>Regenerate Code</button>
        <div style={{marginTop:'auto', fontSize:12, opacity:0.6}}>Teardown UI Layout Designer v0.1</div>
      </div>
      <Canvas />
      <div style={{display:'flex', flexDirection:'column', borderLeft:'1px solid #333'}}>
        <Inspector />
        <CodePanel code={code} />
      </div>
    </div>
  );
};
