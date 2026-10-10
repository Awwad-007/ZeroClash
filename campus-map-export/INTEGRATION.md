# 3D Campus Map Hero Module (ZeroClash Digital Twin) - Integration Guide

A self-contained, portable 3D isometric digital twin hero section for campus equipment booking. Built with React, Three.js, React Three Fiber (R3F), Drei, Postprocessing (Bloom), Zustand, and Tailwind CSS.

---

## 1. What This Is & Visual Expectation

This module renders a **100vh interactive sci-fi isometric campus map**:
- **3D Isometric World**: 7 architectural campus buildings rendered with dark architectural concrete materials, illuminated window matrices, HVAC units, antennae with blinking warning lights, entrance porticos, and glowing pathways over a dark cyber grid (`#050B14`).
- **Floating HTML Equipment Pins**: Floating teardrop pins bobbing smoothly over building roofs with custom equipment icons (cameras, GPUs, VR headsets, microscopes, 3D printers, projectors), colored status indicator dots, and building name labels.
- **Top HUD & Live Search**: Sci-fi bracketed HUD title banner (`[ SMART CAMPUS HUB ]`), status indicator pill (`LIVE`), and an instant search bar that highlights matching equipment/buildings, centers the camera smoothly, and dims non-matching pins.
- **Glassmorphic Equipment Inspection Modal**: Clicking any pin opens a docked glassmorphic card on the top right showing unit specs, live availability ("AVAILABLE until 04:00 PM" / "IN USE until 05:30 PM"), next booking info, and action buttons (`Book Slot` and `Join Waitlist`).
- **Camera Navigation**: Smooth mouse rotation, panning lock, zoom in/out controls, wireframe layer toggle, and grid visibility toggle.
- **Scroll Indicator**: Bottom center chevron that triggers smooth navigation to the next section below the fold.

*Reference Image*: See `reference/campus-hub.jpeg` in this package for the visual baseline.

---

## 2. Prerequisites & Version Requirements

| Stack Layer | Recommended (Default) | Alternative (React 18 Projects) |
| :--- | :--- | :--- |
| **React** | `^19.0.0` | `^18.3.1` |
| **@react-three/fiber** | `^9.1.2` (v9 for React 19) | `^8.17.10` (v8 for React 18) |
| **@react-three/drei** | `^10.0.3` | `^9.121.4` |
| **three** | `^0.174.0` | `^0.164.1` |
| **@react-three/postprocessing** | `^3.0.4` | `^2.16.2` |
| **postprocessing** | `^6.36.7` | `^6.35.3` |
| **zustand** | `^5.0.3` | `^4.5.5` or `^5.0.3` |
| **lucide-react** | `^0.477.0` | `^0.477.0` |
| **Tailwind CSS** | `^3.4.0` | `^3.4.0` |

> **Note on React 18 vs React 19**:
> The component source code in `src/features/campus-map/` uses standard R3F JSX tags (`<Canvas>`, `<mesh>`, `<group>`, `<OrbitControls>`, `<Html>`, `<EffectComposer>`, `<Bloom>`) which are 100% syntactically compatible with both R3F v9 (React 19) and R3F v8 (React 18). No code edits are required if using React 18—simply install the React 18 compatible dependency versions listed above.

---

## 3. Dependency Installation

### If your target project uses React 19:
```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing zustand lucide-react
npm install -D @types/three tailwindcss autoprefixer postcss
```

### If your target project uses React 18:
```bash
npm install three@^0.164.1 @react-three/fiber@^8.17.10 @react-three/drei@^9.121.4 @react-three/postprocessing@^2.16.2 postprocessing@^6.35.3 zustand@^4.5.5 lucide-react
npm install -D @types/three@^0.164.1 tailwindcss autoprefixer postcss
```

---

## 4. File Placement & Style Configuration

### Step 4.1: Copy Folders
1. Copy `src/features/campus-map/` into your project's `src/features/campus-map/`.
2. Copy `public/assets/icons/` into your project's `public/assets/icons/`.
   *(Ensure files like `camera.png`, `gpu.png`, `vr.png` are accessible at `http://localhost:<port>/assets/icons/<name>.png`)*.

