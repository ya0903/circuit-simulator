const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const GRID_SIZE = 20;
const SYMBOL_HALF_WIDTH = 44;
const TERMINAL_HIT_RADIUS = 18;

const state = {
  components: [],
  wires: [],
  lockPoints: [],
  selectedId: null,
  nextId: 1,
  drag: { active: false, dx: 0, dy: 0 },
  wireMode: false,
  lockPointMode: false,
  pendingWire: null,
  mousePos: null,
  lastSimulation: null,
  logicalWidth: 1400,
  logicalHeight: 788,
  history: [],
};

const outputs = {
  selectedPanel: document.getElementById("selectedPanel"),
  explanation: document.getElementById("explanation"),
  supplyVoltage: document.getElementById("supplyVoltage"),
  equivalentResistance: document.getElementById("equivalentResistance"),
  totalCurrent: document.getElementById("totalCurrent"),
  totalPower: document.getElementById("totalPower"),
  circuitType: document.getElementById("circuitType"),
  circuitStatus: document.getElementById("circuitStatus"),
  componentBreakdown: document.getElementById("componentBreakdown"),
  wireModeBtn: document.getElementById("wireModeBtn"),
  wireStatusBadge: document.getElementById("wireStatusBadge"),
  lockPointBtn: document.getElementById("lockPointBtn"),
  componentSearch: document.getElementById("componentSearch"),
};

function saveHistory() {
  state.history.push(
    JSON.stringify({
      components: state.components,
      wires: state.wires,
      lockPoints: state.lockPoints,
      selectedId: state.selectedId,
      nextId: state.nextId,
    })
  );
  if (state.history.length > 50) state.history.shift();
}

function undoLastAction() {
  if (!state.history.length) return;
  const snapshot = JSON.parse(state.history.pop());
  state.components = snapshot.components;
  state.wires = snapshot.wires;
  state.lockPoints = snapshot.lockPoints || [];
  state.selectedId = snapshot.selectedId;
  state.nextId = snapshot.nextId;
  updateSelectedPanel();
  runSimulation();
  draw();
}

