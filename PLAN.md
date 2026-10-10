# ZeroClash: Smart Campus Hub (Hero Section) Plan & Architecture

This document outlines the architecture, file tree, and implementation roadmap for the 3D isometric digital twin hero section of **ZeroClash / Smart Campus Hub**, matching the design reference `reference/campus-hub.jpeg` and icon assets `public/assets/icons/`.

---

## 1. Project Overview & Target Aesthetics
- **Target Aesthetic**: Dark cyberpunk isometric campus twin (`#050B14` background), neon cyan, green, and orange edge-glow architectural volumes, glowing courtyard pathways, floating teardrop pins with cropped equipment icons, and high-fidelity glassmorphic modals.
- **Hero Constraints**: Exactly `100vh` viewport height, smooth 60fps performance, zero console errors, smooth OrbitControls with damping, instant fuzzy search with automated camera focus and dimming.

---

## 2. File Tree Structure

```
c:\Users\lenovo\Desktop\ZeroClash\
├── index.html                                # Dark sci-fi theme root HTML with fonts
├── package.json                              # Vite, React 19, Three, R3F, Drei, Tailwind, Zustand
├── tsconfig.json                             # TypeScript configuration
├── tsconfig.node.json                        # Vite config TypeScript options
├── vite.config.ts                            # Vite configuration with @ path alias
├── tailwind.config.js                        # Cyberpunk palette, glassmorphism, animations
├── postcss.config.js                         # PostCSS setup
├── PROJECT_CONTEXT.md                        # Problem Statement 7 context & algorithms
├── reference/
│   └── campus-hub.jpeg                       # Target UI reference (IMAGE 2)
├── scripts/
│   └── crop_icons.py                         # One-time Pillow script to crop 8 icons
├── public/
│   ├── assets/
│   │   ├── equipment-sheet.jpeg              # 4x2 equipment icon sheet (IMAGE 1)
│   │   └── icons/
│   │       ├── camera.png                    # DSLR Camera circular badge
│   │       ├── gpu.png                       # GPU cluster badge
│   │       ├── vr.png                        # VR Headset badge
│   │       ├── microscope.png                # Microscope badge
│   │       ├── printer.png                   # 3D Printer badge
│   │       ├── projector.png                 # Projector badge
│   │       ├── labkit.png                    # Lab Kit badge
│   │       └── device.png                    # Testing Device badge
└── src/
    ├── main.tsx                              # Application entry point
    ├── App.tsx                               # Main layout (100vh Hero + #analytics anchor)
    ├── index.css                             # Cyberpunk Tailwind base & neon utilities
    ├── data/
    │   └── mock.ts                           # Typed schemas, buildings, equipment units, bookings
    ├── store/
    │   └── campusStore.ts                    # Zustand store (search, selection, modal, camera, layers)
    ├── components/
    │   ├── SciFiHeader.tsx                   # Top-center bracket title frame
    │   ├── SearchBar.tsx                     # Top search bar with fuzzy filter & clear
    │   ├── StatusLegend.tsx                  # Bottom-left Equipment Status card (🟢 🟡 🔴)
    │   ├── ViewportControls.tsx              # Bottom-right zoom buttons, layers & grid toggles, sparkle
    │   ├── ScrollIndicator.tsx               # Bottom-center bouncing chevron scrolling to #analytics
    │   ├── EquipmentModal.tsx                # Glassmorphic modal with availability & booking actions
    │   └── AnalyticsPlaceholder.tsx          # Below-the-fold placeholder section (#analytics)
    └── scene/
        ├── CampusCanvas.tsx                  # R3F Canvas, OrthographicCamera, Bloom EffectComposer
        ├── CampusGround.tsx                  # Isometric grid floor & glowing courtyard pathways
        ├── CampusBuildings.tsx               # 7 procedural wireframe edge-glow buildings
        ├── BuildingMesh.tsx                  # Individual building with architectural facade & hover
        ├── EquipmentPins.tsx                 # Floating billboarded teardrop pins with bobbing animation
        └── CameraController.tsx              # OrbitControls damping + search framing lerp
```

---

## 3. Building & Equipment Layout Mapping (Matching IMAGE 2)

| Building ID | Name | Theme Color | Position `[x, y, z]` | Architectural Elements | Equipment Assigned |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `bldg-science` | **Science Wing** | Cyan (`#00f0ff` / `#38bdf8`) | `[-7, 0, -5]` | L-shaped wing, tiered roofs, front portico, steps, window grid | DSLR Camera #01, 3D Printer #01 |
| `bldg-empty-blue`| **North Annex** | Dark Blue (`#0284c7` / `#1e3a8a`) | `[1, 0, -11]` | Stepped volumes, roof block (Empty building) | *None* |
| `bldg-media-1` | **Media Lab (NE)** | Green (`#22c55e` / `#4ade80`) | `[8, 0, -6]` | Rectangular block, front portico, roof parapet, window grids | DSLR Camera #04, GPU Cluster #01, VR Headset #01 |
| `bldg-empty-orange`| **Block E (East)**| Orange (`#ea580c` / `#f97316`)| `[12, 0, 1]` | Rectangular wireframe block, internal grid (Empty building) | *None* |
| `bldg-library` | **Main Library Locker** | Orange (`#f97316` / `#fb923c`) | `[6, 0, 7]` | Neoclassical facade, colonnade pillars, grand entrance steps | DSLR Camera #02, Projector #01 |
| `bldg-media-2` | **Media Lab (South)** | Green (`#22c55e` / `#4ade80`) | `[-1, 0, 9]` | Rectangular block, entrance steps, window grids | VR Headset #02, Microscope #01 |
| `bldg-media-3` | **Media Lab (SW)** | Green (`#22c55e` / `#4ade80`) | `[-6, 0, 4]` | Rectangular block, entrance steps, window grids | VR Headset #03, Microscope #02 |
