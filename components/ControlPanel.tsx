import React, { useState, useMemo, useEffect, Dispatch, SetStateAction } from 'react';
import { ViewMode, GeoData, Filters, Volcano } from '../types';
import { VolcanoStatus } from '../data/volcanoData';
import { GlobeIcon, WavesIcon, MountainIcon, SearchIcon, RefreshIcon } from './icons';

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
export default ControlPanel;
