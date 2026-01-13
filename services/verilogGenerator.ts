import { Gate, Connection, GateType, CustomModule } from '../types';

export function generateVerilog(gates: Gate[], connections: Connection[], customModules: Record<string, CustomModule> = {}): string {
  const moduleName = "logic_circuit_generated";
  
  // Collect all unique custom module definitions used in this circuit
  const referencedModuleIds = Array.from(new Set(
    gates.filter(g => g.type === GateType.CUSTOM && g.moduleRef).map(g => g.moduleRef!)
  ));

  const subModuleDefinitions = referencedModuleIds.map(mid => {
    const mod = customModules[mid];
    if (!mod) return `// Error: Module definition for ${mid} not found`;
    return generateVerilogInternal(mod.gates, mod.connections, mod.name, customModules);
  });

  const mainModule = generateVerilogInternal(gates, connections, moduleName, customModules);

  return `${subModuleDefinitions.join('\n\n')}\n\n${mainModule}`;
}

function generateVerilogInternal(gates: Gate[], connections: Connection[], name: string, customModules: Record<string, CustomModule>): string {
  const inputs = gates.filter(g => g.type === GateType.INPUT);
  const outputs = gates.filter(g => g.type === GateType.OUTPUT);
  
  const inputPorts = inputs.map(i => `input logic ${i.label || i.id}`).join(', ');
  const outputPorts = outputs.map(o => `output logic ${o.label || o.id}`).join(', ');

  const wires: string[] = [];
  const body: string[] = [];

  // Track signal source for each input pin
  const inputConnectionsMap: Record<string, (string | null)[]> = {};
  gates.forEach(g => {
    const count = g.inputCount || (g.type === GateType.NOT || g.type === GateType.OUTPUT ? 1 : 2);
    inputConnectionsMap[g.id] = new Array(count).fill(null);
  });

  connections.forEach(conn => {
    const fromGate = gates.find(g => g.id === conn.fromGateId);
    if (fromGate) {
      // Logic for multi-output if supported would go here
      const signalName = fromGate.type === GateType.INPUT ? (fromGate.label || fromGate.id) : `w_${fromGate.id}`;
      if (fromGate.type !== GateType.INPUT && !wires.includes(signalName)) {
        wires.push(signalName);
      }
      if (inputConnectionsMap[conn.toGateId]) {
        inputConnectionsMap[conn.toGateId][conn.toInputIndex] = signalName;
      }
    }
  });

  gates.forEach(gate => {
    const inputsToGate = inputConnectionsMap[gate.id] || [];
    const operands = inputsToGate.map(sig => sig || "1'b0");
    const outSignal = gate.type === GateType.OUTPUT ? (gate.label || gate.id) : `w_${gate.id}`;

    switch (gate.type) {
      case GateType.AND:
        body.push(`  assign ${outSignal} = ${operands.join(' & ')};`);
        break;
      case GateType.OR:
        body.push(`  assign ${outSignal} = ${operands.join(' | ')};`);
        break;
      case GateType.NOT:
        body.push(`  assign ${outSignal} = ~${operands[0]};`);
        break;
      case GateType.XOR:
        body.push(`  assign ${outSignal} = ${operands.join(' ^ ')};`);
        break;
      case GateType.NAND:
        body.push(`  assign ${outSignal} = ~(${operands.join(' & ')});`);
        break;
      case GateType.NOR:
        body.push(`  assign ${outSignal} = ~(${operands.join(' | ')});`);
        break;
      case GateType.OUTPUT:
        body.push(`  assign ${gate.label || gate.id} = ${operands[0]};`);
        break;
      case GateType.CUSTOM:
        const modDef = gate.moduleRef ? customModules[gate.moduleRef] : null;
        if (modDef) {
          // Instantiate the custom module
          const instanceName = `inst_${gate.id}`;
          const portMappings = [
            ...modDef.inputLabels.map((label, idx) => `.${label}(${operands[idx] || "1'b0"})`),
            ...modDef.outputLabels.map((label, idx) => `.${label}(${outSignal})`) // Simplified: assumes 1 main output wire if not expanded
          ];
          body.push(`  ${modDef.name} ${instanceName} (\n    ${portMappings.join(',\n    ')}\n  );`);
        }
        break;
      default:
        break;
    }
  });

  return `module ${name} (
  ${inputPorts}${inputPorts && outputPorts ? ',' : ''}
  ${outputPorts}
);

${wires.length > 0 ? '  // Internal wires\n  wire ' + wires.join(', ') + ';\n' : ''}
${body.join('\n')}

endmodule`;
}