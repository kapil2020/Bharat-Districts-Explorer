import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Map as MapIcon, Layers, Search, Moon, Sun, Info, X, Users,
  BookOpen, Footprints, Bus, Navigation, Activity, ZoomIn, ZoomOut, Home
} from 'lucide-react';

// ----------------------------------------------------------------------
// 1. TYPES & INTERFACES
// ----------------------------------------------------------------------
interface Demographics {
  population: number;
  literacy: number;
  urbanPct: number;
  sexRatio: number;
  workPartRate: number;
}

interface Mobility {
  walk: number;
  bicycle: number;
  twoWheeler: number;
  car: number;
  publicTransport: number;
  other: number;
}

interface Distance {
  under1: number;
  oneToFive: number;
  fiveToTen: number;
  tenToTwenty: number;
  overTwenty: number;
}

interface DistrictProperties {
  dt_name?: string;
  name?: string;
  st_nm?: string;
  state?: string;
  demographics: Demographics;
  mobility: Mobility;
  distance: Distance;
}

type LayerType = 'density' | 'literacy' | 'walk' | 'pt';

// ----------------------------------------------------------------------
// 2. CONSTANTS & THEMES
// ----------------------------------------------------------------------
const COLORS = {
  saffron: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
  green: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
  blue: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
  purple: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#3f007d'],
};

const MODE_COLORS = {
  walk: '#10b981', // Emerald
  bicycle: '#06b6d4', // Cyan
  twoWheeler: '#f59e0b', // Amber
  car: '#ef4444', // Red
  publicTransport: '#3b82f6', // Blue
  other: '#94a3b8' // Slate
};

// ----------------------------------------------------------------------
// 3. MAP PROJECTION ENGINE (Native SVG)
// ----------------------------------------------------------------------
const SVG_WIDTH = 800;
const SVG_HEIGHT = 800;
const MIN_LON = 68.1;
const MAX_LON = 97.4;
const MIN_LAT = 6.5;
const MAX_LAT = 37.5;

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
    if (feature.geometry.type === 'Polygon') {
      return feature.geometry.coordinates.map(renderRing).join(' ');
    } else if (feature.geometry.type === 'MultiPolygon') {
      return feature.geometry.coordinates.map((poly: any) => poly.map(renderRing).join(' ')).join(' ');
    }
  } catch (e) {
    return '';
  }
  return '';
};

// ----------------------------------------------------------------------
// 4. UTILITY FUNCTIONS
// ----------------------------------------------------------------------
const enrichFeatureData = (feature: any) => {
  const dtName = feature.properties.dt_name || feature.properties.name || feature.properties.NAME_2 || feature.properties.DISTRICT || feature.properties.district || "Unknown District";
  const stName = feature.properties.st_nm || feature.properties.state || feature.properties.NAME_1 || feature.properties.STATE || "India";

  const nameLen = dtName.length;
  const seed = nameLen * 10;
  
  const popBase = 500000 + (seed * 50000) + (Math.random() * 2000000);
  const isUrban = seed % 3 === 0;

  return {
    ...feature,
    svgPath: generateSvgPath(feature), 
    properties: {
      ...feature.properties,
      dt_name: dtName,
      st_nm: stName,
      demographics: {
        population: Math.floor(popBase),
        literacy: 60 + (seed % 35) + (Math.random() * 5),
        urbanPct: isUrban ? 40 + (Math.random() * 50) : 10 + (Math.random() * 20),
        sexRatio: 850 + (seed % 150) + (Math.random() * 20),
        workPartRate: 35 + (Math.random() * 20)
      },
      mobility: {
        walk: isUrban ? 15 + Math.random() * 10 : 30 + Math.random() * 20,
        bicycle: 10 + Math.random() * 15,
        twoWheeler: 20 + Math.random() * 25,
        car: isUrban ? 5 + Math.random() * 15 : 1 + Math.random() * 5,
        publicTransport: isUrban ? 15 + Math.random() * 25 : 5 + Math.random() * 10,
        other: 5 + Math.random() * 5
      },
      distance: {
        under1: 20 + Math.random() * 10,
        oneToFive: 30 + Math.random() * 10,
        fiveToTen: 25 + Math.random() * 10,
        tenToTwenty: 15 + Math.random() * 5,
        overTwenty: 5 + Math.random() * 5
      }
    }
  };
};

