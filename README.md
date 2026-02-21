# India Viz: District Demographics × Mobility Explorer

An interactive, browser-based visual analytics tool that renders India’s district boundaries and overlays district-level indicators for rapid exploration. The interface supports pan/zoom, layer switching, search, and an insight drawer with distribution charts.

---

## Key Features

- **High-resolution district map rendering**
  - SVG-based geometry rendering from district GeoJSON.
  - Lightweight projection logic (lon/lat → SVG coordinates) for fast client-side drawing.

- **Multi-layer thematic visualization**
  - Switchable layers (Population, Literacy, Walk/Cycle, Public Transit).
  - Threshold-driven color ramps for quick hotspot identification.
  - Built-in legend overlay (LOW → HIGH).

- **Interactive exploration**
  - Hover highlighting and click-to-select district.
  - Smooth pan/zoom navigation with reset controls.
  - District search with instant suggestions.

- **District insight drawer**
  - KPI cards with benchmarking against India-wide reference values.
  - Mode share visualization using a donut chart (Recharts).
  - Distance band distribution using horizontal bar charts (Recharts).

- **Responsive, modern UI**
  - Landing page + workstation view.
  - Dark/Light theme toggle.
  - Mobile-friendly layout and controls.

---

## Tech Stack

- **Frontend:** React
- **UI + Animations:** Tailwind CSS, Framer Motion
- **Charts:** Recharts (PieChart, BarChart)
- **Icons:** Lucide React
- **Data Sources:** District boundary GeoJSON + district attributes pipeline (merged/enriched at runtime)

---

## Project Structure (typical)

```├─ src/
│ ├─ App.jsx / App.tsx
│ ├─ components/
│ ├─ styles/
│ └─ utils/
├─ public/
├─ package.json
└─ vite.config.js
```

## How It Works (Implementation Notes)

### 1) Geometry → SVG Path
District polygons are converted into SVG `<path>` strings using:
- a normalized lon/lat projection into a fixed SVG viewport,
- support for `Polygon` and `MultiPolygon`,
- ring rendering to create closed shapes.

### 2) Layer Computation
Each feature exposes computed properties (e.g., `pop`, `lit`, `mobility`, `distance`).  
The active layer selects the relevant metric and maps it to a color ramp.

### 3) Interaction Model
- Hover: highlight boundary with higher stroke width.
- Click: store selected district and open insight drawer.
- Pan: pointer drag updates transform.
- Zoom: scale transform with guard rails.

---

## Local Development

### Prerequisites
- Node.js 18+ (recommended)
- npm / pnpm / yarn

### Install & Run
```bash
npm install
npm run dev

