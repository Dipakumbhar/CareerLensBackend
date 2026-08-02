const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');

const app = express();

// ─── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
    helmet({
        // Allow cross-origin resources for the Vite dev server / CDN fonts
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        // Content-Security-Policy — tight but compatible with the SPA proxy setup
        contentSecurityPolicy: {
            directives: {
                defaultSrc:  ["'self'"],
                scriptSrc:   ["'self'"],
                styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
                imgSrc:      ["'self'", 'data:', 'blob:'],
                connectSrc:  ["'self'"],
                objectSrc:   ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
            },
        },
        // Strict-Transport-Security — only meaningful over HTTPS
        hsts: process.env.NODE_ENV === 'production'
            ? { maxAge: 31536000, includeSubDomains: true, preload: true }
            : false,
    })
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
// In production CLIENT_URL must be set to the deployed frontend origin.
// Never allow '*' — credentials (cookies) require an explicit origin.
const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL]
    : ['http://localhost:5173', 'http://localhost:5174', 'https://careerbridge-project.vercel.app'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. same-origin, server-to-server, Postman in dev)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// ─── Body / Cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));        // tight payload limit
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Auth endpoints — strict limits to prevent brute-force / credential stuffing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 20,                     // 20 attempts per window per IP
    standardHeaders: true,       // Return `RateLimit-*` headers
    legacyHeaders: false,
    message: {
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    },
    skipSuccessfulRequests: false,
});

// Report generation — heavier AI operation, more generous window
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 10,                     // 10 reports per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Report generation limit reached. Please try again in an hour.'
    },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRouter      = require('./routes/auth.routes');
const interviewRouter = require('./routes/interview.routes');

// Apply auth rate limiter to login and register only
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/interview',     reportLimiter);

app.use('/api/auth',      authRouter);
app.use('/api/interview', interviewRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
// NEVER exposes stack traces, file paths, or implementation details to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // Log full detail server-side only
    console.error('[app] Unhandled error:', err.message || err);

    // CORS rejection — return 403 without implementation detail
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Forbidden: origin not allowed.' });
    }
    // Multer: file too large
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Maximum allowed size is 5 MB.' });
    }
    // Multer: wrong file type
    if (err.message && err.message.includes('Only PDF')) {
        return res.status(400).json({ message: 'Only PDF files are accepted. Please upload a .pdf resume.' });
    }
    // Generic fallback — no internal detail to client
    const status = err.status || err.statusCode || 500;
    const safeMessage = status < 500
        ? (err.message || 'Bad request.')
        : 'An unexpected error occurred. Please try again.';
    return res.status(status).json({ message: safeMessage });
});

module.exports = app;
