export class AIRouteSummary {
  constructor(config) {
    this.config = config;
    this.baseURL = 'https://api.openai.com/v1';
  }

  async generateRouteSummary(routeAccidents, allAccidents, currentRoute) {
    try {
      if (!routeAccidents || !allAccidents || !currentRoute) {
        throw new Error('Missing required data for summary generation');
      }

      // Prepare route statistics
      const routeStats = this.prepareRouteStats(routeAccidents, currentRoute);

      // Prepare comparison data
      const comparisonStats = this.prepareComparisonStats(routeStats, allAccidents, currentRoute);

      // Construct prompt
      const prompt = this.constructPrompt(routeStats, comparisonStats);

      // Call OpenAI API
      const response = await this.callOpenAI(prompt);

      return this.formatResponse(response);

    } catch (error) {
      console.error('AI summary error:', error);
      return "Unable to generate safety summary at this time.";
    }
  }

  async callOpenAI(prompt) {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: "system",
              content: "You are a helpful road safety assistant that provides concise analysis of accident data."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "No summary available";

    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }
  
    formatResponse(text) {
      // Convert the AI's response into formatted HTML
      return text.replace(/\n/g, '<br>')
                 .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    }
  
    // Helper methods for data processing
    getTimeDistribution(accidents) {
      const hours = Array(24).fill(0);
      const days = Array(7).fill(0);
      const months = Array(12).fill(0);
  
      accidents.forEach(accident => {
        const date = new Date(accident.crash_datetime || accident.crash_date);
        if (isNaN(date)) return;
  
        const hour = date.getHours();
        const day = date.getDay();
        const month = date.getMonth();
  
        hours[hour]++;
        days[day]++;
        months[month]++;
      });
  
      return { hours, days, months };
    }
  
    identifyDangerSegments(route, accidents) {
      if (!route?.length || !accidents?.length) return [];
  
      // Split route into segments
      const segments = [];
      for (let i = 0; i < route.length - 1; i++) {
        segments.push({
          start: route[i],
          end: route[i+1],
          accidents: []
        });
      }
  
      // Assign accidents to nearest segment
      accidents.forEach(accident => {
        const coords = accident.location?.coordinates || accident.coordinates;
        if (!coords) return;
  
        let minDistance = Infinity;
        let closestSegment = null;
  
        segments.forEach(segment => {
          const distance = this.distanceToSegment(coords, segment.start, segment.end);
          if (distance < minDistance) {
            minDistance = distance;
            closestSegment = segment;
          }
        });
  
        if (closestSegment && minDistance <= this.config.ACCIDENT_PROXIMITY_THRESHOLD) {
          closestSegment.accidents.push(accident);
        }
      });
  
      // Sort segments by accident count and return top 3
      return segments
        .filter(s => s.accidents.length > 0)
        .sort((a, b) => b.accidents.length - a.accidents.length)
        .slice(0, 3)
        .map(segment => ({
          start: segment.start,
          end: segment.end,
          count: segment.accidents.length,
          severity: segment.accidents.filter(a => a.contains_fatality_words).length
        }));
    }
  
    getAccidentTypes(accidents) {
      const types = {
        pedestrian: 0,
        vehicle: 0,
        motorcycle: 0,
        other: 0
      };
  
      accidents.forEach(accident => {
        if (accident.contains_pedestrian_words) types.pedestrian++;
        else if (accident.contains_matatu_words) types.vehicle++;
        else if (accident.contains_motorcycle_words) types.motorcycle++;
        else types.other++;
      });
  
      return types;
    }
  
    compareToRegionalAverage(routeTimeStats, allAccidents) {
      const regionalTimeStats = this.getTimeDistribution(allAccidents);
      
      return {
        hours: routeTimeStats.hours.map((count, i) => 
          count / routeTimeStats.hours.reduce((a, b) => a + b, 1) - 
          regionalTimeStats.hours[i] / regionalTimeStats.hours.reduce((a, b) => a + b, 1)
        ),
        days: routeTimeStats.days.map((count, i) => 
          count / routeTimeStats.days.reduce((a, b) => a + b, 1) - 
          regionalTimeStats.days[i] / regionalTimeStats.days.reduce((a, b) => a + b, 1)
        )
      };
    }
  
    compareSeverity(routeStats, allAccidents) {
      const totalRegional = allAccidents.length;
      const fatalRegional = allAccidents.filter(a => a.contains_fatality_words).length;
      
      return {
        fatal: (routeStats.fatalAccidents / routeStats.totalAccidents) - (fatalRegional / totalRegional),
        density: (routeStats.totalAccidents / routeStats.routeLength) - (totalRegional / this.calculateRegionalArea(allAccidents))
      };
    }
  
    // Geometry utilities
    distanceToSegment(point, segmentStart, segmentEnd) {
      const lineString = turf.lineString([segmentStart, segmentEnd]);
      const pt = turf.point(point);
      return turf.pointToLineDistance(pt, lineString, { units: 'meters' });
    }
  
    calculateRouteLength(route) {
      if (!route?.length) return 0;
      const line = turf.lineString(route);
      return turf.length(line, { units: 'kilometers' });
    }
  
    calculateRouteArea(route) {
      if (!route?.length) return 0;
      const bbox = turf.bbox(turf.lineString(route));
      const bboxPoly = turf.bboxPolygon(bbox);
      return turf.area(bboxPoly);
    }
  
    calculateRegionalArea(accidents) {
      if (!accidents?.length) return 0;
      const coordinates = accidents.map(a => a.location?.coordinates || a.coordinates).filter(Boolean);
      if (!coordinates.length) return 0;
      
      const bbox = turf.bbox(turf.multiPoint(coordinates));
      const bboxPoly = turf.bboxPolygon(bbox);
      return turf.area(bboxPoly);
    }
  }