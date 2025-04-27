// const myIP = await getLocalIP();
const API_BASE_URL = 'http://192.168.1.9:5000/api/accidents';

async function fetchWithCORS(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
    
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request to ${url} failed:`, {
      error: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export const fetchAllAccidents = async () => {
  try {
    return await fetchWithCORS(API_BASE_URL);
  } catch (error) {
    console.error('Failed to fetch accidents:', {
      error: error.message
    });
    throw error;
  }
};

export const fetchRouteAccidents = async (coordinates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ coordinates })
    });

    const data = await response.json();
    
    // Normalize accident data format
    return data.data.map(accident => ({
      ...accident,
      coordinates: accident.location?.coordinates || 
                 [accident.longitude, accident.latitude],
      contains_fatality_words: accident.contains_fatality_words || false,
      contains_pedestrian_words: accident.contains_pedestrian_words || false,
      contains_matatu_words: accident.contains_matatu_words || false,
      contains_motorcycle_words: accident.contains_motorcycle_words || false
    }));

  } catch (error) {
    console.error('Error fetching route accidents:', error);
    throw error;
  }
};

export const geocodeAddress = async (address) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No results found for address');
    }

    return {
      coordinates: data.features[0].center,
      address: data.features[0].place_name
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};