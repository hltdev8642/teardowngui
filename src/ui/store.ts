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
    const generatedFull = generateLua(state); // fallback full generation
    const current = state.code || '';

    // Build new block strings per element id
    const blockMap: Record<string,string> = {};
    state.rootOrder.forEach((id: string) => {
      const el = state.elements[id]; if (!el) return;
      const block = (() => {
        const meta = `--TDGUI id=${el.id} name=${encodeURIComponent(el.name)} type=${el.type} w=${Math.round(el.w)} h=${Math.round(el.h)}`;
        // reuse emit logic by generating a mini project state with only this element
        // Quick inline emission (duplicated logic minimal):
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
      })();
      blockMap[id] = block;
    });

    // Regex to find existing metadata blocks
    const blockRegex = /(\n?)([ \t]*)--TDGUI id=([^\s]+)[^\n]*\n([ \t]*UiPush\(\)[\s\S]*?UiPop\(\))/g;
    const seenIds = new Set<string>();
    let replacedSomething = false;
    let updated = current.replace(blockRegex, (match: string, leadingNL: string, indent: string, id: string) => {
      const newBlock = blockMap[id];
      if (!newBlock) {
        // Element removed in UI: drop block
        replacedSomething = true;
        return leadingNL || '';
      }
      seenIds.add(id);
      replacedSomething = true;
      // Re-indent new block with existing indent
      const indented = newBlock.split('\n').map((l,i)=> indent + l).join('\n');
      return (leadingNL||'') + indented;
    });

    // Determine insertion point for new elements not present in original code
    const missing = state.rootOrder.filter((id: string) => !seenIds.has(id));
    if (missing.length) {
      // Build insertion text
      const insertion = missing.map((id: string) => blockMap[id]).join('\n');
      // Try to insert inside draw() before its final UiPop()
      const drawMatch = /function\s+draw\s*\([^)]*\)([\s\S]*?)end/gm.exec(updated);
      if (drawMatch) {
        // Find last UiPop() inside draw
        const startIdx = drawMatch.index;
        const drawBodyStart = updated.indexOf('{', startIdx); // not Lua, fallback simple search
        const lastUiPopIdx = updated.lastIndexOf('UiPop()', updated.indexOf('end', startIdx));
        if (lastUiPopIdx !== -1) {
          const before = updated.slice(0, lastUiPopIdx);
          const after = updated.slice(lastUiPopIdx);
          const indentMatch = /^(\s*)UiPop\(\)/m.exec(after);
          const indent = indentMatch ? indentMatch[1] : '    ';
          updated = before + insertion.split('\n').map((l: string)=> indent + l).join('\n') + '\n' + after;
          replacedSomething = true;
        } else {
          // Append at end of file
          updated += '\n' + insertion;
        }
      } else {
        // No draw() function found – append
        updated += '\n' + insertion;
      }
    }

    // Fallback: if nothing was replaced and no metadata present, use marker approach or full generation
    if (!replacedSomething && !/--TDGUI id=/.test(current)) {
      updated = generatedFull; // full overwrite only when we have no existing metadata
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

    // Context stack for additive translations within UiPush/UiPop blocks
    interface Ctx { offX:number; offY:number; meta?: { id?:string; name?:string; w?:number; h?:number }; }
    const ctxStack: Ctx[] = [{ offX:0, offY:0 }];
    const cur = () => ctxStack[ctxStack.length-1];
    const pushCtx = (meta?: Ctx['meta']) => ctxStack.push({ offX: cur().offX, offY: cur().offY, meta });
    const popCtx = () => { if (ctxStack.length>1) ctxStack.pop(); };

    const reTranslate = /UiTranslate\(([^,]+)\s*,\s*([^\)]+)\)/;
    const num = /^-?\d+(?:\.\d+)?$/;
    const reMeta = /--TDGUI\s+id=([^\s]+)\s+name=([^\s]+)\s+type=([\w]+)(?:.*?w=(\d+)\s+h=(\d+))?/;

    // Utility to attempt element creation
    function createElementFromLine(l:string, ctx:Ctx): PEl | null {
      let w=200,h=50; let type:ElementType='rect'; let props:Record<string,any>={};
      const line = l.trim();
      if (/^UiText\(/.test(line)) { type='text'; props.text=(line.match(/^UiText\((.*)\)/)?.[1]||'').replace(/^"|"$/g,''); h=30; }
      else if (/^UiRectOutline\(/.test(line)) { type='rectOutline'; const m=line.match(/UiRectOutline\((\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.thickness=+m[3];} }
      else if (/^UiRect\(/.test(line)) { type='rect'; const m=line.match(/UiRect\((\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];} }
      else if (/^UiRoundedRectOutline\(/.test(line)) { type='roundedRectOutline'; const m=line.match(/UiRoundedRectOutline\((\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.radius=+m[3];props.thickness=+m[4];} }
      else if (/^UiRoundedRect\(/.test(line)) { type='roundrect'; const m=line.match(/UiRoundedRect\((\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.radius=+m[3];} }
      else if (/^UiCircleOutline\(/.test(line)) { type='circleOutline'; const m=line.match(/UiCircleOutline\((\d+),(\s*\d+)\)/); if(m){const r=+m[1];props.radius=r;props.thickness=+m[2];w=h=r*2;} }
      else if (/^UiCircle\(/.test(line)) { type='circle'; const m=line.match(/UiCircle\((\d+)\)/); if(m){const r=+m[1];props.radius=r;w=h=r*2;} }
      else if (/^UiImageBox\(/.test(line)) { type='imageBox'; const m=line.match(/UiImageBox\((".*?"),(\s*\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=+m[2];h=+m[3];props.borderW=+m[4];props.borderH=+m[5];} }
      else if (/^UiImageButton\(/.test(line)) { type='imageButton'; const m=line.match(/UiImageButton\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=h=64;} }
      else if (/^UiImage\(/.test(line)) { type='image'; const m=line.match(/UiImage\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=h=128;} }
      else if (/^UiBlankButton\(/.test(line)) { type='blankButton'; const m=line.match(/UiBlankButton\((\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];} }
      else if (/^if UiTextButton\(/.test(line)) { type='button'; const m=line.match(/UiTextButton\((".*?"),(\s*\d+),(\s*\d+)\)/); if(m){props.text=m[1].replace(/^"|"$/g,'');w=+m[2];h=+m[3];} }
      else if (/UiSlider\(/.test(line)) { type='slider'; const m=line.match(/UiSlider\("dot.png",\s*"x",\s*(\w+)\s*or\s*(\d+),(\s*\d+),(\s*\d+)\)/); if(m){props.var=m[1];props.min=+m[3];props.max=+m[4];w=200;h=24;} }
      else return null;
      let x = ctx.offX; let y = ctx.offY;
      // Apply metadata overrides if any
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
        if (num.test(ax) && num.test(ay)) {
          cur().offX += parseFloat(ax);
          cur().offY += parseFloat(ay);
        } else {
          // Non-numeric translate resets to 0 as we cannot evaluate dynamic expressions
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
