const mongoose = require('mongoose');

// ─── MongoDB connection options ───────────────────────────────────────────────
// serverSelectionTimeoutMS: how long to wait when picking a server
// socketTimeoutMS: how long to wait for a response on an open connection
// heartbeatFrequencyMS: how often to check connection health
const MONGO_OPTIONS = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS:          45000,
    heartbeatFrequencyMS:     10000,
};

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
        console.log('[db] MongoDB connected');
    } catch (error) {
        console.error('[db] Initial connection failed:', error.message);
        process.exit(1);    // Hard fail on startup — no point running without DB
    }
};

// ─── Reconnection event listeners ─────────────────────────────────────────────
// MongoDB Atlas free tier drops idle connections. Mongoose auto-reconnects,
// but we log these events so Render logs show exactly when it happens.
mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected — Mongoose will attempt to reconnect automatically');
});

mongoose.connection.on('reconnected', () => {
    console.log('[db] MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
// Close the MongoDB connection cleanly when the process exits.
process.on('SIGINT',  () => mongoose.connection.close(() => process.exit(0)));
process.on('SIGTERM', () => mongoose.connection.close(() => process.exit(0)));

module.exports = connectToDB;