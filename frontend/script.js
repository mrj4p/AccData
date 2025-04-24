import { fetchAllAccidents, fetchRouteAccidents, geocodeAddress } from './api.js';
import { initCharts, updateCharts } from './components/charts.js';

// Initialize Mapbox with saved state
mapboxgl.accessToken = 'pk.eyJ1IjoiamFwb25kbyIsImEiOiJjbTFseXF0MDkwZ2ZiMnNzYmljN3B4OGFoIn0.oWJxek9ZUakvdA0Cua7Agw';

// Configuration constants
const CONFIG = {
  ROUTE_BUFFER_DISTANCE: 0.01, // in degrees
  ROUTE_LAYER_ID: 'route',
  ACCIDENT_PROXIMITY_THRESHOLD: 0.01 // in degrees
};

// Load saved map state or use defaults
const savedState = JSON.parse(localStorage.getItem('mapState'));
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: savedState ? [savedState.center.lng, savedState.center.lat] : [36.8219, -1.2921],
  zoom: savedState ? savedState.zoom : 11,
  bearing: savedState ? savedState.bearing : 0,
  pitch: savedState ? savedState.pitch : 0
});

// Application states
let allAccidents = [];
let currentRoute = [];
let startMarker = null;
let endMarker = null;

// Save map state to localStorage
function saveMapState() {
  const mapState = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch()
  };
  localStorage.setItem('mapState', JSON.stringify(mapState));
}

// Initialize the application
async function initApp() {
  const requiredElements = [
    'map', 'time-chart', 'severity-chart', 'vehicle-chart',
    'start', 'end', 'search-route', 'clear-route'
  ];
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length) {
    console.error('Missing required elements:', missingElements);
    return;
  }
  try {
    // map event listeners
    map.on('moveend', saveMapState);
    map.on('zoomend', saveMapState);

    map.once('load', async () => {
      setupMapLayers();
      setupLayerToggles();
      setupEventListeners();
      setupFilterToggle();
      initCharts();
      
      allAccidents = await fetchAllAccidents();
      await loadAndPlotAccidents(allAccidents);
    });

  } catch (error) {
    console.error('App initialization failed:', error);
    showUserNotification('Failed to initialize application. Please check console for details.', 'error');
  }
}

// Show user notification
function showUserNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// Toggle visualization layers
function setupLayerToggles() {
  // Heatmap toggle
  document.getElementById('toggle-heatmap').addEventListener('click', function() {
    this.classList.toggle('active');
    const visibility = this.classList.contains('active') ? 'visible' : 'none';
    map.setLayoutProperty('accidents-heatmap', 'visibility', visibility);
  });

  // Clusters toggle
  document.getElementById('toggle-clusters').addEventListener('click', function() {
    this.classList.toggle('active');
    const visibility = this.classList.contains('active') ? 'visible' : 'none';
    map.setLayoutProperty('significant-clusters', 'visibility', visibility);
    map.setLayoutProperty('cluster-count', 'visibility', visibility);
    map.setLayoutProperty('medium-clusters', 'visibility', visibility);
  });

  // Points toggle
  document.getElementById('toggle-points').addEventListener('click', function() {
    this.classList.toggle('active');
    const visibility = this.classList.contains('active') ? 'visible' : 'none';
    map.setLayoutProperty('accident-points', 'visibility', visibility);
  });

  // Filters toggle (already handled by setupFilterToggle)
  document.getElementById('show-filters').addEventListener('click', function() {
    document.querySelector('.filters-panel').classList.add('visible');
    document.querySelector('.overlay').classList.add('visible');
    document.body.style.overflow = 'hidden';
  });
}


