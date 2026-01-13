
export enum GateType {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  XOR = 'XOR',
  NOR = 'NOR',
  NAND = 'NAND',
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  CUSTOM = 'CUSTOM'
}

export interface Point {
  x: number;
  y: number;
}

export interface Gate {
  id: string;
  type: GateType;
  position: Point;
  label?: string;
  inputCount?: number; 
  outputCount?: number;
  moduleRef?: string; // ID of the CustomModule definition
}

export interface Connection {
  id: string;
  fromGateId: string;
  toGateId: string;
  toInputIndex: number; 
}

export interface SelectionBox {
  start: Point;
  end: Point;
}

export interface DragState {
  type: 'gate' | 'wire' | 'marquee';
  id?: string;
  fromId?: string;
  startPos?: Point;
  currentPos: Point;
  inputIndex?: number;
  startFromInput?: boolean;
  startInputIndex?: number;
  initialGatePositions?: Record<string, Point>;
  selectionBox?: SelectionBox;
}

export interface CustomModule {
  id: string;
  name: string;
  gates: Gate[];
  connections: Connection[];
  inputLabels: string[];
  outputLabels: string[];
}

export interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
}
