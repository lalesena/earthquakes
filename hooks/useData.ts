import { useState, useEffect, useCallback, useMemo } from 'react';
import { Earthquake, Volcano, GeoData, Filters, ViewMode } from '../types';
import * as dataService from '../services/dataService';
import { normalizeLongitude, processPlatesData } from '../utils/globe';

export const useData = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Checking for cached data...");
    const [error, setError] = useState<string | null>(null);

    const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
    const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);
    const [platesData, setPlatesData] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Earthquakes);
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
                        coordinates: feature.geometry.coordinates.map((coords: [number, number]) => {
                            const lon = normalizeLongitude(coords[0]);
                            const lat = coords[1];
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

    const handleEarthquakesUpdates = useCallback(async () => {
        if (viewMode === ViewMode.Earthquakes) {
            const filteredEarthquakes = await dataService.updateEarthquakes(setLoadingMessage, {
                magRange: filters.magRange,
                dateRange: filters.dateRange,
            });
            setEarthquakes(filteredEarthquakes);
            setLoadingMessage("Earthquakes updated successfully!");
        }
    }, [filters, viewMode]);

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

    return {
        isLoading,
        loadingMessage,
        error,
        earthquakes,
        volcanoes,
        platesData,
        viewMode,
        setViewMode,
        searchTerm,
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
    };
};
