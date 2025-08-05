export interface TectonicPlate {
  type: string;
  features: {
    type: string;
    properties: {
      PlateName: string;
    };
    geometry: {
      type: string;
      // Updated to support LineString, MultiLineString, Polygon, and MultiPolygon
      coordinates: number[][] | number[][][] | number[][][][]; 
    };
  }[];
}

export interface Earthquake {
  id: string;
  lat: number;
  lng: number;
  mag: number | null;
  depth: number;
  place: string;
  time: number;
}

export enum VolcanoStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  PotentiallyActive = 'Potentially Active',
  Extinct = 'Extinct',
  Holocene = 'Holocene',
  Unknown = 'Unknown',
  Dormant = 'Dormant',
}


export interface RawVolcano {
  name: string;
  lat: number;
  lng: number;
}

export interface Volcano extends RawVolcano {
  id: string;
  elevation: number;
  type: string;
  status: VolcanoStatus;
  information: string;
}

export type GeoData = Earthquake | Volcano;

export enum ViewMode {
  Earthquakes = 'earthquakes',
  Volcanoes = 'volcanoes',
}

export interface Filters {
  dateRange: { start: string; end: string };
  magRange: { min: number; max: number };
}
