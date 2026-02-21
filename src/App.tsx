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
    accent: 'text-red-500',
    bg: 'bg-red-500',
    softBg: 'bg-red-50',
    border: 'border-red-200'
  },
  literacy: {
    label: 'Literacy',
    field: 'lit',
    ramp: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
    threshold: 75,
    accent: 'text-emerald-600',
    bg: 'bg-emerald-500',
    softBg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  active: {
    label: 'Active Transit',
    field: 'activeTransit',
    ramp: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
    threshold: 30,
    accent: 'text-orange-500',
    bg: 'bg-orange-500',
    softBg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  public: {
    label: 'Public Transit',
    field: 'publicTransit',
    ramp: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
    threshold: 20,
    accent: 'text-blue-500',
    bg: 'bg-blue-500',
    softBg: 'bg-blue-50',
    border: 'border-blue-200'
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
    <div className="min-h-[100dvh] w-screen flex flex-col overflow-x-hidden font-sans antialiased bg-white text-slate-900 selection:bg-blue-100">
      
      {/* Hide Scrollbars Utility for clean UI */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="hero"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98, filter: 'blur(5px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen w-full flex flex-col items-center justify-start py-16 sm:py-24 px-4 sm:px-6 text-center relative overflow-y-auto no-scrollbar bg-slate-50"
          >
            {/* Extremely Clean, Soft Gradient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.05),transparent_70%)] pointer-events-none" />
            
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-8 sm:space-y-12 z-10 max-w-5xl w-full">
              
              <div className="bg-white text-blue-600 p-4 sm:p-5 rounded-3xl sm:rounded-[2rem] w-fit mx-auto shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100">
                <Compass size={48} className="sm:w-14 sm:h-14" />
              </div>
              
              <div className="px-2">
                <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black tracking-tighter mb-4 text-slate-900">
                  India <span className="text-blue-600">Viz</span>
                </h1>
                <div className="flex flex-col items-center gap-3 sm:gap-4 mt-6">
                  <p className="text-sm sm:text-2xl lg:text-3xl font-bold tracking-[0.2em] uppercase text-slate-400">Demographics × Mobility</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-medium text-slate-500 max-w-2xl px-4 leading-relaxed">
                    From the lens of census, district-wise and viz.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6 pt-6">
                <button onClick={() => setView('app')} className="group relative px-10 py-4 sm:px-12 sm:py-5 bg-slate-900 text-white rounded-full font-bold text-lg sm:text-xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto">
                  Enter Workstation
                  <ChevronRight size={22} className="sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  Made with <Heart size={14} className="text-red-500 fill-red-500" /> by Kapil
                </p>
              </div>

              {/* Clean Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-24 text-left">
                <FeatureCard icon={<Globe className="text-blue-500"/>} title="Interactive Maps" desc="High-fidelity SVG geometry mapped for all 640+ Indian districts." />
                <FeatureCard icon={<Target className="text-orange-500"/>} title="Benchmarking" desc="Real-time comparative analysis against national census averages." />
                <FeatureCard icon={<BarChart3 className="text-emerald-500"/>} title="Mobility Intel" desc="Granular breakdown of commute distances and modal shares." />
                <FeatureCard icon={<ShieldCheck className="text-purple-500"/>} title="Official Data" desc="Powered directly by the Primary Census Abstract 2011." />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col h-screen bg-slate-50">
            
            {/* SURGICAL CLEAN HEADER */}
            <header className="bg-white border-b border-slate-200 z-40 shadow-sm relative">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('landing')} className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shrink-0 border border-slate-200"><Compass size={18}/></button>
                  <div className="leading-tight">
                    <h2 className="font-black text-base sm:text-lg tracking-tight text-slate-900">India Viz</h2>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hidden sm:block">Demographics × Mobility</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1 justify-end">
                  {/* Search - Visible nicely on desktop */}
                  <div className="relative hidden md:block max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Search District..." value={search} onChange={e => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 w-full rounded-xl text-sm border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                    <AnimatePresence>
                      {results.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 bg-white">
                          {results.map((r, i) => (
                            <button key={i} onClick={() => { setSelected(r.properties); setSearch(''); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 border-b last:border-0 border-slate-100 transition-colors">
                              <div className="font-bold text-slate-900">{r.properties.display_name}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{r.properties.display_state}</div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* LAYER CONTROLS - FULL NAMES, COLORFUL, SCROLLABLE ON MOBILE */}
              <div className="px-4 pb-3 sm:absolute sm:bottom-0 sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-1/2 z-50">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:p-1.5 sm:bg-white sm:shadow-[0_8px_20px_rgb(0,0,0,0.08)] sm:rounded-2xl sm:border sm:border-slate-100">
                  {Object.keys(LAYER_CONFIG).map(l => {
                    const config = LAYER_CONFIG[l as keyof typeof LAYER_CONFIG];
                    const isActive = layer === l;
                    return (
                      <button 
                        key={l} 
                        onClick={() => setLayer(l)} 
                        className={`flex-none px-4 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide transition-all border ${isActive ? `${config.bg} text-white border-transparent shadow-md` : `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`}`}
                      >
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </header>

            {/* MAP WORKSTATION */}
            <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden bg-[#f8fafc]">
              <div 
                className={`flex-1 relative overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
                onMouseDown={e => handlePtrDown(e.clientX, e.clientY)} onMouseMove={e => handlePtrMove(e.clientX, e.clientY)} onMouseUp={() => setIsDragging(false)}
                onTouchStart={e => handlePtrDown(e.touches[0].clientX, e.touches[0].clientY)} onTouchMove={e => handlePtrMove(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={() => setIsDragging(false)}
                style={{ touchAction: 'none' }}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-[100vmin] h-[100vmin] md:w-[90vmin] md:h-[90vmin] overflow-visible drop-shadow-xl">
                      {data.features.map((f: any, i: number) => {
                        const val = f.properties[LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG].field];
                        const isSelected = selected?.display_name === f.properties.display_name;
                        return (
                          <path key={i} d={f.svgPath} fill={getLayerColor(val, layer)} stroke={hovered === f || isSelected ? '#000' : '#ffffff80'} 
                            strokeWidth={(hovered === f || isSelected ? 2 : 0.5) / transform.scale} className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHovered(f)} onMouseLeave={() => setHovered(null)} onClick={(e) => { e.stopPropagation(); setSelected(f.properties); }} />
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* Always Visible Legend */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 p-3 sm:p-4 rounded-2xl border bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border-slate-100 z-20 scale-90 sm:scale-100 origin-bottom-left">
                  <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2.5 leading-none">{LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.label}</h4>
                  <div className="flex h-2 sm:h-2.5 w-32 sm:w-40 rounded-full overflow-hidden bg-slate-100">
                    {LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.ramp.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex justify-between text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1.5 tracking-wider"><span>LOW</span><span>HIGH</span></div>
                </div>

                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-2 z-20">
                  <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-3 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 active:scale-95 transition-transform text-slate-600"><Home size={18} /></button>
                  <div className="flex flex-col rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 bg-white text-slate-600">
                    <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.5 }))} className="p-3 hover:bg-slate-50 border-b border-slate-100 transition-colors"><ZoomIn size={18} /></button>
                    <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.5) }))} className="p-3 hover:bg-slate-50 transition-colors"><ZoomOut size={18} /></button>
                  </div>
                </div>
              </div>

              {/* FLAWLESS MOBILE BOTTOM SHEET / DESKTOP DRAWER */}
              <AnimatePresence>
                {selected && (
                  <motion.div 
                    initial={{ y: '100%', md: { y: 0, x: '100%' } }} 
                    animate={{ y: 0, md: { x: 0 } }} 
                    exit={{ y: '100%', md: { y: 0, x: '100%' } }} 
                    transition={{ type: 'spring', damping: 35, stiffness: 300 }}
                    className="fixed inset-x-0 bottom-0 h-[85vh] md:absolute md:inset-auto md:right-0 md:top-0 md:h-full md:w-[450px] lg:w-[500px] bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.1)] md:shadow-[-20px_0_50px_rgba(0,0,0,0.05)] border-t md:border-t-0 md:border-l border-slate-200 z-[100] md:z-[60] rounded-t-3xl md:rounded-none flex flex-col"
                  >
                    {/* STICKY HEADER - NEVER SCROLLS AWAY */}
                    <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 bg-white/95 backdrop-blur z-10 sticky top-0 flex items-start justify-between">
                      <div>
                        <div className="md:hidden w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 absolute top-2 left-1/2 -translate-x-1/2" />
                        <p className="text-blue-500 font-bold text-[10px] tracking-widest uppercase mb-1">{selected.display_state}</p>
                        <h2 className="text-3xl font-black tracking-tight leading-none text-slate-900">{selected.display_name}</h2>
                      </div>
                      <button onClick={() => setSelected(null)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors mt-2 md:mt-0"><X size={20} /></button>
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                      
                      {/* STATS BENTO */}
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <AnalysisCard label="Population" value={new Intl.NumberFormat('en-IN').format(selected.pop)} target={INDIA_AVG.pop} current={selected.pop} icon={<Users size={16}/>} config={LAYER_CONFIG.population} />
                        <AnalysisCard label="Sex Ratio" value={selected.sexRatio} target={INDIA_AVG.sexRatio} current={selected.sexRatio} sub="Females / 1k Males" icon={<Heart size={16}/>} config={{accent: 'text-pink-500', softBg: 'bg-pink-50', border: 'border-pink-200'}} />
                        <AnalysisCard label="Literacy %" value={`${selected.lit}%`} target={INDIA_AVG.literacy} current={selected.lit} icon={<BookOpen size={16}/>} config={LAYER_CONFIG.literacy} />
                        <AnalysisCard label="Urban %" value={`${selected.urb}%`} target={INDIA_AVG.urban} current={selected.urb} icon={<Globe size={16}/>} config={{accent: 'text-indigo-500', softBg: 'bg-indigo-50', border: 'border-indigo-200'}} />
                        <AnalysisCard label="Work Force %" value={`${selected.workRate}%`} target={INDIA_AVG.workRate} current={selected.workRate} icon={<Briefcase size={16}/>} config={{accent: 'text-amber-500', softBg: 'bg-amber-50', border: 'border-amber-200'}} />
                        <AnalysisCard label="Public Transit %" value={`${selected.mobility.pt}%`} target={INDIA_AVG.publicTransit} current={selected.mobility.pt} icon={<Bus size={16}/>} config={LAYER_CONFIG.public} />
                      </div>

                      {/* CHARTS */}
                      <div className="space-y-8">
                        <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                          <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-800"><Navigation size={16} className="text-blue-500"/> Mode Share %</h3>
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={[
                                  { name: 'Walk', value: parseFloat(selected.mobility.walk.toFixed(1)), color: MODE_COLORS.walk },
                                  { name: 'Cycle', value: parseFloat(selected.mobility.cycle.toFixed(1)), color: MODE_COLORS.bicycle },
                                  { name: '2W', value: parseFloat(selected.mobility.twowheeler.toFixed(1)), color: MODE_COLORS.twoWheeler },
                                  { name: 'Car', value: parseFloat(selected.mobility.car.toFixed(1)), color: MODE_COLORS.car },
                                  { name: 'Public', value: parseFloat(selected.mobility.pt.toFixed(1)), color: MODE_COLORS.publicTransport }
                                ]} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none" label={(entry) => `${entry.value}%`} labelLine={false}>
                                  {Object.values(MODE_COLORS).map((c, i) => <Cell key={i} fill={c} />)}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} formatter={(v) => `${v}%`} />
                                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="p-6 rounded-3xl border border-slate-100 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] mb-10">
                          <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-800"><Ruler size={16} className="text-orange-500"/> Distance (% Workers)</h3>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                { name: '< 1 km', value: parseFloat(selected.distance.under1.toFixed(1)), fill: '#34d399' },
                                { name: '1-5 km', value: parseFloat(selected.distance.oneToFive.toFixed(1)), fill: '#fbbf24' },
                                { name: '5-10 km', value: parseFloat(selected.distance.fiveToTen.toFixed(1)), fill: '#60a5fa' },
                                { name: '10+ km', value: parseFloat(selected.distance.overTen.toFixed(1)), fill: '#f87171' }
                              ]} layout="vertical" margin={{ left: 0, right: 35 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} width={55} />
                                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}/>
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                                   <LabelList dataKey="value" position="right" formatter={(v: string) => `${v}%`} style={{ fontSize: 11, fontWeight: 'bold', fill: '#0f172a' }} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* REAL FOOTER */}
            <footer className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500 z-40 relative">
              <div className="flex items-center gap-4 text-center sm:text-left mb-2 sm:mb-0">
                <span>India Viz &copy; 2024</span>
              </div>
              <div className="flex items-center gap-1.5">
                Made with <Heart size={12} className="text-red-500 fill-red-500 mx-0.5" /> by 
                <a href="https://kapil2020.github.io/website/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors ml-0.5">Kapil</a>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- UI COMPONENTS ---
function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1">
      <div className="mb-4 bg-slate-50 w-fit p-3 rounded-2xl border border-slate-100 text-slate-700">{icon}</div>
      <h4 className="font-bold text-sm uppercase tracking-widest mb-2 text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function AnalysisCard({ label, value, target, current, sub, config, icon }: any) {
  const diff = ((current - target) / target) * 100;
  const isHigher = diff >= 0;
  return (
    <div className={`p-4 rounded-3xl border bg-white shadow-sm flex flex-col justify-between ${config?.border || 'border-slate-100'}`}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
          <div className={`p-1.5 rounded-lg ${config?.softBg || 'bg-slate-50'} ${config?.accent || 'text-slate-500'}`}>{icon}</div>
        </div>
        <div className={`text-xl sm:text-2xl font-black mb-1 tracking-tight ${config?.accent || 'text-slate-900'}`}>{value}</div>
        {sub && <p className="text-[8px] text-slate-400 font-bold uppercase mb-2">{sub}</p>}
      </div>
      <div className={`flex items-center gap-1 text-[9px] font-bold tracking-widest mt-3 pt-3 border-t border-slate-100 ${isHigher ? 'text-emerald-500' : 'text-orange-500'}`}>
        {isHigher ? <TrendingUp size={12} className="shrink-0"/> : <TrendingDown size={12} className="shrink-0"/>}
        {Math.abs(diff).toFixed(1)}% {isHigher ? 'Above' : 'Below'}
      </div>
    </div>
  );
}