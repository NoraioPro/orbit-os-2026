export type ConnectorStatus = 'connected' | 'needs-credentials';

export interface Connector {
  id: string;
  name: string;
  provider: string;
  priority: 'P0' | 'P1';
  purpose: string;
  status: ConnectorStatus;
  /** What's needed to connect, or '' when already keyless/connected. */
  auth: string;
  url: string;
  /** Real date range / coverage, only for connected sources. */
  dateRange?: string;
}

/**
 * The user's authoritative data-source checklist. `connected` sources stream
 * REAL data (no fabrication); `needs-credentials` sources are honestly marked
 * "not connected" until the credential named in `auth` is supplied.
 */
export const CONNECTORS: Connector[] = [
  { id: 'earthdata', name: 'NASA Earthdata', provider: 'NASA ESDIS', priority: 'P0', purpose: 'Authenticate NASA downloads', status: 'needs-credentials', auth: 'free Earthdata login (URS)', url: 'https://urs.earthdata.nasa.gov/' },
  { id: 'asf', name: 'ASF Search API', provider: 'NASA ASF DAAC', priority: 'P0', purpose: 'Find NISAR and SAR scenes', status: 'needs-credentials', auth: 'Earthdata login (metadata search is keyless)', url: 'https://asf.alaska.edu/' },
  { id: 'nisar', name: 'NISAR earthaccess', provider: 'NASA-ISRO', priority: 'P0', purpose: 'Retrieve real radar products', status: 'needs-credentials', auth: 'Earthdata login', url: 'https://nisar.jpl.nasa.gov/data/' },
  { id: 'copernicus-stac', name: 'Copernicus STAC', provider: 'ESA / CDSE', priority: 'P0', purpose: 'Discover Sentinel-1 acquisitions', status: 'needs-credentials', auth: 'CDSE client id + secret', url: 'https://dataspace.copernicus.eu/' },
  { id: 'sentinel-hub', name: 'Sentinel Hub Process', provider: 'Sinergise / Planet', priority: 'P0', purpose: 'Generate Sentinel radar imagery', status: 'needs-credentials', auth: 'Sentinel Hub token', url: 'https://www.sentinel-hub.com/' },
  { id: 'hyp3', name: 'ASF HyP3', provider: 'NASA ASF DAAC', priority: 'P0', purpose: 'Supported radar processing workflows', status: 'needs-credentials', auth: 'Earthdata login', url: 'https://hyp3-docs.asf.alaska.edu/' },
  { id: 'usgs', name: 'USGS Earthquake Events', provider: 'USGS', priority: 'P0', purpose: 'Validate earthquake timing and locations', status: 'connected', auth: '', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', dateRange: 'M2.5+ past month (2,002) + live queries' },
  { id: 'gibs', name: 'NASA GIBS', provider: 'NASA ESDIS', priority: 'P1', purpose: 'Visual Earth imagery', status: 'connected', auth: '', url: 'https://nasa-gibs.github.io/gibs-api-docs/', dateRange: '13 WMTS layers (true colour, SST, snow/ice, NDVI)' },
  { id: 'gee', name: 'Google Earth Engine', provider: 'Google', priority: 'P1', purpose: 'Historical geospatial analysis', status: 'needs-credentials', auth: 'GEE service account + project', url: 'https://earthengine.google.com/' },
  { id: 'power', name: 'NASA POWER', provider: 'NASA LaRC', priority: 'P1', purpose: 'Climate measurements', status: 'connected', auth: '', url: 'https://power.larc.nasa.gov/docs/', dateRange: '5 yrs daily (25,578 rows) + 2001–2025 monthly' },
  { id: 'firms', name: 'NASA FIRMS', provider: 'NASA LANCE', priority: 'P1', purpose: 'Fire detections and disturbances', status: 'connected', auth: '', url: 'https://firms.modaps.eosdis.nasa.gov/active_fire/', dateRange: '24 h NRT · 123,889 detections' },
  { id: 'opentopography', name: 'OpenTopography', provider: 'OpenTopography', priority: 'P1', purpose: 'Elevation reference data', status: 'needs-credentials', auth: 'free API key', url: 'https://opentopography.org/' },
];
