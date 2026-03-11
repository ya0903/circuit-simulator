# 🔌 Circuit Simulator

A browser‑based interactive circuit building tool designed for beginners learning electronics and programming.

Users can build simple electrical circuits, connect components with wires and see live calculations for current, voltage and power.

This project demonstrates the crossover between **electrical engineering** and **software development** using JavaScript and HTML5 canvas.

---
## 👍Try it out!

https://ya0903.github.io/circuit-simulator/

---
## ✨ Features

### 🧩 Circuit Building

* Add batteries, resistors, LEDs, switches, capacitors, inductors and diodes
* Add ammeters and voltmeters for measurements
* Junction nodes for parallel branches
* Drag-and-drop component placement
* Search bar to quickly find components

### 🔌 Wiring System

* Manual wire drawing between terminals
* Right-angle wire routing for clarity
* Wire mode toggle for quick connections
* Lock point mode for custom wire corners and path control
* Visual wire highlighting when current flows
* Undo support for wiring and layout changes

### ⚡ Circuit Simulation

* Automatic series circuit analysis
* Automatic parallel circuit analysis
* Equivalent resistance calculation
* Ohm’s Law current calculation
* Voltage drop estimation
* Power dissipation calculations

### 💡 Visual Feedback

* LEDs glow when powered
* Active wires glow green
* Clear open vs closed circuit status
* Per‑component electrical readings

### 🧰 Tools

* Auto layout for series circuits
* Auto layout for parallel circuits
* Clear wires tool
* Reset workspace tool
* Undo button for recent changes
* Lock point mode for manual right-angle wire shaping
* Component search mode for faster placement

### 🎛️ Interactive Editing

* Click components to edit values
* Change resistance
* Adjust battery voltage
* Set LED forward voltage and colour
* Edit capacitance and inductance values
* Toggle switches open or closed
* Attach voltmeter probes to components

---

## 🖥️ Tech Stack

* **HTML5 Canvas** for schematic rendering
* **CSS3** for modern responsive UI
* **Vanilla JavaScript** for simulation logic

No frameworks or libraries used.

---

## 📂 Project Structure

```
circuit-simulator/
├── index.html   → Main UI and layout
├── style.css    → Visual design and responsive layout
└── script.js    → Circuit logic and simulation engine
```

---

## 🚀 How to Run

### Option 1 — Quick Start

1. Download all project files
2. Ensure these three files are in the same folder:

   * `index.html`
   * `style.css`
   * `script.js`
3. Double‑click `index.html`
4. The simulator opens in your web browser

### Option 2 — Using VS Code (recommended)

1. Open the folder in VS Code
2. Install the **Live Server** extension
3. Right‑click `index.html`
4. Click **Open with Live Server**

This enables automatic refresh when editing code.

---

## 🧪 Example Circuits to Try

### 🔹 Series Circuit

1. Add Battery
2. Add Resistor
3. Add LED
4. Click **Auto Layout Series**
5. Click **Run Simulation**

### 🔹 Parallel Circuit

1. Add Battery
2. Add Two Resistors
3. Click **Auto Layout Parallel**
4. Click **Run Simulation**

### 🔹 Manual Wiring

1. Add components
2. Turn **Wire Mode** on
3. Click one terminal
4. Turn **Lock Point Mode** on if you want custom corners
5. Click on the canvas to place one or more lock points
6. Click another terminal to complete the wire
7. Run simulation

### 🔹 Search and Add Components

1. Use the search box in the component panel
2. Type a name such as `capacitor`, `inductor` or `diode`
3. Click the matching component button to add it

### 🔹 Undo Changes

1. Move a component, add a wire or add a component
2. Click **Undo** to step back one change

---

## 🎓 Learning Outcomes

This project helps demonstrate:

* Basic circuit theory
* Ohm's Law in action
* Series vs parallel behaviour
* Power dissipation concepts
* Interactive graphical programming
* Canvas rendering techniques
* Event-driven UI design
* UI state management with undo history
* Search and filtering logic in JavaScript
* Path-based wire drawing with manual lock points

---

## 💼 Portfolio Value

This project is useful for showcasing:

✅ Engineering knowledge
✅ JavaScript programming
✅ UI design skills
✅ Simulation logic
✅ Problem solving

Ideal for applications in:

* Electrical Engineering
* Electronic Engineering
* Embedded Systems
* Software Engineering
* Robotics
* Mechatronics

---

## 🔮 Possible Future Improvements

* Real SPICE-level simulation
* Oscilloscope tool
* More accurate capacitor and inductor behaviour
* AC signal analysis
* Save and load circuits
* Multi-select and box selection
* Mobile touch gestures
* Dark/light theme toggle

---

## 📜 License

Free to use for educational and portfolio purposes.

---

## 👤 Author

Created as an educational engineering project combining electronics and programming.