function snapToGrid(value, spacing = GRID_SIZE) {
  return Math.round(value / spacing) * spacing;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createComponent(type) {
  const index = state.components.length;
  const x = snapToGrid(180 + (index % 5) * 180);
  const y = snapToGrid(180 + Math.floor(index / 5) * 140);

  return {
    id: state.nextId++,
    type,
    x,
    y,
    width: 120,
    height: 64,
    voltage: type === "battery" ? 9 : undefined,
    resistance: type === "resistor" ? 220 : undefined,
    forwardVoltage: type === "led" || type === "diode" ? 2 : undefined,
    capacitance: type === "capacitor" ? 100 : undefined,
    inductance: type === "inductor" ? 10 : undefined,
    colour: type === "led" ? "red" : undefined,
    switchClosed: type === "switch" ? true : undefined,
    measuredCurrent: 0,
    measuredVoltage: 0,
    power: 0,
    lit: false,
    probeA: null,
    probeB: null,
  };
}

function addComponent(type) {
  saveHistory();
  const component = createComponent(type);
  state.components.push(component);
  state.selectedId = component.id;
  updateSelectedPanel();
  runSimulation();
  draw();
}

function componentById(id) {
  return state.components.find(component => component.id === id);
}

function selectedComponent() {
  return componentById(state.selectedId);
}

function getTerminals(component) {
  return [
    { componentId: component.id, kind: "left", x: component.x - SYMBOL_HALF_WIDTH, y: component.y },
    { componentId: component.id, kind: "right", x: component.x + SYMBOL_HALF_WIDTH, y: component.y },
  ];
}

function terminalKey(terminal) {
  return `${terminal.componentId}:${terminal.kind}`;
}

function allTerminals() {
  return state.components.flatMap(getTerminals);
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function nearestTerminal(x, y) {
  let best = null;
  for (const terminal of allTerminals()) {
    const d = distance(x, y, terminal.x, terminal.y);
    if (d < TERMINAL_HIT_RADIUS && (!best || d < best.d)) best = { ...terminal, d };
  }
  return best;
}

function nearestLockPoint(x, y) {
  let best = null;
  for (const point of state.lockPoints) {
    const d = distance(x, y, point.x, point.y);
    if (d < 12 && (!best || d < best.d)) best = point;
  }
  return best;
}

function getComponentAt(x, y) {
  for (let i = state.components.length - 1; i >= 0; i -= 1) {
    const component = state.components[i];
    if (
      x >= component.x - component.width / 2 &&
      x <= component.x + component.width / 2 &&
      y >= component.y - component.height / 2 &&
      y <= component.y + component.height / 2
    ) {
      return component;
    }
  }
  return null;
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const displayWidth = Math.round(rect.width * dpr);
  const displayHeight = Math.round(rect.height * dpr);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  state.logicalWidth = rect.width;
  state.logicalHeight = rect.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function toCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawBreadboardBackground() {
  const cols = Math.ceil(state.logicalWidth / 60);
  const rows = Math.ceil(state.logicalHeight / 60);

  ctx.save();
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const x = 40 + col * 60;
      const y = 40 + row * 60;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTerminal(terminal, highlighted = false) {
  ctx.save();
  ctx.fillStyle = highlighted ? "#4cc3ff" : "rgba(230,237,247,0.92)";
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(terminal.x, terminal.y, highlighted ? 5.5 : 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function buildWirePoints(start, end, lockPoints = []) {
  return [start, ...lockPoints, end];
}

function drawOrthogonalSegments(points, dashed = false, active = false) {
  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = active ? "#1ec66b" : dashed ? "#4cc3ff" : "#95a4bd";
  ctx.lineWidth = active ? 4 : 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (dashed) ctx.setLineDash([8, 8]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const horizontalFirst = Math.abs(dx) >= Math.abs(dy);

    if (horizontalFirst) {
      ctx.lineTo(curr.x, prev.y);
    } else {
      ctx.lineTo(prev.x, curr.y);
    }
    ctx.lineTo(curr.x, curr.y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawWire(wire) {
  const aComponent = componentById(wire.from.componentId);
  const bComponent = componentById(wire.to.componentId);
  if (!aComponent || !bComponent) return;

  const a = getTerminals(aComponent).find(terminal => terminal.kind === wire.from.kind);
  const b = getTerminals(bComponent).find(terminal => terminal.kind === wire.to.kind);
  if (!a || !b) return;

  drawOrthogonalSegments(buildWirePoints(a, b, wire.lockPoints || []), false, wire.active);
}

function drawSelectionGlow() {
  ctx.save();
  ctx.strokeStyle = "rgba(76,195,255,0.95)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(76,195,255,0.4)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBattery(component) {
  ctx.strokeStyle = "#e6edf7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(-14, 0);
  ctx.moveTo(14, 0);
  ctx.lineTo(40, 0);
  ctx.moveTo(-8, -18);
  ctx.lineTo(-8, 18);
  ctx.moveTo(8, -28);
  ctx.lineTo(8, 28);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.voltage}V`, 0, 42);
}

function drawResistor(component) {
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-20, -12);
  ctx.lineTo(-10, 12);
  ctx.lineTo(0, -12);
  ctx.lineTo(10, 12);
  ctx.lineTo(20, -12);
  ctx.lineTo(30, 0);
  ctx.lineTo(44, 0);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.resistance}Ω`, 0, 42);
}

function drawCapacitor(component) {
  ctx.strokeStyle = "#e6edf7";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-12, 0);
  ctx.moveTo(-6, -18);
  ctx.lineTo(-6, 18);
  ctx.moveTo(6, -18);
  ctx.lineTo(6, 18);
  ctx.moveTo(12, 0);
  ctx.lineTo(44, 0);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.capacitance}µF`, 0, 42);
}

function drawInductor(component) {
  ctx.strokeStyle = "#e6edf7";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-26, 0);
  ctx.stroke();

  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(-18 + i * 12, 0, 6, Math.PI, 0);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(44, 0);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.inductance}mH`, 0, 42);
}

function drawLed(component) {
  if (component.lit) {
    ctx.shadowColor = component.colour || "red";
    ctx.shadowBlur = 20;
  }

  ctx.strokeStyle = "#e6edf7";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(-18, 0);
  ctx.moveTo(18, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();

  ctx.fillStyle = component.colour || "red";
  ctx.beginPath();
  ctx.moveTo(-18, -15);
  ctx.lineTo(10, 0);
  ctx.lineTo(-18, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, -20);
  ctx.lineTo(14, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(16, -40);
  ctx.moveTo(10, -40);
  ctx.lineTo(16, -40);
  ctx.lineTo(16, -34);
  ctx.moveTo(12, -12);
  ctx.lineTo(28, -28);
  ctx.moveTo(22, -28);
  ctx.lineTo(28, -28);
  ctx.lineTo(28, -22);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.forwardVoltage}V LED`, 0, 42);
}

function drawDiode(component) {
  ctx.strokeStyle = "#e6edf7";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(-18, 0);
  ctx.moveTo(18, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-18, -15);
  ctx.lineTo(10, 0);
  ctx.lineTo(-18, 15);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, -18);
  ctx.lineTo(14, 18);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(`${component.forwardVoltage}V diode`, 0, 42);
}

function drawSwitch(component) {
  ctx.strokeStyle = component.switchClosed ? "#1ec66b" : "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-28, 10, 4, 0, Math.PI * 2);
  ctx.arc(28, 10, 4, 0, Math.PI * 2);
  ctx.fillStyle = component.switchClosed ? "#1ec66b" : "#ef4444";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-28, 10);
  if (component.switchClosed) ctx.lineTo(28, 10);
  else ctx.lineTo(10, -8);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "600 13px Inter, Arial, sans-serif";
  ctx.fillText(component.switchClosed ? "Closed" : "Open", 0, 42);
}

function drawMeter(component, label, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(-22, 0);
  ctx.moveTo(22, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#e6edf7";
  ctx.font = "700 18px Inter, Arial, sans-serif";
  ctx.fillText(label, 0, 6);

  ctx.font = "600 13px Inter, Arial, sans-serif";
  if (component.type === "ammeter") ctx.fillText(`${component.measuredCurrent.toFixed(3)}A`, 0, 42);
  else ctx.fillText(`${component.measuredVoltage.toFixed(2)}V`, 0, 42);
}

function drawJunction() {
  ctx.fillStyle = "#e6edf7";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawLockPoints() {
  for (const point of state.lockPoints) {
    ctx.save();
    ctx.fillStyle = "rgba(139,92,246,0.95)";
    ctx.strokeStyle = "#020617";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawComponent(component) {
  const selected = component.id === state.selectedId;
  ctx.save();
  ctx.translate(component.x, component.y);
  ctx.textAlign = "center";

  if (selected) drawSelectionGlow();

  if (component.type === "battery") drawBattery(component);
  if (component.type === "resistor") drawResistor(component);
  if (component.type === "capacitor") drawCapacitor(component);
  if (component.type === "inductor") drawInductor(component);
  if (component.type === "led") drawLed(component);
  if (component.type === "diode") drawDiode(component);
  if (component.type === "switch") drawSwitch(component);
  if (component.type === "ammeter") drawMeter(component, "A", "#4cc3ff");
  if (component.type === "voltmeter") drawMeter(component, "V", "#8b5cf6");
  if (component.type === "junction") drawJunction();

  ctx.fillStyle = "rgba(149,164,189,0.92)";
  ctx.font = "600 12px Inter, Arial, sans-serif";
  const labelOffset = component.type === "junction" ? -18 : -34;
  const label = component.type.charAt(0).toUpperCase() + component.type.slice(1);
  ctx.fillText(label, 0, labelOffset);
  ctx.restore();

  for (const terminal of getTerminals(component)) {
    const highlighted = Boolean(
      component.id === state.selectedId ||
      (state.pendingWire && terminalKey(state.pendingWire) === terminalKey(terminal))
    );
    drawTerminal(terminal, highlighted);
  }
}

function drawPendingWirePreview() {
  if (!state.pendingWire || !state.mousePos) return;
  drawOrthogonalSegments(buildWirePoints(state.pendingWire, state.mousePos, state.lockPoints), true, false);
}

function draw() {
  resizeCanvasForDisplay();
  ctx.clearRect(0, 0, state.logicalWidth, state.logicalHeight);
  drawBreadboardBackground();
  state.wires.forEach(drawWire);
  drawLockPoints();
  state.components.forEach(drawComponent);
  drawPendingWirePreview();
}

function setWireMode(on) {
  state.wireMode = on;
  state.pendingWire = null;
  if (!on) {
    state.lockPointMode = false;
    state.lockPoints = [];
    outputs.lockPointBtn.textContent = "Lock Point Mode: Off";
  }
  outputs.wireModeBtn.textContent = `Wire Mode: ${on ? "On" : "Off"}`;
  outputs.wireStatusBadge.textContent = on ? "Wire Mode On" : "Wire Mode Off";
  draw();
}

function setLockPointMode(on) {
  state.lockPointMode = on;
  outputs.lockPointBtn.textContent = `Lock Point Mode: ${on ? "On" : "Off"}`;
}

function updateSelectedPanel() {
  const component = selectedComponent();
  if (!component) {
    outputs.selectedPanel.innerHTML = "Click a component on the board to edit it.";
    outputs.selectedPanel.className = "selected-panel empty-state";
    return;
  }

  outputs.selectedPanel.className = "selected-panel";
  let html = `<div><strong>${component.type.charAt(0).toUpperCase() + component.type.slice(1)}</strong></div>`;

  if (component.type === "battery") {
    html += `<div><label>Voltage (V)</label><input id="editVoltage" type="number" min="1" max="48" step="0.1" value="${component.voltage}"></div>`;
  }

  if (component.type === "resistor") {
    html += `<div><label>Resistance (Ω)</label><input id="editResistance" type="number" min="1" max="100000" step="1" value="${component.resistance}"></div>`;
  }

  if (component.type === "capacitor") {
    html += `<div><label>Capacitance (µF)</label><input id="editCapacitance" type="number" min="1" max="100000" step="1" value="${component.capacitance}"></div>`;
  }

  if (component.type === "inductor") {
    html += `<div><label>Inductance (mH)</label><input id="editInductance" type="number" min="1" max="100000" step="1" value="${component.inductance}"></div>`;
  }

  if (component.type === "led" || component.type === "diode") {
    html += `
      <div class="component-edit-grid">
        <div><label>Forward Voltage</label><input id="editLedV" type="number" min="0.1" max="4" step="0.1" value="${component.forwardVoltage}"></div>
        ${component.type === "led" ? `<div>
          <label>Colour</label>
          <select id="editLedColour">
            <option value="red" ${component.colour === "red" ? "selected" : ""}>Red</option>
            <option value="lime" ${component.colour === "lime" ? "selected" : ""}>Green</option>
            <option value="yellow" ${component.colour === "yellow" ? "selected" : ""}>Yellow</option>
            <option value="cyan" ${component.colour === "cyan" ? "selected" : ""}>Blue</option>
          </select>
        </div>` : ""}
      </div>`;
  }

  if (component.type === "switch") {
    html += `<div><button id="toggleSwitchBtn" type="button">Toggle Switch, currently ${component.switchClosed ? "Closed" : "Open"}</button></div>`;
  }

  if (component.type === "voltmeter") {
    const options = state.components
      .filter(item => item.id !== component.id)
      .map(item => `<option value="${item.id}">${item.type} #${item.id}</option>`)
      .join("");

    html += `
      <div class="component-edit-grid">
        <div><label>Probe A</label><select id="probeA"><option value="">None</option>${options}</select></div>
        <div><label>Probe B</label><select id="probeB"><option value="">None</option>${options}</select></div>
      </div>`;
  }

  html += `<div><button id="deleteSelected" class="button-danger" type="button">Delete Selected</button></div>`;
  outputs.selectedPanel.innerHTML = html;

  const bindInput = (id, handler) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (element.tagName === "BUTTON") element.onclick = handler;
    else {
      element.oninput = handler;
      element.onchange = handler;
    }
  };

  bindInput("editVoltage", event => {
    component.voltage = Math.max(0.1, parseFloat(event.target.value) || 0.1);
    runSimulation();
    draw();
  });

  bindInput("editResistance", event => {
    component.resistance = Math.max(1, parseFloat(event.target.value) || 1);
    runSimulation();
    draw();
  });

  bindInput("editCapacitance", event => {
    component.capacitance = Math.max(1, parseFloat(event.target.value) || 1);
    runSimulation();
    draw();
  });

  bindInput("editInductance", event => {
    component.inductance = Math.max(1, parseFloat(event.target.value) || 1);
    runSimulation();
    draw();
  });

  bindInput("editLedV", event => {
    component.forwardVoltage = Math.max(0.1, parseFloat(event.target.value) || 0.1);
    runSimulation();
    draw();
  });

  bindInput("editLedColour", event => {
    component.colour = event.target.value;
    draw();
  });

  bindInput("toggleSwitchBtn", () => {
    component.switchClosed = !component.switchClosed;
    updateSelectedPanel();
    runSimulation();
    draw();
  });

  bindInput("probeA", event => {
    component.probeA = event.target.value ? Number(event.target.value) : null;
    runSimulation();
    draw();
  });

  bindInput("probeB", event => {
    component.probeB = event.target.value ? Number(event.target.value) : null;
    runSimulation();
    draw();
  });

  const probeA = document.getElementById("probeA");
  const probeB = document.getElementById("probeB");
  if (probeA) probeA.value = component.probeA ?? "";
  if (probeB) probeB.value = component.probeB ?? "";

  bindInput("deleteSelected", deleteSelected);
}

function deleteSelected() {
  const id = state.selectedId;
  if (!id) return;
  saveHistory();
  state.components = state.components.filter(component => component.id !== id);
  state.wires = state.wires.filter(wire => wire.from.componentId !== id && wire.to.componentId !== id);
  state.selectedId = null;
  updateSelectedPanel();
  runSimulation();
  draw();
}

function buildGraph() {
  const graph = new Map();

  function addEdge(a, b) {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push(b);
    graph.get(b).push(a);
  }

  allTerminals().forEach(terminal => {
    const key = terminalKey(terminal);
    if (!graph.has(key)) graph.set(key, []);
  });

  state.wires.forEach(wire => addEdge(terminalKey(wire.from), terminalKey(wire.to)));

  state.components.forEach(component => {
    const [left, right] = getTerminals(component);
    if (["battery", "resistor", "led", "diode", "ammeter", "junction", "voltmeter", "capacitor", "inductor"].includes(component.type)) {
      addEdge(terminalKey(left), terminalKey(right));
    }
    if (component.type === "switch" && component.switchClosed) {
      addEdge(terminalKey(left), terminalKey(right));
    }
  });

  return graph;
}

function bfs(graph, start) {
  const queue = [start];
  const seen = new Set([start]);

  while (queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return seen;
}

function findBattery() {
  return state.components.find(component => component.type === "battery");
}

function countConnectionsForComponent(component) {
  const terminals = getTerminals(component);
  return state.wires.filter(wire => terminals.some(terminal => terminalKey(terminal) === terminalKey(wire.from) || terminalKey(terminal) === terminalKey(wire.to))).length;
}

function inferCircuitType() {
  const junctions = state.components.filter(component => component.type === "junction").length;
  if (junctions > 0) return "Parallel / Mixed";
  const branched = state.components.some(component => countConnectionsForComponent(component) > 2);
  return branched ? "Parallel / Mixed" : "Series";
}

function activeLoads() {
  return state.components.filter(component => ["resistor", "led", "diode", "capacitor", "inductor"].includes(component.type));
}

function estimateEquivalentResistance() {
  const loads = activeLoads();
  if (!loads.length) return 0;

  const circuitType = inferCircuitType();
  const pseudoResistance = loads.map(component => {
    if (component.type === "resistor") return component.resistance;
    if (component.type === "led" || component.type === "diode") return 120;
    if (component.type === "capacitor") return 180;
    if (component.type === "inductor") return 150;
    return 100;
  });

  if (circuitType === "Series") {
    return pseudoResistance.reduce((total, value) => total + value, 0);
  }

  const inverseTotal = pseudoResistance.reduce((sum, value) => sum + (value > 0 ? 1 / value : 0), 0);
  return inverseTotal > 0 ? 1 / inverseTotal : 0;
}

function setOutputs({ supply, req, current, power, type, status, explanation }) {
  outputs.supplyVoltage.textContent = `${supply.toFixed(2)} V`;
  outputs.equivalentResistance.textContent = `${req.toFixed(2)} Ω`;
  outputs.totalCurrent.textContent = `${current.toFixed(4)} A`;
  outputs.totalPower.textContent = `${power.toFixed(4)} W`;
  outputs.circuitType.textContent = type;
  outputs.circuitStatus.textContent = status;
  outputs.explanation.textContent = explanation;
}

function renderBreakdown() {
  if (!state.components.length) {
    outputs.componentBreakdown.textContent = "No components yet.";
    outputs.componentBreakdown.className = "readings-list empty-state";
    return;
  }

  outputs.componentBreakdown.className = "readings-list";
  outputs.componentBreakdown.innerHTML = state.components.map(component => {
    let title = `${component.type.charAt(0).toUpperCase() + component.type.slice(1)} #${component.id}`;
    let detail = `Current: <strong>${(component.measuredCurrent || 0).toFixed(4)} A</strong>, Voltage: <strong>${(component.measuredVoltage || 0).toFixed(4)} V</strong>, Power: <strong>${(component.power || 0).toFixed(4)} W</strong>`;

    if (component.type === "resistor") title += `, ${component.resistance} Ω`;
    if (component.type === "battery") title += `, ${component.voltage} V`;
    if (component.type === "capacitor") title += `, ${component.capacitance} µF`;
    if (component.type === "inductor") title += `, ${component.inductance} mH`;
    if (component.type === "led") title += `, forward ${component.forwardVoltage} V, <span class="${component.lit ? "good" : "bad"}">${component.lit ? "ON" : "OFF"}</span>`;
    if (component.type === "diode") title += `, forward ${component.forwardVoltage} V`;
    if (component.type === "switch") title += `, <span class="${component.switchClosed ? "good" : "bad"}">${component.switchClosed ? "Closed" : "Open"}</span>`;
    if (component.type === "ammeter") detail = `Reading: <strong>${(component.measuredCurrent || 0).toFixed(4)} A</strong>`;
    if (component.type === "voltmeter") detail = `Reading: <strong>${(component.measuredVoltage || 0).toFixed(4)} V</strong>`;

    return `<div class="reading-item"><strong>${title}</strong><br>${detail}</div>`;
  }).join("");
}

function runSimulation() {
  state.components.forEach(component => {
    component.measuredCurrent = 0;
    component.measuredVoltage = 0;
    component.power = 0;
    if (component.type === "led") component.lit = false;
  });

  state.wires.forEach(wire => {
    wire.active = false;
  });

  const battery = findBattery();
  if (!battery) {
    setOutputs({
      supply: 0,
      req: 0,
      current: 0,
      power: 0,
      type: "Unknown",
      status: "Open",
      explanation: "Add a battery to power the circuit.",
    });
    renderBreakdown();
    return;
  }

  const graph = buildGraph();
  const [left, right] = getTerminals(battery);
  const reachable = bfs(graph, terminalKey(left));
  const closed = reachable.has(terminalKey(right));
  const circuitType = inferCircuitType();
  const equivalentResistance = estimateEquivalentResistance();
  const leds = state.components.filter(component => component.type === "led");
  const openSwitch = state.components.some(component => component.type === "switch" && !component.switchClosed);

  if (!closed || openSwitch) {
    setOutputs({
      supply: battery.voltage,
      req: equivalentResistance,
      current: 0,
      power: 0,
      type: circuitType,
      status: openSwitch ? "Open Switch" : "Open Circuit",
      explanation: "The battery terminals are not connected through a complete closed path, or a switch is open.",
    });
    renderBreakdown();
    return;
  }

  const ledDrop = leds.reduce((sum, led) => sum + led.forwardVoltage, 0);
  const effectiveVoltage = Math.max(0, battery.voltage - (circuitType === "Series" ? ledDrop : Math.min(ledDrop, battery.voltage * 0.5)));
  const totalCurrent = equivalentResistance > 0 ? effectiveVoltage / equivalentResistance : 0;
  const totalPower = battery.voltage * totalCurrent;

  state.components.forEach(component => {
    if (component.type === "resistor") {
      if (circuitType === "Series") {
        component.measuredCurrent = totalCurrent;
        component.measuredVoltage = totalCurrent * component.resistance;
      } else {
        component.measuredVoltage = battery.voltage;
        component.measuredCurrent = battery.voltage / component.resistance;
      }
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "capacitor") {
      component.measuredVoltage = battery.voltage * 0.5;
      component.measuredCurrent = totalCurrent * 0.35;
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "inductor") {
      component.measuredVoltage = battery.voltage * 0.4;
      component.measuredCurrent = totalCurrent * 0.45;
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "led") {
      component.measuredVoltage = component.forwardVoltage;
      component.measuredCurrent = circuitType === "Series" ? totalCurrent : Math.max(0.001, totalCurrent / Math.max(1, leds.length));
      component.lit = component.measuredCurrent > 0.002 && battery.voltage > component.forwardVoltage;
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "diode") {
      component.measuredVoltage = component.forwardVoltage;
      component.measuredCurrent = totalCurrent * 0.9;
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "battery") {
      component.measuredVoltage = component.voltage;
      component.measuredCurrent = totalCurrent;
      component.power = component.voltage * totalCurrent;
    }

    if (component.type === "switch") {
      component.measuredCurrent = totalCurrent;
      component.measuredVoltage = component.switchClosed ? 0 : battery.voltage;
      component.power = component.measuredVoltage * component.measuredCurrent;
    }

    if (component.type === "ammeter") {
      component.measuredCurrent = totalCurrent;
      component.measuredVoltage = 0;
      component.power = 0;
    }

    if (component.type === "voltmeter") {
      const a = componentById(component.probeA);
      const b = componentById(component.probeB);
      if (a && b) component.measuredVoltage = Math.abs((a.measuredVoltage || 0) - (b.measuredVoltage || 0));
      else if (a) component.measuredVoltage = a.measuredVoltage || 0;
      else component.measuredVoltage = battery.voltage;
      component.measuredCurrent = 0;
      component.power = 0;
    }
  });

  state.wires.forEach(wire => {
    wire.active = totalCurrent > 0;
  });

  const explanation = circuitType === "Series"
    ? `Series model detected. Equivalent resistance is ${equivalentResistance.toFixed(2)} Ω, effective voltage is ${effectiveVoltage.toFixed(2)} V and total current is ${totalCurrent.toFixed(4)} A using Ohm's law.`
    : `Parallel or mixed model detected. Equivalent resistance is estimated as ${equivalentResistance.toFixed(2)} Ω and total current is approximately ${totalCurrent.toFixed(4)} A. Branch currents are estimated per component.`;

  setOutputs({
    supply: battery.voltage,
    req: equivalentResistance,
    current: totalCurrent,
    power: totalPower,
    type: circuitType,
    status: "Closed",
    explanation,
  });

  renderBreakdown();
}

function connectRightToLeft(a, b) {
  state.wires.push({
    from: { componentId: a.id, kind: "right" },
    to: { componentId: b.id, kind: "left" },
    lockPoints: [],
    active: false,
  });
}

function createAndInsert(type) {
  const component = createComponent(type);
  state.components.push(component);
  return component;
}

function autoLayoutSeries() {
  saveHistory();
  const startX = 140;
  const y = snapToGrid(state.logicalHeight / 2);

  state.components.forEach((component, index) => {
    component.x = snapToGrid(startX + index * 170);
    component.y = y;
  });

  state.wires = [];
  for (let i = 0; i < state.components.length - 1; i += 1) {
    connectRightToLeft(state.components[i], state.components[i + 1]);
  }
  if (state.components.length > 1) {
    connectRightToLeft(state.components[state.components.length - 1], state.components[0]);
  }

  runSimulation();
  draw();
}

function autoLayoutParallel() {
  saveHistory();
  const battery = findBattery();
  if (!battery) return;

  battery.x = 140;
  battery.y = snapToGrid(state.logicalHeight / 2);

  const existingJunctions = state.components.filter(component => component.type === "junction");
  const junctionA = existingJunctions[0] || createAndInsert("junction");
  const junctionB = existingJunctions[1] || createAndInsert("junction");
  junctionA.x = 320;
  junctionA.y = snapToGrid(state.logicalHeight * 0.3);
  junctionB.x = 320;
  junctionB.y = snapToGrid(state.logicalHeight * 0.7);

  const branches = state.components.filter(component => !["battery", "junction", "ammeter", "voltmeter"].includes(component.type));
  branches.forEach((component, index) => {
    component.x = snapToGrid(560 + index * 150);
    component.y = snapToGrid(state.logicalHeight * 0.3 + index * 110);
  });

  state.wires = [];
  connectRightToLeft(battery, junctionA);
  connectRightToLeft(junctionB, battery);

  branches.forEach(component => {
    state.wires.push({
      from: { componentId: junctionA.id, kind: "right" },
      to: { componentId: component.id, kind: "left" },
      lockPoints: [],
      active: false,
    });
    state.wires.push({
      from: { componentId: component.id, kind: "right" },
      to: { componentId: junctionB.id, kind: "left" },
      lockPoints: [],
      active: false,
    });
  });

  runSimulation();
  draw();
}

function clearAll() {
  saveHistory();
  state.components = [];
  state.wires = [];
  state.lockPoints = [];
  state.selectedId = null;
  state.pendingWire = null;
  updateSelectedPanel();
  runSimulation();
  draw();
}

function clearWires() {
  saveHistory();
  state.wires = [];
  state.lockPoints = [];
  state.pendingWire = null;
  runSimulation();
  draw();
}

document.querySelectorAll("[data-type]").forEach(button => {
  button.addEventListener("click", () => addComponent(button.dataset.type));
});

document.getElementById("wireModeBtn").addEventListener("click", () => setWireMode(!state.wireMode));
document.getElementById("lockPointBtn").addEventListener("click", () => setLockPointMode(!state.lockPointMode));
document.getElementById("undoBtn").addEventListener("click", undoLastAction);
document.getElementById("seriesLayoutBtn").addEventListener("click", autoLayoutSeries);
document.getElementById("parallelLayoutBtn").addEventListener("click", autoLayoutParallel);
document.getElementById("simulateBtn").addEventListener("click", () => {
  runSimulation();
  draw();
});
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.getElementById("clearWiresBtn").addEventListener("click", clearWires);

outputs.componentSearch.addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#componentButtons [data-type]").forEach(button => {
    const text = button.textContent.toLowerCase();
    button.classList.toggle("hidden-component", query && !text.includes(query));
  });
});

