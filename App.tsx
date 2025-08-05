import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { Earthquake, Volcano, GeoData } from './types';
import { VolcanoStatus } from './data/volcanoData';
import { getEarthquakeColorByTime } from './utils/globe';
import LoadingOverlay from './components/LoadingOverlay';
import DetailsPanel from './components/DetailsPanel';
import ControlPanel from './components/ControlPanel';
import { useData } from './hooks/useData';

const App: React.FC = () => {
    const globeEl = useRef<GlobeMethods | null>(null);
    const [selectedItem, setSelectedItem] = useState<GeoData | null>(null);
    const {
        isLoading,
        loadingMessage,
        error,
        volcanoes,
        platesData,
        viewMode,
        setViewMode,
        setSearchTerm,
        volcanoesLastUpdated,
        isUpdatingVolcanoes,
        filters,
        setFilters,
        volcanoFilter,
        setVolcanoFilter,
        handleUpdateVolcanoes,
        handleEarthquakesUpdates,
        filteredData,
    } = useData();

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
        if ('mag' in (d as GeoData)) {
            const eq = d as Earthquake;
            const magnitude = eq.mag ?? 0;
            const energiaRelativa = Math.pow(magnitude, 4);
            const factorDeEscala = 0.0001;
            return energiaRelativa * factorDeEscala;
        }
        return 0.01;
    }, []);

    const pointRadius = useCallback((d: object) => {
        if ('mag' in (d as GeoData)) {
            const eq = d as Earthquake;
            return Math.pow(eq.mag ?? 1, 2) * 0.008;
        }
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
    }, [filters.dateRange]);

    const pointLabel = useCallback((d: object) => {
        const item = d as GeoData;
        return 'mag' in item ? `<div class="bg-gray-800 text-white p-2 rounded-md shadow-lg text-sm"><b>${item.place}</b><br/>Magnitude: <b>${item.mag ?? 'N/A'}</b><br/>Depth: ${item.depth.toFixed(2)} km</div>` : `<div class="bg-gray-800 text-white p-2 rounded-md shadow-lg text-sm"><b>${item.name}</b><br/>Type: ${item.type}<br/>Status: ${item.status}<br/>Elevation: ${item.elevation}m</div>`;
    }, []);

    if (isLoading || error) {
        return <LoadingOverlay message={loadingMessage} error={error} />;
    }

    return (
        <div className="relative w-screen h-screen">
            <ControlPanel
                viewMode={viewMode}
                setViewMode={setViewMode}
                filteredData={filteredData}
                onSelectItem={onSelectItemFromList}
                setSearchTerm={setSearchTerm}
                filters={filters}
                setFilters={setFilters}
                volcanoFilter={volcanoFilter}
                setVolcanoFilter={setVolcanoFilter}
                volcanoes={volcanoes}
                onUpdateVolcanoes={handleUpdateVolcanoes}
                onUpdateEarthquakes={handleEarthquakesUpdates}
                isUpdatingVolcanoes={isUpdatingVolcanoes}
                volcanoesLastUpdated={volcanoesLastUpdated}
            />
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
                pathsData={platesData}
                pathPoints={(d: any) => d.geometry.coordinates}
                pathColor={() => 'rgba(244, 131, 9, 0.9)'}
                pathStroke={0.7}
            />
        </div>
    );
};

export default App;
