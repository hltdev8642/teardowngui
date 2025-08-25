export type ElementType = 'text' | 'rect' | 'rectOutline' | 'roundrect' | 'roundedRectOutline' | 'circle' | 'circleOutline' | 'image' | 'imageBox' | 'button' | 'imageButton' | 'blankButton' | 'slider' | 'mute' | 'colorFilter' | 'color' | 'disableInput' | 'buttonHoverColor' | 'setCursorState' | 'ignoreNavigation' | 'font' | 'align' | 'textOutline' | 'wordWrap' | 'textAlignment' | 'drawLater' | 'group';

export interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number; // canvas coordinates (safe area space)
  y: number;
  w: number;
  h: number;
  children?: string[]; // for group
  props: Record<string, any>;
}

export interface ProjectState {
  rootOrder: string[]; // top-level element ids (z order)
  elements: Record<string, BaseElement>;
  selection: string[];
  canvas: { width: number; height: number };
  code: string;
}
