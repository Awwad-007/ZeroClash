# Project: ZeroClash (Engine) / Smart Campus Hub (Frontend)
**Team GALACTICOS**  
**Problem Statement 7**: Shared Equipment Booking & Conflict Management  
**Focus**: Architecture, UI/UX, Edge Cases, and Feasibility (Design Round)

---

## 1. Problem Overview
Universities share scarce and high-value research/academic equipment (DSLRs, GPU clusters, VR headsets, microscopes, projectors, lab kits, testing devices). Overlapping requests, manual paper trails, and lack of real-time visibility cause reservation clashes, ghost bookings, and idle gear.

---

## 2. Core Workflow
1. **Equipment Discovery**: The user explores the isometric 3D campus digital twin or searches by equipment type, building location, or keywords.
2. **Availability Check**: Real-time validation checks for existing interval conflicts.
3. **Booking Resolution**:
   - **Available**: The booking is immediately accepted and locked.
   - **In Use / Booked**: The slot is marked unavailable; user can join an automated waitlist with priority ranking.
   - **Maintenance**: Hardware locked out with administrative override.
4. **Lifecycle & Updates**: Users can cancel or modify existing bookings, triggering instant cascade notifications and reallocations in real-time over WebSockets.

---

## 3. Scope & Requirements
- **Must-Haves**:
  - Comprehensive equipment catalog with unit IDs and location mapping.
  - Time-based slot booking with instant interval conflict detection.
  - Cancellation handling with instant state updates.
- **Stretch Goals**:
  - Automated waitlist promotion with temporary lock windows.
  - Predictive demand analytics and usage heatmaps.
  - High-precision moving-average utilization forecasting.
- **Edge Cases**:
  - Concurrent race conditions during simultaneous booking attempts.
  - Unscheduled hardware maintenance lockout.
  - Instant reallocation cascade when high-priority slots are vacated.

---

## 4. User Experience Architecture
- **Tier A (Hero Section - Current Implementation)**:
  - 100vh dark cyberpunk 3D isometric digital twin campus map.
  - Procedural translucent edge-glow building volumes with neon shaders.
  - Real-time floating billboard teardrop pins with cropped icon badges and bobbing animation.
  - Interactive glassmorphic inspection modals with availability dots and quick actions.
  - Instant fuzzy search with camera focus and dimming of non-matching assets.
- **Tier B (Below the Fold / Analytics & Calendar - Next Phase)**:
  - Interactive Gantt booking calendar (color-coded availability, loans, clashes).
  - Drag-to-select interval booking with instant overlap collision validation.
  - Facility usage heatmap and moving-average demand forecasting charts.
  - Waitlist priority matrix with scoring algorithms (role + urgency + track record).
  - Administrative maintenance override and hardware telemetry panel.

---

## 5. Conflict Resolution & Waitlist Algorithm
- **Conflict Logic**:  
  A clash occurs if and only if an active booking exists where:  
  $$\text{start\_time} < \text{requested\_end} \quad \text{AND} \quad \text{end\_time} > \text{requested\_start}$$  
  for the exact same equipment unit ID.
- **Concurrency Control**:  
  Database row locking (`SELECT ... FOR UPDATE`) prevents double-booking race conditions during checkout.
- **Waitlist Cascade**:  
  Upon cancellation of an active reservation, the slot opens. The top waitlisted candidate (computed by `Priority = Role_Weight * 0.4 + Urgency * 0.4 + Reliability_Score * 0.2`) receives a 10-minute provisional hold. If unconfirmed within the window, the reservation cascades to the next eligible waitlist user.

---

## 6. Technical Stack
- **Frontend (Hero & UI)**: Vite, React 19 / 18, TypeScript, Tailwind CSS, Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, Lucide React, Zustand.
- **Future Backend**: FastAPI, WebSockets, PostgreSQL (SQLite prototype), Pandas / Scikit-Learn for demand forecasting and utilization analytics.
