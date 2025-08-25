import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { produce } from 'immer';
import { BaseElement, ProjectState, ElementType } from './types';
import { generateLua } from './codegen';

const defaultCanvas = { width: 1920, height: 1080 };

interface Actions {
  addElement: (type: ElementType) => void;
  removeElement: (id: string) => void;
  setSelection: (ids: string[]) => void;
  moveElement: (id: string, dx: number, dy: number) => void;
  resizeElement: (id: string, w: number, h: number) => void;
  updateProp: (id: string, key: string, value: any) => void;
  regenCode: () => void;
  setElementPos: (id: string, x: number, y: number) => void;
  removeSelected: () => void;
  parseCode: (code: string) => void;
  renameElement: (id: string, name: string) => void;
}

const createElement = (type: ElementType): BaseElement => {
  const id = nanoid(6);
  const base: BaseElement = {
    id,
    type,
    name: type + '_' + id,
    x: 100,
    y: 100,
    w: 200,
    h: 50,
    props: {}
  };
  switch (type) {
    case 'text':
      base.props.text = 'Label'; base.h = 30; break;
    case 'button':
      base.props.text = 'Button'; break;
    case 'imageButton':
      base.props.path = 'ui/example.png'; break;
    case 'blankButton':
      base.props.text = ''; break;
    case 'slider':
      base.props.min = 0; base.props.max = 100; base.props.var = 'sliderVal'; base.h = 24; break;
    case 'image':
      base.props.path = 'ui/example.png'; base.w = 128; base.h = 128; break;
    case 'imageBox':
      base.props.path = 'ui/example.png'; base.w = 128; base.h = 128; base.props.borderW = 10; base.props.borderH = 10; break;
    case 'roundrect':
      base.props.radius = 8; break;
    case 'roundedRectOutline':
      base.props.radius = 8; base.props.thickness = 2; break;
    case 'rectOutline':
      base.props.thickness = 2; break;
    case 'circle':
      base.props.radius = 50; base.w = 100; base.h = 100; break;
    case 'circleOutline':
      base.props.radius = 50; base.props.thickness = 4; base.w = 100; base.h = 100; break;
    case 'mute': base.w=0;base.h=0; break;
    case 'colorFilter': base.props={r:1,g:1,b:1,a:1}; base.w=0;base.h=0; break;
    case 'color': base.props={r:1,g:1,b:1,a:1}; base.w=0;base.h=0; break;
    case 'disableInput': base.w=0;base.h=0; break;
    case 'buttonHoverColor': base.props={r:0.8,g:0.8,b:0.8,a:1}; base.w=0;base.h=0; break;
    case 'setCursorState': base.props={state:0}; base.w=0;base.h=0; break;
    case 'ignoreNavigation': base.w=0;base.h=0; break;
    case 'font': base.props={path:'regular.ttf', size:18}; base.w=0;base.h=0; break;
    case 'align': base.props={align:'left'}; base.w=0;base.h=0; break;
    case 'textOutline': base.props={r:0,g:0,b:0,a:1,thickness:0.1}; base.w=0;base.h=0; break;
    case 'wordWrap': base.props={width:600}; base.w=0;base.h=0; break;
    case 'textAlignment': base.props={alignment:'left'}; base.w=0;base.h=0; break;
    case 'drawLater': base.w=0;base.h=0; break;
  }
  return base;
};

