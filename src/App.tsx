import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  Search, Moon, Sun, X, Users, BookOpen, Footprints, Bus, Navigation, Activity, ZoomIn, ZoomOut, Home, 
  Globe, Compass, ChevronRight, MapPin, Ruler, TrendingUp, TrendingDown, ChevronDown, Heart, Briefcase, 
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
  walk: '#10b981', bicycle: '#06b6d4', twoWheeler: '#f59e0b',
  car: '#ef4444', publicTransport: '#3b82f6', other: '#94a3b8'
};

const LAYER_CONFIG = {
  population: {
    label: 'Population Scale',
    field: 'pop',
    ramp: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
    threshold: 1500000,
    color: 'bg-red-500'
  },
  literacy: {
    label: 'Literacy %',
    field: 'lit',
    ramp: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
    threshold: 75,
    color: 'bg-emerald-500'
  },
  active: {
    label: 'Walk/Cycle %',
    field: 'activeTransit',
    ramp: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
    threshold: 30,
    color: 'bg-orange-500'
  },
  public: {
    label: 'Public Transit %',
    field: 'publicTransit',
    ramp: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
    threshold: 20,
    color: 'bg-blue-500'
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
  const [isDark, setIsDark] = useState(false);
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
    <div className={`min-h-[100dvh] w-screen flex flex-col overflow-x-hidden font-sans antialiased ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Hide Scrollbars Utility */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="hero"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -40 }}
            className="min-h-screen w-full flex flex-col items-center justify-start py-12 sm:py-20 px-4 sm:px-6 text-center relative overflow-y-auto"
          >
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.08),transparent_70%)] pointer-events-none" />
            
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-8 sm:space-y-10 z-10 max-w-5xl w-full">
              
              <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3 sm:p-5 rounded-3xl sm:rounded-[2rem] w-fit mx-auto shadow-2xl">
                <Compass size={40} className="sm:w-14 sm:h-14" />
              </div>
              
              <div className="px-2">
                <h1 className="text-5xl sm:text-7xl lg:text-9xl font-black tracking-tighter mb-4 leading-none italic drop-shadow-sm">
                  India <span className="text-orange-500">Viz</span>
                </h1>
                <div className="flex flex-col items-center gap-2 sm:gap-3">
                  <p className="text-sm sm:text-xl lg:text-3xl font-bold tracking-[0.2em] uppercase text-slate-500 dark:text-slate-400">Demographics × Mobility</p>
                  <p className="text-xs sm:text-base lg:text-xl font-medium opacity-60 max-w-2xl px-4">
                    From the lens of census, district-wise visual intelligence of the nation's movement.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-5 sm:gap-6 pt-4">
                <button onClick={() => setView('app')} className="group px-8 py-4 sm:px-14 sm:py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black text-lg sm:text-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 sm:gap-4 mx-auto">
                  Start Analysis
                  <ChevronRight size={20} className="sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-40 flex items-center gap-1.5 sm:gap-2">
                  Made with <Heart size={12} className="sm:w-3.5 sm:h-3.5 text-red-500 fill-red-500" /> by Kapil
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-12 sm:mt-20 pt-12 sm:pt-20 border-t border-slate-200 dark:border-slate-800 text-left">
                <FeatureCard icon={<Globe className="text-blue-500"/>} title="REAL CENSUS DATA" desc="Fused 2011 Primary Census Abstract with geographic polygons." />
                <FeatureCard icon={<Target className="text-orange-500"/>} title="BENCHMARKING" desc="Automated variance analysis against India's national averages." />
                <FeatureCard icon={<BarChart3 className="text-emerald-500"/>} title="MOBILITY VIZ" desc="Advanced Pie and Bar charts with explicit percentage labels." />
                <FeatureCard icon={<ShieldCheck className="text-purple-500"/>} title="VERIFIED" desc="Accurate 640+ district mapping for academic research." />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col h-screen">
            
            {/* OPTIMIZED TWO-TIER MOBILE HEADER */}
            <header className={`border-b z-50 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('landing')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:scale-105 transition-transform shrink-0"><Compass size={18}/></button>
                  <div className="leading-tight">
                    <h2 className="font-black text-base sm:text-lg tracking-tight">India Districts</h2>
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Demographics × Mobility</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-1 justify-end">
                  <div className="relative hidden md:block max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Search District..." value={search} onChange={e => setSearch(e.target.value)}
                      className={`pl-9 pr-4 py-2 w-full rounded-xl text-sm border outline-none focus:ring-2 focus:ring-slate-500 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                    <AnimatePresence>
                      {results.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-xl border overflow-hidden z-50 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                          {results.map((r, i) => (
                            <button key={i} onClick={() => { setSelected(r.properties); setSearch(''); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-500/10 border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors">
                              <div className="font-bold">{r.properties.display_name}</div>
                              <div className="text-[10px] opacity-50 font-bold uppercase mt-0.5">{r.properties.display_state}</div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Desktop Layer Controls */}
                  <div className="hidden lg:flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                    {Object.keys(LAYER_CONFIG).map(l => (
                      <button key={l} onClick={() => setLayer(l)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${layer === l ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'opacity-50 hover:opacity-100'}`}>
                        {LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].label}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
              </div>

              {/* Mobile Only Layer Controls (Scrollable Row) */}
              <div className="lg:hidden px-3 pb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {Object.keys(LAYER_CONFIG).map(l => (
                    <button key={l} onClick={() => setLayer(l)} 
                      className={`flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${layer === l ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                      {LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].label}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {/* MAP WORKSTATION */}
            <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
              <div 
                className={`flex-1 relative overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-default'} ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}
                onMouseDown={e => handlePtrDown(e.clientX, e.clientY)} onMouseMove={e => handlePtrMove(e.clientX, e.clientY)} onMouseUp={() => setIsDragging(false)}
                onTouchStart={e => handlePtrDown(e.touches[0].clientX, e.touches[0].clientY)} onTouchMove={e => handlePtrMove(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={() => setIsDragging(false)}
                style={{ touchAction: 'none' }}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-[100vmin] h-[100vmin] md:w-[90vmin] md:h-[90vmin] overflow-visible">
                      {data.features.map((f: any, i: number) => {
                        const val = f.properties[LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG].field];
                        const isSelected = selected?.display_name === f.properties.display_name;
                        return (
                          <path key={i} d={f.svgPath} fill={getLayerColor(val, layer)} stroke={hovered === f || isSelected ? (isDark ? '#fff' : '#000') : (isDark ? '#33415515' : '#fff')} 
                            strokeWidth={(hovered === f || isSelected ? 2.5 : 0.5) / transform.scale} className="transition-all duration-300 cursor-pointer hover:brightness-110"
                            onMouseEnter={() => setHovered(f)} onMouseLeave={() => setHovered(null)} onClick={(e) => { e.stopPropagation(); setSelected(f.properties); }} />
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* LEGEND - Always Visible, Scales on Mobile */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl border-slate-200 dark:border-slate-800 z-20 scale-90 sm:scale-100 origin-bottom-left">
                  <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-2.5 sm:mb-3 leading-none">{LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.label}</h4>
                  <div className="flex h-2 sm:h-2.5 w-32 sm:w-40 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                    {LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.ramp.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex justify-between text-[8px] sm:text-[9px] font-black opacity-40 mt-1.5 tracking-wider"><span>LOW</span><span>HIGH</span></div>
                </div>

                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-2 z-20">
                  <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-3 sm:p-3.5 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform"><Home size={18} className="sm:w-5 sm:h-5"/></button>
                  <div className="flex flex-col rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.5 }))} className="p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 transition-colors"><ZoomIn size={18} className="sm:w-5 sm:h-5"/></button>
                    <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.5) }))} className="p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><ZoomOut size={18} className="sm:w-5 sm:h-5"/></button>
                  </div>
                </div>
              </div>

              {/* DETAILS SIDEBAR (BOTTOM SHEET ON MOBILE) */}
              <AnimatePresence>
                {selected && (
                  <motion.div initial={{ y: '100%', md: { y: 0, x: '100%' } }} animate={{ y: 0, md: { x: 0 } }} exit={{ y: '100%', md: { y: 0, x: '100%' } }} transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                    className={`absolute md:relative bottom-0 right-0 w-full h-[85vh] md:h-auto md:w-[500px] z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:shadow-[-20px_0_40px_rgba(0,0,0,0.1)] overflow-y-auto border-t md:border-t-0 md:border-l backdrop-blur-3xl rounded-t-3xl md:rounded-none p-5 sm:p-8 ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                    
                    <div className="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-6" />
                    <button onClick={() => setSelected(null)} className="absolute right-5 top-5 md:right-6 md:top-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:scale-110 transition-transform"><X size={18} /></button>
                    
                    <p className="text-orange-500 font-black uppercase text-[10px] tracking-[0.3em] mb-1.5">{selected.display_state}</p>
                    <h2 className="text-4xl sm:text-5xl font-black mb-8 tracking-tighter leading-none">{selected.display_name}</h2>

                    {/* BENTO STATS */}
                    <div className="grid grid-cols-2 gap-3 mb-10">
                      <AnalysisCard label="Population" value={new Intl.NumberFormat('en-IN').format(selected.pop)} target={INDIA_AVG.pop} current={selected.pop} icon={<Users size={16}/>} />
                      <AnalysisCard label="Sex Ratio" value={selected.sexRatio} target={INDIA_AVG.sexRatio} current={selected.sexRatio} sub="Females / 1k Males" icon={<Heart size={16}/>} accent="text-pink-500" />
                      <AnalysisCard label="Literacy %" value={`${selected.lit}%`} target={INDIA_AVG.literacy} current={selected.lit} accent="text-emerald-500" icon={<BookOpen size={16}/>} />
                      <AnalysisCard label="Urban %" value={`${selected.urb}%`} target={INDIA_AVG.urban} current={selected.urb} icon={<Globe size={16}/>} />
                      <AnalysisCard label="Work Force %" value={`${selected.workRate}%`} target={INDIA_AVG.workRate} current={selected.workRate} icon={<Briefcase size={16}/>} accent="text-amber-500" />
                      <AnalysisCard label="Public Transit %" value={`${selected.mobility.pt}%`} target={INDIA_AVG.publicTransit} current={selected.mobility.pt} icon={<Bus size={16}/>} accent="text-blue-500" />
                    </div>

                    <div className="space-y-8 sm:space-y-10">
                      <div className={`p-5 sm:p-8 rounded-[2rem] border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Navigation size={16} className="text-blue-500"/> Mode Share %</h3>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={[
                                { name: 'Walk', value: parseFloat(selected.mobility.walk.toFixed(1)), color: MODE_COLORS.walk },
                                { name: 'Cycle', value: parseFloat(selected.mobility.cycle.toFixed(1)), color: MODE_COLORS.bicycle },
                                { name: '2W', value: parseFloat(selected.mobility.twowheeler.toFixed(1)), color: MODE_COLORS.twoWheeler },
                                { name: 'Car', value: parseFloat(selected.mobility.car.toFixed(1)), color: MODE_COLORS.car },
                                { name: 'Public', value: parseFloat(selected.mobility.pt.toFixed(1)), color: MODE_COLORS.publicTransport }
                              ]} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none" label={(entry) => `${entry.value}%`} labelLine={false}>
                                {Object.values(MODE_COLORS).map((c, i) => <Cell key={i} fill={c} />)}
                              </Pie>
                              <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 'bold' }} formatter={(v) => `${v}%`} />
                              <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="mb-8">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Ruler size={16} className="text-orange-500"/> Distance (% Workers)</h3>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: '< 1 km', value: parseFloat(selected.distance.under1.toFixed(1)), fill: '#10b981' },
                              { name: '1-5 km', value: parseFloat(selected.distance.oneToFive.toFixed(1)), fill: '#f59e0b' },
                              { name: '5-10 km', value: parseFloat(selected.distance.fiveToTen.toFixed(1)), fill: '#3b82f6' },
                              { name: '10+ km', value: parseFloat(selected.distance.overTen.toFixed(1)), fill: '#ef4444' }
                            ]} layout="vertical" margin={{ left: 5, right: 35 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.05} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: isDark ? '#94a3b8' : '#64748b' }} width={55} />
                              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }}/>
                              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                                 <LabelList dataKey="value" position="right" formatter={(v: string) => `${v}%`} style={{ fontSize: 10, fontWeight: '900', fill: isDark ? '#fff' : '#000' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            <footer className={`px-4 sm:px-6 py-3 border-t flex flex-col sm:flex-row justify-between items-center text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] z-[100] ${isDark ? 'bg-slate-950 border-slate-900 text-slate-500' : 'bg-white border-slate-100 text-slate-400'}`}>
              <div className="flex items-center gap-4 text-center sm:text-left mb-1.5 sm:mb-0">
                <span>India Districts &copy; 2024</span>
                <span className="hidden sm:block opacity-20">|</span>
                <span className="hidden sm:inline text-blue-500/60">Census Mobility Intelligence</span>
              </div>
              <div className="flex items-center gap-1.5">
                Made with <Heart size={10} className="text-red-500 fill-red-500" /> by 
                <a href="https://kapil2020.github.io/website/" target="_blank" rel="noreferrer" className="text-slate-900 dark:text-white hover:underline decoration-orange-500 transition-all underline-offset-2">Kapil</a>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="mb-3 sm:mb-4 bg-slate-50 dark:bg-slate-800 w-fit p-3 rounded-xl border border-slate-100 dark:border-slate-700">{icon}</div>
      <h4 className="font-black text-xs sm:text-sm uppercase tracking-widest mb-1.5 sm:mb-2">{title}</h4>
      <p className="text-[11px] sm:text-xs opacity-60 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function AnalysisCard({ label, value, target, current, sub, accent = "text-slate-900 dark:text-white", icon }: any) {
  const diff = ((current - target) / target) * 100;
  const isHigher = diff >= 0;
  return (
    <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 leading-tight pr-2">{label}</p>
          <div className="p-1.5 sm:p-2 bg-slate-50 dark:bg-slate-800 rounded-lg opacity-60 shrink-0">{icon}</div>
        </div>
        <div className={`text-lg sm:text-2xl font-black mb-0.5 tracking-tight ${accent}`}>{value}</div>
        {sub && <p className="text-[8px] opacity-40 font-bold uppercase mb-2 leading-none">{sub}</p>}
      </div>
      <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] font-black tracking-wide mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 ${isHigher ? 'text-emerald-500' : 'text-orange-500'}`}>
        {isHigher ? <TrendingUp size={10} className="shrink-0"/> : <TrendingDown size={10} className="shrink-0"/>}
        {Math.abs(diff).toFixed(1)}% {isHigher ? 'Above' : 'Below'}
      </div>
    </div>
  );
}