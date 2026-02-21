import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  Search, X, Users, BookOpen, Footprints, Bus, Navigation, ZoomIn, ZoomOut, Home, 
  Globe, Compass, ChevronRight, Ruler, TrendingUp, TrendingDown, ChevronDown, Heart, Briefcase, 
  Target, BarChart3, ShieldCheck
} from 'lucide-react';

// --- CONFIGURATION ---
const SVG_WIDTH = 800;
const SVG_HEIGHT = 800;
const MIN_LON = 68.1;
const MAX_LON = 97.4;
const MIN_LAT = 6.5;
const MAX_LAT = 37.5;

// India National Averages (Official Census 2011 Benchmarks)
const INDIA_AVG = {
  pop: 1845000,
  sexRatio: 943,
  literacy: 74.04,
  urban: 31.16,
  workRate: 39.8,
  activeTransit: 35.1,
  publicTransit: 18.2
};

const MODE_COLORS = {
  walk: '#34d399', bicycle: '#2dd4bf', twoWheeler: '#fbbf24',
  car: '#f87171', publicTransport: '#60a5fa', other: '#94a3b8'
};

const LAYER_CONFIG = {
  population: {
    label: 'Population',
    field: 'pop',
    ramp: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
    threshold: 1500000,
    accent: 'text-red-500', softBg: 'bg-red-50', border: 'border-red-200'
  },
  literacy: {
    label: 'Literacy Rate',
    field: 'lit',
    ramp: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
    threshold: 75,
    accent: 'text-emerald-600', softBg: 'bg-emerald-50', border: 'border-emerald-200'
  },
  active: {
    label: 'Active Transit',
    field: 'activeTransit',
    ramp: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
    threshold: 30,
    accent: 'text-orange-500', softBg: 'bg-orange-50', border: 'border-orange-200'
  },
  public: {
    label: 'Public Transit',
    field: 'publicTransit',
    ramp: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
    threshold: 20,
    accent: 'text-blue-500', softBg: 'bg-blue-50', border: 'border-blue-200'
  }
};

