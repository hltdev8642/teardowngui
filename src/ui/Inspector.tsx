import React from 'react';
import { useProject } from './store';

export const Inspector: React.FC = () => {
  const sel = useProject((s:any)=>s.selection) as string[];
  const elements = useProject((s:any)=>s.elements) as any;
  const updateProp = useProject((s:any)=>s.updateProp) as (id:string,key:string,value:any)=>void;
  const regen = useProject((s:any)=>s.regenCode) as ()=>void;
  if (sel.length !== 1) return <div style={{padding:8, borderBottom:'1px solid #333'}}>No selection</div>;
  const el = elements[sel[0]];
  const set = (k:string,v:any)=>{ updateProp(el.id,k,v); regen(); };
  return (
    <div style={{padding:8, borderBottom:'1px solid #333'}}>
      <h3>Inspector</h3>
      <div style={{fontSize:12, opacity:0.7}}>{el.type} ({el.id})</div>
      {el.type === 'text' || el.type === 'button' ? (
        <label style={{display:'block', marginTop:8}}>Text<br/>
          <input value={el.props.text||''} onChange={(e:any)=>set('text', e.target.value)} style={{width:'100%'}} />
        </label>
      ):null}
      {el.type === 'slider' && (
        <>
          <label style={{display:'block', marginTop:8}}>Var<br/>
            <input value={el.props.var||''} onChange={(e:any)=>set('var', e.target.value)} style={{width:'100%'}} />
          </label>
          <label style={{display:'block', marginTop:8}}>Min<br/>
            <input type='number' value={el.props.min??0} onChange={(e:any)=>set('min', Number(e.target.value))} style={{width:'100%'}} />
          </label>
          <label style={{display:'block', marginTop:8}}>Max<br/>
            <input type='number' value={el.props.max??100} onChange={(e:any)=>set('max', Number(e.target.value))} style={{width:'100%'}} />
          </label>
        </>
      )}
    </div>
  );
};
