require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

// Get local IP address for CORS
const { networkInterfaces } = require('os');
const nets = networkInterfaces();
const localIps = Object.values(nets).flat().filter(net => net.family === 'IPv4' && !net.internal).map(net => `http://${net.address}`);

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5502', 
  'http://localhost:5000',
  'https://accmap.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed origin or regex pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth !== process.env.API_SECRET) {  
    return res.status(401).send('Unauthorized');
  }
  next(); 
});

// Routes
app.use('/api/accidents', require('./routes/accident'));

// Test endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: "CORS test successful",
    yourOrigin: req.headers.origin,
    allowedOrigins: allowedOrigins
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ 
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Listen on all network interfaces
const HOST = '0.0.0.0'; 
app.listen(PORT, HOST, () => {
  // console.log(`Server running on http://${HOST}:${PORT}`);
  // console.log(`Also accessible at http://localhost:${PORT}`);
  // console.log(`Also at http://${localIps[0]}:${PORT} (your local IP)`);
  // console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
});
