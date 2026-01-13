
import React from 'react';
import { GateType } from './types';

export const GATE_WIDTH = 80;
export const GATE_HEIGHT = 60;

export const GATE_CONFIGS: Record<GateType, { inputs: number; label: string }> = {
  [GateType.AND]: { inputs: 2, label: 'AND' },
  [GateType.OR]: { inputs: 2, label: 'OR' },
  [GateType.NOT]: { inputs: 1, label: 'NOT' },
  [GateType.XOR]: { inputs: 2, label: 'XOR' },
  [GateType.NOR]: { inputs: 2, label: 'NOR' },
  [GateType.NAND]: { inputs: 2, label: 'NAND' },
  [GateType.INPUT]: { inputs: 0, label: 'IN' },
  [GateType.OUTPUT]: { inputs: 1, label: 'OUT' },
  [GateType.CUSTOM]: { inputs: 0, label: 'MOD' }, // Inputs/outputs defined by instance
};

export const GatePaths: Record<string, React.ReactNode> = {
  [GateType.AND]: (
    <path d="M 0,0 L 20,0 A 30,30 0 0,1 20,60 L 0,60 Z" />
  ),
  [GateType.OR]: (
    <path d="M 0,0 C 20,0 30,5 50,30 C 30,55 20,60 0,60 C 15,45 15,15 0,0 Z" />
  ),
  [GateType.NOT]: (
    <g>
      <path d="M 0,0 L 50,30 L 0,60 Z" />
      <circle cx="56" cy="30" r="6" fill="transparent" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  [GateType.XOR]: (
    <g>
      <path d="M 5,0 C 25,0 35,5 55,30 C 35,55 25,60 5,60 C 20,45 20,15 5,0 Z" />
      <path d="M -5,0 C 10,15 10,45 -5,60" fill="none" />
    </g>
  ),
  [GateType.NAND]: (
    <g>
      <path d="M 0,0 L 20,0 A 30,30 0 0,1 20,60 L 0,60 Z" />
      <circle cx="56" cy="30" r="6" fill="transparent" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  [GateType.NOR]: (
    <g>
      <path d="M 0,0 C 20,0 30,5 50,30 C 30,55 20,60 0,60 C 15,45 15,15 0,0 Z" />
      <circle cx="56" cy="30" r="6" fill="transparent" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  [GateType.INPUT]: (
    <g>
      <path d="M 0,10 L 40,10 L 55,30 L 40,50 L 0,50 Z" />
      <rect x="8" y="22" width="20" height="16" rx="2" fill="currentColor" fillOpacity="0.2" />
    </g>
  ),
  [GateType.OUTPUT]: (
    <g>
      <path d="M 15,10 L 55,10 L 55,50 L 15,50 L 0,30 Z" />
      <circle cx="35" cy="30" r="10" fill="currentColor" fillOpacity="0.1" />
      <circle cx="35" cy="30" r="4" fill="currentColor" />
    </g>
  ),
  [GateType.CUSTOM]: (
    <g>
      <rect x="0" y="0" width="80" height="60" rx="4" strokeDasharray="4,2" />
      <path d="M 20,20 L 60,20 L 60,40 L 20,40 Z" fillOpacity="0.1" fill="currentColor" />
    </g>
  ),
};