### Step 4.2: Merge Tailwind Configuration
Open your project's `tailwind.config.js` (or `tailwind.config.ts`):
1. **Add content path**:
   ```javascript
   content: [
     "./index.html",
     "./src/**/*.{js,ts,jsx,tsx}",
     "./src/features/campus-map/**/*.{js,ts,jsx,tsx}" // <-- Add this
   ],
   ```
2. **Merge theme extensions** from `tailwind.snippet.js`:
   ```javascript
   theme: {
     extend: {
       colors: {
         campus: {
           bg: '#050B14',
           surface: 'rgba(10, 18, 30, 0.75)',
           border: 'rgba(56, 189, 248, 0.25)',
           cyan: '#00f0ff',
           blue: '#0284c7',
           green: '#22c55e',
           orange: '#f97316',
           red: '#ef4444',
           yellow: '#eab308',
         },
       },
       boxShadow: {
         'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.35), 0 0 30px rgba(0, 240, 255, 0.15)',
         'neon-green': '0 0 15px rgba(34, 197, 94, 0.35), 0 0 30px rgba(34, 197, 94, 0.15)',
         'neon-orange': '0 0 15px rgba(249, 115, 22, 0.35), 0 0 30px rgba(249, 115, 22, 0.15)',
         'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
       },
       animation: {
         'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
         'bounce-subtle': 'bounceSubtle 2s infinite ease-in-out',
       },
     },
   },
   ```

### Step 4.3: Import CSS
In your global CSS entry file (e.g. `src/index.css` or `src/App.css`):
```css
@import './features/campus-map/map-styles.css';
```
*(Or copy the contents of `map-styles.css` directly into your main CSS file).*

---

## 5. Usage Example (Hero Section)

Mount `<CampusMap />` directly in your page or layout as the hero section:

```tsx
import React, { useState } from 'react';
import { CampusMap, toMapEquipmentList, toMapBuildingList } from './features/campus-map';
import type { RawEquipmentInput, RawBuildingInput } from './features/campus-map';

export const HomePage: React.FC = () => {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Example handler when user clicks "Book Slot" in the map modal
  const handleBookSlot = (unitId: string) => {
    console.log('Open booking modal for unit:', unitId);
    // Open your app's existing booking modal / drawer
  };

  // Example handler when user clicks "Join Waitlist" in the map modal
  const handleJoinWaitlist = (unitId: string) => {
    console.log('Join waitlist for unit:', unitId);
    // Open your app's existing waitlist modal / drawer
  };

  const handleScrollDown = () => {
    const nextSection = document.getElementById('details-section');
    nextSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-100 flex flex-col">
      {/* 100vh 3D Hero Map */}
      <CampusMap
        onBookSlot={handleBookSlot}
        onJoinWaitlist={handleJoinWaitlist}
        onSelectUnit={(id) => setSelectedUnitId(id)}
        onScrollDown={handleScrollDown}
        title="Smart Campus Hub"
        badgeText="v2.4 Live"
      />

      {/* Host App's Existing Content Below The Fold */}
      <section id="details-section" className="p-8 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Equipment Booking & Analytics</h2>
        {/* Your existing tables, calendars, or cards */}
      </section>
    </div>
  );
};
```

> **Standalone Demo**: If you omit `buildings` and `equipment` props, `<CampusMap />` automatically renders the pre-packaged demo campus with 7 buildings and 10 equipment units.

---

## 6. Data Contract & Adapter Mapping

