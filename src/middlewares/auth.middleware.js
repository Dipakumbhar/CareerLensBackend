const jwt = require('jsonwebtoken');
const tokenBlacklistModel = require('../models/blacklist.model');

/**
 * Extract JWT from either:
 *  1. httpOnly cookie  (works on same-domain / localhost)
 *  2. Authorization: Bearer <token>  (works cross-domain — Vercel → Render)
 */
function extractToken(req) {
    // Prefer cookie (dev / same-domain)
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    // Fallback: Authorization header (cross-domain production)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

async function authUser(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({ token });
    if (isTokenBlacklisted) {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid session. Please log in again.' });
    }
}

module.exports = { authUser };