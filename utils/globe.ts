export const getEarthquakeColorByTime = (time: number, startDate: string, endDate: string): string => {
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
export const normalizeLongitude = (lon: number): number => {
    let newLon = lon;
    while (newLon <= -180) newLon += 360;
    while (newLon > 180) newLon -= 360;
    return newLon;
};

export const processPlatesData = (features: any[]) => {
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
