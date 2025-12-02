const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
// Explicitly load .env from the backend directory to avoid CWD issues
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const routes = require('./routes');
const db = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health route with DB check
app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: result.rows[0].ok === 1 ? 'connected' : 'unknown' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API routes
app.use('/api', routes);

const port = process.env.PORT || 3000;
(async () => {
  try {
    const result = await db.query('SELECT 1 as ok');
    console.log(`DB connection: ${result.rows[0].ok === 1 ? 'connected' : 'unknown'}`);
  } catch (err) {
    console.error(`DB connection error: ${err.message}`);
  }
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
})();
