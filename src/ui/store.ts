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
    const code = generateLua(state);
    set({ code });
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
    const rawLines = code.split(/\r?\n/);
    interface PEl { type: ElementType; x:number; y:number; w:number; h:number; props: Record<string,any>; metaName?: string; }
    const parsed: PEl[] = [];

    // Track translation context per depth
    interface TxCtx { x:number; y:number; numeric:boolean; metaName?:string; metaW?:number; metaH?:number; }
    const txStack: TxCtx[] = [];

    // Helper to push context
    const pushCtx = (meta?: TxCtx) => { txStack.push(meta || {x:0,y:0,numeric:true}); };
    const popCtx = () => { txStack.pop(); };
    const currentCtx = () => txStack[txStack.length-1];

    // Regexes
    const reTranslate = /UiTranslate\(([^,]+)\s*,\s*([^\)]+)\)/;
    const numeric = /^-?\d+(?:\.\d+)?$/;
    const reMeta = /--TDGUI.*name=([^\s]+).*type=([\w]+)(?:.*w=(\d+).*h=(\d+))?/;

    // Drawing patterns map -> handler
    function mkElementFromDraw(line:string, ctx:TxCtx): PEl | null {
      let w=200,h=50; let type:ElementType='rect'; let props:Record<string,any>={};
      const lc = line.trim();
      if (/^UiText\(/.test(lc)) { type='text'; props.text=(lc.match(/^UiText\((.*)\)/)?.[1]||'').replace(/^"|"$/g,''); h=30; }
      else if (/^UiRectOutline\(/.test(lc)) { type='rectOutline'; const m=lc.match(/UiRectOutline\((\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.thickness=+m[3];} }
      else if (/^UiRect\(/.test(lc)) { type='rect'; const m=lc.match(/UiRect\((\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];} }
      else if (/^UiRoundedRectOutline\(/.test(lc)) { type='roundedRectOutline'; const m=lc.match(/UiRoundedRectOutline\((\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.radius=+m[3];props.thickness=+m[4];} }
      else if (/^UiRoundedRect\(/.test(lc)) { type='roundrect'; const m=lc.match(/UiRoundedRect\((\d+),(\s*\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];props.radius=+m[3];} }
      else if (/^UiCircleOutline\(/.test(lc)) { type='circleOutline'; const m=lc.match(/UiCircleOutline\((\d+),(\s*\d+)\)/); if(m){const r=+m[1];props.radius=r;props.thickness=+m[2];w=h=r*2;} }
      else if (/^UiCircle\(/.test(lc)) { type='circle'; const m=lc.match(/UiCircle\((\d+)\)/); if(m){const r=+m[1];props.radius=r;w=h=r*2;} }
      else if (/^UiImageBox\(/.test(lc)) { type='imageBox'; const m=lc.match(/UiImageBox\((".*?"),(\s*\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=+m[2];h=+m[3];props.borderW=+m[4];props.borderH=+m[5];} }
      else if (/^UiImageButton\(/.test(lc)) { type='imageButton'; const m=lc.match(/UiImageButton\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=h=64;} }
      else if (/^UiImage\(/.test(lc)) { type='image'; const m=lc.match(/UiImage\((".*?")\)/); if(m){props.path=m[1].replace(/^"|"$/g,'');w=h=128;} }
      else if (/^UiBlankButton\(/.test(lc)) { type='blankButton'; const m=lc.match(/UiBlankButton\((\d+),(\s*\d+)\)/); if(m){w=+m[1];h=+m[2];} }
      else if (/^if UiTextButton\(/.test(lc)) { type='button'; const m=lc.match(/UiTextButton\((".*?"),(\s*\d+),(\s*\d+)\)/); if(m){props.text=m[1].replace(/^"|"$/g,'');w=+m[2];h=+m[3];} }
      else if (/UiSlider\(/.test(lc)) { type='slider'; const m=lc.match(/UiSlider\("dot.png",\s*"x",\s*(\w+)\s*or\s*(\d+),(\s*\d+),(\s*\d+)\)/); if(m){props.var=m[1];props.min=+m[3];props.max=+m[4];w=200;h=24;} }
      else return null;
      let x = ctx.x; let y=ctx.y;
      if (!ctx.numeric) { x=0; y=0; }
      return { type, x, y, w, h, props, metaName: ctx.metaName } as PEl;
    }

    for (let i=0;i<rawLines.length;i++) {
      const line = rawLines[i];
      const trimmed = line.trim();
      // metadata association: store on next push at this depth
      let pendingMeta: {name?:string; w?:number; h?:number}|undefined;
      if (trimmed.startsWith('--TDGUI')) {
        const mm = trimmed.match(reMeta); if (mm) { pendingMeta = { name: decodeURIComponent(mm[1]), w: mm[3]? +mm[3]:undefined, h: mm[4]? +mm[4]:undefined }; }
      }
      if (/^UiPush\(\)/.test(trimmed)) {
        pushCtx(pendingMeta ? { x: currentCtx()? currentCtx().x:0, y: currentCtx()? currentCtx().y:0, numeric:true, metaName: pendingMeta.name } : undefined);
        continue;
      }
      if (/^UiPop\(\)/.test(trimmed)) { popCtx(); continue; }
      if (trimmed.startsWith('--TDGUI')) continue;
      if (reTranslate.test(trimmed)) {
        const m = trimmed.match(reTranslate)!;
        const ax = m[1].trim(); const ay = m[2].trim();
        const isNum = numeric.test(ax) && numeric.test(ay);
        const cx = currentCtx();
        if (cx) {
          cx.x = isNum ? parseFloat(ax):0;
          cx.y = isNum ? parseFloat(ay):0;
          cx.numeric = isNum;
        }
        continue;
      }
      // Skip context-less draws
      if (!txStack.length) continue;
      const ctx = currentCtx(); if (!ctx) continue;
      const el = mkElementFromDraw(trimmed, ctx);
      if (el) {
        // apply meta size if present
        if (ctx.metaName) el.metaName = ctx.metaName;
        parsed.push(el);
      }
    }

    set(() => {
      if (!parsed.length) return { code };
      const elements: Record<string, BaseElement> = {};
      const rootOrder: string[] = [];
      parsed.forEach(p => {
        const id = nanoid(6);
        const name = p.metaName || p.type + '_' + id;
        elements[id] = { id, type: p.type, name, x: p.x, y: p.y, w: p.w, h: p.h, props: p.props } as any;
        rootOrder.push(id);
      });
      return { elements, rootOrder, selection: [], code };
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
