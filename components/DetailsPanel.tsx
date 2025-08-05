import React, { useState, useEffect, useRef } from 'react';
import { GeoData, Earthquake, Volcano } from '../types';
import * as geminiService from '../services/geminiService';
import { CloseIcon, ExternalLinkIcon } from './icons';

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

export default DetailsPanel;
