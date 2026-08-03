require('dotenv').config();

// ─── Startup environment validation ───────────────────────────────────────────
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'GROQ_API_KEY'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`[startup] FATAL: Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
}

// ─── Global error guards ──────────────────────────────────────────────────────
// Unhandled promise rejections (e.g. mongoose query on a bad connection)
// Without this, Node exits with code 1 and Render shows a crash.
process.on('unhandledRejection', (reason, promise) => {
    console.error('[process] Unhandled promise rejection:', reason);
    // Don't exit — let the request fail gracefully, keep server alive
});

process.on('uncaughtException', (err) => {
    console.error('[process] Uncaught exception:', err.message);
    // Exit for truly unexpected crashes — Render will auto-restart
    process.exit(1);
});

const app         = require('./app');
const connectToDB = require('./config/database');

connectToDB();

const PORT   = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
// Render sends SIGTERM before restarting a dyno.
// This lets in-flight requests finish before closing.
const shutdown = (signal) => {
    console.log(`[server] ${signal} received — shutting down gracefully`);
    server.close(() => {
        console.log('[server] HTTP server closed');
        process.exit(0);
    });
    // Force-exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
        console.error('[server] Forced exit after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));