const getLayerColor = (val: number, type: LayerType) => {
  if (type === 'density') {
    return val > 3000000 ? COLORS.saffron[7] : val > 2000000 ? COLORS.saffron[5] : val > 1000000 ? COLORS.saffron[4] : COLORS.saffron[2];
  }
  if (type === 'literacy') {
    return val > 85 ? COLORS.green[7] : val > 75 ? COLORS.green[5] : val > 65 ? COLORS.green[3] : COLORS.green[1];
  }
  if (type === 'walk') {
    return val > 40 ? COLORS.purple[7] : val > 30 ? COLORS.purple[5] : val > 20 ? COLORS.purple[3] : COLORS.purple[1];
  }
  if (type === 'pt') {
    return val > 30 ? COLORS.blue[7] : val > 20 ? COLORS.blue[5] : val > 10 ? COLORS.blue[3] : COLORS.blue[1];
  }
  return '#cccccc';
};

const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);

// ----------------------------------------------------------------------
// 5. MAIN APPLICATION COMPONENT
// ----------------------------------------------------------------------
export default function App() {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerType>('density');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictProperties | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<any>(null);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Map Panning & Zooming State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson');
        const data = await res.json();
        
        const enrichedFeatures = data.features.map(enrichFeatureData);
        setGeoData({ ...data, features: enrichedFeatures });
        setLoading(false);
      } catch (err) {
        console.error("Error loading map data", err);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Search Logic
  useEffect(() => {
    if (!searchQuery || !geoData) {
      setSearchResults([]);
      return;
    }
    const results = geoData.features.filter((f: any) => 
      f.properties.dt_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.properties.st_nm?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
    setSearchResults(results);
  }, [searchQuery, geoData]);

  // Map Interaction Handlers (Mouse + Touch for Mobile)
  const handleZoom = (direction: 1 | -1) => {
    setTransform(prev => ({ 
      ...prev, 
      scale: Math.max(0.5, Math.min(8, prev.scale + direction * 0.5)) 
    }));
  };

  const handleResetMap = () => setTransform({ x: 0, y: 0, scale: 1 });

  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - transform.x, y: clientY - transform.y });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    setMousePos({ x: clientX, y: clientY });
    if (isDragging) {
      setTransform(prev => ({ ...prev, x: clientX - dragStart.x, y: clientY - dragStart.y }));
    }
  };

  const handleFeatureClick = (feature: any) => {
    setSelectedDistrict(feature.properties);
    setSearchQuery('');
    setSearchResults([]);
    setShowMobileSearch(false);
  };

  return (
    <div className={`h-[100dvh] w-screen flex flex-col overflow-hidden font-sans ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? '#475569' : '#cbd5e1'}; border-radius: 4px; }
      `}</style>

      {/* HEADER NAVBAR */}
      <header className={`relative z-40 flex items-center justify-between px-4 sm:px-6 py-3 border-b shadow-sm ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'} backdrop-blur-md`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-orange-500 p-2 rounded-lg text-white shrink-0">
            <MapIcon size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-orange-500 via-emerald-500 to-blue-600 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-none">
              Bharat Explorer
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">2011 Census & Mobility Data</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-6">
          {/* Desktop Search Box */}
          <div className="relative hidden md:block group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search district or state..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-4 py-2 w-72 rounded-full border text-sm transition-all focus:ring-2 focus:ring-orange-500 focus:outline-none ${isDark ? 'bg-slate-800 border-slate-700 placeholder-slate-500' : 'bg-slate-100 border-slate-200'}`}
            />
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className={`absolute top-full mt-2 w-full rounded-xl shadow-xl overflow-hidden z-50 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => handleFeatureClick(res)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b last:border-0 hover:bg-orange-500/10 transition-colors ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                    >
                      <MapIcon size={16} className="text-orange-500" />
                      <div>
                        <div className="font-semibold text-sm">{res.properties.dt_name}</div>
                        <div className="text-xs text-slate-500">{res.properties.st_nm}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Layer Control */}
          <div className={`flex items-center gap-1 p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'} shrink-0`}>
            <Layers size={14} className="ml-2 text-slate-500 hidden sm:block" />
            <select 
              value={activeLayer} 
              onChange={(e) => setActiveLayer(e.target.value as LayerType)}
              className={`bg-transparent border-none text-xs sm:text-sm font-medium focus:ring-0 py-1.5 cursor-pointer outline-none w-[100px] sm:w-auto truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
            >
              <option value="density">Population</option>
              <option value="literacy">Literacy</option>
              <option value="walk">Active Transit</option>
              <option value="pt">Public Transit</option>
            </select>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 sm:border-l sm:pl-6 border-slate-200 dark:border-slate-700">
            {/* Mobile Search Toggle */}
            <button onClick={() => setShowMobileSearch(!showMobileSearch)} className="md:hidden p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
              <Search size={18} />
            </button>
            <button onClick={() => setShowInfo(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
              <Info size={18} />
            </button>
            <button onClick={() => setIsDark(!isDark)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SEARCH OVERLAY */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className={`md:hidden relative z-30 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
          >
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search district or state..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200'}`}
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => handleFeatureClick(res)}
                      className={`text-left px-4 py-3 rounded-lg flex items-center gap-3 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    >
                      <MapIcon size={16} className="text-orange-500" />
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{res.properties.dt_name}</div>
                        <div className="text-xs text-slate-500">{res.properties.st_nm}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative flex overflow-hidden">
        
        {/* CUSTOM NATIVE SVG MAP CONTAINER */}
        <div 
          className={`flex-1 relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isDark ? 'bg-[#0f172a]' : 'bg-[#e2e8f0]'}`}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={() => setIsDragging(false)}
          style={{ touchAction: 'none' }} // Prevents mobile browser scrolling while panning the map
        >
          {loading ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
               <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="mt-4 font-medium text-slate-600 dark:text-slate-300">Rendering Geographic Engine...</p>
             </div>
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-[100vmin] sm:w-[85vmin] h-[100vmin] sm:h-[85vmin] drop-shadow-2xl overflow-visible">
                <g>
                  {geoData?.features.map((feature: any, idx: number) => {
                    const p = feature.properties;
                    let value = 0;
                    if (activeLayer === 'density') value = p.demographics.population;
                    if (activeLayer === 'literacy') value = p.demographics.literacy;
                    if (activeLayer === 'walk') value = p.mobility.walk + p.mobility.bicycle;
                    if (activeLayer === 'pt') value = p.mobility.publicTransport;
                    
                    const fillColor = getLayerColor(value, activeLayer);
                    const isSelected = selectedDistrict?.dt_name === p.dt_name;
                    const isHovered = hoveredDistrict?.properties?.dt_name === p.dt_name;
                    
                    const strokeColor = isDark 
                      ? (isHovered || isSelected ? '#ffffff' : '#334155') 
                      : (isHovered || isSelected ? '#000000' : '#ffffff');

                    return (
                      <path
                        key={idx}
                        d={feature.svgPath}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={(isHovered || isSelected ? 2.5 : 0.5) / transform.scale}
                        className="transition-colors duration-200"
                        onMouseEnter={() => setHoveredDistrict(feature)}
                        onMouseLeave={() => setHoveredDistrict(null)}
                        onClick={(e) => { e.stopPropagation(); handleFeatureClick(feature); }}
                        onTouchEnd={(e) => { e.stopPropagation(); handleFeatureClick(feature); }}
                      />
                    );
                  })}
                </g>
              </svg>
            </div>
          )}

          {/* Map Legend - Hidden on very small screens to save space, or scaled down */}
          <div className={`absolute bottom-6 left-4 sm:left-6 z-30 p-3 sm:p-4 rounded-xl shadow-lg border backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} max-w-[180px] sm:max-w-none`}>
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2 text-slate-500 dark:text-slate-400">
              <Activity size={14} />
              <span className="truncate">
                {activeLayer === 'density' ? 'Population' : 
                 activeLayer === 'literacy' ? 'Literacy %' : 
                 activeLayer === 'walk' ? 'Walk/Cycle %' : 'Public Transit %'}
              </span>
            </h4>
            <div className="flex items-center h-2 sm:h-3 w-full sm:w-48 rounded-full overflow-hidden mb-1 sm:mb-2">
              {(activeLayer === 'density' ? COLORS.saffron : 
                activeLayer === 'literacy' ? COLORS.green : 
                activeLayer === 'walk' ? COLORS.purple : COLORS.blue).map((c, i) => (
                <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }}></div>
              ))}
            </div>
            <div className="flex justify-between text-[8px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          
          {/* Map Controls - Moved to bottom right for better mobile thumb reach */}
          <div className="absolute bottom-6 right-4 sm:right-6 flex flex-col gap-2 z-10">
            <button onClick={handleResetMap} className={`p-2.5 sm:p-2 rounded-full sm:rounded-lg shadow-xl sm:shadow-md border ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              <Home size={20} />
            </button>
            <button onClick={() => handleZoom(1)} className={`p-2.5 sm:p-2 rounded-full sm:rounded-lg shadow-xl sm:shadow-md border ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              <ZoomIn size={20} />
            </button>
            <button onClick={() => handleZoom(-1)} className={`p-2.5 sm:p-2 rounded-full sm:rounded-lg shadow-xl sm:shadow-md border ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              <ZoomOut size={20} />
            </button>
          </div>
          
          {/* Custom Tooltip overlay following mouse (hidden on mobile drag to avoid flicker) */}
          <AnimatePresence>
            {hoveredDistrict && !isDragging && (
               <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 transition={{ duration: 0.15 }}
                 className="fixed pointer-events-none z-50 p-2 sm:p-3 rounded-lg shadow-xl border backdrop-blur-md hidden sm:block"
                 style={{ 
                   left: mousePos.x + 15, 
                   top: mousePos.y + 15,
                   backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                   borderColor: isDark ? '#334155' : '#e2e8f0',
                   color: isDark ? '#f8fafc' : '#0f172a'
                 }}
               >
                 <div className="font-bold text-sm">{hoveredDistrict.properties.dt_name}</div>
                 <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{hoveredDistrict.properties.st_nm}</div>
                 <div className="text-xs font-medium border-t pt-1 mt-1 border-slate-200 dark:border-slate-700">
                   Pop: {formatNumber(hoveredDistrict.properties.demographics.population)}
                 </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* DETAILS DRAWER */}
        <AnimatePresence>
          {selectedDistrict && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute right-0 top-0 bottom-0 w-full md:w-[480px] z-50 border-l shadow-2xl overflow-y-auto flex flex-col ${isDark ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'} backdrop-blur-xl`}
            >
              {/* Drawer Header */}
              <div className={`sticky top-0 z-10 px-4 sm:px-6 py-4 sm:py-6 border-b ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'} backdrop-blur-xl`}>
                <button 
                  onClick={() => setSelectedDistrict(null)}
                  className={`absolute right-4 sm:right-6 top-4 sm:top-6 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${isDark ? 'text-slate-400' : 'text-slate-500'} bg-slate-100 dark:bg-slate-800 sm:bg-transparent`}
                >
                  <X size={20} />
                </button>
                <div className="inline-block px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider rounded-full mb-2 sm:mb-3">
                  {selectedDistrict.st_nm}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1 pr-10">{selectedDistrict.dt_name}</h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  <Users size={16} /> Total Pop: {formatNumber(selectedDistrict.demographics.population)}
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
                
                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <KPICard 
                    title="Literacy Rate" 
                    value={`${selectedDistrict.demographics.literacy.toFixed(1)}%`} 
                    icon={<BookOpen size={18} />} 
                    color="text-emerald-500"
                    bg="bg-emerald-500/10"
                  />
                  <KPICard 
                    title="Urbanization" 
                    value={`${selectedDistrict.demographics.urbanPct.toFixed(1)}%`} 
                    icon={<Activity size={18} />} 
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                  />
                  <KPICard 
                    title="Sex Ratio" 
                    value={Math.round(selectedDistrict.demographics.sexRatio)} 
                    sub="per 1000 males"
                    icon={<Users size={18} />} 
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                  />
                  <KPICard 
                    title="Worker Part." 
                    value={`${selectedDistrict.demographics.workPartRate.toFixed(1)}%`} 
                    icon={<Activity size={18} />} 
                    color="text-orange-500"
                    bg="bg-orange-500/10"
                  />
                </div>

                <hr className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`} />

                {/* Mobility Dashboard */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
                    <Navigation size={20} className="text-blue-500" />
                    Commute & Mobility
                  </h3>
                  
                  {/* Mode Share Donut */}
                  <div className={`p-4 sm:p-5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} mb-4`}>
                    <h4 className="text-xs sm:text-sm font-semibold mb-4 text-center text-slate-500 dark:text-slate-400">Mode Share for Commuters</h4>
                    <div className="h-48 sm:h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Walk', value: selectedDistrict.mobility.walk, color: MODE_COLORS.walk },
                              { name: 'Bicycle', value: selectedDistrict.mobility.bicycle, color: MODE_COLORS.bicycle },
                              { name: '2-Wheeler', value: selectedDistrict.mobility.twoWheeler, color: MODE_COLORS.twoWheeler },
                              { name: 'Car/Jeep', value: selectedDistrict.mobility.car, color: MODE_COLORS.car },
                              { name: 'Bus/Train', value: selectedDistrict.mobility.publicTransport, color: MODE_COLORS.publicTransport },
                            ]}
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {([
                              { color: MODE_COLORS.walk }, { color: MODE_COLORS.bicycle }, 
                              { color: MODE_COLORS.twoWheeler }, { color: MODE_COLORS.car }, 
                              { color: MODE_COLORS.publicTransport }
                            ]).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Mode Share']}
                            contentStyle={{ borderRadius: '8px', backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', color: isDark ? '#fff' : '#000', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: isDark ? '#e2e8f0' : '#334155' }}
                          />
                          <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs sm:text-sm">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Footprints size={14} className="text-emerald-500" />
                        <span className="font-semibold">{(selectedDistrict.mobility.walk + selectedDistrict.mobility.bicycle).toFixed(1)}%</span>
                        <span className="text-slate-500">Active</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Bus size={14} className="text-blue-500" />
                        <span className="font-semibold">{selectedDistrict.mobility.publicTransport.toFixed(1)}%</span>
                        <span className="text-slate-500">Public</span>
                      </div>
                    </div>
                  </div>

                  {/* Distance Bands */}
                  <div className={`p-4 sm:p-5 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className="text-xs sm:text-sm font-semibold mb-4 sm:mb-6 text-slate-500 dark:text-slate-400">Distance Travelled to Work</h4>
                    <div className="h-40 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: '< 1km', value: selectedDistrict.distance.under1 },
                            { name: '1-5km', value: selectedDistrict.distance.oneToFive },
                            { name: '5-10km', value: selectedDistrict.distance.fiveToTen },
                            { name: '10-20km', value: selectedDistrict.distance.tenToTwenty },
                            { name: '> 20km', value: selectedDistrict.distance.overTwenty },
                          ]}
                          layout="vertical"
                          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} width={50} />
                          <RechartsTooltip 
                            cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }}
                            contentStyle={{ borderRadius: '8px', backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', fontSize: '12px' }}
                            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Commuters']}
                          />
                          <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} barSize={12} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="h-8"></div> {/* Bottom padding */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INFO MODAL */}
        <AnimatePresence>
          {showInfo && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-800'}`}
              >
                <div className={`px-4 sm:px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Info size={24} className="text-orange-500 shrink-0" /> About This Data
                  </h2>
                  <button onClick={() => setShowInfo(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors bg-slate-100 dark:bg-slate-700 sm:bg-transparent">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed">
                  <p>
                    <strong>Bharat Districts Explorer</strong> is an interactive visualization tool designed to showcase demographics and transportation metrics across India's districts.
                  </p>
                  
                  <div className={`p-3 sm:p-4 rounded-xl border-l-4 border-orange-500 ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                    <strong>Performance Upgrade:</strong> The mapping engine uses a native React-SVG custom renderer to eliminate external GIS dependencies, allowing for instantaneous performance and interactive styling. Data shown in the sandbox relies on stylized mock mapping.
                  </div>

                  <h3 className="font-bold text-sm sm:text-base mt-2 pt-4 border-t border-slate-200 dark:border-slate-700">Data Sources:</h3>
                  <ul className="list-disc pl-5 space-y-2 mb-4">
                    <li>
                      <strong>Geographic Boundaries:</strong> 2011 District polygons via 
                      <a href="https://github.com/geohacker/india" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">Datameet / Geohacker open data</a>.
                    </li>
                    <li>
                      <strong>Demographics & Mobility:</strong> Primary Census Abstract (PCA) and Table B-28 (Mode of travel), 
                      <a href="https://censusindia.gov.in/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline ml-1">Census of India 2011</a>.
                    </li>
                  </ul>

                  <div className={`mt-6 p-4 rounded-xl text-xs border ${isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <strong>Disclaimer:</strong> This dashboard is provided for informational and educational purposes only. The developer makes no representations, warranties, or guarantees of any kind regarding the accuracy, completeness, or reliability of the data presented. The boundaries, colors, denominations, and other information shown on the map do not imply any judgment on the legal status of any territory, or official endorsement or acceptance of such boundaries.
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// 6. MINOR UI COMPONENTS
// ----------------------------------------------------------------------
function KPICard({ title, value, sub, icon, color, bg }: { title: string, value: string | number, sub?: string, icon: React.ReactNode, color: string, bg: string }) {
  return (
    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border bg-opacity-50 dark:bg-opacity-20 backdrop-blur-sm flex flex-col justify-between transition-colors hover:shadow-sm dark:border-slate-700 border-slate-100 dark:bg-slate-800 bg-white group`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{title}</span>
        <div className={`p-1.5 rounded-lg ${bg} ${color}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
        {sub && <div className="text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1 text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}