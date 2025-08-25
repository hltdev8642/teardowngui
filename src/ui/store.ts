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
    // Improved parser: scan all UiPush/UiPop root-level blocks and extract first-level UiTranslate + draw call
    const rawLines = code.split(/\r?\n/);
    const lines = rawLines.map(l=>l.replace(/\t/g,'    '));
    interface PEl { type: ElementType; x:number; y:number; w:number; h:number; props: Record<string,any>; metaName?: string; metaW?: number; metaH?: number; }
    const parsed: PEl[] = [];

    // Stack-based block detection
    let depth = 0;
    interface Block { start:number; depthAtStart:number; }
    const blocks: { start:number; end:number; depth:number }[] = [];
    const stack: Block[] = [];
    for (let i=0;i<lines.length;i++) {
      const t = lines[i].trim();
      if (t.startsWith('--TDGUI')) { /* metadata comment, handled later */ }
      if (/^UiPush\(\)/.test(t)) {
        stack.push({ start:i, depthAtStart: depth });
        depth++;
      } else if (/^UiPop\(\)/.test(t)) {
        depth = Math.max(0, depth-1);
        const blk = stack.pop();
        if (blk && blk.depthAtStart === 0) {
          blocks.push({ start: blk.start, end: i, depth:0 });
        }
      }
    }

    // Helper: parse element from block
    function parseBlock(block:{start:number; end:number}) {
      // Collect metadata comment immediately preceding block
      let metaLine: string | undefined;
      for (let k = block.start-1; k >= 0 && k >= block.start-5; k--) {
        const ml = lines[k].trim();
        if (ml.startsWith('--TDGUI')) { metaLine = ml; break; }
        if (ml.length && !ml.startsWith('--')) break; // stop at unrelated code
      }
      let metaName: string | undefined; let metaW: number | undefined; let metaH: number | undefined;
      if (metaLine) {
        const mm = metaLine.match(/--TDGUI.*name=([^\s]+).*type=([\w]+)(?:.*w=(\d+).*h=(\d+))?/);
        if (mm) { metaName = decodeURIComponent(mm[1]); if (mm[3]) metaW = +mm[3]; if (mm[4]) metaH = +mm[4]; }
      }

      // Determine top-level (relative depth 1) statements inside block
      let relDepth = 0;
      let tx: number | undefined; let ty: number | undefined;
      let drawLine: string | undefined;
      for (let i = block.start+1; i < block.end; i++) {
        const line = lines[i].trim();
        if (/^UiPush\(\)/.test(line)) { relDepth++; continue; }
        if (/^UiPop\(\)/.test(line)) { if (relDepth>0) relDepth--; continue; }
        if (relDepth>0) continue; // Only look at first-level inside this push
        // Translate
        if (tx === undefined) {
          const m = line.match(/UiTranslate\(([-\d]+)\s*,\s*([-\d]+)\)/);
            if (m) { tx = parseInt(m[1],10); ty = parseInt(m[2],10); continue; }
        }
        if (tx !== undefined && !drawLine && /^Ui(?!Push|Pop|Translate|Window|SafeMargins|Mute|ColorFilter|Color|DisableInput|ButtonHoverColor|SetCursorState|IgnoreNavigation|Font|Align|TextOutline|WordWrap|TextAlignment)/.test(line)) {
          drawLine = line; // first candidate drawing call
          break;
        }
        // Also allow meta-only elements (color, etc.) if no drawing but we still have translate
        if (tx !== undefined && !drawLine && /^(UiText|UiRect|UiRoundedRect|UiCircle|UiImage|UiImageBox|UiBlankButton|if UiTextButton|UiSlider|UiRectOutline|UiRoundedRectOutline|UiCircleOutline|UiImageButton)/.test(line)) {
          drawLine = line; break;
        }
      }
      if (tx === undefined || ty === undefined || !drawLine) return; // not an element pattern
      // Build element from drawLine
      let w=200,h=50; let type:ElementType = 'rect'; let props: Record<string,any> = {};
      const l = drawLine;
      if (/^UiText\(/.test(l)) { type='text'; props.text = (l.match(/^UiText\((.*)\)/)?.[1]||'').replace(/^"|"$/g,''); h=30; }
      else if (/^UiRectOutline\(/.test(l)) { type='rectOutline'; const mm = l.match(/UiRectOutline\((\d+),\s*(\d+),\s*(\d+)\)/); if (mm){ w=+mm[1]; h=+mm[2]; props.thickness=+mm[3]; } }
      else if (/^UiRect\(/.test(l)) { type='rect'; const mm = l.match(/UiRect\((\d+),\s*(\d+)\)/); if (mm){ w=+mm[1]; h=+mm[2]; } }
      else if (/^UiRoundedRectOutline\(/.test(l)) { type='roundedRectOutline'; const mm = l.match(/UiRoundedRectOutline\((\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if (mm){ w=+mm[1]; h=+mm[2]; props.radius=+mm[3]; props.thickness=+mm[4]; } }
      else if (/^UiRoundedRect\(/.test(l)) { type='roundrect'; const mm = l.match(/UiRoundedRect\((\d+),(\s*\d+),(\s*\d+)\)/); if (mm){ w=+mm[1]; h=+mm[2]; props.radius=+mm[3]; } }
      else if (/^UiCircleOutline\(/.test(l)) { type='circleOutline'; const mm = l.match(/UiCircleOutline\((\d+),\s*(\d+)\)/); if (mm){ const r=+mm[1]; props.radius=r; props.thickness=+mm[2]; w=h=r*2; } }
      else if (/^UiCircle\(/.test(l)) { type='circle'; const mm = l.match(/UiCircle\((\d+)\)/); if (mm){ const r=+mm[1]; props.radius=r; w=h=r*2; } }
      else if (/^UiImageBox\(/.test(l)) { type='imageBox'; const mm = l.match(/UiImageBox\((".*?"),(\s*\d+),(\s*\d+),(\s*\d+),(\s*\d+)\)/); if (mm){ props.path=mm[1].replace(/^"|"$/g,''); w=+mm[2]; h=+mm[3]; props.borderW=+mm[4]; props.borderH=+mm[5]; } }
      else if (/^UiImageButton\(/.test(l)) { type='imageButton'; const mm = l.match(/UiImageButton\((".*?")\)/); if (mm){ props.path=mm[1].replace(/^"|"$/g,''); w=h=64; } }
      else if (/^UiImage\(/.test(l)) { type='image'; const mm = l.match(/UiImage\((".*?")\)/); if (mm){ props.path=mm[1].replace(/^"|"$/g,''); w=h=128; } }
      else if (/^UiBlankButton\(/.test(l)) { type='blankButton'; const mm = l.match(/UiBlankButton\((\d+),\s*(\d+)\)/); if (mm){ w=+mm[1]; h=+mm[2]; } }
      else if (/^if UiTextButton\(/.test(l)) { type='button'; const mm = l.match(/UiTextButton\((".*?"),\s*(\d+),\s*(\d+)\)/); if (mm){ props.text=mm[1].replace(/^"|"$/g,''); w=+mm[2]; h=+mm[3]; } }
      else if (/UiSlider\(/.test(l)) { type='slider'; const mm = l.match(/UiSlider\("dot.png",\s*"x",\s*(\w+)\s*or\s*(\d+),\s*(\d+),\s*(\d+)\)/); if (mm){ props.var=mm[1]; props.min=+mm[3]; props.max=+mm[4]; w=200; h=24; } }
      else return;
      const el: PEl = { type, x: tx!, y: ty!, w, h, props };
      if (metaName) { el.metaName = metaName; if (metaW) el.w = metaW; if (metaH) el.h = metaH; }
      parsed.push(el);
    }

    blocks.forEach(parseBlock);

    // Apply results
    set(() => {
      if (!parsed.length) return { code }; // nothing recognized
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
