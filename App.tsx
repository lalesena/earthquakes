import React, { useState, useMemo, useCallback, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { ViewMode, Earthquake, Volcano, GeoData, Filters } from './types';
import { VolcanoStatus } from './data/volcanoData';
import * as geminiService from './services/geminiService';
import * as dataService from './services/dataService';
import { GlobeIcon, WavesIcon, MountainIcon, CloseIcon, SearchIcon, ExternalLinkIcon, RefreshIcon } from './components/icons';

// ========================================================================
// --- SECCIÓN DE FUNCIONES DE AYUDA (VERSIÓN DEFINITIVA) ---
// ========================================================================

const getEarthquakeColorByTime = (time: number, startDate: string, endDate: string): string => {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    if (endTime <= startTime) return 'rgba(239, 68, 68, 0.75)';

    const t = (time - startTime) / (endTime - startTime);
    const old_r = 220, old_g = 210, old_b = 215;
    const recent_r = 239, recent_g = 68, recent_b = 68;
    const r = Math.round(old_r + (recent_r - old_r) * t);
    const g = Math.round(old_g + (recent_g - old_g) * t);
    const b = Math.round(old_b + (recent_b - old_b) * t);
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
};

// Función 1: Corrige el desfase de la longitud
const normalizeLongitude = (lon: number): number => {
    let newLon = lon;
    while (newLon <= -180) newLon += 360;
    while (newLon > 180) newLon -= 360;
    return newLon;
};

const processPlatesData = (features: any[]) => {
    const finalFeatures: any[] = [];
    features.forEach(feature => {
        let currentSegment: any[] = [];
        const coordinates = feature.geometry.coordinates;

        coordinates.forEach((point, index) => {
            if (index === 0) {
                currentSegment.push(point);
                return;
            }
            const prevPoint = coordinates[index - 1];
            const [lon1] = prevPoint;
            const [lon2] = point;
            if (Math.abs(lon1 - lon2) > 180) {
                if (currentSegment.length > 1) {
                    finalFeatures.push({ ...feature, geometry: { ...feature.geometry, coordinates: currentSegment } });
                }
                currentSegment = [point];
            } else {
                currentSegment.push(point);
            }
        });
        if (currentSegment.length > 1) {
            finalFeatures.push({ ...feature, geometry: { ...feature.geometry, coordinates: currentSegment } });
        }
    });
    return finalFeatures;
};

// ========================================================================
// --- COMPONENTES DE UI (Loading, Details, ControlPanel) ---
// (Tu código actual para estos componentes está bien, no es necesario pegarlo aquí para la respuesta)
// ========================================================================

const LoadingOverlay: React.FC<{ message: string; error?: string | null }> = ({ message, error }) => (
    <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col justify-center items-center gap-4 text-center p-4">
        <h1 className="text-3xl font-bold text-cyan-300">GeoSphere Explorer</h1>
        {error ? (
            <div className="text-red-400">
                <p className="font-semibold">Failed to load data:</p>
                <p className="text-sm">{error}</p>
                <p className="text-sm mt-2 text-gray-400">Please check your network or API key and refresh.</p>
            </div>
        ) : (
            <>
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400"></div>
                <p className="text-lg text-gray-300">{message}</p>
            </>
        )}
    </div>
);


const DetailsPanel: React.FC<{ selectedItem: GeoData | null; onClose: () => void }> = ({ selectedItem, onClose }) => {
    const [earthquakeSummary, setEarthquakeSummary] = useState<string>('');
    const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
    const prevEarthquakeId = useRef<string | null>(null);

    useEffect(() => {
        if (selectedItem && 'mag' in selectedItem) { // It's an Earthquake
            if (prevEarthquakeId.current !== selectedItem.id) {
                setIsLoadingSummary(true);
                setEarthquakeSummary('');
                geminiService.generateEarthquakeSummary(selectedItem).then(res => {
                    setEarthquakeSummary(res);
                    setIsLoadingSummary(false);
                });
                prevEarthquakeId.current = selectedItem.id;
            }
        } else {
            prevEarthquakeId.current = null;
        }
    }, [selectedItem]);

    if (!selectedItem) return null;
    const isEarthquake = 'mag' in selectedItem;

    return (
        <div className={`absolute top-0 right-0 h-full w-full md:w-1/3 lg:w-1/4 bg-gray-900/80 backdrop-blur-sm text-white p-6 shadow-2xl z-20 transform transition-transform duration-300 ease-in-out ${selectedItem ? 'translate-x-0' : 'translate-x-full'}`}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition" aria-label="Close details panel">
                <CloseIcon className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold mb-4 text-cyan-300">{isEarthquake ? 'Earthquake Details' : 'Volcano Details'}</h2>

            {isEarthquake ? (
                <div className="space-y-3">
                    <p><strong className="text-gray-400">Location:</strong> {(selectedItem as Earthquake).place}</p>
                    <p><strong className="text-gray-400">Magnitude:</strong> {(selectedItem as Earthquake).mag ?? 'N/A'}</p>
                    <p><strong className="text-gray-400">Depth:</strong> {(selectedItem as Earthquake).depth.toFixed(2)} km</p>
                    <p><strong className="text-gray-400">Time:</strong> {new Date((selectedItem as Earthquake).time).toLocaleString()}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p><strong className="text-gray-400">Name:</strong> {(selectedItem as Volcano).name}</p>
                    <p><strong className="text-gray-400">Elevation:</strong> {(selectedItem as Volcano).elevation} m</p>
                    <p><strong className="text-gray-400">Type:</strong> {(selectedItem as Volcano).type}</p>
                    <p><strong className="text-gray-400">Status:</strong> {(selectedItem as Volcano).status}</p>
                </div>
            )}

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">{isEarthquake ? 'AI Summary' : 'Fascinating Fact'}</h3>
                {isEarthquake ? (
                    isLoadingSummary ? <div className="flex justify-center items-center h-24"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div></div> : <p className="text-gray-300 italic">{earthquakeSummary}</p>
                ) : (
                    <p className="text-gray-300 italic">{(selectedItem as Volcano).information}</p>
                )}
            </div>

            {isEarthquake && (
                <a href={`https://earthquake.usgs.gov/earthquakes/eventpage/${selectedItem.id}`} target="_blank" rel="noopener noreferrer" className="mt-6 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center space-x-2">
                    <ExternalLinkIcon className="w-5 h-5" />
                    <span>View on USGS</span>
                </a>
            )}
        </div>
    );
};

const ControlPanel: React.FC<{
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    filteredData: GeoData[];
    onSelectItem: (item: GeoData) => void;
    setSearchTerm: (term: string) => void;
    filters: Filters;
    setFilters: Dispatch<SetStateAction<Filters>>;
    volcanoFilter: { type: string; status: string };
    setVolcanoFilter: Dispatch<SetStateAction<{ type: string; status: string }>>;
    volcanoes: Volcano[];
    onUpdateEarthquakes: () => void;
    onUpdateVolcanoes: () => void;
    isUpdatingVolcanoes: boolean;
    volcanoesLastUpdated: number | null;
}> = ({ viewMode, setViewMode, filteredData, onSelectItem, setSearchTerm, filters, setFilters, volcanoFilter, setVolcanoFilter, volcanoes, onUpdateVolcanoes, onUpdateEarthquakes, isUpdatingVolcanoes, volcanoesLastUpdated }) => {
    const [showAll, setShowAll] = useState(false);
    const volcanoTypes = useMemo(() => [...new Set(volcanoes.map(v => v.type))].sort(), [volcanoes]);

    useEffect(() => { setShowAll(false); }, [viewMode, volcanoFilter, filters]);
    useEffect(() => { onUpdateEarthquakes() }, [filters]);

    const itemsToShow = showAll ? filteredData : filteredData.slice(0, 10);

    return (
        <div className="absolute top-0 left-0 h-full w-full md:w-1/3 lg:w-1/4 bg-gray-900/70 backdrop-blur-sm text-white p-4 z-10 overflow-y-auto">
            <header className="flex items-center space-x-2 mb-4"><GlobeIcon className="w-8 h-8 text-cyan-400" /><h1 className="text-2xl font-bold">GeoSphere Explorer</h1></header>

            <div className="flex bg-gray-800 rounded-lg p-1 mb-4">
                <button onClick={() => setViewMode(ViewMode.Earthquakes)} className={`w-1/2 py-2 text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition ${viewMode === ViewMode.Earthquakes ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}><WavesIcon className="w-5 h-5" /><span>Earthquakes</span></button>
                <button onClick={() => setViewMode(ViewMode.Volcanoes)} className={`w-1/2 py-2 text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition ${viewMode === ViewMode.Volcanoes ? 'bg-rose-600' : 'hover:bg-gray-700'}`}><MountainIcon className="w-5 h-5" /><span>Volcanoes</span></button>
            </div>

            <div className="relative mb-4">
                <label htmlFor="search-input" className="sr-only">Search</label>
                <input id="search-input" type="text" placeholder={`Search ${viewMode}...`} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>

            {viewMode === ViewMode.Earthquakes && (
                <div className="space-y-4 mb-4 p-4 bg-gray-800/50 rounded-lg">
                    <h3 className="font-bold text-lg">Earthquake Filters</h3>
                    <div>
                        <label htmlFor="mag-min" className="block text-sm font-medium text-gray-300">Min Magnitude: {filters.magRange.min.toFixed(1)}</label>
                        <input id="mag-min" type="range" min="1" max="9" step="0.1" value={filters.magRange.min} onChange={e => setFilters(f => ({ ...f, magRange: { ...f.magRange, min: +e.target.value } }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-gray-300">Start Date</label>
                            <input type="date" id="start-date" value={filters.dateRange.start} onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, start: e.target.value } }))} className="w-full bg-gray-700 border-gray-600 rounded-md p-1.5 mt-1 text-sm text-white" />
                        </div>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-gray-300">End Date</label>
                            <input type="date" id="end-date" value={filters.dateRange.end} onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, end: e.target.value } }))} className="w-full bg-gray-700 border-gray-600 rounded-md p-1.5 mt-1 text-sm text-white" />
                        </div>
                    </div>
                </div>
            )}

            {viewMode === ViewMode.Volcanoes && (
                <>
                    <div className="space-y-4 mb-4 p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="font-bold text-lg">Volcano Filters</h3>
                        <select id="volcano-status" value={volcanoFilter.status} onChange={e => setVolcanoFilter(f => ({ ...f, status: e.target.value }))} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-sm focus:ring-rose-500 focus:border-rose-500">
                            <option value="All">All Statuses</option>{Object.values(VolcanoStatus).map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <select id="volcano-type" value={volcanoFilter.type} onChange={e => setVolcanoFilter(f => ({ ...f, type: e.target.value }))} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-sm focus:ring-rose-500 focus:border-rose-500">
                            <option value="All">All Types</option>{volcanoTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <button onClick={() => setVolcanoFilter({ type: 'All', status: 'All' })} className="w-full text-sm text-cyan-300 hover:text-cyan-200">Reset Filters</button>
                    </div>
                    <div className="mb-4">
                        <button
                            onClick={onUpdateVolcanoes}
                            disabled={isUpdatingVolcanoes}
                            className="w-full bg-rose-700 hover:bg-rose-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center space-x-2"
                        >
                            {isUpdatingVolcanoes ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                                <RefreshIcon className="w-5 h-5" />
                            )}
                            <span>{isUpdatingVolcanoes ? 'Updating...' : 'Update from USGS'}</span>
                        </button>
                        {volcanoesLastUpdated && (
                            <p className="text-xs text-gray-400 text-center mt-2">
                                Last updated: {new Date(volcanoesLastUpdated).toLocaleString()}
                            </p>
                        )}
                    </div>
                </>
            )}

            <hr className="border-gray-700 my-4" />

            <div className="space-y-2">
                {itemsToShow.length > 0 ? itemsToShow.map(item => (
                    <div key={item.id} onClick={() => onSelectItem(item)} onKeyDown={(e) => e.key === 'Enter' && onSelectItem(item)} tabIndex={0} role="button" aria-pressed="false" className="bg-gray-800 hover:bg-gray-700 p-3 rounded-lg cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        {'mag' in item ? (
                            <div>
                                <p className="font-semibold">{item.place}</p>
                                <div className="text-sm text-gray-400 mt-1 flex justify-between"><span>Mag: <strong className="text-white">{item.mag ?? 'N/A'}</strong></span><span>Depth: <strong className="text-white">{item.depth.toFixed(1)} km</strong></span></div>
                                <p className="text-xs text-gray-500 mt-1">{new Date(item.time).toLocaleString()}</p>
                            </div>
                        ) : (
                            <div>
                                <p className="font-semibold">{item.name}</p>
                                <div className="text-sm text-gray-400 mt-1 flex justify-between"><span>Type: <strong className="text-white">{item.type}</strong></span><span>Status: <strong className="text-white">{item.status}</strong></span></div>
                            </div>
                        )}
                    </div>
                )) : (<p className="text-center text-gray-500 py-4">No data matches the current filters.</p>)}
            </div>

            {filteredData.length > 10 && (<div className="mt-4 text-center"><button onClick={() => setShowAll(p => !p)} className="bg-gray-700 hover:bg-gray-600 text-cyan-300 font-semibold py-2 px-4 rounded-lg transition duration-300 text-sm">{showAll ? 'Show Top 10' : `Show All ${filteredData.length} Results`}</button></div>)}
        </div>
    );
};

const App: React.FC = () => {
    const globeEl = useRef<GlobeMethods | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Checking for cached data...");
    const [error, setError] = useState<string | null>(null);

    const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
    const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
    const [platesData, setPlatesData] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Earthquakes);
    const [selectedItem, setSelectedItem] = useState<GeoData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [volcanoesLastUpdated, setVolcanoesLastUpdated] = useState<number | null>(null);
    const [isUpdatingVolcanoes, setIsUpdatingVolcanoes] = useState(false);

    const [filters, setFilters] = useState<Filters>(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
        return {
            dateRange: { start: thirtyDaysAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0] },
            magRange: { min: 2.5, max: 9.0 },
        };
    });

    const [volcanoFilter, setVolcanoFilter] = useState({ type: 'All', status: 'All' });

    useEffect(() => {
        const loadData = async () => {
            try {
                const { earthquakes, volcanoes, volcanoesLastUpdated } = await dataService.getInitialData(setLoadingMessage);
                setEarthquakes(earthquakes);
                setVolcanoes(volcanoes);
                setVolcanoesLastUpdated(volcanoesLastUpdated);

                setLoadingMessage("Fetching tectonic plate boundaries...");
                const platesResponse = await fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json');
                if (!platesResponse.ok) throw new Error(`Failed to fetch tectonic plates: ${platesResponse.statusText}`);
                const platesJson = await platesResponse.json();

                const normalizedFeatures = platesJson.features.map((feature: any) => ({
                    ...feature,
                    geometry: {
                        ...feature.geometry,
                        // Itera sobre cada punto [longitud, latitud]
                        coordinates: feature.geometry.coordinates.map((coords: [number, number]) => {
                            const lon = normalizeLongitude(coords[0]); // Normaliza la longitud
                            const lat = coords[1];

                            // --- AQUÍ SE HARÍA EL CAMBIO ---
                            // Invierte el orden para que sea [latitud, longitud]
                            return [lat, lon];
                        }),
                    },
                }));
                const finalPlatesData = processPlatesData(normalizedFeatures);
                setPlatesData(finalPlatesData);
            } catch (err: any) {
                setError(err.message || 'An unknown error occurred.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleUpdateVolcanoes = useCallback(async () => {
        setIsUpdatingVolcanoes(true);
        try {
            const { updatedVolcanoes, newVolcanoes } = await dataService.updateVolcanoes(volcanoes);

            if (newVolcanoes.length > 0) {
                setVolcanoes(updatedVolcanoes);
                alert(`Successfully added ${newVolcanoes.length} new volcanoes to the list!`);
            } else {
                alert('Your volcano list is already up to date with the latest from USGS with observed eruptions.');
            }

            const cache = JSON.parse(localStorage.getItem('volcanoDataCache')!);
            setVolcanoesLastUpdated(cache.timestamp);

        } catch (error) {
            console.error("Failed to update volcanoes:", error);
            alert(`Failed to update volcano list: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUpdatingVolcanoes(false);
        }
    }, [volcanoes]);

    const filteredData = useMemo(() => {
        let data;
        if (viewMode === ViewMode.Earthquakes) {
            data = earthquakes.filter(eq => {
                const nameMatch = eq.place.toLowerCase().includes(searchTerm.toLowerCase());
                return nameMatch;
            }).sort((a, b) => b.time - a.time);
        } else {
            data = volcanoes.filter(vol => {
                const nameMatch = vol.name.toLowerCase().includes(searchTerm.toLowerCase());
                const statusMatch = volcanoFilter.status === 'All' || vol.status === volcanoFilter.status;
                const typeMatch = volcanoFilter.type === 'All' || vol.type === volcanoFilter.type;
                return nameMatch && statusMatch && typeMatch;
            }).sort((a, b) => a.name.localeCompare(b.name));
        }
        return data;
    }, [viewMode, volcanoes, searchTerm, volcanoFilter, earthquakes]);

    const handleEarthquakesUpdates = useCallback(async () => {
        if (viewMode === ViewMode.Earthquakes) {
            const filteredEarthquakes = await dataService.updateEarthquakes(setLoadingMessage, {
                magRange: filters.magRange,
                dateRange: filters.dateRange,
            });
            setEarthquakes(filteredEarthquakes);
            setLoadingMessage("Earthquakes updated successfully!");
        }
    }, [filters, viewMode])


    const handlePointClick = useCallback((point: object) => {
        const item = point as GeoData;
        setSelectedItem(item);
        globeEl.current?.pointOfView({ lat: item.lat, lng: item.lng, altitude: 1.5 }, 1000);
    }, []);

    const onSelectItemFromList = useCallback((item: GeoData) => {
        setSelectedItem(item);
        globeEl.current?.pointOfView({ lat: item.lat, lng: item.lng, altitude: 1 }, 1000);
    }, []);

    const pointAltitude = useCallback((d: object) => {
        // Comprueba si el punto es un terremoto
        if ('mag' in (d as GeoData)) {
            const eq = d as Earthquake;
            const magnitude = eq.mag ?? 0;

            // 1. Usamos una función de potencia para crear la curva exponencial.
            // Un exponente de 3 o 4 funciona bien para sobrerepresentar los valores altos.
            const energiaRelativa = Math.pow(magnitude, 4);

            // 2. Aplicamos un factor de escala MUY pequeño para que la altura sea visible en el globo.
            // Ajusta este valor para cambiar la altura máxima de los terremotos más grandes.
            const factorDeEscala = 0.0001;

            return energiaRelativa * factorDeEscala;
        }

        // Para los volcanes, mantenemos una altitud mínima.
        return 0.01;
    }, []);
    // const pointRadius = useCallback((d: object) => ('mag' in (d as GeoData) ? Math.pow((d as Earthquake).mag ?? 1, 1.5) * 0.015 : 0.25), []);
    const pointRadius = useCallback((d: object) => {
        if ('mag' in (d as GeoData)) {
            const eq = d as Earthquake;
            // La base es la magnitud al cuadrado, multiplicada por un factor para ajustar el tamaño general.
            return Math.pow(eq.mag ?? 1, 2) * 0.008;
        }
        // Mantiene el tamaño fijo para los volcanes
        return 0.25;
    }, []);
    const pointColor = useCallback((d: object) => {
        const item = d as GeoData;
        if ('mag' in item) {
            return getEarthquakeColorByTime(item.time, filters.dateRange.start, filters.dateRange.end);
        }
        switch ((item as Volcano).status) {
            case VolcanoStatus.Active: return '#ef4444';
            case VolcanoStatus.PotentiallyActive: return '#f97316';
            case VolcanoStatus.Inactive: return '#84cc16';
            case VolcanoStatus.Extinct: return '#a9826aff';
            case VolcanoStatus.Unknown: return '#ffffffff';
            default: return '#a8a29e';
        }
    }, [filters.dateRange]); // CORRECCIÓN: Añadida la dependencia que faltaba

    const pointLabel = useCallback((d: object) => {
        const item = d as GeoData;
        return 'mag' in item ? `<div class="bg-gray-800 text-white p-2 rounded-md shadow-lg text-sm"><b>${item.place}</b><br/>Magnitude: <b>${item.mag ?? 'N/A'}</b><br/>Depth: ${item.depth.toFixed(2)} km</div>` : `<div class="bg-gray-800 text-white p-2 rounded-md shadow-lg text-sm"><b>${item.name}</b><br/>Type: ${item.type}<br/>Status: ${item.status}<br/>Elevation: ${item.elevation}m</div>`;
    }, []);

    if (isLoading || error) {
        return <LoadingOverlay message={loadingMessage} error={error} />;
    }

    return (
        <div className="relative w-screen h-screen">
            <ControlPanel viewMode={viewMode} setViewMode={setViewMode} filteredData={filteredData} onSelectItem={onSelectItemFromList} setSearchTerm={setSearchTerm} filters={filters} setFilters={setFilters} volcanoFilter={volcanoFilter} setVolcanoFilter={setVolcanoFilter} volcanoes={volcanoes} onUpdateVolcanoes={handleUpdateVolcanoes} onUpdateEarthquakes={handleEarthquakesUpdates} isUpdatingVolcanoes={isUpdatingVolcanoes} volcanoesLastUpdated={volcanoesLastUpdated} />
            <DetailsPanel selectedItem={selectedItem} onClose={() => setSelectedItem(null)} />
            <Globe
                ref={globeEl}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                pointsData={filteredData}
                pointLat="lat"
                pointLng="lng"
                pointAltitude={pointAltitude}
                pointRadius={pointRadius}
                pointColor={pointColor}
                pointLabel={pointLabel}
                onPointClick={handlePointClick}
                // --- REEMPLAZA LAS PROPIEDADES "path..." CON ESTAS ---
                pathsData={platesData}
                pathPoints={(d: any) => d.geometry.coordinates}
                pathColor={() => 'rgba(244, 131, 9, 0.9)'} // Un color cian, por ejemplo
                pathStroke={0.7}
            />
        </div>
    );
};

export default App;
