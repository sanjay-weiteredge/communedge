const admin = require('../config/firebase');
const { User } = require('../models');
const { uploadProfileImageToS3, getSignedUrlForView, uploadFileBufferToS3, isS3Value, extractS3Key } = require('../services/s3Service');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, firebase_uid: user.firebase_uid },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, linkedin_url } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // ── Step 1: Check DB FIRST ──
        const existingUser = await User.findOne({ where: { email: normalizedEmail } });

        // If user exists AND has a password, tell them to login.
        if (existingUser && existingUser.password_hash) {
            return res.status(409).json({ error: 'A password is already set for this email. Please sign in instead.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        let user;
        if (existingUser) {
            // bridge: user exists (from Google), add password now
            existingUser.password_hash = password_hash;
            existingUser.name = name.trim();
            existingUser.phone = phone?.trim() || existingUser.phone;
            existingUser.linkedin_url = linkedin_url?.trim() || existingUser.linkedin_url;
            await existingUser.save();
            user = existingUser;
        } else {
            // New user entirely
            user = await User.create({
                email: normalizedEmail,
                name: name.trim(),
                phone: phone?.trim() || null,
                linkedin_url: linkedin_url?.trim() || null,
                password_hash,
                role: 'USER',
                is_active: true,
                auth_provider: 'password',
                firebase_uid: `pw_${Buffer.from(normalizedEmail).toString('base64').substring(0, 16)}`
            });
        }

        const token = generateToken(user);
        const userJson = user.toJSON();
        delete userJson.password_hash;

        return res.status(201).json({
            message: 'Account created successfully.',
            token,
            user: userJson,
        });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password, idToken } = req.body;

        let user;
        let firebaseData = null;

        // --- OPTION 1: Google Login (via Firebase idToken) ---
        if (idToken) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                firebaseData = decodedToken;

                user = await User.findOne({
                    where: { email: decodedToken.email.toLowerCase() }
                });

                if (!user) {
                    // Auto-create user from Google data
                    user = await User.create({
                        firebase_uid: decodedToken.uid,
                        email: decodedToken.email.toLowerCase(),
                        name: decodedToken.name || decodedToken.email.split('@')[0],
                        auth_provider: 'google.com',
                        role: 'USER',
                        is_active: true
                    });
                } else if (!user.firebase_uid || user.firebase_uid.startsWith('custom_')) {
                    // Link existing password user to Firebase UID on first Google login
                    user.firebase_uid = decodedToken.uid;
                    await user.save();
                }
            } catch (fbError) {
                console.error('Firebase Verify Error:', fbError);
                return res.status(401).json({ error: 'Invalid Google token' });
            }
        }
        // --- OPTION 2: Password Login ---
        else if (email && password) {
            user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

            if (!user || !user.password_hash) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
        } else {
            return res.status(400).json({ error: 'Please provide credentials' });
        }

        // Add profile pic logic for Google login if missing
        if (firebaseData?.picture && !isS3Value(user.photo_url)) {
            try {
                const key = await uploadProfileImageToS3(firebaseData.picture, user.firebase_uid);
                if (key) {
                    user.photo_url = key;
                    await user.save();
                }
            } catch (err) {
                console.error("Failed to sync profile pic:", err);
            }
        }

        const token = generateToken(user);
        const userJson = user.toJSON();
        delete userJson.password_hash;

        if (isS3Value(userJson.photo_url)) {
            userJson.photo_url = await getSignedUrlForView(userJson.photo_url);
        }

        return res.json({ message: 'Login successful', token, user: userJson });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const { id } = req.user; // From our new middleware

        const user = await User.findByPk(id, {
            include: 'startup'
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userJson = user.toJSON();
        delete userJson.password_hash;

        if (isS3Value(userJson.photo_url)) {
            userJson.photo_url = await getSignedUrlForView(userJson.photo_url);
        }

        res.json(userJson);

    } catch (error) {
        console.error('❌ Get Profile Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { id } = req.user;
        const { is_active, name, phone, bio, linkedin_url, location } = req.body;
        const file = req.file;

        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (file) {
            try {
                const key = await uploadFileBufferToS3(file.buffer, user.firebase_uid || user.id, file.mimetype);
                user.photo_url = key;
            } catch (err) {
                console.error("S3 Upload Error:", err);
            }
        }

        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (linkedin_url !== undefined) user.linkedin_url = linkedin_url;
        if (location !== undefined) user.location = location;
        if (typeof is_active !== 'undefined') user.is_active = is_active;

        await user.save();

        const userJson = user.toJSON();
        delete userJson.password_hash;

        if (isS3Value(userJson.photo_url)) {
            userJson.photo_url = await getSignedUrlForView(userJson.photo_url);
        }

        res.json({ message: 'Profile updated', user: userJson });
    } catch (error) {
        console.error('❌ Update Profile Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const { id } = req.user;
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await user.destroy();

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('❌ Delete Account Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

exports.deleteProfilePhoto = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.photo_url = null;
        await user.save();

        res.json({ message: 'Photo removed' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
