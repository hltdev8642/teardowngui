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
    // Very simple parser for generated blocks
    const lines = code.split(/\r?\n/).map(l=>l.trim());
    interface PEl { type: ElementType; x:number; y:number; w:number; h:number; props: Record<string,any>; }
    const parsed: PEl[] = [];
    for (let i=0;i<lines.length;i++) {
      if (lines[i] === 'UiPush()' && /^UiTranslate\(/.test(lines[i+1]||'')) {
        const tLine = lines[i+1];
        const m = tLine.match(/UiTranslate\(([-\d]+),\s*([-\d]+)\)/);
        if (!m) continue;
        const x = parseInt(m[1],10); const y = parseInt(m[2],10);
        // scan until UiPop()
        let j=i+2; let body: string[] = [];
        for (; j<lines.length; j++) { if (lines[j] === 'UiPop()') break; body.push(lines[j]); }
        if (body.length) {
          const first = body[0];
          let el: PEl | null = null;
          let w=200, h=50;
          if (/^UiText\(/.test(first)) {
            const txt = first.match(/^UiText\((.*)\)/);
            el = { type:'text', x,y,w:200,h:30, props:{ text: txt? txt[1].replace(/^"|"$/g,''): 'Text'} } as any;
          } else if (/^UiRect\(/.test(first)) {
            const mm = first.match(/UiRect\((\d+),\s*(\d+)\)/); if (mm){ w=parseInt(mm[1]); h=parseInt(mm[2]); el = { type:'rect', x,y,w,h, props:{} } as any; }
          } else if (/^UiRectOutline\(/.test(first)) {
            const mm = first.match(/UiRectOutline\((\d+),\s*(\d+),\s*(\d+)\)/); if (mm){ w=parseInt(mm[1]); h=parseInt(mm[2]); const thickness=parseInt(mm[3]); el = { type:'rectOutline', x,y,w,h, props:{ thickness } } as any; }
          } else if (/^UiRoundedRectOutline\(/.test(first)) {
            const mm = first.match(/UiRoundedRectOutline\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/); if (mm){ w=parseInt(mm[1]); h=parseInt(mm[2]); const radius=parseInt(mm[3]); const thickness=parseInt(mm[4]); el = { type:'roundedRectOutline', x,y,w,h, props:{ radius, thickness } } as any; }
          } else if (/^UiCircleOutline\(/.test(first)) {
            const mm = first.match(/UiCircleOutline\((\d+),\s*(\d+)\)/); if (mm){ const radius=parseInt(mm[1]); const thickness=parseInt(mm[2]); w=radius*2; h=radius*2; el = { type:'circleOutline', x,y,w,h, props:{ radius, thickness } } as any; }
          } else if (/^UiCircle\(/.test(first)) {
            const mm = first.match(/UiCircle\((\d+)\)/); if (mm){ const radius=parseInt(mm[1]); w=radius*2; h=radius*2; el = { type:'circle', x,y,w,h, props:{ radius } } as any; }
          } else if (/^UiImageBox\(/.test(first)) {
            const mm = first.match(/UiImageBox\((".*?"),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/); if (mm){ w=parseInt(mm[2]); h=parseInt(mm[3]); const borderW=parseInt(mm[4]); const borderH=parseInt(mm[5]); const path = mm[1].replace(/^"|"$/g,''); el = { type:'imageBox', x,y,w,h, props:{ path, borderW, borderH } } as any; }
          } else if (/^UiImageButton\(/.test(first)) {
            const mm = first.match(/UiImageButton\((".*?")\)/); if (mm){ const path = mm[1].replace(/^"|"$/g,''); el = { type:'imageButton', x,y,w:64,h:64, props:{ path } } as any; }
          } else if (/^UiBlankButton\(/.test(first)) {
            const mm = first.match(/UiBlankButton\((\d+),\s*(\d+)\)/); if (mm){ w=parseInt(mm[1]); h=parseInt(mm[2]); el = { type:'blankButton', x,y,w,h, props:{} } as any; }
          }
          if (el) parsed.push(el);
        }
        i = j; // jump past block
      }
    }
    set(() => {
      const elements: Record<string, BaseElement> = {};
      const rootOrder: string[] = [];
      parsed.forEach(p => {
        const id = nanoid(6);
        elements[id] = { id, type: p.type, name: p.type+'_'+id, x: p.x, y: p.y, w: p.w, h: p.h, props: p.props } as any;
        rootOrder.push(id);
      });
      return { elements, rootOrder, selection: [], code };
    });
  },
}));