// Set up all map layers and sources
function setupMapLayers() {
  // Accident data source with adjusted clustering parameters
  map.addSource('accidents', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 60,
    clusterMinPoints: 5
  });

  // Heatmap layer
  map.addLayer({
    id: 'accidents-heatmap',
    type: 'heatmap',
    source: 'accidents',
    maxzoom: 15,
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'severity'],
        0, 0.2,
        1, 1
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.5,
        9, 1.5
      ],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 15,
        9, 25
      ],
      'heatmap-opacity': 0.7
    }
  }, 'waterway-label');

  // Significant clusters (10+ accidents)
  map.addLayer({
    id: 'significant-clusters',
    type: 'circle',
    source: 'accidents',
    filter: ['all', ['has', 'point_count'], ['>=', 'point_count', 10]],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',
        50, '#f28cb1'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        25,
        50, 35
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  // Cluster labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'accidents',
    filter: ['all', ['has', 'point_count'], ['>=', 'point_count', 10]],
    layout: {
      'text-field': '{point_count_abbreviated}+',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    }
  });

  // Medium clusters (5-9 accidents)
  map.addLayer({
    id: 'medium-clusters',
    type: 'circle',
    source: 'accidents',
    filter: ['all', 
      ['has', 'point_count'],
      ['<', 'point_count', 10],
      ['>=', 'point_count', 5]
    ],
    paint: {
      'circle-color': '#51bbd6',
      'circle-radius': 4,
      'circle-opacity': 0.6
    }
  });

  // Individual accident points
  map.addLayer({
    id: 'accident-points',
    type: 'circle',
    source: 'accidents',
    filter: ['!', ['has', 'point_count']],
    minzoom: 12,
    paint: {
      'circle-color': [
        'match',
        ['get', 'severity'],
        'fatal', '#ff0000',
        '#3b82f6'
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        12, 4,
        14, 6
      ],
      'circle-stroke-width': 0,
      'circle-opacity': 1,
      'circle-blur': 0
    }
  });

  setupMapInteractions();
}

