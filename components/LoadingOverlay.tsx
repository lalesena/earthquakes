import React from 'react';

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

export default LoadingOverlay;
