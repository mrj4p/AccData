const express = require('express');
const router = express.Router();
const Accident = require('../models/Accident');

// Get all accidents
router.get('/', async (req, res) => {
  try {
    const accidents = await Accident.find().lean();
    
    if (!accidents || accidents.length === 0) {
      return res.status(404).json({ message: 'No accidents found' });
    }

    const transformed = accidents.map(accident => ({
      crash_id: accident.crash_id,
      crash_datetime: accident.crash_datetime?.toISOString(),
      crash_date: accident.crash_date?.toISOString(),
      location: accident.location,
      coordinates: accident.location?.coordinates,
      latitude: accident.location?.coordinates[1],
      longitude: accident.location?.coordinates[0],
      n_crash_reports: accident.n_crash_reports,
      contains_fatality_words: accident.contains_fatality_words,
      contains_pedestrian_words: accident.contains_pedestrian_words,
      contains_matatu_words: accident.contains_matatu_words,
      contains_motorcycle_words: accident.contains_motorcycle_words
    }));

    res.json(transformed);
  } catch (err) {
    console.error('Error fetching accidents:', err);
    res.status(500).json({ 
      message: 'Failed to fetch accidents',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

router.post('/route', async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid coordinates format'
      });
    }

    // Convert route to LineString
    const routeLineString = {
      type: 'LineString',
      coordinates: coordinates.map(coord => [
        parseFloat(coord[0]), 
        parseFloat(coord[1])
      ])
    };

    // Create a buffer around the route (1000 meters)
    const bufferedRoute = {
      type: 'Polygon',
      coordinates: [coordinates.map(coord => [
        parseFloat(coord[0]), 
        parseFloat(coord[1])
      ])]
    };

    // Find accidents within the buffered route
    const accidents = await Accident.find({
      location: {
        $geoWithin: {
          $geometry: bufferedRoute
        }
      }
    });

    res.json({
      success: true,
      count: accidents.length,
      data: accidents
    });

  } catch (err) {
    console.error('Route accidents error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch route accidents',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;