canvas.addEventListener("mousedown", event => {
  const { x, y } = toCanvasCoordinates(event);
  const terminal = nearestTerminal(x, y);
  const lockPoint = nearestLockPoint(x, y);

  if (state.wireMode && state.lockPointMode && state.pendingWire && !terminal) {
    saveHistory();
    if (lockPoint) {
      state.lockPoints = state.lockPoints.filter(point => point !== lockPoint);
    } else {
      state.lockPoints.push({ x: snapToGrid(x), y: snapToGrid(y) });
    }
    draw();
    return;
  }

  if (state.wireMode && terminal) {
    if (!state.pendingWire) {
      state.pendingWire = terminal;
      state.lockPoints = [];
    } else if (terminalKey(state.pendingWire) !== terminalKey(terminal)) {
      saveHistory();
      state.wires.push({
        from: { componentId: state.pendingWire.componentId, kind: state.pendingWire.kind },
        to: { componentId: terminal.componentId, kind: terminal.kind },
        lockPoints: [...state.lockPoints],
        active: false,
      });
      state.pendingWire = null;
      state.lockPoints = [];
      runSimulation();
    } else {
      state.pendingWire = null;
      state.lockPoints = [];
    }
    draw();
    return;
  }

  const component = getComponentAt(x, y);
  if (component) {
    state.selectedId = component.id;
    state.drag.active = true;
    state.drag.dx = x - component.x;
    state.drag.dy = y - component.y;
    updateSelectedPanel();
  } else {
    state.selectedId = null;
    updateSelectedPanel();
  }
  draw();
});

canvas.addEventListener("mousemove", event => {
  const { x, y } = toCanvasCoordinates(event);
  state.mousePos = { x: snapToGrid(x), y: snapToGrid(y) };

  if (!state.drag.active) {
    draw();
    return;
  }

  const component = selectedComponent();
  if (!component) return;

  component.x = clamp(snapToGrid(x - state.drag.dx), 70, state.logicalWidth - 70);
  component.y = clamp(snapToGrid(y - state.drag.dy), 70, state.logicalHeight - 70);
  draw();
});

window.addEventListener("mouseup", () => {
  state.drag.active = false;
});

window.addEventListener("resize", () => {
  draw();
});

updateSelectedPanel();
runSimulation();
draw();