// Set up map event handlers
function setupMapInteractions() {
  // Cluster click - zoom in
  map.on('click', 'significant-clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['significant-clusters'] });
    const clusterId = features[0].properties.cluster_id;
    
    map.getSource('accidents').getClusterExpansionZoom(
      clusterId,
      (err, zoom) => {
        if (err) return;
        map.flyTo({
          center: e.lngLat,
          zoom: Math.min(zoom, 14) // Don't zoom too close
        });
      }
    );
  });

  // Accident point click - show popup
  map.on('click', 'accident-points', (e) => {
    const feature = e.features[0];
    const coords = feature.geometry.coordinates.slice();
    
    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
      coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
    }
    
    new mapboxgl.Popup()
      .setLngLat(coords)
      .setHTML(`
        <strong>Accident ID:</strong> ${feature.properties.id}<br>
        <strong>Date:</strong> ${new Date(feature.properties.date).toLocaleString()}
      `)
      .addTo(map);
  });

  // Cursor changes
  const interactiveLayers = ['significant-clusters', 'accident-points'];
  interactiveLayers.forEach(layer => {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// Load accident data and plot on map
async function loadAndPlotAccidents(accidents) {
  try {
    if (!accidents?.length) {
      throw new Error('No accident data received');
    }

    console.log(`Loaded ${accidents.length} accidents`);
    
    // Transform to GeoJSON format
    const features = accidents.map(accident => {
      const coords = accident.location?.coordinates || accident.coordinates;
      
      if (!coords || coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        console.warn('Invalid coordinates for accident:', accident.crash_id, coords);
        return null;
      }
    
      return {
        type: 'Feature',
        properties: {
          id: accident.crash_id,
          severity: accident.contains_fatality_words ? 'fatal' : 'non-fatal',
          date: accident.crash_datetime || accident.crash_date,
          proximity: isNearRoute(coords) ? 1 : 0
        },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      };
    }).filter(Boolean);

    if (features.length === 0) {
      throw new Error('No valid accident features after filtering');
    }

    // Update map source
    map.getSource('accidents').setData({
      type: 'FeatureCollection',
      features: features
    });

    // Fit map to accidents if no route is displayed
    if (currentRoute.length === 0) {
      const bounds = features.reduce((bounds, feature) => {
        return bounds.extend(feature.geometry.coordinates);
      }, new mapboxgl.LngLatBounds());
      
      map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }

    // Update charts with all accidents initially
    updateCharts(accidents);
    updateSummaryDashboard(accidents, false);

  } catch (error) {
    console.error('Error loading accidents:', error);
    showUserNotification('Failed to load accident data. See console for details.', 'error');
  }
}

// Update summary dashboard
function updateSummaryDashboard(accidents, isRouteSpecific = false) {
  if (!accidents || !Array.isArray(accidents)) return;

  const totalAccidents = accidents.length;
  const dangerZone = findMostDangerousSegment(accidents, currentRoute);
  const mostCommonTime = findMostCommonTime(accidents);
  
  let latestAccident = '-';
  if (accidents.length > 0) {
    const dates = accidents.map(a => new Date(a.crash_datetime || a.crash_date)).filter(d => !isNaN(d.getTime()));
    if (dates.length > 0) {
      const latestDate = new Date(Math.max(...dates));
      latestAccident = latestDate.toLocaleDateString();
    }
  }

  // Update the DOM elements
  document.getElementById('total-accidents').textContent = totalAccidents;
  document.getElementById('fatal-accidents').textContent = dangerZone || 'N/A';
  document.getElementById('pedestrian-accidents').textContent = mostCommonTime || 'N/A';
  document.getElementById('latest-accident').textContent = latestAccident;

  // Update tooltips or labels if needed
  document.getElementById('fatal-accidents').title = isRouteSpecific 
    ? 'Most dangerous segment along the route' 
    : 'Most dangerous area in the dataset';
  document.getElementById('pedestrian-accidents').title = 'Most common time for accidents';

  // Store coordinates for click actions
  if (dangerZone.coords) {
    document.getElementById('danger-zone-card').querySelector('.coordinates').textContent = 
      JSON.stringify(dangerZone.coords);
  }
  
  if (latestAccident.coords) {
    document.getElementById('latest-accident-card').querySelector('.coordinates').textContent = 
      JSON.stringify(latestAccident.coords);
  }

  // Add click handlers
  document.getElementById('danger-zone-card').addEventListener('click', function() {
    const coords = JSON.parse(this.querySelector('.coordinates').textContent);
    if (coords) {
      map.flyTo({
        center: coords,
        zoom: 14,
        essential: true
      });
    }
  });

  document.getElementById('latest-accident-card').addEventListener('click', function() {
    const coords = JSON.parse(this.querySelector('.coordinates').textContent);
    if (coords) {
      map.flyTo({
        center: coords,
        zoom: 14,
        essential: true
      });
      
      // Optional: Highlight the specific accident
      const features = map.querySourceFeatures('accidents', {
        filter: ['==', 'id', latestAccident.id]
      });
      
      if (features.length > 0) {
        // Show a popup or pulse the marker
        new mapboxgl.Popup()
          .setLngLat(coords)
          .setHTML(`<strong>Latest Accident</strong><br>ID: ${latestAccident.id}`)
          .addTo(map);
      }
    }
  });

}

// Helper function to find the most dangerous road segment
function findMostDangerousSegment(accidents, route) {
  if (!route || route.length === 0) return 'N/A';
  
  // Simple implementation - find the route segment with most accidents
  const segmentAccidents = {};
  
  // Group accidents by nearest route point
  accidents.forEach(accident => {
    const coords = accident.location?.coordinates || accident.coordinates;
    if (!coords) return;
    
    // Find nearest route point
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < route.length; i++) {
      const dist = calculateDistance(coords, route[i]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }
    
    // Group by every 5 points to create segments
    const segment = Math.floor(nearestIndex / 5);
    segmentAccidents[segment] = (segmentAccidents[segment] || 0) + 1;
  });
  
  // Find segment with most accidents
  let maxSegment = null;
  let maxCount = 0;
  
  for (const [segment, count] of Object.entries(segmentAccidents)) {
    if (count > maxCount) {
      maxCount = count;
      maxSegment = segment;
    }
  }
  
  return maxSegment !== null 
    ? `Hotspot (${maxCount} accidents)` 
    : 'No dangerous segments';

  
}

// Helper function to find most common accident time
function findMostCommonTime(accidents) {
  if (accidents.length === 0) return 'N/A';
  
  const timeSlots = Array(8).fill(0);
  const timeLabels = [
    'Late Night (00-03)', 'Early Morning (03-06)', 'Morning (06-09)',
    'Late Morning (09-12)', 'Afternoon (12-15)', 'Evening (15-18)',
    'Night (18-21)', 'Late Evening (21-24)'
  ];
  
  accidents.forEach(accident => {
    const crashDate = accident.crash_datetime || accident.crash_date;
    if (!crashDate) return;
    
    const hour = new Date(crashDate).getHours();
    if (isNaN(hour)) return;
    
    const timeSlot = Math.floor(hour / 3) % 8;
    timeSlots[timeSlot]++;
  });
  
  const maxIndex = timeSlots.indexOf(Math.max(...timeSlots));
  return timeLabels[maxIndex];
}

// Distance calculation
function calculateDistance(coord1, coord2) {
  const dx = coord1[0] - coord2[0];
  const dy = coord1[1] - coord2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Filter toggle and application
function setupFilterToggle() {
  const closeBtn = document.getElementById('close-filters');
  const applyBtn = document.getElementById('apply-filters');
  const filtersPanel = document.querySelector('.filters-panel');
  const overlay = document.querySelector('.overlay');



  closeBtn.addEventListener('click', closeFilters);
  overlay.addEventListener('click', closeFilters);
  applyBtn.addEventListener('click', applyFilters);

  function closeFilters() {
    filtersPanel.classList.remove('visible');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }
}

function applyFilters() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const severityFilters = [...document.querySelectorAll('input[name="severity"]:checked')].map(cb => cb.value);
  const vehicleFilters = [...document.querySelectorAll('input[name="vehicle"]:checked')].map(cb => cb.value);

  // Filter accident data
  const filteredAccidents = allAccidents.filter(accident => {
    // Date filtering
    const accidentDate = new Date(accident.crash_datetime || accident.crash_date);
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate + 'T23:59:59') : null;
    
    const dateMatch = (!startDate || accidentDate >= startDateObj) && 
                     (!endDate || accidentDate <= endDateObj);
    
    // Severity filtering
    const severityMatch = severityFilters.length === 0 || 
                         severityFilters.includes(accident.contains_fatality_words ? 'fatal' : 'non-fatal');
    
    // Vehicle type filtering
    const vehicleMatch = vehicleFilters.length === 0 || vehicleFilters.some(type => {
      if (type === 'pedestrian') return accident.contains_pedestrian_words;
      if (type === 'matatu') return accident.contains_matatu_words;
      if (type === 'motorcycle') return accident.contains_motorcycle_words;
      return true;
    });
    
    return dateMatch && severityMatch && vehicleMatch;
  });

  // Update map with filtered data
  updateMapWithAccidents(filteredAccidents);
  
  // Close filters panel
  closeFilters();
}

function updateMapWithAccidents(accidents) {
  const features = accidents.map(accident => {
    const coords = accident.location?.coordinates || accident.coordinates;
    
    return {
      type: 'Feature',
      properties: {
        id: accident.crash_id,
        severity: accident.contains_fatality_words ? 'fatal' : 'non-fatal',
        date: accident.crash_datetime || accident.crash_date,
        proximity: isNearRoute(coords) ? 1 : 0
      },
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };
  });

  map.getSource('accidents').setData({
    type: 'FeatureCollection',
    features: features
  });

  // Update charts with filtered data
  if (currentRoute.length > 0) {
    const routeAccidents = filterAccidentsForRoute(accidents, currentRoute);
    updateCharts(routeAccidents);
  } else {
    updateCharts(accidents);
  }
  
  updateSummaryDashboard(accidents);
}

function filterAccidentsForRoute(accidents, route) {
  return accidents.filter(accident => {
    const coords = accident.location?.coordinates || accident.coordinates;
    return isNearRoute(coords);
  });
}

// Set up UI event listeners
function setupEventListeners() {
  // Route search
  document.getElementById('search-route').addEventListener('click', async () => {
    const startAddress = document.getElementById('start').value.trim();
    const endAddress = document.getElementById('end').value.trim();

    if (!startAddress || !endAddress) {
      showUserNotification('Please enter both start and end locations', 'warning');
      return;
    }

    try {
      // Show loading state
      const searchBtn = document.getElementById('search-route');
      searchBtn.disabled = true;
      searchBtn.innerHTML = '<span class="spinner"></span> Searching...';

      const [startCoords, endCoords] = await Promise.all([
        geocodeAddress(startAddress),
        geocodeAddress(endAddress)
      ]);
      
      // Clear previous route and markers
      clearRoute();
      
      // Add markers
      startMarker = new mapboxgl.Marker({ color: '#4CAF50' })
        .setLngLat(startCoords.coordinates)
        .addTo(map);
      
      endMarker = new mapboxgl.Marker({ color: '#F44336' })
        .setLngLat(endCoords.coordinates)
        .addTo(map);

      // Calculate and draw route
      await calculateRoute(startCoords.coordinates, endCoords.coordinates);

    } catch (error) {
      console.error('Route search error:', error);
      showUserNotification('Error finding route. Please try again.', 'error');
    } finally {
      // Reset button state
      const searchBtn = document.getElementById('search-route');
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search Route';
      }
    }
  });

  // Clear route
  document.getElementById('clear-route').addEventListener('click', clearRoute);
}

