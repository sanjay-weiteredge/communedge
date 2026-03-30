const admin = require('../config/firebase');
const { User, Sequelize } = require('../models');
const Op = Sequelize.Op;

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided or invalid format' });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);

        req.user = decodedToken;
        const dbUser = await User.findOne({
            where: {
                [Op.or]: [
                    { firebase_uid: decodedToken.uid },
                    { email: decodedToken.email }
                ]
            }
        });

        if (dbUser) {
            const { isS3Value, uploadProfileImageToS3 } = require('../services/s3Service');
            const needsHeal = !isS3Value(dbUser.photo_url) && decodedToken.picture;

            if (needsHeal) {
                try {
                    const key = await uploadProfileImageToS3(decodedToken.picture, decodedToken.uid);
                    if (key) {
                        dbUser.photo_url = key;
                        await dbUser.save();
                        console.log('🔧 Fixed photo_url for user:', decodedToken.uid);
                    }
                } catch (err) {
                    console.error('Failed to fix photo_url:', err);
                }
            }

            req.dbUser = dbUser;
            next();
        } else {
            console.log(`User ${decodedToken.email || decodedToken.uid} not found in DB. Auto-creating...`);

            let photoKey = null;
            if (decodedToken.picture) {
                try {
                    const { uploadProfileImageToS3 } = require('../services/s3Service');
                    photoKey = await uploadProfileImageToS3(decodedToken.picture, decodedToken.uid);
                } catch (err) {
                    console.error("Failed to upload profile pic to S3:", err);
                }
            }

            try {
                const newUser = await User.create({
                    firebase_uid: decodedToken.uid,
                    email: decodedToken.email,
                    photo_url: photoKey,
                    auth_provider: decodedToken.firebase.sign_in_provider || 'password',
                    role: 'USER',
                    is_active: true
                });

                req.dbUser = newUser;
                console.log(`✅ Auto-created new user: ${newUser.id}`);
                next();
            } catch (createError) {
                if (createError.name === 'SequelizeUniqueConstraintError') {
                    console.log('Race condition detected: User created by another request. Fetching...');
                    const existingUser = await User.findOne({
                        where: {
                            [Op.or]: [
                                { firebase_uid: decodedToken.uid },
                                { email: decodedToken.email }
                            ]
                        }
                    });
                    if (existingUser) {
                        req.dbUser = existingUser;
                        next();
                    } else {
                        return res.status(500).json({ error: 'Failed to retrieve created user' });
                    }
                } else {
                    throw createError;
                }
            }
        }
    } catch (error) {
        console.error('Auth Middleware Verification Error:', error);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }

        if (!res.headersSent) {
            res.status(403).json({ error: 'Unauthorized: Invalid Token' });
        }
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
        const decodedToken = await admin.auth().verifyIdToken(token);
        const dbUser = await User.findOne({ where: { firebase_uid: decodedToken.uid } });
        if (dbUser) req.dbUser = dbUser;
        next();
    } catch (error) {
        console.warn('Optional Auth Token invalid or expired');
        next();
    }
};

module.exports = { verifyToken, verifyOptionalToken, requireRole };
