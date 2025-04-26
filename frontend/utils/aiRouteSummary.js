export class AIRouteSummary {
  constructor(config) {
    this.config = config;
    this.baseURL = 'https://api.openai.com/v1';
    this.geocodingCache = new Map(); // Cache for place names
  }

  async generateRouteSummary(routeAccidents, allAccidents, currentRoute) {
    try {
      if (!routeAccidents || !Array.isArray(routeAccidents)) {
        return "No valid accident data provided for analysis.";
      }

      // Prepare stats with place names
      const stats = await this.prepareEnhancedStatsWithPlaces(routeAccidents, currentRoute);
      
      // Construct prompt with place names
      const prompt = this.constructPromptWithPlaceNames(stats);
      
      // Call OpenAI API
      const response = await this.callOpenAI(prompt);
      
      return this.formatResponseWithPlaces(response, stats);

    } catch (error) {
      console.error('AI summary failed:', error);
      return await this.generatePlaceBasedSummary(routeAccidents, currentRoute);
    }
  }

  async prepareEnhancedStatsWithPlaces(accidents, route) {
    const hours = Array(24).fill(0);
    const days = Array(7).fill(0);
    const locationCounts = new Map();
    let totalWithValidTime = 0;

    // Process accidents
    for (const accident of accidents) {
      // Time analysis
      try {
        const dateStr = accident.crash_datetime || accident.crash_date;
        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date)) {
            hours[date.getHours()]++;
            days[date.getDay()]++;
            totalWithValidTime++;
          }
        }
      } catch (e) {
        console.warn('Date processing error:', e);
      }

      // Spatial analysis
      try {
        const coords = accident.location?.coordinates || accident.coordinates;
        if (coords && coords.length === 2) {
          const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
          locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
        }
      } catch (e) {
        console.warn('Location processing error:', e);
      }
    }

    // Get top 3 danger zones with place names
    const sortedLocations = Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const dangerZones = [];
    for (const [coords, count] of sortedLocations) {
      const [lng, lat] = coords.split(',').map(Number);
      const placeName = await this.getPlaceName(lng, lat);
      dangerZones.push({
        name: placeName,
        count,
        coords: [lng, lat]
      });
    }

    return {
      totalAccidents: accidents.length,
      totalWithValidTime,
      hours,
      days,
      dangerZones,
      routeLength: this.calculateRouteLength(route)
    };
  }

  async getPlaceName(lng, lat) {
    const cacheKey = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    
    // Check cache first
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
        `types=poi,neighborhood,locality,place&limit=1&access_token=${mapboxgl.accessToken}`
      );
      
      const data = await response.json();
      let placeName = 'Unknown location';
      
      if (data.features && data.features.length > 0) {
        // Try to get the most specific name available
        placeName = data.features[0].text;
        const context = data.features[0].context;
        if (context) {
          const neighborhood = context.find(c => c.id.startsWith('neighborhood'));
          const locality = context.find(c => c.id.startsWith('place'));
          if (neighborhood) placeName += `, ${neighborhood.text}`;
          if (locality) placeName += `, ${locality.text}`;
        }
      }
      
      // Cache the result
      this.geocodingCache.set(cacheKey, placeName);
      return placeName;

    } catch (error) {
      console.error('Geocoding failed:', error);
      return `Location near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  constructPromptWithPlaceNames(stats) {
    const hourLabels = Array.from({length: 24}, (_, i) => {
      const ampm = i >= 12 ? 'PM' : 'AM';
      const hour = i % 12 || 12;
      return `${hour} ${ampm}`;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakHour = stats.hours.indexOf(Math.max(...stats.hours));
    const peakDay = stats.days.indexOf(Math.max(...stats.days));

    // Format danger zones description
    let dangerZonesDesc = "No significant danger zones identified";
    if (stats.dangerZones.length > 0) {
      dangerZonesDesc = stats.dangerZones.map(zone => 
        `${zone.name} (${zone.count} accidents)`
      ).join('\n- ');
    }

    return `
      Analyze road safety for a ${stats.routeLength.toFixed(2)} km route with ${stats.totalAccidents} recorded accidents.

      Temporal Patterns:
      - Peak hour: ${hourLabels[peakHour]} (${stats.hours[peakHour]} accidents)
      - Peak day: ${dayNames[peakDay]} (${stats.days[peakDay]} accidents)

      Danger Zones:
      - ${dangerZonesDesc}

      Please provide a detailed safety analysis including:
      1. Time-based risk assessment
      2. Analysis of identified danger zones
      3. Specific recommendations for:
         - Safe travel times
         - Caution areas
         - Driving behavior adjustments
      
      Reference locations by name rather than coordinates.
      Provide practical, actionable advice for drivers.
      Use clear, professional language.
    `;
  }

  async callOpenAI(prompt) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: "system",
            content: "You are a road safety expert. Provide detailed analysis using place names from the provided data. " +
                    "Focus on practical recommendations. Highlight specific danger areas by name. " +
                    "Suggest optimal travel times. Use clear, professional language."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    const data = await response.json();
    return data.choices[0]?.message?.content;
  }

  formatResponseWithPlaces(text, stats) {
    if (!text) return this.generatePlaceBasedSummary(stats.dangerZones, stats.totalAccidents);

    return `
      <div class="safety-analysis">
        <h3><i class="fas fa-car-crash"></i> Route Safety Analysis</h3>
        <div class="summary-stats">
          <span>${stats.totalAccidents} accidents analyzed</span>
          <span>${stats.routeLength.toFixed(2)} km route</span>
        </div>
        
        <div class="analysis-content">
          ${text.replace(/\n\n/g, '</div><div class="analysis-section">')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
        </div>
        
        ${stats.dangerZones.length > 0 ? `
        <div class="danger-zones">
          <h4><i class="fas fa-exclamation-triangle"></i> Key Danger Areas:</h4>
          <ul>
            ${stats.dangerZones.map(zone => `
              <li>${zone.name} (${zone.count} accidents)</li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    `;
  }

  async generatePlaceBasedSummary(accidents, route) {
    if (!accidents || accidents.length === 0) {
      return "<div class='no-data'>No accident data available for this route</div>";
    }

    // Simple spatial clustering
    const locationMap = new Map();
    for (const accident of accidents) {
      const coords = accident.location?.coordinates || accident.coordinates;
      if (coords) {
        const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
        locationMap.set(key, (locationMap.get(key) || 0) + 1);
      }
    }

    // Get top 3 locations with place names
    const sortedLocations = Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const hotspots = [];
    for (const [coords, count] of sortedLocations) {
      const [lng, lat] = coords.split(',').map(Number);
      const placeName = await this.getPlaceName(lng, lat);
      hotspots.push({ name: placeName, count });
    }

    return `
      <div class="safety-summary">
        <p>This route has ${accidents.length} recorded accidents.</p>
        
        ${hotspots.length > 0 ? `
        <div class="hotspots">
          <h4><i class="fas fa-exclamation-circle"></i> High-Risk Areas:</h4>
          <ul>
            ${hotspots.map(spot => `
              <li>${spot.name} (${spot.count} accidents)</li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        <div class="recommendations">
          <h4><i class="fas fa-car-side"></i> Driving Recommendations:</h4>
          <ul>
            <li><i class="fas fa-clock"></i> Avoid peak accident times if possible</li>
            <li><i class="fas fa-tachometer-alt"></i> Reduce speed in high-risk areas</li>
            <li><i class="fas fa-eye"></i> Stay extra alert in marked danger zones</li>
          </ul>
        </div>
      </div>
    `;
  }

  calculateRouteLength(route) {
    if (!route || route.length < 2) return 0;
    const line = turf.lineString(route);
    return turf.length(line, { units: 'kilometers' });
  }
}