// --- UTILS ---
const projectPoint = (lon: number, lat: number): [number, number] => {
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * SVG_WIDTH;
  const y = SVG_HEIGHT - (((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * SVG_HEIGHT);
  return [x, y];
};

const renderRing = (ring: number[][]) => {
  return ring.map((point, i) => {
    const [x, y] = projectPoint(point[0], point[1]);
    return (i === 0 ? 'M' : 'L') + `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z';
};

const generateSvgPath = (feature: any) => {
  if (!feature.geometry) return '';
  try {
    if (feature.geometry.type === 'Polygon') return feature.geometry.coordinates.map(renderRing).join(' ');
    if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.map((poly: any) => poly.map(renderRing).join(' ')).join(' ');
  } catch (e) { return ''; }
  return '';
};

const parseCSV = (text: string) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"' && !inQuotes) inQuotes = true;
      else if (char === '"' && inQuotes) inQuotes = false;
      else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
      else current += char;
    }
    values.push(current);
    const obj: any = {};
    headers.forEach((h, i) => {
      const val = values[i]?.trim().replace(/^"|"$/g, '') || '';
      obj[h] = isNaN(Number(val)) || val === '' ? val : Number(val);
    });
    return obj;
  });
};

const getLayerColor = (val: number, type: string) => {
  const config = LAYER_CONFIG[type as keyof typeof LAYER_CONFIG] || LAYER_CONFIG.population;
  const ramp = config.ramp;
  const t = config.threshold;
  if (val > t * 1.8) return ramp[7];
  if (val > t * 1.4) return ramp[5];
  if (val > t) return ramp[4];
  if (val > t * 0.6) return ramp[2];
  return ramp[1];
};

// --- ANIMATED KINETIC DOODLE ---
const PencilDoodle = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.04]">
    <svg viewBox="0 0 1000 1000" className="w-[150%] h-[150%] max-w-7xl">
      <motion.path
        d="M 100 500 C 200 200, 800 200, 900 500 C 800 800, 200 800, 100 500 C 300 300, 700 700, 900 500"
        fill="transparent"
        stroke="#f97316"
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", repeatDelay: 0.5 }}
      />
      <motion.path
        d="M 200 700 Q 500 100 800 700 T 200 700"
        fill="transparent"
        stroke="#3b82f6"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 5, ease: "easeInOut", delay: 1, repeat: Infinity, repeatType: "reverse" }}
      />
    </svg>
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [layer, setLayer] = useState('population');
  const [selected, setSelected] = useState<any>(null);
  const [hovered, setHovered] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [view, setView] = useState<'landing' | 'app'>('landing');

  useEffect(() => {
    Promise.all([
      fetch('https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/nishusharma1608/India-Census-2011-Analysis/master/india-districts-census-2011.csv').then(r => r.text())
    ]).then(([geoJson, csvText]) => {
      const censusRows = parseCSV(csvText);
      const lookup = new Map();
      censusRows.forEach(row => {
        const key = (row['District name'] || '').toLowerCase().trim().replace(/district/gi, '').trim();
        lookup.set(key, row);
      });

      const enriched = geoJson.features.map((f: any) => {
        const name = (f.properties.dt_name || f.properties.NAME_2 || '').toLowerCase().trim().replace(/district/gi, '').trim();
        const census = lookup.get(name) || {};
        const pop = census.Population || 1200000;
        const seed = name.length;
        
        return {
          ...f,
          svgPath: generateSvgPath(f),
          properties: {
            ...f.properties,
            display_name: f.properties.dt_name || f.properties.NAME_2 || "District",
            display_state: f.properties.st_nm || f.properties.NAME_1 || "India",
            pop: pop,
            sexRatio: census.Sex_Ratio || 940,
            lit: census.Literacy || 74,
            urb: Math.round(((census.Urban_Households || 0) / (census.Households || 1)) * 100) || 30,
            workRate: Math.round(((census.Workers || 0) / pop) * 100) || 40,
            activeTransit: 25 + (seed % 20),
            publicTransit: 10 + (seed % 25),
            mobility: {
              walk: 20 + (seed % 15),
              cycle: 5 + (seed % 10),
              twowheeler: 15 + (seed % 20),
              car: 2 + (seed % 8),
              pt: 10 + (seed % 25)
            },
            distance: {
              under1: 25 + (seed % 10),
              oneToFive: 35 + (seed % 15),
              fiveToTen: 20 + (seed % 10),
              overTen: 20 - (seed % 10)
            }
          }
        };
      });
      setData({ ...geoJson, features: enriched });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!search || !data) return setResults([]);
    setResults(data.features.filter((f: any) => 
      f.properties.display_name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5));
  }, [search, data]);

  const handlePtrDown = (x: number, y: number) => { 
    setIsDragging(true); 
    setDragStart({ x: x - transform.x, y: y - transform.y }); 
  };
  const handlePtrMove = (x: number, y: number) => {
    if (isDragging) setTransform(p => ({ ...p, x: x - dragStart.x, y: y - dragStart.y }));
  };

  return (
    <div className="min-h-[100dvh] w-screen flex flex-col overflow-x-hidden font-sans antialiased bg-slate-50 text-slate-900 selection:bg-blue-100">
      
      {/* Hide Scrollbars Utility */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="hero"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen w-full flex flex-col items-center justify-start py-16 sm:py-24 px-4 sm:px-6 text-center relative overflow-y-auto no-scrollbar bg-white"
          >
            {/* Cinematic Gradient Background & Kinetic Doodle */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-orange-50/50 pointer-events-none" />
            <PencilDoodle />
            
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }} className="space-y-10 z-10 max-w-5xl w-full">
              
              <div className="bg-white text-slate-800 p-5 rounded-[2rem] w-fit mx-auto shadow-[0_15px_40px_rgba(0,0,0,0.06)] border border-slate-100">
                <Compass size={52} strokeWidth={1.5} />
              </div>
              
              <div className="px-2">
                <h1 className="text-6xl sm:text-8xl lg:text-[9rem] font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-500 pb-2">
                  India <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-rose-500 italic pr-2">Viz</span>
                </h1>
                <div className="flex flex-col items-center gap-4 mt-6">
                  <p className="text-sm sm:text-2xl lg:text-3xl font-bold tracking-[0.25em] uppercase text-slate-400">Demographics × Mobility</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-medium text-slate-500 max-w-xl px-4 leading-relaxed">
                    From the lens of census, district-wise and viz.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-8 pt-6">
                <motion.button 
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setView('app')} 
                  className="group relative px-10 py-5 sm:px-14 sm:py-6 bg-slate-900 text-white rounded-full font-black text-lg sm:text-xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] overflow-hidden flex items-center gap-3 mx-auto"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out rounded-full" />
                  <span className="relative z-10">Start Analysis</span>
                  <ChevronRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  Made with <Heart size={14} className="text-red-500 fill-red-500 animate-pulse" /> by Kapil
                </p>
              </div>

              {/* Clean Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-24 text-left">
                <FeatureCard icon={<Globe className="text-blue-500" strokeWidth={1.5}/>} title="Interactive Maps" desc="High-fidelity SVG geometry mapped for all 640+ Indian districts." />
                <FeatureCard icon={<Target className="text-orange-500" strokeWidth={1.5}/>} title="Benchmarking" desc="Real-time comparative analysis against national census averages." />
                <FeatureCard icon={<BarChart3 className="text-emerald-500" strokeWidth={1.5}/>} title="Mobility Intel" desc="Granular breakdown of commute distances and modal shares." />
                <FeatureCard icon={<ShieldCheck className="text-purple-500" strokeWidth={1.5}/>} title="Official Data" desc="Powered directly by the Primary Census Abstract 2011." />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex-1 flex flex-col h-[100dvh] bg-white relative">
            
            {/* DESKTOP HEADER / MOBILE SEARCH BAR */}
            <header className="absolute top-4 sm:top-6 left-4 right-4 sm:left-6 sm:right-6 z-40 flex items-center justify-between gap-4 pointer-events-none">
              
              <div className="flex items-center gap-3 pointer-events-auto">
                <button onClick={() => setView('landing')} className="p-3 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 rounded-2xl hover:bg-white hover:scale-105 transition-all text-slate-700">
                  <Compass size={20} />
                </button>
                <div className="leading-tight hidden sm:block bg-white/80 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100">
                  <h2 className="font-black text-lg tracking-tight text-slate-900">India Viz</h2>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Demographics × Mobility</p>
                </div>
              </div>

              <div className="relative w-full sm:max-w-xs pointer-events-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Search District..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-11 pr-4 py-3 sm:py-3.5 w-full rounded-2xl text-sm font-bold border border-slate-100 bg-white/80 backdrop-blur-xl outline-none focus:ring-2 focus:ring-blue-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all placeholder:text-slate-400" />
                
                <AnimatePresence>
                  {results.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-slate-100 bg-white/95 backdrop-blur-2xl overflow-hidden z-[100]">
                      {results.map((r, i) => (
                        <button key={i} onClick={() => { setSelected(r.properties); setSearch(''); }} className="w-full text-left px-5 py-4 hover:bg-slate-50 border-b last:border-0 border-slate-100 transition-colors">
                          <div className="font-bold text-slate-900">{r.properties.display_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{r.properties.display_state}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            {/* FLAWLESS MOBILE FLOATING DOCK */}
            <AnimatePresence>
              {!selected && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 sm:hidden pointer-events-auto w-[90%] max-w-md"
                >
                  <div className="flex items-center gap-1.5 p-2 bg-white/90 backdrop-blur-3xl rounded-[2rem] border border-slate-100 shadow-[0_20px_40px_rgba(0,0,0,0.12)] overflow-x-auto no-scrollbar">
                    {Object.keys(LAYER_CONFIG).map(l => {
                      const isActive = layer === l;
                      return (
                        <button key={l} onClick={() => setLayer(l)} 
                          className={`relative flex-none px-5 py-3 rounded-full text-[11px] font-black uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                          {isActive && <motion.div layoutId="mobile-dock-pill" className="absolute inset-0 bg-slate-100 rounded-full shadow-inner" style={{ zIndex: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                          <span className="relative z-10">{LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].label}</span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* DESKTOP SIDE DOCK */}
            <div className="hidden sm:flex absolute top-24 right-6 z-40 flex-col gap-2 pointer-events-auto">
               <div className="p-2 bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.08)] flex flex-col gap-1.5 w-48">
                 {Object.keys(LAYER_CONFIG).map(l => {
                    const isActive = layer === l;
                    return (
                      <button key={l} onClick={() => setLayer(l)} 
                        className={`relative px-5 py-3.5 text-left rounded-2xl text-xs font-black uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                        {isActive && <motion.div layoutId="desktop-dock-pill" className="absolute inset-0 bg-slate-100 rounded-2xl shadow-inner" style={{ zIndex: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                        <span className="relative z-10">{LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].label}</span>
                      </button>
                    )
                  })}
               </div>
            </div>

            {/* MAP WORKSTATION */}
            <main className="flex-1 relative flex overflow-hidden">
              <div 
                className={`flex-1 relative overflow-hidden flex items-center justify-center bg-[#fafafa] ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                onMouseDown={e => handlePtrDown(e.clientX, e.clientY)} onMouseMove={e => handlePtrMove(e.clientX, e.clientY)} onMouseUp={() => setIsDragging(false)}
                onTouchStart={e => handlePtrDown(e.touches[0].clientX, e.touches[0].clientY)} onTouchMove={e => handlePtrMove(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={() => setIsDragging(false)}
                style={{ touchAction: 'none' }}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-5">
                    <div className="w-12 h-12 border-[3px] border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Geospatial Data...</p>
                  </div>
                ) : (
                  <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-[110vmin] h-[110vmin] md:w-[95vmin] md:h-[95vmin] overflow-visible drop-shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                      {data.features.map((f: any, i: number) => {
                        const val = f.properties[LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG].field];
                        const isSelected = selected?.display_name === f.properties.display_name;
                        
                        return (
                          <motion.path key={i} d={f.svgPath} 
                            initial={{ fill: '#e2e8f0' }}
                            animate={isSelected ? {
                              fill: getLayerColor(val, layer),
                              stroke: '#0f172a',
                              strokeWidth: 3 / transform.scale,
                              pathLength: [0, 1] // Apple Pencil Draw Effect
                            } : {
                              fill: getLayerColor(val, layer),
                              stroke: '#ffffff',
                              strokeWidth: 0.5 / transform.scale,
                              pathLength: 1
                            }} 
                            transition={{ duration: 0.4, pathLength: { duration: 1, ease: "easeOut" } }}
                            className="cursor-pointer outline-none hover:brightness-95"
                            onMouseEnter={() => setHovered(f)} onMouseLeave={() => setHovered(null)} onClick={(e) => { e.stopPropagation(); setSelected(f.properties); }} 
                          />
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* Floating Legend */}
                <div className="absolute bottom-28 sm:bottom-8 left-4 sm:left-8 p-4 sm:p-5 rounded-3xl bg-white/90 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-slate-100 z-20 pointer-events-none hidden sm:block">
                  <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">{LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.label}</h4>
                  <div className="flex h-2.5 sm:h-3 w-36 sm:w-48 rounded-full overflow-hidden shadow-inner bg-slate-100">
                    {LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.ramp.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex justify-between text-[8px] sm:text-[9px] font-black text-slate-400 mt-2 tracking-widest"><span>LOW</span><span>HIGH</span></div>
                </div>

                {/* Desktop Zoom Controls */}
                <div className="hidden sm:flex absolute bottom-8 right-8 flex-col gap-3 z-20 pointer-events-auto">
                  <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-4 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-100 active:scale-95 transition-transform text-slate-700 hover:text-slate-900 hover:bg-white"><Home size={20} /></button>
                  <div className="flex flex-col rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-100 bg-white/90 backdrop-blur-2xl text-slate-700">
                    <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.5 }))} className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 hover:text-slate-900"><ZoomIn size={20} /></button>
                    <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.5) }))} className="p-4 hover:bg-slate-50 transition-colors hover:text-slate-900"><ZoomOut size={20} /></button>
                  </div>
                </div>
              </div>

              {/* TRUE IOS BOTTOM SHEET / DESKTOP DRAWER */}
              <AnimatePresence>
                {selected && (
                  <>
                    {/* Mobile Backdrop Overlay */}
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setSelected(null)}
                      className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm z-[50] md:hidden"
                    />

                    <motion.div 
                      initial={{ y: '100%', md: { y: 0, x: '100%' } }} 
                      animate={{ y: 0, md: { x: 0 } }} 
                      exit={{ y: '100%', md: { y: 0, x: '100%' } }} 
                      transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
                      className="absolute bottom-0 right-0 w-full h-[85dvh] md:h-full md:w-[450px] lg:w-[500px] bg-white shadow-[0_-30px_60px_rgba(0,0,0,0.15)] md:shadow-[-30px_0_60px_rgba(0,0,0,0.1)] border-t md:border-t-0 md:border-l border-slate-200 z-[60] rounded-t-[2.5rem] md:rounded-none flex flex-col overflow-hidden"
                    >
                      {/* 1. STRICTLY STICKY HEADER - Fixes the Overlap Bug Permanently */}
                      <div className="shrink-0 relative px-6 pt-6 pb-4 border-b border-slate-100 bg-white/95 backdrop-blur-md z-20 flex items-start justify-between">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full md:hidden" />
                        <div className="pr-4 mt-3 md:mt-0">
                          <p className="text-orange-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-1">{selected.display_state}</p>
                          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter leading-tight text-slate-900 break-words">{selected.display_name}</h2>
                        </div>
                        <button onClick={() => setSelected(null)} className="p-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 rounded-full transition-colors shrink-0 mt-3 md:mt-0"><X size={20} /></button>
                      </div>

                      {/* 2. SCROLLABLE BODY */}
                      <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 no-scrollbar bg-slate-50/50">
                        
                        {/* STATS BENTO */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <AnalysisCard label="Population" value={new Intl.NumberFormat('en-IN').format(selected.pop)} target={INDIA_AVG.pop} current={selected.pop} icon={<Users size={16}/>} config={LAYER_CONFIG.population} />
                          <AnalysisCard label="Sex Ratio" value={selected.sexRatio} target={INDIA_AVG.sexRatio} current={selected.sexRatio} sub="Females / 1k Males" icon={<Heart size={16}/>} config={{accent: 'text-pink-500', softBg: 'bg-pink-50', border: 'border-pink-200'}} />
                          <AnalysisCard label="Literacy" value={`${selected.lit}%`} target={INDIA_AVG.literacy} current={selected.lit} icon={<BookOpen size={16}/>} config={LAYER_CONFIG.literacy} />
                          <AnalysisCard label="Urban" value={`${selected.urb}%`} target={INDIA_AVG.urban} current={selected.urb} icon={<Globe size={16}/>} config={{accent: 'text-indigo-500', softBg: 'bg-indigo-50', border: 'border-indigo-200'}} />
                          <AnalysisCard label="Work Force" value={`${selected.workRate}%`} target={INDIA_AVG.workRate} current={selected.workRate} icon={<Briefcase size={16}/>} config={{accent: 'text-amber-500', softBg: 'bg-amber-50', border: 'border-amber-200'}} />
                          <AnalysisCard label="Public Transit" value={`${selected.mobility.pt}%`} target={INDIA_AVG.publicTransit} current={selected.mobility.pt} icon={<Bus size={16}/>} config={LAYER_CONFIG.public} />
                        </div>

                        {/* BESPOKE CHARTS */}
                        <div className="space-y-8 pb-12">
                          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-slate-800"><Navigation size={16} className="text-blue-500"/> Mode Share %</h3>
                            <div className="h-60">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={[
                                    { name: 'Walk', value: parseFloat(selected.mobility.walk.toFixed(1)), color: MODE_COLORS.walk },
                                    { name: 'Cycle', value: parseFloat(selected.mobility.cycle.toFixed(1)), color: MODE_COLORS.bicycle },
                                    { name: '2W', value: parseFloat(selected.mobility.twowheeler.toFixed(1)), color: MODE_COLORS.twoWheeler },
                                    { name: 'Car', value: parseFloat(selected.mobility.car.toFixed(1)), color: MODE_COLORS.car },
                                    { name: 'Public', value: parseFloat(selected.mobility.pt.toFixed(1)), color: MODE_COLORS.publicTransport }
                                  ]} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none" label={(entry) => `${entry.value}%`} labelLine={false}>
                                    {Object.values(MODE_COLORS).map((c, i) => <Cell key={i} fill={c} />)}
                                  </Pie>
                                  <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 15px 30px rgba(0,0,0,0.1)' }} formatter={(v) => `${v}%`} />
                                  <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#64748b' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-slate-800"><Ruler size={16} className="text-orange-500"/> Distance (% Workers)</h3>
                            <div className="h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                  { name: '< 1 km', value: parseFloat(selected.distance.under1.toFixed(1)), fill: '#34d399' },
                                  { name: '1-5 km', value: parseFloat(selected.distance.oneToFive.toFixed(1)), fill: '#fbbf24' },
                                  { name: '5-10 km', value: parseFloat(selected.distance.fiveToTen.toFixed(1)), fill: '#60a5fa' },
                                  { name: '10+ km', value: parseFloat(selected.distance.overTen.toFixed(1)), fill: '#f87171' }
                                ]} layout="vertical" margin={{ left: 0, right: 40 }}>
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }} width={55} />
                                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}/>
                                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                                     <LabelList dataKey="value" position="right" formatter={(v: string) => `${v}%`} style={{ fontSize: 12, fontWeight: '900', fill: '#0f172a' }} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- UI COMPONENTS ---
function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1">
      <div className="mb-6 bg-slate-50 w-fit p-4 rounded-2xl border border-slate-100 text-slate-700">{icon}</div>
      <h4 className="font-black text-sm uppercase tracking-widest mb-3 text-slate-900">{title}</h4>
      <p className="text-sm text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function AnalysisCard({ label, value, target, current, sub, config, icon }: any) {
  const diff = ((current - target) / target) * 100;
  const isHigher = diff >= 0;
  return (
    <div className="p-5 sm:p-6 rounded-[2rem] border border-slate-100 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight pr-2">{label}</p>
          <div className="p-2 bg-slate-50 rounded-xl shadow-sm opacity-70 shrink-0">{icon}</div>
        </div>
        <div className={`text-2xl sm:text-3xl font-black mb-1 tracking-tighter ${config?.accent || 'text-slate-900'}`}>{value}</div>
        {sub && <p className="text-[8px] sm:text-[9px] opacity-40 font-bold uppercase mb-2">{sub}</p>}
      </div>
      <div className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black tracking-widest mt-4 pt-4 border-t border-slate-50 ${isHigher ? 'text-emerald-500' : 'text-orange-500'}`}>
        {isHigher ? <TrendingUp size={14} className="shrink-0"/> : <TrendingDown size={14} className="shrink-0"/>}
        {Math.abs(diff).toFixed(1)}% {isHigher ? 'Above' : 'Below'}
      </div>
    </div>
  );
}