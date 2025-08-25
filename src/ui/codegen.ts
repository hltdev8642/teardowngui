import { ProjectState, BaseElement } from './types';

function emitElement(el: BaseElement, depth: number, all: Record<string, BaseElement>): string {
  const pad = '    '.repeat(depth);
  const lines: string[] = [];
  const t = (s: string) => lines.push(pad + s);
  const translate = `UiTranslate(${Math.round(el.x)}, ${Math.round(el.y)})`;
  t('UiPush()');
  t(translate);
  switch (el.type) {
    case 'text':
      t(`UiText(${JSON.stringify(el.props.text || 'Text')})`);
      break;
    case 'rect':
      t(`UiRect(${Math.round(el.w)}, ${Math.round(el.h)})`);
      break;
    case 'roundrect':
      t(`UiRoundedRect(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.radius || 8)})`);
      break;
    case 'image':
      t(`UiImage(${JSON.stringify(el.props.path || 'ui/example.png')})`);
      break;
    case 'button':
      const label = JSON.stringify(el.props.text || 'Button');
      const handler = el.props.onPress || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Press';
      t(`if UiTextButton(${label}, ${Math.round(el.w)}, ${Math.round(el.h)}) then ${handler}() end`);
      break;
    case 'slider':
      const varName = el.props.var || el.name + 'Val';
      const onChange = el.props.onChange || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Change';
      t(`${varName}, __done = UiSlider("dot.png", "x", ${varName} or ${(el.props.min||0)}, ${(el.props.min||0)}, ${(el.props.max||100)})`);
      t(`if __done then ${onChange}(${varName}) end`);
      break;
  }
  t('UiPop()');
  return lines.join('\n');
}

export function generateLua(state: ProjectState): string {
  const lines: string[] = [];
  lines.push('-- Auto-generated Teardown UI code');
  lines.push('state = state or {}');
  lines.push('');
  lines.push('function draw()');
  lines.push('    UiPush()');
  lines.push('        local x0,y0,x1,y1 = UiSafeMargins(); UiTranslate(x0,y0); UiWindow(x1-x0, y1-y0)');
  for (const id of state.rootOrder) {
    const el = state.elements[id];
    if (!el) continue;
    lines.push(emitElement(el, 2, state.elements));
  }
  lines.push('    UiPop()');
  lines.push('end');
  lines.push('');
  lines.push('-- Event handler stubs (implement)');
  const handlers = new Set<string>();
  Object.values(state.elements).forEach(el => {
    if (el.type === 'button') {
      handlers.add(el.props.onPress || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Press');
    } else if (el.type === 'slider') {
      handlers.add(el.props.onChange || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Change');
    }
  });
  handlers.forEach(h => lines.push(`function ${h}() end`));
  return lines.join('\n');
}
