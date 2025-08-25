import React, { useState } from 'react';
import { useProject } from './store';

export const CodePanel: React.FC<{code: string}> = ({ code }: {code:string}) => {
  const parseCode = useProject((s:any)=>s.parseCode) as (code:string)=>void;
  const regen = useProject((s:any)=>s.regenCode) as ()=>void;
  const [local, setLocal] = useState(code);
  React.useEffect(()=> { setLocal(code); }, [code]);
  const apply = () => { parseCode(local); regen(); };
  return (
    <div style={{flex:1, display:'flex', flexDirection:'column'}}>
      <div style={{padding:8, borderBottom:'1px solid #333', display:'flex', alignItems:'center', gap:8}}>
        <h3 style={{margin:0, flex:1}}>Lua Code</h3>
        <button onClick={apply} style={{padding:'4px 8px'}}>Apply</button>
      </div>
      <textarea value={local} onChange={e=>setLocal(e.target.value)} onBlur={apply} style={{flex:1, background:'#0e1114', color:'#c9d1d9', fontFamily:'monospace', fontSize:12, border:'none', padding:8}} />
    </div>
  );
};