// Clear current route and markers
function clearRoute() {
  if (startMarker) {
    startMarker.remove();
    startMarker = null;
  }
  if (endMarker) {
    endMarker.remove();
    endMarker = null;
  }
  if (map.getLayer(CONFIG.ROUTE_LAYER_ID)) map.removeLayer(CONFIG.ROUTE_LAYER_ID);
  if (map.getSource(CONFIG.ROUTE_LAYER_ID)) map.removeSource(CONFIG.ROUTE_LAYER_ID);
  
  currentRoute = [];
  
  // Reset accident proximities
  const source = map.getSource('accidents');
  if (source) {
    const features = source._data.features.map(f => ({
      ...f,
      properties: { ...f.properties, proximity: 0 }
    }));
    source.setData({
      type: 'FeatureCollection',
      features: features
    });
  }

  // Update charts with all accidents
  updateCharts(allAccidents);
  updateSummaryDashboard(allAccidents, false);
}

// Calculate and display route
async function calculateRoute(start, end) {
  try {
    // Validate coordinates
    if (!isValidCoordinate(start) || !isValidCoordinate(end)) {
      throw new Error('Invalid start or end coordinates');
    }

    // Show loading state
    const searchBtn = document.getElementById('search-route');
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="spinner"></span> Searching...';

    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${start.join(',')};${end.join(',')}` +
      `?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    
    if (!response.ok) {
      throw new Error(`Mapbox API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.routes?.length) {
      throw new Error('No route found between locations');
    }

    currentRoute = data.routes[0].geometry.coordinates;
    updateRouteLayer(currentRoute);

    // Find and update accidents along route
    const routeAccidents = allAccidents.filter(accident => {
      const coords = accident.location?.coordinates || accident.coordinates;
      return isNearRoute(coords);
    });
    
    updateCharts(routeAccidents);
    updateSummaryDashboard(routeAccidents, true);
    fitMapToRoute(currentRoute);
    updateAccidentProximities();

  } catch (error) {
    console.error('Route calculation error:', error);
    showUserNotification(`Failed to calculate route: ${error.message}`, 'error');
  } finally {
    const searchBtn = document.getElementById('search-route');
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search Route';
    }
  }
}

function isValidCoordinate(coord) {
  return Array.isArray(coord) && 
         coord.length === 2 &&
         !isNaN(coord[0]) && !isNaN(coord[1]) &&
         Math.abs(coord[0]) <= 180 &&
         Math.abs(coord[1]) <= 90;
}

function updateRouteLayer(coordinates) {
  if (map.getSource(CONFIG.ROUTE_LAYER_ID)) {
    map.getSource(CONFIG.ROUTE_LAYER_ID).setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    });
  } else {
    map.addSource(CONFIG.ROUTE_LAYER_ID, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });
    
    map.addLayer({
      id: CONFIG.ROUTE_LAYER_ID,
      type: 'line',
      source: CONFIG.ROUTE_LAYER_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.7
      }
    });
  }
}

// Helper function to fit map to route
function fitMapToRoute(coordinates) {
  const bounds = coordinates.reduce((bounds, coord) => {
    return bounds.extend(coord);
  }, new mapboxgl.LngLatBounds());
  
  map.fitBounds(bounds, { 
    padding: 50,
    maxZoom: 14,
    duration: 1000
  });
}

// Update accident markers based on route proximity
function updateAccidentProximities() {
  const source = map.getSource('accidents');
  if (!source) return;

  const features = source._data.features.map(feature => ({
    ...feature,
    properties: {
      ...feature.properties,
      proximity: isNearRoute(feature.geometry.coordinates) ? 1 : 0
    }
  }));

  source.setData({
    type: 'FeatureCollection',
    features: features
  });
}

function isNearRoute(pointCoords) {
  if (!currentRoute.length) return false;
  
  // Simple proximity check - for better accuracy, consider using Turf.js
  return currentRoute.some(routePoint => {
    const dx = Math.abs(routePoint[0] - pointCoords[0]);
    const dy = Math.abs(routePoint[1] - pointCoords[1]);
    return dx < CONFIG.ACCIDENT_PROXIMITY_THRESHOLD && 
           dy < CONFIG.ACCIDENT_PROXIMITY_THRESHOLD;
  });
}

// Initialize the app
initApp();