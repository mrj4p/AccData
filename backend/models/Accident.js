const mongoose = require('mongoose');

const AccidentSchema = new mongoose.Schema({
  crash_id: String,
  crash_datetime: Date,
  crash_date: Date,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: props => `${props.value} is not a valid longitude/latitude pair`
      }
    }
  },
  latitude: Number,
  longitude: Number,
  n_crash_reports: Number,
  contains_fatality_words: Boolean,
  contains_pedestrian_words: Boolean,
  contains_matatu_words: Boolean,
  contains_motorcycle_words: Boolean
});

AccidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Accident', AccidentSchema);