### `EquipmentUnit` Contract
```typescript
interface EquipmentUnit {
  id: string;               // Unique ID, e.g. "eq-cam-01"
  name: string;             // Display name, e.g. "DSLR Camera"
  unitNumber: string;       // Unit badge, e.g. "#01"
  type: string;             // "camera" | "gpu" | "vr" | "microscope" | "printer" | "projector" | "labkit" | "device"
  iconUrl: string;          // Path to public icon, e.g. "/assets/icons/camera.png"
  buildingId: string;       // Parent building ID, e.g. "bldg-science"
  buildingName: string;     // Display location, e.g. "Science Wing - Lab 102"
  status: 'available' | 'booked' | 'maintenance';
  statusText: string;       // e.g. "AVAILABLE until 04:00 PM" or "IN USE until 05:30 PM (Devin T.)"
  currentBooking?: {
    userName: string;
    startTime?: string;
    endTime?: string;
    userRole?: string;
  };
  nextBooking?: {
    userName: string;
    startTime: string;
    endTime: string;
  };
  specs: {
    model: string;          // e.g. "Sony Alpha 7 IV Mirrorless"
    resolution?: string;
    vram?: string;
    features?: string;
  };
  aliases: string[];        // Search keywords, e.g. ["sony", "camera", "dslr"]
}
```

### `Building` Contract
```typescript
interface Building {
  id: string;               // e.g. "bldg-science"
  name: string;             // e.g. "Science Wing"
  code: string;             // e.g. "SW-01"
  category: 'science' | 'media' | 'library' | 'annex' | 'archive' | string;
  colorTheme: 'cyan' | 'green' | 'orange' | 'dark-blue';
  neonColor: string;        // Hex string, e.g. "#00e5ff"
  fillColor: string;        // Hex string, e.g. "#0284c7"
  position: [number, number, number]; // [X, Y, Z] 3D coordinates
  size: [number, number, number];     // [Width, Height, Depth]
  rotation?: [number, number, number];
  architecturalType: 'science-wing' | 'stepped-annex' | 'media-hall' | 'classical-library' | 'cube-archive';
  equipmentIds: string[];   // Array of unit IDs housed here
}
```

### Target Project Concept -> Map Field Mapping Table
| Target Project Concept | Map Field | Adapter Function |
| :--- | :--- | :--- |
| `item.id` / `device.uuid` | `id` | `raw.id` |
| `item.title` / `device.name` | `name` | `raw.name` |
| `item.category` | `type` | auto-resolves icon if one of the 8 types |
| `item.room` / `item.building` | `buildingId`, `buildingName` | matches target building |
| `item.is_broken` / `device.is_serviced` | `status = 'maintenance'` | `deriveEquipmentStatus({ isMaintenance: true })` |
| `item.current_reservation` | `status = 'booked'`, `currentBooking` | `deriveEquipmentStatus({ activeBooking: ... })` |
| `item.next_reservation` | `status = 'available'`, `nextBooking` | `deriveEquipmentStatus({ nextBooking: ... })` |

### Using `adapter.ts`:
```typescript
import { toMapEquipment, toMapBuilding } from './features/campus-map';

const hostRawUnits = await fetch('/api/my-equipment').then(r => r.json());
const mapEquipment = hostRawUnits.map(unit => toMapEquipment({
  id: unit.id,
  name: unit.title,
  type: unit.category,
  buildingId: unit.location_id,
  buildingName: unit.location_name,
  isMaintenance: unit.under_repair,
  activeBooking: unit.current_user ? { userName: unit.current_user.name, endTime: unit.booking_end } : undefined,
  nextBooking: unit.next_user ? { userName: unit.next_user.name, startTime: unit.next_start } : undefined,
}));
```

---

## 7. Event Flow & Live State Updates

```
+-------------------------------------------------------------------------+
|                               HOST APP                                  |
|                                                                         |
|  1. Pass props: <CampusMap equipment={units} buildings={buildings} />  |
|                                                                         |
|  2. User clicks pin / building -> onSelectUnit(unitId) fires           |
|                                                                         |
|  3. Modal opens -> User clicks "Book Slot" -> onBookSlot(unitId) fires  |
|                                                                         |
|  4. Host app executes booking API call                                  |
|                                                                         |
|  5. Host app updates its state -> passes new `equipment` array via prop |
|                                                                         |
|  6. <CampusMap /> updates reactively: status dot turns RED (booked),   |
|     building edge glows red, "Book Slot" becomes disabled.              |
+-------------------------------------------------------------------------+
```

