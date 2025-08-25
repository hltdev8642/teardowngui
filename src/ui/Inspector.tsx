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
      {el.type === 'image' || el.type==='imageButton' || el.type==='imageBox' ? (
        <label style={{display:'block', marginTop:8}}>Image Path<br/>
          <input value={el.props.path||''} onChange={(e:any)=>set('path', e.target.value)} style={{width:'100%'}} />
        </label>
      ):null}
      {el.type === 'imageBox' ? (
        <>
          <label style={{display:'block', marginTop:8}}>Border W<br/>
            <input type='number' value={el.props.borderW??10} onChange={(e:any)=>set('borderW', Number(e.target.value))} style={{width:'100%'}} />
          </label>
          <label style={{display:'block', marginTop:8}}>Border H<br/>
            <input type='number' value={el.props.borderH??10} onChange={(e:any)=>set('borderH', Number(e.target.value))} style={{width:'100%'}} />
          </label>
        </>
      ):null}
      {(el.type === 'roundrect' || el.type==='roundedRectOutline' || el.type==='circle' || el.type==='circleOutline') && (
        <label style={{display:'block', marginTop:8}}>Radius<br/>
          <input type='number' value={el.props.radius??8} onChange={(e:any)=>set('radius', Number(e.target.value))} style={{width:'100%'}} />
        </label>
      )}
      {(el.type === 'rectOutline' || el.type==='roundedRectOutline' || el.type==='circleOutline') && (
        <label style={{display:'block', marginTop:8}}>Thickness<br/>
          <input type='number' value={el.props.thickness??2} onChange={(e:any)=>set('thickness', Number(e.target.value))} style={{width:'100%'}} />
        </label>
      )}
      {el.type === 'colorFilter' || el.type==='color' || el.type==='buttonHoverColor' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)', gap:4, marginTop:8}}>
          {['r','g','b','a'].map(ch => (
            <input key={ch} type='number' min={0} max={1} step={0.05} value={el.props[ch]??1} onChange={(e:any)=>set(ch, parseFloat(e.target.value))} />
          ))}
        </div>
      ):null}
      {el.type === 'font' && (
        <>
          <label style={{display:'block', marginTop:8}}>Font Path<br/>
            <input value={el.props.path||''} onChange={(e:any)=>set('path', e.target.value)} style={{width:'100%'}} />
          </label>
          <label style={{display:'block', marginTop:8}}>Size<br/>
            <input type='number' value={el.props.size||18} onChange={(e:any)=>set('size', Number(e.target.value))} style={{width:'100%'}} />
          </label>
        </>
      )}
      {el.type === 'align' && (
        <label style={{display:'block', marginTop:8}}>Align<br/>
          <input value={el.props.align||'left'} onChange={(e:any)=>set('align', e.target.value)} style={{width:'100%'}} />
        </label>
      )}
      {el.type === 'textOutline' && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)', gap:4, marginTop:8}}>
            {['r','g','b','a'].map(ch => (
              <input key={ch} type='number' min={0} max={1} step={0.05} value={el.props[ch]??(ch==='a'?1:0)} onChange={(e:any)=>set(ch, parseFloat(e.target.value))} />
            ))}
          </div>
          <label style={{display:'block', marginTop:8}}>Thickness<br/>
            <input type='number' step={0.05} value={el.props.thickness??0.1} onChange={(e:any)=>set('thickness', parseFloat(e.target.value))} />
          </label>
        </>
      )}
      {el.type === 'wordWrap' && (
        <label style={{display:'block', marginTop:8}}>Width<br/>
          <input type='number' value={el.props.width||600} onChange={(e:any)=>set('width', Number(e.target.value))} />
        </label>
      )}
      {el.type === 'textAlignment' && (
        <label style={{display:'block', marginTop:8}}>Mode<br/>
          <input value={el.props.alignment||'left'} onChange={(e:any)=>set('alignment', e.target.value)} style={{width:'100%'}} />
        </label>
      )}
      <label style={{display:'block', marginTop:8}}>Name<br/>
        <input value={el.name} onChange={(e:any)=>{ useProject.getState().renameElement(el.id, e.target.value); useProject.getState().regenCode(); }} style={{width:'100%'}} />
      </label>
    </div>
  );
};
