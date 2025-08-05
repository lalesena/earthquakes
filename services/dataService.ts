import { Earthquake, RawVolcano, Volcano } from '../types';
import { volcanoData } from '../data/volcanoData';
import * as geminiService from './geminiService';

const EQ_CACHE_KEY = 'earthquakeDataCache';
const VOLCANO_CACHE_KEY = 'volcanoDataCache';
const EQ_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour for earthquakes

interface CachedEarthquakeData {
    earthquakes: Earthquake[];
    timestamp: number;
}

interface CachedVolcanoData {
    volcanoes: Volcano[];
    timestamp: number;
}

const fetchEarthquakesFromApi = async (filters: { dateRange: { start: string, end: string }, magRange: { min: number } }): Promise<Earthquake[]> => {
    const { start, end } = filters.dateRange;
    const { min } = filters.magRange;
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&minmagnitude=${min}&limit=10000`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch earthquakes: ${response.statusText}`);
        const data = await response.json();
        return data.features.map((feature: any): Earthquake => ({
            id: feature.id,
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            depth: feature.geometry.coordinates[2],
            mag: feature.properties.mag,
            place: feature.properties.place,
            time: feature.properties.time,
        })).sort((a, b) => b.mag! - a.mag!);
    } catch (error) {
        console.error("Earthquake fetch error:", error);
        throw error; // Propagate error to be handled in UI
    }
};

const getEarthquakes = async (setLoadingMessage: (msg: string) => void, filters?: {
    dateRange: { start: string, end: string },
    magRange: { min: number }
}): Promise<Earthquake[]> => {
    setLoadingMessage("Fetching latest earthquake data...");

    const filtersSelected = filters || {
        dateRange: { start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
        magRange: { min: 2.5 }
    };

    const earthquakes = await fetchEarthquakesFromApi(filtersSelected);
    const newCache: CachedEarthquakeData = { earthquakes, timestamp: Date.now() };
    localStorage.setItem(EQ_CACHE_KEY, JSON.stringify(newCache));
    console.log("New earthquake data fetched and cached.");
    return earthquakes;
};

const getVolcanoes = (): CachedVolcanoData => {
    const cachedItem = localStorage.getItem(VOLCANO_CACHE_KEY);
    if (cachedItem) {
        console.log("Loading volcanoes from cache.");
        return JSON.parse(cachedItem);
    }

    console.log("Loading volcanoes from static file and creating initial cache.");
    const initialCache: CachedVolcanoData = { volcanoes: volcanoData, timestamp: Date.now() };
    localStorage.setItem(VOLCANO_CACHE_KEY, JSON.stringify(initialCache));
    return initialCache;
}

export const getInitialData = async (setLoadingMessage: (msg: string) => void): Promise<{ earthquakes: Earthquake[], volcanoes: Volcano[], volcanoesLastUpdated: number }> => {
    setLoadingMessage("Loading geological data...");

    const earthquakePromise = getEarthquakes(setLoadingMessage);
    const { volcanoes, timestamp: volcanoesLastUpdated } = getVolcanoes();
    const volcanoPromise = Promise.resolve(volcanoes);

    const [earthquakesResult, volcanoesResult] = await Promise.all([earthquakePromise, volcanoPromise]);

    console.log(`Loaded ${earthquakesResult.length} earthquakes and ${volcanoesResult.length} volcanoes.`);
    return { earthquakes: earthquakesResult, volcanoes: volcanoesResult, volcanoesLastUpdated };
};

export const updateEarthquakes = async (setLoadingMessage: (msg: string) => void, filters?: {
    dateRange: { start: string, end: string },
    magRange: { min: number }
}): Promise<Earthquake[]> => {
    setLoadingMessage("Updating earthquake data...");

    return getEarthquakes(setLoadingMessage, filters)
        .then(earthquakes => {
            console.log(`Updated ${earthquakes.length} earthquakes.`);
            return earthquakes;
        })
        .catch(error => {
            console.error("Error updating earthquakes:", error);
            throw error; // Propagate error to be handled in UI
        }
        );
};


export const updateVolcanoes = async (currentVolcanoes: Volcano[]): Promise<{ updatedVolcanoes: Volcano[], newVolcanoes: Volcano[] }> => {
    console.log("Fetching latest volcano list from USGS...");
    const response = await fetch('https://volcanoes.usgs.gov/vsc/api/volcanoApi/volcanoesGVP');
    if (!response.ok) throw new Error('Failed to fetch from USGS volcano API');
    const usgsVolcanoes: any[] = await response.json();

    const currentVolcanoNames = new Set(currentVolcanoes.map(v => v.name.toLowerCase()));

    const newRawVolcanoes: RawVolcano[] = usgsVolcanoes
        .filter((v: any) => v.volcanoName && !currentVolcanoNames.has(v.volcanoName.toLowerCase()) && v.evidenceCategory === 'Eruption Observed')
        .map((v: any): RawVolcano => ({
            name: v.volcanoName,
            lat: v.latitude,
            lng: v.longitude
        }));

    if (newRawVolcanoes.length === 0) {
        console.log("No new volcanoes with observed eruptions found.");
        const cacheStr = localStorage.getItem(VOLCANO_CACHE_KEY);
        if (cacheStr) {
            const cache: CachedVolcanoData = JSON.parse(cacheStr);
            cache.timestamp = Date.now();
            localStorage.setItem(VOLCANO_CACHE_KEY, JSON.stringify(cache));
            console.log("Updated timestamp for volcano data.");
        }
        return { updatedVolcanoes: currentVolcanoes, newVolcanoes: [] };
    }

    const MAX_TO_ADD = 50; // Add up to 50 new volcanoes at a time, one full batch for Gemini
    const volcanoesToEnrich = newRawVolcanoes.slice(0, MAX_TO_ADD);

    console.log(`Found ${newRawVolcanoes.length} new volcanoes. Enriching the top ${volcanoesToEnrich.length}...`);

    const enrichedNewVolcanoes = await geminiService.enrichVolcanoData(volcanoesToEnrich);

    if (enrichedNewVolcanoes.length === 0) {
        console.warn("Enrichment process returned no volcanoes. Aborting update.");
        return { updatedVolcanoes: currentVolcanoes, newVolcanoes: [] };
    }

    const updatedVolcanoes = [...currentVolcanoes, ...enrichedNewVolcanoes];

    const newCache: CachedVolcanoData = { volcanoes: updatedVolcanoes, timestamp: Date.now() };
    localStorage.setItem(VOLCANO_CACHE_KEY, JSON.stringify(newCache));
    console.log("Successfully updated and cached new volcano data.");

    return { updatedVolcanoes, newVolcanoes: enrichedNewVolcanoes };
}