### Button Disabled Rules:
- **Available**: `Book Slot` (enabled), `Join Waitlist` (enabled).
- **Booked**: `Book Slot` (disabled - "Booked (Waitlist Only)"), `Join Waitlist` (enabled).
- **Maintenance**: `Book Slot` (disabled), `Join Waitlist` (disabled).

---

## 8. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Blank Canvas / Dark Screen** | Camera position or clear color error | Check browser console. Ensure WebGL is supported and parent container has height (`h-screen` or fixed height). |
| **Icons not showing on pins** | Public asset path mismatch | Ensure icons are located in `public/assets/icons/`. If the host app uses a different public subfolder or CDN, pass `iconUrl` in each equipment object or configure Vite `publicDir`. |
| **Postprocessing / Bloom crash** | Multiple Three.js instances or version clash | Ensure only ONE version of `three` is installed. Run `npm ls three` to check. If using React 18, use `@react-three/postprocessing@^2.16.2`. |
| **Tailwind styles missing** | `content` path missing in `tailwind.config.js` | Add `"./src/features/campus-map/**/*.{js,ts,jsx,tsx}"` to the `content` array in `tailwind.config.js`. |
| **Modal doesn't close on click outside** | Canvas click propagation | Clicking anywhere on the canvas or pressing `Esc` closes the modal automatically. |
| **WebGL Context Lost** | Hot reloading too frequently in dev | Refresh the browser tab. The built-in `<ErrorBoundary>` catches fatal WebGL errors and shows a reload button. |

---

## 9. Ready-to-Paste Prompt for AI Coding Agent

If you are using an AI coding assistant (Antigravity, Cursor, GitHub Copilot, Codex, etc.) to integrate this map into the target project, paste the following prompt:

```markdown
You are an expert React and Three.js engineer. I want to integrate the 3D Campus Map hero module from `./campus-map-export/` into our project.

Follow these strict instructions step by step:

1. WORK ON A BRANCH:
   Create and switch to a new git branch: `feature/3d-map`.

2. ANALYZE OUR PROJECT:
   Inspect our project first:
   - Check `package.json`: What React version are we on (React 18 or 19)? What package manager?
   - Check our styling: Are we using Tailwind CSS? Check `tailwind.config.*`.
   - Check our equipment/device/room data model and existing booking API or state.
   - Do NOT delete, overwrite, or break any existing features, endpoints, or pages.

3. COPY MODULE FILES:
   - Copy `campus-map-export/src/features/campus-map/` into `src/features/campus-map/`.
   - Copy `campus-map-export/public/assets/icons/` into `public/assets/icons/`.
   - Import `campus-map-export/map-styles.css` into our global CSS file.
   - Merge `campus-map-export/tailwind.snippet.js` into our `tailwind.config.js`, and ensure `content` includes `./src/features/campus-map/**/*.{js,ts,jsx,tsx}`.

4. INSTALL DEPENDENCIES:
   Check `campus-map-export/package.json.deps.json`.
   - If we are on React 19: install the recommended React 19 stack.
   - If we are on React 18: install the React 18 compatible versions (R3F v8, drei v9, postprocessing v2).

5. WIRE DATA ADAPTER:
   - Open `src/features/campus-map/adapter.ts`.
   - Map our project's real equipment, rooms, and bookings into the map's `toMapEquipment` and `toMapBuilding` functions.

6. MOUNT THE HERO COMPONENT:
   - Mount `<CampusMap />` at the top of our main page as a 100vh hero section.
   - Wire `onBookSlot(unitId)` to open our app's existing booking flow.
   - Wire `onJoinWaitlist(unitId)` to open our app's existing waitlist flow.
   - Wire `onScrollDown()` to smoothly scroll down to our existing page content.

7. TEST AND VERIFY:
   - Run type checks (`tsc --noEmit` or build) and ensure zero TypeScript errors.
   - Run the development server and verify in the browser:
     - 3D buildings and lighting render without console errors.
     - Equipment pins bob and display icons.
     - Search bar filters pins and focuses camera.
     - Clicking a pin opens the glassmorphic modal.
     - "Book Slot" and "Join Waitlist" trigger our flows.
   - Ensure our existing below-the-fold features continue working completely intact.
```
