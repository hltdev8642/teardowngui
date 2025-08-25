import { ProjectState, BaseElement } from './types';

function emitElement(el: BaseElement, depth: number): string {
  const pad = '    '.repeat(depth);
  const lines: string[] = [];
  const t = (s: string) => lines.push(pad + s);
  const translate = `UiTranslate(${Math.round(el.x)}, ${Math.round(el.y)})`;
  t('UiPush()');
  t(translate);
  switch (el.type) {
    case 'text':
      t(`UiText(${JSON.stringify(el.props.text || 'Text')})`); break;
    case 'rect':
      t(`UiRect(${Math.round(el.w)}, ${Math.round(el.h)})`); break;
    case 'rectOutline':
      t(`UiRectOutline(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.thickness||2)})`); break;
    case 'roundrect':
      t(`UiRoundedRect(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.radius || 8)})`); break;
    case 'roundedRectOutline':
      t(`UiRoundedRectOutline(${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.radius||8)}, ${Math.round(el.props.thickness||2)})`); break;
    case 'circle':
      t(`UiCircle(${Math.round(el.props.radius|| (el.w/2))})`); break;
    case 'circleOutline':
      t(`UiCircleOutline(${Math.round(el.props.radius|| (el.w/2))}, ${Math.round(el.props.thickness||2)})`); break;
    case 'image':
      t(`UiImage(${JSON.stringify(el.props.path || 'ui/example.png')})`); break;
    case 'imageBox':
      t(`UiImageBox(${JSON.stringify(el.props.path||'ui/example.png')}, ${Math.round(el.w)}, ${Math.round(el.h)}, ${Math.round(el.props.borderW||10)}, ${Math.round(el.props.borderH||10)})`); break;
    case 'button': {
      const label = JSON.stringify(el.props.text || 'Button');
      const handler = el.props.onPress || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Press';
      t(`if UiTextButton(${label}, ${Math.round(el.w)}, ${Math.round(el.h)}) then ${handler}() end`); break; }
    case 'imageButton': {
      const handler = el.props.onPress || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Press';
      t(`if UiImageButton(${JSON.stringify(el.props.path||'ui/example.png')}) then ${handler}() end`); break; }
    case 'blankButton': {
      const handler = el.props.onPress || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Press';
      t(`if UiBlankButton(${Math.round(el.w)}, ${Math.round(el.h)}) then ${handler}() end`); break; }
    case 'slider': {
      const varName = el.props.var || el.name + 'Val';
      const onChange = el.props.onChange || 'on' + el.name.replace(/[^A-Za-z0-9]/g,'') + 'Change';
      t(`${varName}, __done = UiSlider("dot.png", "x", ${varName} or ${(el.props.min||0)}, ${(el.props.min||0)}, ${(el.props.max||100)})`);
      t(`if __done then ${onChange}(${varName}) end`); break; }
    case 'mute': t('UiMute(1)'); break;
    case 'colorFilter': t(`UiColorFilter(${el.props.r||1}, ${el.props.g||1}, ${el.props.b||1}, ${el.props.a??1})`); break;
    case 'color': t(`UiColor(${el.props.r||1}, ${el.props.g||1}, ${el.props.b||1}, ${el.props.a??1})`); break;
    case 'disableInput': t('UiDisableInput()'); break;
    case 'buttonHoverColor': t(`UiButtonHoverColor(${el.props.r||0.8}, ${el.props.g||0.8}, ${el.props.b||0.8}, ${el.props.a??1})`); break;
    case 'setCursorState': t(`UiSetCursorState(${el.props.state||0})`); break;
    case 'ignoreNavigation': t('UiIgnoreNavigation()'); break;
    case 'font': t(`UiFont(${JSON.stringify(el.props.path||'regular.ttf')}, ${el.props.size||18})`); break;
    case 'align': t(`UiAlign(${JSON.stringify(el.props.align||'left')})`); break;
    case 'textOutline': t(`UiTextOutline(${el.props.r||0}, ${el.props.g||0}, ${el.props.b||0}, ${el.props.a??1}, ${el.props.thickness||0.1})`); break;
    case 'wordWrap': t(`UiWordWrap(${el.props.width||600})`); break;
    case 'textAlignment': t(`UiTextAlignment(${JSON.stringify(el.props.alignment||'left')})`); break;
    case 'drawLater': t('-- UiDrawLater not supported in static export'); break;
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
    // metadata comment for round-trip parsing (includes size)
    lines.push(`        --TDGUI id=${el.id} name=${encodeURIComponent(el.name)} type=${el.type} w=${Math.round(el.w)} h=${Math.round(el.h)}`);
    lines.push(emitElement(el, 2));
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