export const useProject = create<ProjectState & Actions>((set: any, get: any) => ({
  rootOrder: [],
  elements: {},
  selection: [],
  canvas: defaultCanvas,
  code: '-- code will appear here',
  addElement: (type: ElementType) => set(produce((s: ProjectState) => {
    const el = createElement(type);
    s.elements[el.id] = el;
    s.rootOrder.push(el.id);
  })),
  removeElement: (id: string) => set(produce((s: ProjectState) => {
    delete s.elements[id];
    s.rootOrder = s.rootOrder.filter(e => e !== id);
    s.selection = s.selection.filter(e => e !== id);
  })),
  setSelection: (ids: string[]) => set({ selection: ids }),
  moveElement: (id: string, dx: number, dy: number) => set(produce((s: ProjectState) => {
    const el = s.elements[id]; if (!el) return; el.x += dx; el.y += dy;
  })),
  resizeElement: (id: string, w: number, h: number) => set(produce((s: ProjectState) => {
    const el = s.elements[id]; if (!el) return; el.w = Math.max(4, w); el.h = Math.max(4, h);
  })),
  renameElement: (id: string, name: string) => set(produce((s: ProjectState) => {
    const el = s.elements[id]; if (!el) return; el.name = name.trim() || el.name;
  })),
  updateProp: (id: string, key: string, value: any) => set(produce((s: ProjectState) => {
    const el = s.elements[id]; if (!el) return; el.props[key] = value;
  })),
  regenCode: () => {
    const state = get();
    const generatedFull = generateLua(state); // fallback
    const current = state.code || '';

    // Build element emission blocks
    const buildBlock = (el: BaseElement): string => {
      const meta = `--TDGUI id=${el.id} name=${encodeURIComponent(el.name)} type=${el.type} w=${Math.round(el.w)} h=${Math.round(el.h)}`;
      const lines: string[] = [];
      lines.push('UiPush()');
      lines.push(`UiTranslate(${Math.round(el.x)}, ${Math.round(el.y)})`);
      switch (el.type) {
        case 'text': lines.push(`UiText(${JSON.stringify(el.props.text || 'Text')})`); break;
        case 'rect': lines.push(`UiRect(${Math.round(el.w)}, ${Math.round(el.h)})`); break;
        case 'rectOutline': lines.push(`UiRectOutline(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.thickness||2)})`); break;
        case 'roundrect': lines.push(`UiRoundedRect(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.radius||8)})`); break;
        case 'roundedRectOutline': lines.push(`UiRoundedRectOutline(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.radius||8)}, ${Math.round(el.props.thickness||2)})`); break;
        case 'circle': lines.push(`UiCircle(${Math.round(el.props.radius|| (el.w/2))})`); break;
        case 'circleOutline': lines.push(`UiCircleOutline(${Math.round(el.props.radius|| (el.w/2))}, ${Math.round(el.props.thickness||2)})`); break;
        case 'image': lines.push(`UiImage(${JSON.stringify(el.props.path || 'ui/example.png')})`); break;
        case 'imageBox': lines.push(`UiImageBox(${JSON.stringify(el.props.path||'ui/example.png')}, ${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.borderW||10)}, ${Math.round(el.props.borderH||10)})`); break;
        case 'button': { const label = JSON.stringify(el.props.text||'Button'); const handler = el.props.onPress || ('on'+el.name.replace(/[^A-Za-z0-9]/g,'')+'Press'); lines.push(`if UiTextButton(${label}, ${Math.round(el.w)}, ${Math.round(el.h)}) then ${handler}() end`); break; }
        case 'imageButton': { const handler = el.props.onPress || ('on'+el.name.replace(/[^A-Za-z0-9]/g,'')+'Press'); lines.push(`if UiImageButton(${JSON.stringify(el.props.path||'ui/example.png')}) then ${handler}() end`); break; }
        case 'blankButton': { const handler = el.props.onPress || ('on'+el.name.replace(/[^A-Za-z0-9]/g,'')+'Press'); lines.push(`if UiBlankButton(${Math.round(el.w)}, ${Math.round(el.h)}) then ${handler}() end`); break; }
        case 'slider': { const varName = el.props.var || el.name + 'Val'; const onChange = el.props.onChange || ('on'+el.name.replace(/[^A-Za-z0-9]/g,'')+'Change'); lines.push(`${varName}, __done = UiSlider("dot.png", "x", ${varName} or ${(el.props.min||0)}, ${(el.props.min||0)}, ${(el.props.max||100)})`); lines.push(`if __done then ${onChange}(${varName}) end`); break; }
        case 'mute': lines.push('UiMute(1)'); break;
        case 'colorFilter': lines.push(`UiColorFilter(${el.props.r||1}, ${el.props.g||1}, ${el.props.b||1}, ${el.props.a??1})`); break;
        case 'color': lines.push(`UiColor(${el.props.r||1}, ${el.props.g||1}, ${el.props.b||1}, ${el.props.a??1})`); break;
        case 'disableInput': lines.push('UiDisableInput()'); break;
        case 'buttonHoverColor': lines.push(`UiButtonHoverColor(${el.props.r||0.8}, ${el.props.g||0.8}, ${el.props.b||0.8}, ${el.props.a??1})`); break;
        case 'setCursorState': lines.push(`UiSetCursorState(${el.props.state||0})`); break;
        case 'ignoreNavigation': lines.push('UiIgnoreNavigation()'); break;
        case 'font': lines.push(`UiFont(${JSON.stringify(el.props.path||'regular.ttf')}, ${el.props.size||18})`); break;
        case 'align': lines.push(`UiAlign(${JSON.stringify(el.props.align||'left')})`); break;
        case 'textOutline': lines.push(`UiTextOutline(${el.props.r||0}, ${el.props.g||0}, ${el.props.b||0}, ${el.props.a??1}, ${el.props.thickness||0.1})`); break;
        case 'wordWrap': lines.push(`UiWordWrap(${el.props.width||600})`); break;
        case 'textAlignment': lines.push(`UiTextAlignment(${JSON.stringify(el.props.alignment||'left')})`); break;
        case 'drawLater': lines.push('-- UiDrawLater not supported in static export'); break;
      }
      lines.push('UiPop()');
      return meta + '\n' + lines.join('\n');
    };

    // If metadata already present, use id-based replacement logic (existing path below)
    const hasMeta = /--TDGUI id=/.test(current);

    if (!hasMeta) {
      // Attempt in-place instrumentation: replace original UiPush/UiTranslate(x,y)...UiPop() blocks matching each element coordinates
      let updatedCode = current;
      const replacedIds = new Set<string>();
      state.rootOrder.forEach((id: string) => {
        const el = state.elements[id]; if (!el) return;
        const x = Math.round(el.x); const y = Math.round(el.y);
        // Regex: capture indent and block. Use non-greedy until first UiPop() at same indent.
        const blockRegex = new RegExp(`(^|\\n)([\\ \t]*)UiPush\\(\\)\\s*\\n((?:[\\s\\S]*?))?([\\ \t]*)UiTranslate\\(\\s*${x}\\s*,\\s*${y}\\s*\\)([\\s\\S]*?)([\\ \t]*)UiPop\\(\\)`, 'm');
        const match = updatedCode.match(blockRegex);
        if (match) {
          const indent = match[2] || match[4] || '';
            const newBlock = buildBlock(el).split('\n').map(l=> indent + l).join('\n');
            // Insert leading newline if original had one (match[1])
            updatedCode = updatedCode.replace(blockRegex, `${match[1] || ''}${newBlock}`);
            replacedIds.add(id);
        }
      });
      // For any not replaced (new elements) append inside draw() if possible
      if (replacedIds.size < state.rootOrder.length) {
        const remaining = state.rootOrder.filter((id:string)=> !replacedIds.has(id));
        if (remaining.length) {
          const insertion = remaining.map((id:string)=> buildBlock(state.elements[id])).join('\n');
          const drawPos = updatedCode.search(/function\s+draw\s*\(/);
          if (drawPos !== -1) {
            // Insert before final UiPop() of draw
            const lastUiPop = updatedCode.lastIndexOf('UiPop()', updatedCode.indexOf('end', drawPos));
            if (lastUiPop !== -1) {
              const before = updatedCode.slice(0,lastUiPop);
              const after = updatedCode.slice(lastUiPop);
              const indentMatch = /(\n)([ \t]*)UiPop\(\)/.exec(after);
              const indent = indentMatch ? indentMatch[2] : '        ';
              updatedCode = before + insertion.split('\n').map((l: string)=> indent + l).join('\n') + '\n' + after;
            } else {
              updatedCode += '\n' + insertion;
            }
          } else {
            updatedCode += '\n' + insertion;
          }
        }
      }
      set({ code: updatedCode });
      return; // done
    }

    // ===== Existing metadata path (was previously implemented) =====
    const blockMap: Record<string,string> = {};
    state.rootOrder.forEach((id: string) => {
      const el = state.elements[id]; if (!el) return; blockMap[id] = buildBlock(el); });

    const blockRegex = /(\n?)([ \t]*)--TDGUI id=([^\s]+)[^\n]*\n([ \t]*UiPush\(\)[\s\S]*?UiPop\(\))/g;
    const seenIds = new Set<string>();
    let replacedSomething = false;
    let updated = current.replace(blockRegex, (match: string, leadingNL: string, indent: string, id: string) => {
      const newBlock = blockMap[id];
      if (!newBlock) { replacedSomething = true; return leadingNL || ''; }
      seenIds.add(id); replacedSomething = true;
      const indented = newBlock.split('\n').map((l: string)=> indent + l).join('\n');
      return (leadingNL||'') + indented;
    });

    const missing = state.rootOrder.filter((id: string) => !seenIds.has(id));
    if (missing.length) {
      const insertion = missing.map((id: string) => blockMap[id]).join('\n');
      const drawMatch = /function\s+draw\s*\([^)]*\)([\s\S]*?)end/gm.exec(updated);
      if (drawMatch) {
        const startIdx = drawMatch.index;
        const lastUiPopIdx = updated.lastIndexOf('UiPop()', updated.indexOf('end', startIdx));
        if (lastUiPopIdx !== -1) {
          const before = updated.slice(0, lastUiPopIdx);
          const after = updated.slice(lastUiPopIdx);
          const indentMatch = /^(\s*)UiPop\(\)/m.exec(after);
          const indent = indentMatch ? indentMatch[1] : '    ';
          updated = before + insertion.split('\n').map((l: string)=> indent + l).join('\n') + '\n' + after;
          replacedSomething = true;
        } else {
          updated += '\n' + insertion;
        }
      } else {
        updated += '\n' + insertion;
      }
    }
    if (!replacedSomething && !/--TDGUI id=/.test(current)) {
      updated = generatedFull;
    }
    set({ code: updated });
  },
  setElementPos: (id: string, x: number, y: number) => set(produce((s: ProjectState) => {
    const el = s.elements[id]; if (!el) return; el.x = x; el.y = y;
  })),
  removeSelected: () => set(produce((s: ProjectState) => {
    if (!s.selection.length) return;
    s.selection.forEach(id => { delete s.elements[id]; });
    s.rootOrder = s.rootOrder.filter(id => s.elements[id]);
    s.selection = [];
  })),
  parseCode: (code: string) => {
    const prev = get();
    const rawLines = code.split(/\r?\n/);
    interface PEl { id?:string; type: ElementType; x:number; y:number; w:number; h:number; props: Record<string,any>; metaName?: string; metaW?:number; metaH?:number; }
    const parsed: PEl[] = [];

    // Variable environment (simple numeric assignments)
    const varEnv: Record<string, number> = {};
    const assignRe = /^\s*(?:local\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\b/;
    for (const ln of rawLines) {
      const m = ln.match(assignRe);
      if (m) varEnv[m[1]] = parseFloat(m[2]);
    }

    // Context stack for additive translations within UiPush/UiPop blocks
    interface Ctx { offX:number; offY:number; meta?: { id?:string; name?:string; w?:number; h?:number }; }
    const ctxStack: Ctx[] = [{ offX:0, offY:0 }];
    const cur = () => ctxStack[ctxStack.length-1];
    const pushCtx = (meta?: Ctx['meta']) => ctxStack.push({ offX: cur().offX, offY: cur().offY, meta });
    const popCtx = () => { if (ctxStack.length>1) ctxStack.pop(); };

    const reTranslate = /UiTranslate\(([^,]+)\s*,\s*([^\)]+)\)/;
    const num = /^-?\d+(?:\.\d+)?$/;
    const reMeta = /--TDGUI\s+id=([^\s]+)\s+name=([^\s]+)\s+type=([\w]+)(?:.*?w=(\d+)\s+h=(\d+))?/;

    const resolveToken = (tok: string): number | undefined => {
      const t = tok.trim();
      if (num.test(t)) return parseFloat(t);
      if (t in varEnv) return varEnv[t];
      return undefined;
    };

    // Utility to attempt element creation (supports variable tokens for size)
    function createElementFromLine(l:string, ctx:Ctx): PEl | null {
      let w=200,h=50; let type:ElementType='rect'; let props:Record<string,any>={};
      const line = l.trim();
      const rectGeneric = line.match(/^UiRect\(([^,]+),\s*([^\)]+)\)/);
      const rectOutlineGeneric = line.match(/^UiRectOutline\(([^,]+),\s*([^,]+),\s*([^\)]+)\)/);
      const rrGeneric = line.match(/^UiRoundedRect\(([^,]+),\s*([^,]+),\s*([^\)]+)\)/);
      const rrOutlineGeneric = line.match(/^UiRoundedRectOutline\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)/);
      const circleGeneric = line.match(/^UiCircle\(([^\)]+)\)/);
      const circleOutlineGeneric = line.match(/^UiCircleOutline\(([^,]+),\s*([^\)]+)\)/);
      if (/^UiText\(/.test(line)) { type='text'; props.text=(line.match(/^UiText\((.*)\)/)?.[1]||'').replace(/^"|"$/g,''); h=30; }
      else if (rectOutlineGeneric) { type='rectOutline'; const a=resolveToken(rectOutlineGeneric[1]); const b=resolveToken(rectOutlineGeneric[2]); const c=resolveToken(rectOutlineGeneric[3]); if(a!==undefined&&b!==undefined){w=a;h=b;} if(c!==undefined) props.thickness=c; }
      else if (rectGeneric) { type='rect'; const a=resolveToken(rectGeneric[1]); const b=resolveToken(rectGeneric[2]); if(a!==undefined&&b!==undefined){w=a;h=b;} }
      else if (rrOutlineGeneric) { type='roundedRectOutline'; const a=resolveToken(rrOutlineGeneric[1]); const b=resolveToken(rrOutlineGeneric[2]); const r=resolveToken(rrOutlineGeneric[3]); const t=resolveToken(rrOutlineGeneric[4]); if(a!==undefined&&b!==undefined){w=a;h=b;} if(r!==undefined) props.radius=r; if(t!==undefined) props.thickness=t; }
      else if (rrGeneric) { type='roundrect'; const a=resolveToken(rrGeneric[1]); const b=resolveToken(rrGeneric[2]); const r=resolveToken(rrGeneric[3]); if(a!==undefined&&b!==undefined){w=a;h=b;} if(r!==undefined) props.radius=r; }
      else if (circleOutlineGeneric) { type='circleOutline'; const r=resolveToken(circleOutlineGeneric[1]); const t=resolveToken(circleOutlineGeneric[2]); if(r!==undefined){props.radius=r; w=h=r*2;} if(t!==undefined) props.thickness=t; }
      else if (circleGeneric) { type='circle'; const r=resolveToken(circleGeneric[1]); if(r!==undefined){props.radius=r; w=h=r*2;} }
      else if (/^UiImageBox\(/.test(line)) { type='imageBox'; const m=line.match(/UiImageBox\((".*?"),(\s*[^,]+),(\s*[^,]+),(\s*[^,]+),(\s*[^\)]+)\)/); if(m){props.path=m[1].replace(/^"|"$/g,''); const a=resolveToken(m[2]); const b=resolveToken(m[3]); const bw=resolveToken(m[4]); const bh=resolveToken(m[5]); if(a!==undefined) w=a; if(b!==undefined) h=b; if(bw!==undefined) props.borderW=bw; if(bh!==undefined) props.borderH=bh; } }
      else if (/^UiImageButton\(/.test(line)) { type='imageButton'; const m=line.match(/UiImageButton\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,''); w=h=64;} }
      else if (/^UiImage\(/.test(line)) { type='image'; const m=line.match(/UiImage\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,''); w=h=128;} }
      else if (/^UiBlankButton\(/.test(line)) { type='blankButton'; const m=line.match(/UiBlankButton\(([^,]+),\s*([^\)]+)\)/); if(m){ const a=resolveToken(m[1]); const b=resolveToken(m[2]); if(a!==undefined) w=a; if(b!==undefined) h=b; } }
      else if (/^if UiTextButton\(/.test(line)) { type='button'; const m=line.match(/UiTextButton\((".*?"),(\s*[^,]+),(\s*[^\)]+)\)/); if(m){props.text=m[1].replace(/^"|"$/g,''); const a=resolveToken(m[2]); const b=resolveToken(m[3]); if(a!==undefined) w=a; if(b!==undefined) h=b;} }
      else if (/UiSlider\(/.test(line)) { type='slider'; const m=line.match(/UiSlider\("dot.png",\s*"x",\s*(\w+)\s*or\s*(\d+),(\s*[^,]+),(\s*[^\)]+)\)/); if(m){props.var=m[1]; props.min=+m[3]; const a=resolveToken(m[4]); const b=resolveToken(m[5]); w=200; h=24; if(a!==undefined) props.min = a; if(b!==undefined) props.max = b; } }
      else return null;
      let x = ctx.offX; let y = ctx.offY;
      if (ctx.meta?.w) { w = ctx.meta.w; }
      if (ctx.meta?.h) { h = ctx.meta.h; }
      return { id: ctx.meta?.id, type, x, y, w, h, props, metaName: ctx.meta?.name };
    }

    // Pass 1: iterate lines
    for (let i=0;i<rawLines.length;i++) {
      const line = rawLines[i];
      const t = line.trim();
      if (t.startsWith('--TDGUI')) {
        const m = t.match(reMeta);
        if (m) {
          // Attach meta to next push at current depth
          const meta = { id:m[1], name: decodeURIComponent(m[2]), w: m[4]? +m[4]:undefined, h: m[5]? +m[5]:undefined };
          // Store meta temporarily by pushing context with same offsets when we encounter UiPush
          // We can't look ahead reliably, so mark on current context; next UiPush duplicates it.
          cur().meta = meta;
        }
        continue;
      }
      if (/^UiPush\(\)/.test(t)) {
        const inheritedMeta = cur().meta; // capture then clear on parent so it only applies to first nested level
        cur().meta = undefined;
        pushCtx(inheritedMeta);
        continue;
      }
      if (/^UiPop\(\)/.test(t)) { popCtx(); continue; }
      const mt = t.match(reTranslate);
      if (mt) {
        const ax = mt[1].trim(); const ay = mt[2].trim();
        const rx = resolveToken(ax); const ry = resolveToken(ay);
        if (rx !== undefined && ry !== undefined) {
          cur().offX += rx;
          cur().offY += ry;
        }
        continue;
      }
      // Attempt element creation if inside any context (depth>0). Root (only initial context) is depth 1 length? ctxStack>1 indicates inside push.
      if (ctxStack.length > 1) {
        const el = createElementFromLine(t, cur());
        if (el) {
          parsed.push(el);
          // After creating an element, clear meta so multiple elements inside same push don't reuse same metadata
          if (cur().meta) cur().meta = undefined;
        }
      }
    }

    // Merge with existing elements non-destructively
    set(() => {
      if (!parsed.length) return { code }; // nothing new recognized: preserve everything
      const existing = { ...prev.elements } as Record<string, BaseElement>;
      const newElements: Record<string, BaseElement> = {};
      const newOrder: string[] = [];

      parsed.forEach(p => {
        // Determine id reuse strategy
        let useId = p.id && existing[p.id] ? p.id : undefined;
        if (!useId && p.id && !existing[p.id]) useId = p.id; // new stable id
        if (!useId) {
          // Try match by name
            const foundId = Object.keys(existing).find(id => existing[id].name === (p.metaName||''));
            if (foundId) useId = foundId;
        }
        if (!useId) useId = nanoid(6);
        const base: BaseElement = existing[useId] ? { ...existing[useId] } : { id: useId, type: p.type, name: p.metaName || (p.type+'_'+useId), x:p.x, y:p.y, w:p.w, h:p.h, props:{} } as any;
        // Update geometry & type if changed
        base.type = p.type;
        base.x = p.x; base.y = p.y; base.w = p.w; base.h = p.h;
        base.name = p.metaName || base.name;
        // Merge props (shallow)
        base.props = { ...base.props, ...p.props };
        newElements[useId] = base;
        newOrder.push(useId);
        delete existing[useId];
      });
      // Append remaining existing elements (not matched) to preserve them
      Object.values(existing).forEach(el => { newElements[el.id] = el; newOrder.push(el.id); });
      return { elements: newElements, rootOrder: newOrder, selection: [], code };
    });
  },
}));

// Enhance resizeElement to auto-regenerate code
const _resize = useProject.getState().resizeElement;
useProject.setState({
  resizeElement: (id: string, w: number, h: number) => {
    _resize(id, w, h);
    useProject.getState().regenCode();
  }
});
