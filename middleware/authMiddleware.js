const jwt = require('jsonwebtoken');
const { User, Sequelize } = require('../models');
const Op = Sequelize.Op;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided or invalid format' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        // Verify our OWN JWT
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded; // Contains id, email, role

        const dbUser = await User.findByPk(decoded.id);

        if (!dbUser) {
            return res.status(404).json({ error: 'User profile not found in database' });
        }

        if (!dbUser.is_active) {
            return res.status(403).json({ error: 'User account is disabled' });
        }

        req.dbUser = dbUser;
        next();

    } catch (error) {
        console.error('Auth Middleware Verification Error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }

        return res.status(403).json({ error: 'Unauthorized: Invalid Token' });
    }
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.dbUser) {
            return res.status(403).json({ error: 'Forbidden: User profile not found' });
        }
        if (req.dbUser.role !== role) {
            return res.status(403).json({ error: `Forbidden: Requires ${role} role` });
        }
        next();
    };
};

const verifyOptionalToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const dbUser = await User.findByPk(decoded.id);
        if (dbUser) {
            req.user = decoded;
            req.dbUser = dbUser;
        }
        next();
    } catch (error) {
        console.warn('Optional Auth Token invalid or expired');
        next();
    }
};

module.exports = { verifyToken, verifyOptionalToken, requireRole };
