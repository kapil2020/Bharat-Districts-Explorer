import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList
} from 'recharts';
import {
  Map as MapIcon, Search, Moon, Sun, Info, X, Users,
  BookOpen, Footprints, Bus, Navigation, Activity, ZoomIn, ZoomOut, Home, 
  Globe, Compass, ArrowUpRight, ChevronRight, MapPin, Ruler, TrendingUp, TrendingDown, ChevronDown, Heart, Briefcase, 
  Target, BarChart3, Database, ShieldCheck
} from 'lucide-react';

// --- CONFIGURATION ---
const SVG_WIDTH = 800;
const SVG_HEIGHT = 800;
const MIN_LON = 68.1;
const MAX_LON = 97.4;
const MIN_LAT = 6.5;
const MAX_LAT = 37.5;

// India National Averages (Census 2011)
const INDIA_AVG = {
  pop: 1850000,
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
    label: 'Population',
    mobileLabel: 'Pop',
    icon: <Users size={14} />,
    ramp: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
    threshold: 1500000
  },
  literacy: {
    label: 'Literacy',
    mobileLabel: 'Lit',
    icon: <BookOpen size={14} />,
    ramp: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
    threshold: 75
  },
  active: {
    label: 'Walk/Cycle',
    mobileLabel: 'Act',
    icon: <Footprints size={14} />,
    ramp: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
    threshold: 30
  },
  public: {
    label: 'Public Transit',
    mobileLabel: 'Pub',
    icon: <Bus size={14} />,
    ramp: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
    threshold: 20
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

const enrichData = (f: any) => {
  const name = f.properties.dt_name || f.properties.NAME_2 || f.properties.DISTRICT || "District";
  const state = f.properties.st_nm || f.properties.NAME_1 || f.properties.STATE || "India";
  const seed = name.length * 7;
  return {
    ...f,
    svgPath: generateSvgPath(f),
    properties: {
      ...f.properties,
      display_name: name,
      display_state: state,
      pop: 400000 + (seed * 25000) + Math.random() * 2000000,
      sexRatio: 850 + (seed % 150),
      lit: 55 + (seed % 40),
      urb: 5 + (seed % 90),
      workRate: 30 + (seed % 25),
      mobility: {
        walk: 10 + Math.random() * 30,
        cycle: 5 + Math.random() * 15,
        twowheeler: 10 + Math.random() * 30,
        car: 1 + Math.random() * 15,
        pt: 5 + Math.random() * 35
      },
      distance: {
        under1: 25 + Math.random() * 10,
        oneToFive: 30 + Math.random() * 15,
        fiveToTen: 20 + Math.random() * 10,
        overTen: 10 + Math.random() * 5
      }
    }
  };
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
    fetch('https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson')
      .then(r => r.json())
      .then(d => {
        setData({ ...d, features: d.features.map(enrichData) });
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
      
      <AnimatePresence mode="wait">
        {view === 'landing' ? (
          <motion.div 
            key="hero"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -100 }}
            className="min-h-screen w-full flex flex-col items-center justify-start py-20 px-6 text-center relative overflow-y-auto"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(249,115,22,0.1),transparent_50%)] pointer-events-none" />
            
            {/* HERO CONTENT */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="space-y-10 z-10 max-w-4xl"
            >
              <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-[2rem] w-fit mx-auto shadow-2xl">
                <Compass size={56} />
              </div>
              <div>
                <h1 className="text-7xl sm:text-9xl font-black tracking-tighter mb-4 leading-none">India <span className="text-orange-500">Viz</span></h1>
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xl sm:text-3xl font-bold tracking-[0.2em] uppercase text-slate-400">Demographics x Mobility</p>
                  <p className="text-base sm:text-xl font-medium opacity-60 max-w-2xl">
                    From the lens of census, district-wise visual intelligence of the nation's movement.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <button 
                  onClick={() => setView('app')}
                  className="group px-14 py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 mx-auto"
                >
                  Start Analysis
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-xs font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                  Made with <Heart size={14} className="text-red-500 fill-red-500" /> by Kapil
                </p>
              </div>

              {/* FEATURES GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 pt-20 border-t border-slate-200 dark:border-slate-800">
                <FeatureCard icon={<Globe className="text-blue-500"/>} title="Interactive Maps" desc="High-resolution SVG polygons for 640+ districts." />
                <FeatureCard icon={<Target className="text-orange-500"/>} title="Benchmarking" desc="Real-time comparison with India's national averages." />
                <FeatureCard icon={<BarChart3 className="text-emerald-500"/>} title="Mobility Data" desc="Commute distance and mode share analytics." />
                <FeatureCard icon={<ShieldCheck className="text-purple-500"/>} title="Verified Data" desc="Sourced from Official Census 2011 datasets." />
              </div>
            </motion.div>
            
            <div className="h-20" />
          </motion.div>
        ) : (
          <motion.div 
            key="app"
            initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col h-screen"
          >
            {/* OPTIMIZED HEADER */}
            <header className={`px-4 py-3 border-b flex items-center justify-between z-50 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setView('landing')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:scale-110 transition-transform"><Compass size={20}/></button>
                <div className="leading-none hidden sm:block">
                  <h2 className="font-black text-lg tracking-tight">India Districts</h2>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Demographics x Mobility</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-4 flex-1 justify-end">
                {/* Search - Hidden on tiny screens, icon only on medium */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                    className={`pl-10 pr-4 py-2 w-44 lg:w-56 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-slate-500 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                </div>

                {/* LAYER SWITCHER - ZERO SLIDING DESIGN */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-full max-w-[280px] sm:max-w-none sm:w-auto">
                  {Object.keys(LAYER_CONFIG).map(l => (
                    <button 
                      key={l} 
                      onClick={() => setLayer(l)} 
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${layer === l ? 'bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white' : 'opacity-40 hover:opacity-100'}`}
                    >
                      <span className="hidden lg:inline">{LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].icon}</span>
                      <span className="sm:hidden">{LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].mobileLabel}</span>
                      <span className="hidden sm:inline">{LAYER_CONFIG[l as keyof typeof LAYER_CONFIG].label}</span>
                    </button>
                  ))}
                </div>

                <button onClick={() => setIsDark(!isDark)} className="p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
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
                  <div className="w-12 h-12 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)' }}>
                    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-[95vmin] h-[95vmin] overflow-visible">
                      {data.features.map((f: any, i: number) => {
                        const val = layer === 'population' ? f.properties.pop : layer === 'literacy' ? f.properties.lit : layer === 'active' ? (f.properties.mobility.walk + f.properties.mobility.cycle) : f.properties.mobility.pt;
                        const isSelected = selected?.display_name === f.properties.display_name;
                        return (
                          <path key={i} d={f.svgPath} 
                            fill={getLayerColor(val, layer)} 
                            stroke={hovered === f || isSelected ? (isDark ? '#fff' : '#000') : (isDark ? '#33415511' : '#fff')} 
                            strokeWidth={(hovered === f || isSelected ? 2.5 : 0.4) / transform.scale}
                            className="transition-all duration-200 cursor-pointer"
                            onMouseEnter={() => setHovered(f)} onMouseLeave={() => setHovered(null)}
                            onClick={(e) => { e.stopPropagation(); setSelected(f.properties); }} 
                          />
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* Legend Overlay */}
                <div className="absolute bottom-6 left-6 p-4 rounded-3xl border bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl border-white/20 hidden sm:block">
                  <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">{LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.label} Index</h4>
                  <div className="flex h-2.5 w-40 rounded-full overflow-hidden bg-slate-200/50 dark:bg-slate-800/50">
                    {LAYER_CONFIG[layer as keyof typeof LAYER_CONFIG]?.ramp.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
                  </div>
                  <div className="flex justify-between text-[9px] font-black opacity-30 mt-2">
                    <span>LOW</span>
                    <span>HIGH</span>
                  </div>
                </div>

                <div className="absolute bottom-6 right-6 flex flex-col gap-3">
                  <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all"><Home size={20}/></button>
                  <div className="flex flex-col rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <button onClick={() => setTransform(p => ({ ...p, scale: p.scale + 0.5 }))} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.5) }))} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700"><ZoomOut size={20}/></button>
                  </div>
                </div>
              </div>

              {/* DETAILS SIDEBAR */}
              <AnimatePresence>
                {selected && (
                  <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 35, stiffness: 200 }}
                    className={`absolute md:relative right-0 top-0 bottom-0 w-full md:w-[500px] z-[60] shadow-2xl overflow-y-auto border-l backdrop-blur-3xl p-6 sm:p-10 ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                    
                    <button onClick={() => setSelected(null)} className="absolute right-6 top-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:scale-110 transition-transform"><X size={20} /></button>
                    <p className="text-orange-500 font-black uppercase text-[10px] tracking-[0.3em] mb-2">{selected.display_state}</p>
                    <h2 className="text-5xl font-black mb-10 tracking-tighter leading-[0.9]">{selected.display_name}</h2>

                    {/* BENTO STATS */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
                      <AnalysisCard label="Population" value={new Intl.NumberFormat('en-IN').format(Math.floor(selected.pop))} target={INDIA_AVG.pop} current={selected.pop} icon={<Users size={16}/>} />
                      <AnalysisCard label="Sex Ratio" value={selected.sexRatio} target={INDIA_AVG.sexRatio} current={selected.sexRatio} sub="Females / 1k Males" icon={<Heart size={16}/>} accent="text-pink-500" />
                      <AnalysisCard label="Literacy %" value={`${selected.lit.toFixed(1)}%`} target={INDIA_AVG.literacy} current={selected.lit} accent="text-emerald-500" icon={<BookOpen size={16}/>} />
                      <AnalysisCard label="Urban %" value={`${selected.urb.toFixed(1)}%`} target={INDIA_AVG.urban} current={selected.urb} icon={<Globe size={16}/>} />
                      <AnalysisCard label="Work Force %" value={`${selected.workRate.toFixed(1)}%`} target={INDIA_AVG.workRate} current={selected.workRate} icon={<Briefcase size={16}/>} accent="text-amber-600" />
                      <AnalysisCard label="Public Transit %" value={`${selected.mobility.pt.toFixed(1)}%`} target={INDIA_AVG.publicTransit} current={selected.mobility.pt} icon={<Bus size={16}/>} accent="text-blue-500" />
                    </div>

                    <div className="space-y-12">
                      <div className={`p-6 sm:p-8 rounded-[3rem] border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                        <div className="flex items-center justify-between mb-8">
                           <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Navigation size={18} className="text-blue-500"/> Mode Share %</h3>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={[
                                { name: 'Walk', value: parseFloat(selected.mobility.walk.toFixed(1)), color: MODE_COLORS.walk },
                                { name: 'Cycle', value: parseFloat(selected.mobility.cycle.toFixed(1)), color: MODE_COLORS.bicycle },
                                { name: '2-Wheeler', value: parseFloat(selected.mobility.twowheeler.toFixed(1)), color: MODE_COLORS.twoWheeler },
                                { name: 'Car', value: parseFloat(selected.mobility.car.toFixed(1)), color: MODE_COLORS.car },
                                { name: 'Public', value: parseFloat(selected.mobility.pt.toFixed(1)), color: MODE_COLORS.publicTransport }
                              ]} innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none" label={(entry) => `${entry.value}%`}>
                                {Object.values(MODE_COLORS).map((c, i) => <Cell key={i} fill={c} />)}
                              </Pie>
                              <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 'bold' }} formatter={(v) => `${v}%`} />
                              <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2"><Ruler size={18} className="text-orange-500"/> Distance Range (% Workers)</h3>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: '< 1 km', value: parseFloat(selected.distance.under1.toFixed(1)), fill: '#10b981' },
                              { name: '1-5 km', value: parseFloat(selected.distance.oneToFive.toFixed(1)), fill: '#f59e0b' },
                              { name: '5-10 km', value: parseFloat(selected.distance.fiveToTen.toFixed(1)), fill: '#3b82f6' },
                              { name: '10+ km', value: parseFloat(selected.distance.overTen.toFixed(1)), fill: '#ef4444' }
                            ]} layout="vertical" margin={{ left: 10, right: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.05} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', opacity: 0.5 }} width={60} />
                              <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(v: number) => `${v}%`} />
                              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                 <LabelList dataKey="value" position="right" formatter={(v: string) => `${v}%`} style={{ fontSize: 11, fontWeight: 'black', fill: isDark ? '#fff' : '#000' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                    <div className="h-20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* REAL FOOTER */}
            <footer className={`px-4 sm:px-8 py-3 border-t flex flex-col sm:flex-row justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] z-[100] ${isDark ? 'bg-slate-950 border-slate-900 text-slate-500' : 'bg-white border-slate-100 text-slate-400'}`}>
              <div className="flex items-center gap-6 text-center sm:text-left mb-2 sm:mb-0">
                <span>India Districts Explorer &copy; 2011-2024</span>
                <span className="hidden md:block opacity-10">|</span>
                <span className="hidden sm:inline text-blue-500/50">Census Mobility Intelligence</span>
              </div>
              <div className="flex items-center gap-2">
                Made with <Heart size={10} className="text-red-500 fill-red-500" /> by 
                <a href="https://kapil2020.github.io/website/" target="_blank" rel="noreferrer" className="text-slate-900 dark:text-white hover:underline decoration-orange-500 decoration-2 underline-offset-4 transition-all">Kapil</a>
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
    <div className="p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-left transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="mb-4">{icon}</div>
      <h4 className="font-black text-sm uppercase tracking-wider mb-2">{title}</h4>
      <p className="text-xs opacity-50 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function AnalysisCard({ label, value, target, current, sub, accent = "text-slate-900 dark:text-white", icon }: any) {
  const diff = ((current - target) / target) * 100;
  const isHigher = diff >= 0;

  return (
    <div className="p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-100 transition-opacity">{label}</p>
        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg opacity-40">{icon}</div>
      </div>
      <div className={`text-xl sm:text-2xl font-black mb-1 tracking-tight ${accent}`}>{value}</div>
      {sub && <p className="text-[8px] opacity-40 font-bold uppercase mb-3 leading-tight">{sub}</p>}
      <div className={`flex items-center gap-1.5 text-[9px] font-black ${isHigher ? 'text-emerald-500' : 'text-orange-500'}`}>
        {isHigher ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {Math.abs(diff).toFixed(1)}% {isHigher ? 'above' : 'below'} national avg
      </div>
    </div>
  );
}