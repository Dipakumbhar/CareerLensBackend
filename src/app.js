const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');

const app = express();

// ─── Trust Render's proxy ─────────────────────────────────────────────────────
// Render (and most cloud hosts) sit behind a load balancer.
// Without this, express sees every IP as the same proxy IP — rate limiting
// would block ALL users simultaneously after the limit is reached.
app.set('trust proxy', 1);

// ─── Request logger (production debugging) ────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.path} | origin: ${req.headers.origin || 'none'}`);
    next();
});

// ─── Health check (before all middleware) ─────────────────────────────────────
// Render pings this to decide if the service is alive.
// Must respond fast — no auth, no DB queries.
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// ─── Security headers (Helmet) ────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: {
            directives: {
                defaultSrc:  ["'self'"],
                scriptSrc:   ["'self'"],
                styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
                imgSrc:      ["'self'", 'data:', 'blob:'],
                connectSrc:  [
                    "'self'",
                    'https://careerlensbackend-1.onrender.com',
                ],
                objectSrc:   ["'none'"],
                // upgradeInsecureRequests only in production — passing null in dev breaks helmet
                ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
            },
        },
        hsts: isProduction
            ? { maxAge: 31536000, includeSubDomains: true, preload: true }
            : false,
    })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// All allowed frontend origins. Add any new Vercel preview URLs here.
// CLIENT_URL env var on Render overrides nothing — it supplements the list.
const ALLOWED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
    'https://careerbridge-project.vercel.app',
    'https://career-lens-frontend-3a4k.vercel.app',
    // Add further Vercel preview URLs as needed
]);

// If CLIENT_URL is set on Render, include it too
if (process.env.CLIENT_URL) {
    ALLOWED_ORIGINS.add(process.env.CLIENT_URL);
}

const corsOptions = {
    origin: (origin, callback) => {
        // No origin = same-origin request, Postman, server-to-server — allow
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        console.warn(`[cors] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,   // Some browsers (IE11) choke on 200 for OPTIONS
};

// Handle OPTIONS preflight BEFORE any other middleware.
// This ensures preflight never hits auth middleware or rate limiters.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ─── Body / Cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// ─── Rate limiters ────────────────────────────────────────────────────────────
// With 'trust proxy' set above, these now correctly use the real client IP.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again in 15 minutes.' },
    skip: (req) => !isProduction,   // Skip rate limiting in local development
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Report generation limit reached. Please try again in an hour.' },
    skip: (req) => !isProduction,
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRouter      = require('./routes/auth.routes');
const interviewRouter = require('./routes/interview.routes');

app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/interview',     reportLimiter);

app.use('/api/auth',      authRouter);
app.use('/api/interview', interviewRouter);

// ─── 404 handler for unknown API routes ───────────────────────────────────────
app.use('/api/*', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`[error] ${req.method} ${req.path} →`, err.message || err);

    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Forbidden: origin not allowed.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
    }
    if (err.message && err.message.includes('Only PDF')) {
        return res.status(400).json({ message: 'Only PDF files are accepted.' });
    }

    const status = err.status || err.statusCode || 500;
    const safeMessage = status < 500
        ? (err.message || 'Bad request.')
        : 'An unexpected error occurred. Please try again.';
    return res.status(status).json({ message: safeMessage });
});

module.exports = app;
