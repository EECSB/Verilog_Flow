
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GateType, Gate, Connection, Point, DragState, CustomModule, Notification } from './types';
import { GATE_CONFIGS, GATE_WIDTH, GATE_HEIGHT, GatePaths } from './constants';
import { generateVerilog } from './services/verilogGenerator';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Code, Trash2, PlusCircle, Download, X, Eraser, ZoomIn, 
  ZoomOut, Maximize, MousePointer2, AlertTriangle, Undo2, 
  Redo2, Edit2, Info, Copy, Check, Settings2, Sparkles,
  Camera, Upload, Loader2, Image as ImageIcon, Box, AlertCircle, Hash, ClipboardCopy, ClipboardPaste, ArrowLeft, ChevronRight
} from 'lucide-react';

const STORAGE_KEY = 'verilog-flow-state-v1';
const SETTINGS_KEY = 'verilog-flow-settings-v1';
const VARIABLE_INPUT_GATES = [GateType.AND, GateType.OR, GateType.NAND, GateType.NOR, GateType.XOR];

const Sidebar: React.FC<{ 
  customModules: Record<string, CustomModule>,
  onDragStart: (type: GateType, e: React.DragEvent, moduleRef?: string) => void,
  onEditModule: (moduleId: string) => void
}> = ({ customModules, onDragStart, onEditModule }) => {
  const gateTypes = [
    GateType.AND, GateType.OR, GateType.NOT, GateType.XOR, GateType.NOR, GateType.NAND, GateType.INPUT, GateType.OUTPUT
  ];

  const modules = Object.values(customModules);

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 h-full flex flex-col shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
          <PlusCircle size={20} /> Toolbox
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-1 gap-4">
          {gateTypes.map((type) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(type, e)}
              className="group bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-sky-500 cursor-grab active:cursor-grabbing transition-all hover:shadow-[0_0_15px_rgba(14,165,233,0.1)] flex flex-col items-center"
            >
              <div className="text-slate-300 group-hover:text-sky-400 transition-colors pointer-events-none">
                <svg width="60" height="40" viewBox="0 0 80 60" className="gate-symbol">
                  {GatePaths[type]}
                </svg>
              </div>
              <span className="mt-2 font-mono text-sm tracking-wider uppercase pointer-events-none">{GATE_CONFIGS[type].label}</span>
            </div>
          ))}
        </div>

        {modules.length > 0 && (
          <>
            <div className="my-8 flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-slate-800"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Created Modules</span>
              <div className="h-[1px] flex-1 bg-slate-800"></div>
            </div>

            <div className="grid grid-cols-1 gap-4 pb-8">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  draggable
                  onDragStart={(e) => onDragStart(GateType.CUSTOM, e, mod.id)}
                  className="group relative bg-slate-800/40 p-4 rounded-lg border border-slate-700 border-dashed hover:border-sky-500 hover:bg-slate-800/60 cursor-grab active:cursor-grabbing transition-all flex flex-col items-center"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditModule(mod.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100"
                    title="Edit Module Interior"
                  >
                    <Edit2 size={12} />
                  </button>
                  <div className="text-sky-400/50 group-hover:text-sky-400 transition-colors pointer-events-none">
                    <Box size={32} />
                  </div>
                  <span className="mt-2 font-mono text-xs tracking-wider uppercase truncate w-full text-center">{mod.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface WorkspaceState {
  gates: Gate[];
  connections: Connection[];
  moduleId: string | null;
  history: { gates: Gate[]; connections: Connection[] }[];
  historyIndex: number;
}

const App: React.FC = () => {
  const [gates, setGates] = useState<Gate[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [customModules, setCustomModules] = useState<Record<string, CustomModule>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<{ gates: Gate[]; connections: Connection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleNameInput, setModuleNameInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingGateId, setRenamingGateId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [verilog, setVerilog] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showIds, setShowIds] = useState(false);
  const [clipboard, setClipboard] = useState<{ gates: Gate[]; connections: Connection[] } | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [workspaceStack, setWorkspaceStack] = useState<WorkspaceState[]>([]);
  const canvasRef = useRef<SVGSVGElement>(null);

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const pushToHistory = useCallback((newGates: Gate[], newConnections: Connection[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ gates: [...newGates], connections: [...newConnections] });
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGates(parsed.gates || []);
        setConnections(parsed.connections || []);
        setCustomModules(parsed.customModules || {});
        setScale(parsed.scale || 1);
        setOffset(parsed.offset || { x: 0, y: 0 });
        setHistory([{ gates: parsed.gates || [], connections: parsed.connections || [] }]);
        setHistoryIndex(0);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    } else {
      setHistory([{ gates: [], connections: [] }]);
      setHistoryIndex(0);
    }

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setShowIds(!!settings.showIds);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!editingModuleId) {
      const stateToSave = { gates, connections, customModules, scale, offset };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [gates, connections, customModules, scale, offset, editingModuleId]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showIds }));
  }, [showIds]);

  useEffect(() => {
    if (showVisionModal && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play failed", e));
    }
  }, [showVisionModal, cameraStream]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const newGates = gates.filter(g => !selectedIds.includes(g.id));
    const newConnections = connections.filter(
      c => !selectedIds.includes(c.fromGateId) && !selectedIds.includes(c.toGateId)
    );
    setGates(newGates);
    setConnections(newConnections);
    setSelectedIds([]);
    pushToHistory(newGates, newConnections);
    addNotification(`${selectedIds.length} element(s) deleted`, 'info');
  }, [gates, connections, selectedIds, pushToHistory, addNotification]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selectedGates = gates.filter(g => selectedIds.includes(g.id));
    const internalConnections = connections.filter(
      c => selectedIds.includes(c.fromGateId) && selectedIds.includes(c.toGateId)
    );
    setClipboard({ gates: selectedGates, connections: internalConnections });
    addNotification(`Copied ${selectedGates.length} element(s)`, 'success');
  }, [gates, connections, selectedIds, addNotification]);

  const pasteClipboard = useCallback(() => {
    if (!clipboard) return;

    const idMapping: Record<string, string> = {};
    const offsetPos = { x: 40, y: 40 };

    const newGates: Gate[] = clipboard.gates.map(g => {
      const newId = `${g.type.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;
      idMapping[g.id] = newId;
      return {
        ...g,
        id: newId,
        position: { x: g.position.x + offsetPos.x, y: g.position.y + offsetPos.y }
      };
    });

    const newConnections: Connection[] = clipboard.connections.map(c => ({
      ...c,
      id: `conn_${Math.random().toString(36).substr(2, 9)}`,
      fromGateId: idMapping[c.fromGateId],
      toGateId: idMapping[c.toGateId]
    }));

    const finalGates = [...gates, ...newGates];
    const finalConnections = [...connections, ...newConnections];

    setGates(finalGates);
    setConnections(finalConnections);
    setSelectedIds(newGates.map(g => g.id));
    pushToHistory(finalGates, finalConnections);
    
    setClipboard({
      gates: newGates,
      connections: newConnections
    });

    addNotification(`Pasted ${newGates.length} element(s)`, 'success');
  }, [clipboard, gates, connections, pushToHistory, addNotification]);

  const enterEditMode = useCallback((moduleId: string) => {
    const mod = customModules[moduleId];
    if (!mod) return;

    // Save current state
    const currentWS: WorkspaceState = {
      gates: [...gates],
      connections: [...connections],
      moduleId: editingModuleId,
      history: [...history],
      historyIndex: historyIndex
    };
    
    setWorkspaceStack(prev => [...prev, currentWS]);
    
    // Load module contents
    setGates(mod.gates);
    setConnections(mod.connections);
    setEditingModuleId(moduleId);
    setSelectedIds([]);
    setHistory([{ gates: mod.gates, connections: mod.connections }]);
    setHistoryIndex(0);
    resetView();
    addNotification(`Entering edit mode for "${mod.name}"`, 'info');
  }, [customModules, gates, connections, editingModuleId, history, historyIndex, addNotification]);

  const exitEditMode = useCallback(() => {
    if (workspaceStack.length === 0 || !editingModuleId) return;

    // 1. Save changes to current definition
    const internalInputs = gates.filter(g => g.type === GateType.INPUT);
    const internalOutputs = gates.filter(g => g.type === GateType.OUTPUT);
    
    const inputLabels = internalInputs.map(g => g.label || g.id);
    const outputLabels = internalOutputs.map(g => g.label || g.id);

    const updatedModule: CustomModule = {
      ...customModules[editingModuleId],
      gates: [...gates],
      connections: [...connections],
      inputLabels,
      outputLabels
    };

    const newCustomModules = { ...customModules, [editingModuleId]: updatedModule };

    // 2. Restore parent workspace
    const parentWS = workspaceStack[workspaceStack.length - 1];
    
    // 3. Sync instances in parent workspace
    const syncedGates = parentWS.gates.map(g => {
      if (g.moduleRef === editingModuleId) {
        return {
          ...g,
          inputCount: inputLabels.length,
          outputCount: outputLabels.length
        };
      }
      return g;
    });

    // Handle dangling connections in parent workspace if ports were removed
    const syncedConnections = parentWS.connections.filter(c => {
      const toGate = syncedGates.find(g => g.id === c.toGateId);
      if (toGate && toGate.moduleRef === editingModuleId) {
        return c.toInputIndex < inputLabels.length;
      }
      return true;
    });

    setCustomModules(newCustomModules);
    setGates(syncedGates);
    setConnections(syncedConnections);
    setEditingModuleId(parentWS.moduleId);
    setHistory(parentWS.history);
    setHistoryIndex(parentWS.historyIndex);
    setWorkspaceStack(prev => prev.slice(0, -1));
    addNotification("Module interior saved and synced", 'success');
  }, [editingModuleId, workspaceStack, gates, connections, customModules, addNotification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        deleteSelected();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (isInput) return;
        copySelected();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (isInput) return;
        pasteClipboard();
      }

      if (e.key === 'Escape' && editingModuleId) {
        exitEditMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, copySelected, pasteClipboard, editingModuleId, exitEditMode]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setGates(prevState.gates);
      setConnections(prevState.connections);
      setHistoryIndex(historyIndex - 1);
      setSelectedIds([]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setGates(nextState.gates);
      setConnections(nextState.connections);
      setHistoryIndex(historyIndex + 1);
      setSelectedIds([]);
    }
  }, [history, historyIndex]);

  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left) / scale - offset.x,
      y: (screenY - rect.top) / scale - offset.y
    };
  }, [scale, offset]);

  const getPortY = (gate: Gate, inputIndex: number, isOutput = false) => {
    let count = 0;
    if (isOutput) {
      count = gate.outputCount || 1;
    } else {
      count = gate.inputCount || (GATE_CONFIGS[gate.type]?.inputs || 0);
    }
    
    if (count <= 1) return 30;
    const padding = 10;
    const availableHeight = GATE_HEIGHT - (2 * padding);
    return padding + (inputIndex * (availableHeight / (count - 1)));
  };

  const handleExport = useCallback(() => {
    if (gates.length === 0) {
      addNotification("Add some logic gates first!", "warning");
      return;
    }
    const code = generateVerilog(gates, connections, customModules);
    setVerilog(code);
    setShowCode(true);
  }, [gates, connections, customModules, addNotification]);

  const addGate = useCallback((type: GateType, pos: Point, moduleRef?: string) => {
    const id = `${type.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;
    let defaultLabel = "";
    let inputCount = VARIABLE_INPUT_GATES.includes(type) ? 2 : undefined;
    let outputCount = undefined;

    if (type === GateType.INPUT || type === GateType.OUTPUT) {
      const prefix = type === GateType.INPUT ? "in" : "out";
      let count = 0;
      while (gates.some(g => g.label === `${prefix}_${count}`)) {
        count++;
      }
      defaultLabel = `${prefix}_${count}`;
    }

    if (type === GateType.CUSTOM && moduleRef) {
      const mod = customModules[moduleRef];
      if (mod) {
        defaultLabel = mod.name;
        inputCount = mod.inputLabels.length;
        outputCount = mod.outputLabels.length;
      }
    }

    const newGates = [...gates, { 
      id, 
      type, 
      position: pos, 
      label: defaultLabel || undefined, 
      inputCount, 
      outputCount,
      moduleRef 
    }];
    setGates(newGates);
    pushToHistory(newGates, connections);
  }, [gates, connections, customModules, pushToHistory]);

  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('gateType') as GateType;
    const moduleRef = e.dataTransfer.getData('moduleRef') || undefined;
    if (canvasRef.current && type) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      addGate(type, { x: pos.x - GATE_WIDTH / 2, y: pos.y - GATE_HEIGHT / 2 }, moduleRef);
    }
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    setSelectedIds([]);
    setDragState({ type: 'marquee', startPos: pos, currentPos: pos, selectionBox: { start: pos, end: pos } });
  };

  const onGateMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const isShiftPressed = e.shiftKey;
    let nextSelection = [...selectedIds];
    if (isShiftPressed) {
      if (nextSelection.includes(id)) {
        nextSelection = nextSelection.filter(sid => sid !== id);
      } else {
        nextSelection.push(id);
      }
    } else {
      if (!nextSelection.includes(id)) {
        nextSelection = [id];
      }
    }
    setSelectedIds(nextSelection);
    const initialPositions: Record<string, Point> = {};
    gates.forEach(g => { 
      if (nextSelection.includes(g.id)) {
        initialPositions[g.id] = { ...g.position }; 
      }
    });
    setDragState({ 
      type: 'gate', 
      id, 
      initialGatePositions: initialPositions, 
      startPos: { x: e.clientX, y: e.clientY }, 
      currentPos: { x: e.clientX, y: e.clientY } 
    });
  };

  const onPortMouseDown = (e: React.MouseEvent, gateId: string, isInput: boolean, inputIndex?: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const gate = gates.find(g => g.id === gateId);
    if (!gate) return;
    const startPos = isInput 
      ? { x: gate.position.x, y: gate.position.y + getPortY(gate, inputIndex || 0) } 
      : { x: gate.position.x + 80, y: gate.position.y + getPortY(gate, inputIndex || 0, true) };
    setDragState({ type: 'wire', fromId: gateId, currentPos: screenToCanvas(e.clientX, e.clientY), startPos, startFromInput: isInput, startInputIndex: inputIndex });
  };

  const onPortMouseUp = (e: React.MouseEvent, gateId: string, isInput: boolean, inputIndex?: number) => {
    if (dragState?.type === 'wire') {
      const { fromId, startFromInput, startInputIndex } = dragState;
      if (fromId === gateId) { setDragState(null); return; }
      let fromGateId = '', toGateId = '', targetInputIndex = 0, validConnection = false;
      if (!startFromInput && isInput && inputIndex !== undefined) {
        fromGateId = fromId!; toGateId = gateId; targetInputIndex = inputIndex; validConnection = true;
      } else if (startFromInput && !isInput) {
        fromGateId = gateId; toGateId = fromId!; targetInputIndex = startInputIndex!; validConnection = true;
      }
      if (validConnection) {
        const newConn: Connection = { id: `conn_${Math.random().toString(36).substr(2, 9)}`, fromGateId, toGateId, toInputIndex: targetInputIndex };
        const newConnections = connections.filter(c => !(c.toGateId === toGateId && c.toInputIndex === targetInputIndex)).concat(newConn);
        setConnections(newConnections); pushToHistory(gates, newConnections);
      }
    }
    setDragState(null);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - lastMousePos.current.x) / scale;
      const dy = (e.clientY - lastMousePos.current.y) / scale;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!dragState) return;
    if (dragState.type === 'gate' && dragState.initialGatePositions && dragState.startPos) {
      const dx = (e.clientX - dragState.startPos.x) / scale;
      const dy = (e.clientY - dragState.startPos.y) / scale;
      setGates(prev => prev.map(g => dragState.initialGatePositions![g.id] ? { ...g, position: { x: dragState.initialGatePositions![g.id].x + dx, y: dragState.initialGatePositions![g.id].y + dy } } : g));
    } else if (dragState.type === 'wire') {
      setDragState(prev => prev ? ({ ...prev, currentPos: screenToCanvas(e.clientX, e.clientY) }) : null);
    } else if (dragState.type === 'marquee' && dragState.startPos) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const xMin = Math.min(dragState.startPos.x, pos.x), xMax = Math.max(dragState.startPos.x, pos.x);
      const yMin = Math.min(dragState.startPos.y, pos.y), yMax = Math.max(dragState.startPos.y, pos.y);
      setSelectedIds(gates.filter(g => g.position.x + GATE_WIDTH >= xMin && g.position.x <= xMax && g.position.y + GATE_HEIGHT >= yMin && g.position.y <= yMax).map(g => g.id));
      setDragState(prev => prev ? ({ ...prev, selectionBox: { start: dragState.startPos!, end: pos }, currentPos: pos }) : null);
    }
  };

  const onMouseUp = () => { if (dragState?.type === 'gate') pushToHistory(gates, connections); setIsPanning(false); setDragState(null); };

  const clearCanvas = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleModuleCreation = () => {
    if (selectedIds.length < 1) return;
    
    const selectedGates = gates.filter(g => selectedIds.includes(g.id));
    
    for (const gate of selectedGates) {
      const expectedInputs = gate.inputCount || (GATE_CONFIGS[gate.type]?.inputs || 0);
      for (let i = 0; i < expectedInputs; i++) {
        const isConnected = connections.some(c => c.toGateId === gate.id && c.toInputIndex === i);
        if (!isConnected) {
          addNotification(`Incomplete Circuit: Gate ${gate.label || gate.id} has an unconnected input at index ${i}.`, 'error');
          return;
        }
      }
      if (gate.type !== GateType.OUTPUT) {
        const isConnected = connections.some(c => c.fromGateId === gate.id);
        if (!isConnected) {
          addNotification(`Incomplete Circuit: Output of ${gate.label || gate.id} is dangling.`, 'error');
          return;
        }
      }
    }

    const boundaryInputConns = connections.filter(c => selectedIds.includes(c.toGateId) && !selectedIds.includes(c.fromGateId));
    const boundaryOutputConns = connections.filter(c => selectedIds.includes(c.fromGateId) && !selectedIds.includes(c.toGateId));
    
    const internalInputGates = selectedGates.filter(g => g.type === GateType.INPUT);
    const internalOutputGates = selectedGates.filter(g => g.type === GateType.OUTPUT);

    if ((boundaryInputConns.length + internalInputGates.length) === 0) {
      addNotification("Invalid Module: At least one input source is required.", 'warning');
      return;
    }
    if ((boundaryOutputConns.length + internalOutputGates.length) === 0) {
      addNotification("Invalid Module: At least one output destination is required.", 'warning');
      return;
    }

    setModuleNameInput(`Module_${Object.keys(customModules).length + 1}`);
    setShowModuleModal(true);
  };

  const finalizeModule = () => {
    const name = moduleNameInput.trim();
    if (!name) return;

    const selectedGates = gates.filter(g => selectedIds.includes(g.id));
    
    const boundaryInputs = connections.filter(c => selectedIds.includes(c.toGateId) && !selectedIds.includes(c.fromGateId));
    const boundaryOutputs = connections.filter(c => selectedIds.includes(c.fromGateId) && !selectedIds.includes(c.toGateId));
    
    const internalInputGates = selectedGates.filter(g => g.type === GateType.INPUT);
    const internalOutputGates = selectedGates.filter(g => g.type === GateType.OUTPUT);

    const inputPorts = [
      ...boundaryInputs.map(c => ({ originalGateId: c.toGateId, inputIndex: c.toInputIndex, label: `in_${c.toGateId}_${c.toInputIndex}`, type: 'wire' })),
      ...internalInputGates.map(g => ({ originalGateId: g.id, inputIndex: -1, label: g.label || g.id, type: 'terminal' }))
    ];

    const outputSourceIds = Array.from(new Set([
      ...boundaryOutputs.map(c => c.fromGateId),
      ...internalOutputGates.map(g => g.id)
    ]));

    const outputPorts = outputSourceIds.map(sid => {
      const g = selectedGates.find(x => x.id === sid);
      return { originalGateId: sid, label: g?.label || sid };
    });

    const moduleId = `mod_${Math.random().toString(36).substr(2, 9)}`;
    const newModule: CustomModule = {
      id: moduleId,
      name,
      gates: selectedGates,
      connections: connections.filter(c => selectedIds.includes(c.fromGateId) && selectedIds.includes(c.toGateId)),
      inputLabels: inputPorts.map(p => p.label),
      outputLabels: outputPorts.map(p => p.label)
    };

    setCustomModules(prev => ({ ...prev, [moduleId]: newModule }));

    const avgX = selectedGates.reduce((acc, g) => acc + g.position.x, 0) / selectedGates.length;
    const avgY = selectedGates.reduce((acc, g) => acc + g.position.y, 0) / selectedGates.length;

    const moduleGate: Gate = {
      id: `gate_${moduleId}`,
      type: GateType.CUSTOM,
      position: { x: avgX, y: avgY },
      label: name,
      inputCount: inputPorts.length,
      outputCount: outputPorts.length,
      moduleRef: moduleId
    };

    const newGates = gates.filter(g => !selectedIds.includes(g.id)).concat(moduleGate);
    let newConnections = connections.filter(c => !selectedIds.includes(c.fromGateId) && !selectedIds.includes(c.toGateId));

    boundaryInputs.forEach((c) => {
      const portIndex = inputPorts.findIndex(p => p.originalGateId === c.toGateId && p.inputIndex === c.toInputIndex);
      if (portIndex !== -1) {
        newConnections.push({
          id: `rewire_in_${c.id}`,
          fromGateId: c.fromGateId,
          toGateId: moduleGate.id,
          toInputIndex: portIndex
        });
      }
    });

    boundaryOutputs.forEach(c => {
      const portIndex = outputPorts.findIndex(p => p.originalGateId === c.fromGateId);
      if (portIndex !== -1) {
        newConnections.push({
          id: `rewire_out_${c.id}`,
          fromGateId: moduleGate.id,
          toGateId: c.toGateId,
          toInputIndex: c.toInputIndex,
        });
      }
    });

    setGates(newGates);
    setConnections(newConnections);
    setSelectedIds([moduleGate.id]);
    setShowModuleModal(false);
    pushToHistory(newGates, newConnections);
    addNotification(`Module "${name}" created`, 'success');
  };

  const startRenaming = (gate: Gate) => {
    if (gate.type === GateType.INPUT || gate.type === GateType.OUTPUT || gate.type === GateType.CUSTOM) {
      setRenamingGateId(gate.id);
      setNewName(gate.label || '');
      setRenameError(null);
      setShowRenameModal(true);
    }
  };

  const finalizeRename = () => {
    const trimmed = newName.trim();
    if (!trimmed.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) { setRenameError("Invalid name."); return; }
    const newGates = gates.map(g => g.id === renamingGateId ? { ...g, label: trimmed } : g);
    setGates(newGates); pushToHistory(newGates, connections);
    setShowRenameModal(false); setRenamingGateId(null);
    addNotification("Terminal renamed", 'info');
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const toggleVisionModal = useCallback(async () => {
    if (!showVisionModal) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setCameraStream(stream);
        setShowVisionModal(true);
      } catch (err) {
        console.error("Camera access denied", err);
        addNotification("Camera access denied. Please enable permissions.", 'error');
      }
    } else {
      stopCamera();
      setShowVisionModal(false);
      setCapturedImage(null);
    }
  }, [showVisionModal, stopCamera, addNotification]);

  const captureFrame = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  }, [stopCamera]);

  const processWithAI = useCallback(async () => {
    if (!capturedImage) return;
    setIsVisionLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = capturedImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
            { text: "Convert this hand-drawn logic circuit into a JSON format. Provide an object with 'gates' (array of {id, type, x, y, label}) and 'connections' (array of {fromGateId, toGateId, toInputIndex}). Ensure 'type' matches one of: AND, OR, NOT, XOR, NOR, NAND, INPUT, OUTPUT. Coordinates x and y should be between 0 and 1000." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                  },
                  required: ["id", "type", "x", "y"],
                }
              },
              connections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fromGateId: { type: Type.STRING },
                    toGateId: { type: Type.STRING },
                    toInputIndex: { type: Type.NUMBER },
                  },
                  required: ["fromGateId", "toGateId", "toInputIndex"],
                }
              }
            },
            required: ["gates", "connections"],
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      const newGates: Gate[] = (result.gates || []).map((g: any) => ({
        id: g.id,
        type: g.type as GateType,
        position: { x: g.x, y: g.y },
        label: g.label,
        inputCount: VARIABLE_INPUT_GATES.includes(g.type as GateType) ? 2 : undefined
      }));

      const newConnections: Connection[] = (result.connections || []).map((c: any) => ({
        id: `conn_${Math.random().toString(36).substr(2, 9)}`,
        fromGateId: c.fromGateId,
        toGateId: c.toGateId,
        toInputIndex: c.toInputIndex
      }));

      setGates(newGates);
      setConnections(newConnections);
      pushToHistory(newGates, newConnections);
      setShowVisionModal(false);
      setCapturedImage(null);
      addNotification("Layout generated from drawing!", 'success');
    } catch (error) {
      console.error("AI Analysis failed:", error);
      addNotification("AI failed to interpret drawing. Please try again with a clearer image.", 'error');
    } finally {
      setIsVisionLoading(false);
    }
  }, [capturedImage, pushToHistory, addNotification]);

  const wiresToRender = useMemo(() => {
    return connections.map(conn => {
      const fromGate = gates.find(g => g.id === conn.fromGateId);
      const toGate = gates.find(g => g.id === conn.toGateId);
      if (!fromGate || !toGate) return null;
      const fromY = fromGate.position.y + 30; 
      const x1 = fromGate.position.x + 80, y1 = fromY;
      const x2 = toGate.position.x, y2 = toGate.position.y + getPortY(toGate, conn.toInputIndex);
      return <path key={conn.id} d={`M ${x1} ${y1} C ${x1 + (x2 - x1) / 2} ${y1}, ${x1 + (x2 - x1) / 2} ${y2}, ${x2} ${y2}`} className="wire" />;
    });
  }, [connections, gates]);

  const zoomIn = () => setScale(prev => Math.min(prev * 1.1, 3));
  const zoomOut = () => setScale(prev => Math.max(prev * 0.9, 0.2));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const toggleShowIds = () => {
    setShowIds(prev => {
      const newVal = !prev;
      addNotification(`ID Display ${newVal ? 'Enabled' : 'Disabled'}`, 'info');
      return newVal;
    });
  };

  const handleSidebarDragStart = (type: GateType, e: React.DragEvent, moduleRef?: string) => {
    e.dataTransfer.setData('gateType', type);
    if (moduleRef) e.dataTransfer.setData('moduleRef', moduleRef);
  };

  const canCreateModule = selectedIds.length > 1;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans no-select">
      <Sidebar customModules={customModules} onDragStart={handleSidebarDragStart} onEditModule={enterEditMode} />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">VerilogFlow</h1>
            
            {editingModuleId && (
              <div className="flex items-center gap-2 text-slate-500">
                <ChevronRight size={16} />
                <button onClick={exitEditMode} className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-md border border-sky-500/30 transition-all text-xs font-bold uppercase tracking-wider">
                  <ArrowLeft size={14} /> Back to Parent
                </button>
                <div className="h-4 w-[1px] bg-slate-800 mx-1" />
                <span className="text-xs font-mono text-slate-300">Editing: {customModules[editingModuleId]?.name}</span>
              </div>
            )}

            {!editingModuleId && (
              <button onClick={toggleVisionModal} className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 transition-all group">
                <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wider">Schematic Img To Layout</span>
              </button>
            )}

            <div className="flex items-center gap-1 ml-2">
              <button onClick={copySelected} disabled={selectedIds.length === 0} title="Copy Selected (Ctrl+C)" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-20 transition-all"><ClipboardCopy size={18} /></button>
              <button onClick={pasteClipboard} disabled={!clipboard} title="Paste (Ctrl+V)" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-20 transition-all"><ClipboardPaste size={18} /></button>
            </div>
            {canCreateModule && (
              <button onClick={handleModuleCreation} className="ml-2 flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-full border border-sky-500/30 transition-all group">
                <Box size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wider">Create Module</span>
              </button>
            )}
            <button 
              onClick={toggleShowIds} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${showIds ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/40 hover:bg-slate-800'}`}
              title="Toggle ID visibility"
            >
              <Hash size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Show IDs</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={undo} title="Undo" disabled={historyIndex <= 0} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-20 transition-all"><Undo2 size={20} /></button>
              <button onClick={redo} title="Redo" disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 disabled:opacity-20 transition-all"><Redo2 size={20} /></button>
            </div>
            <div className="w-[1px] h-6 bg-slate-800 mx-1" />
            <button onClick={clearCanvas} title="Clear Canvas" disabled={gates.length === 0} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 disabled:opacity-20 transition-all"><Trash2 size={18} /></button>
            <button onClick={deleteSelected} title="Delete Selection" disabled={selectedIds.length === 0} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 disabled:opacity-20 transition-all"><Eraser size={18} /></button>
            <button onClick={handleExport} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg"><Code size={18} /> Verilog</button>
          </div>
        </header>

        <div className="flex-1 relative bg-slate-900/20 overflow-hidden group/canvas">
          <svg ref={canvasRef} className={`w-full h-full canvas-grid ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`} onDragOver={onDragOver} onDrop={onDrop} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseDown={onCanvasMouseDown} onWheel={(e) => setScale(Math.min(Math.max(scale * (e.deltaY < 0 ? 1.1 : 0.9), 0.2), 3))} onContextMenu={e => e.preventDefault()}>
            <g transform={`scale(${scale}) translate(${offset.x}, ${offset.y})`}>
              {wiresToRender}
              {dragState?.type === 'wire' && dragState.startPos && <path d={`M ${dragState.startPos.x} ${dragState.startPos.y} L ${dragState.currentPos.x} ${dragState.currentPos.y}`} className="wire opacity-50" strokeDasharray="5,5" />}
              {dragState?.type === 'marquee' && dragState.selectionBox && <rect x={Math.min(dragState.selectionBox.start.x, dragState.selectionBox.end.x)} y={Math.min(dragState.selectionBox.start.y, dragState.selectionBox.end.y)} width={Math.abs(dragState.selectionBox.end.x - dragState.selectionBox.start.x)} height={Math.abs(dragState.selectionBox.end.y - dragState.selectionBox.start.y)} fill="rgba(56, 189, 248, 0.1)" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1" strokeDasharray="4,4" />}
              {gates.map((gate) => {
                const isSelected = selectedIds.includes(gate.id);
                const inputCount = gate.inputCount || (GATE_CONFIGS[gate.type]?.inputs || 0);
                const outputCount = gate.outputCount || 1;
                return (
                  <g key={gate.id} transform={`translate(${gate.position.x}, ${gate.position.y})`} onMouseDown={(e) => onGateMouseDown(e, gate.id)} onDoubleClick={() => startRenaming(gate)} className="cursor-move group/gate">
                    {isSelected && <rect x="-5" y="-5" width={GATE_WIDTH + 10} height={GATE_HEIGHT + 10} rx="8" fill="rgba(56, 189, 248, 0.15)" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.5" strokeDasharray="4,2" className="pointer-events-none" />}
                    <g className={isSelected ? 'text-sky-400' : 'text-sky-100'}>
                      <rect width={GATE_WIDTH} height={GATE_HEIGHT} fill="transparent" />
                      <g transform="translate(10, 0)" className="gate-symbol">{GatePaths[gate.type]}</g>
                    </g>
                    
                    {showIds && (
                      <text x={GATE_WIDTH / 2} y="-10" textAnchor="middle" className="font-mono text-[8px] fill-sky-500/60 pointer-events-none uppercase tracking-widest bg-slate-900/50">ID: {gate.id}</text>
                    )}

                    <text x={GATE_WIDTH / 2} y={GATE_HEIGHT + 15} textAnchor="middle" className={`font-mono text-[10px] uppercase tracking-tighter ${isSelected ? 'fill-sky-400 font-bold' : 'fill-slate-400'}`}>{gate.label || gate.id.split('_')[0]}</text>
                    
                    {Array.from({ length: inputCount }).map((_, idx) => (
                      <circle key={`${gate.id}-in-${idx}`} cx="0" cy={getPortY(gate, idx)} r="5" className="port fill-slate-700 stroke-slate-500 hover:fill-sky-400 hover:stroke-sky-200" onMouseDown={(e) => onPortMouseDown(e, gate.id, true, idx)} onMouseUp={(e) => onPortMouseUp(e, gate.id, true, idx)} />
                    ))}
                    {gate.type !== GateType.OUTPUT && Array.from({ length: outputCount }).map((_, idx) => (
                      <circle key={`${gate.id}-out-${idx}`} cx="80" cy={getPortY(gate, idx, true)} r="5" className="port fill-slate-700 stroke-slate-500 hover:fill-amber-400 hover:stroke-amber-200" onMouseDown={(e) => onPortMouseDown(e, gate.id, false, idx)} onMouseUp={(e) => onPortMouseUp(e, gate.id, false, idx)} />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-2xl">
              <button onClick={zoomIn} className="p-3 text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition-all border-b border-slate-700" title="Zoom In"><ZoomIn size={20} /></button>
              <button onClick={zoomOut} className="p-3 text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition-all border-b border-slate-700" title="Zoom Out"><ZoomOut size={20} /></button>
              <button onClick={resetView} className="p-3 text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition-all" title="Reset View"><Maximize size={20} /></button>
            </div>
          </div>

          <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-[100] max-w-sm pointer-events-none">
            {notifications.map((n) => (
              <div 
                key={n.id} 
                className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl pointer-events-auto animate-in slide-in-from-left duration-300
                  ${n.type === 'error' ? 'bg-rose-950/40 border-rose-500/50 text-rose-200' : ''}
                  ${n.type === 'warning' ? 'bg-amber-950/40 border-amber-500/50 text-amber-200' : ''}
                  ${n.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : ''}
                  ${n.type === 'info' ? 'bg-sky-950/40 border-sky-500/50 text-sky-200' : ''}
                `}
              >
                {n.type === 'error' && <AlertCircle size={20} className="shrink-0" />}
                {n.type === 'warning' && <AlertTriangle size={20} className="shrink-0" />}
                {n.type === 'success' && <Check size={20} className="shrink-0" />}
                {n.type === 'info' && <Info size={20} className="shrink-0" />}
                <p className="text-sm font-medium">{n.message}</p>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="ml-auto p-1 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {showModuleModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[80] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 text-sky-400"><Box size={32} /><h3 className="text-2xl font-bold">New Sub-Module</h3></div>
              <p className="text-slate-400 text-sm mb-4">Give your logic bundle a reusable name.</p>
              <input type="text" value={moduleNameInput} onChange={e => setModuleNameInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6 outline-none focus:border-sky-500 transition-colors" placeholder="Module Name" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => setShowModuleModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold hover:bg-slate-700 transition-colors">Cancel</button>
                <button onClick={finalizeModule} className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 transition-all shadow-lg shadow-sky-900/40">Create</button>
              </div>
            </div>
          </div>
        )}

        {showVisionModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div><h3 className="text-xl font-bold text-white">Hand-drawn Circuit Scan</h3><p className="text-slate-400 text-xs">Transform a photo into functional logic</p></div>
                <button onClick={() => { stopCamera(); setShowVisionModal(false); }} className="p-2 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-6">
                {!capturedImage ? (
                  <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center group">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {cameraStream ? (
                      <button onClick={captureFrame} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-4 border-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20"><div className="w-12 h-12 rounded-full bg-white" /></button>
                    ) : (<div className="flex flex-col items-center gap-3 text-slate-500"><Camera size={48} /><span className="text-sm">Camera unavailable</span></div>)}
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-6">
                    <img src={capturedImage} alt="Captured circuit" className="w-full aspect-video object-contain bg-slate-950 rounded-2xl border border-sky-500/30" />
                    {isVisionLoading ? (
                      <div className="flex flex-col items-center gap-4 py-8 text-sky-400 animate-pulse"><Loader2 size={48} className="animate-spin" /><p className="font-bold text-lg">Gemini is thinking...</p></div>
                    ) : (
                      <div className="flex gap-4">
                        <button onClick={() => setCapturedImage(null)} className="flex-1 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all">Retake Photo</button>
                        <button onClick={processWithAI} className="flex-1 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-2"><Sparkles size={18} /> Generate Layout</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRenameModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-xl font-bold mb-4">Rename Terminal</h3>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white mb-2" autoFocus />
              {renameError && <p className="text-rose-500 text-xs mb-4">{renameError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowRenameModal(false)} className="flex-1 py-2 bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={finalizeRename} className="flex-1 py-2 bg-sky-600 text-white rounded-xl">Update</button>
              </div>
            </div>
          </div>
        )}

        {showCode && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between"><span className="font-mono text-sm text-slate-400">output.sv</span><button onClick={() => setShowCode(false)} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
              <div className="flex-1 overflow-auto p-6 bg-slate-950 font-mono text-sm text-sky-400"><pre>{verilog}</pre></div>
              <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                <button onClick={async () => { await navigator.clipboard.writeText(verilog); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy'}</button>
                <button onClick={() => setShowCode(false)} className="px-6 py-2 bg-sky-600 rounded-lg text-white font-medium">Close</button>
              </div>
            </div>
          </div>
        )}

        {showClearConfirm && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4 text-rose-500"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-bold mb-2">Clear Canvas?</h3>
              <p className="text-slate-400 mb-8">This will delete all current progress.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 bg-slate-800 rounded-xl">Cancel</button>
                <button onClick={() => { setGates([]); setConnections([]); setCustomModules({}); setSelectedIds([]); setShowClearConfirm(false); pushToHistory([], []); addNotification("Canvas cleared", 'info'); }} className="flex-1 py-3 bg-rose-600 text-white rounded-xl">Clear All</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
