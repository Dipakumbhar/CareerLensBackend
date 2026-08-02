require('dotenv').config();

// ─── Startup environment validation ───────────────────────────────────────────
// Fail fast if any required variable is missing — never silently use bad defaults.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'GROQ_API_KEY'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`[startup] FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('[startup] Copy Backend/.env.example to Backend/.env and fill in all values.');
    process.exit(1);
}

const app        = require('./app');
const connectToDB = require('./config/database');

connectToDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});