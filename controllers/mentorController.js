const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { Mentor } = require('../models');
const { uploadImageToS3, getSignedUrlForView, isS3Value } = require('../services/s3Service');

// ── Multer (memory storage — no disk writes) ──────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

// Export so the router can reference it as middleware
exports.uploadAvatarMiddleware = upload.single('avatar');

// ── Helper: resolve avatar_url to a presigned URL if it's an S3 key ──────────
const resolveAvatarUrl = async (mentor) => {
    const plain = mentor.toJSON ? mentor.toJSON() : { ...mentor };
    if (plain.avatar_url && isS3Value(plain.avatar_url)) {
        plain.avatar_url = await getSignedUrlForView(plain.avatar_url);
    }
    return plain;
};

// ── Helper: resolve a list of mentors ────────────────────────────────────────
const resolveMentorList = (mentors) =>
    Promise.all(mentors.map(resolveAvatarUrl));

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * GET /api/mentors
 * Returns all active mentors with presigned avatar URLs.
 */
exports.getAllMentors = async (req, res) => {
    try {
        const mentors = await Mentor.findAll({
            order: [
                ['display_order', 'ASC'],
                ['created_at', 'ASC'],
            ],
        });
        const resolved = await resolveMentorList(mentors);
        res.json(resolved);
    } catch (error) {
        console.error('Get Mentors Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/mentors/:id
 * Returns a single active mentor with presigned avatar URL.
 */
exports.getMentorById = async (req, res) => {
    try {
        const mentor = await Mentor.findOne({
            where: { id: req.params.id },
        });
        if (!mentor) {
            return res.status(404).json({ error: 'Mentor not found' });
        }
        const resolved = await resolveAvatarUrl(mentor);
        res.json(resolved);
    } catch (error) {
        console.error('Get Mentor Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * POST /api/mentors
 * Admin: Create a new mentor.
 * Accepts multipart/form-data with optional `avatar` image file.
 * All other fields come from req.body (FormData or JSON).
 */
exports.createMentor = async (req, res) => {
    try {
        const {
            name, title, company, bio,
            expertise, linkedin_url, twitter_url,
            email, display_order,
        } = req.body;

        // Trim all string fields — Postman form-data can inject \t characters
        const cleanName = name?.trim();
        const cleanTitle = title?.trim();
        const cleanCompany = company?.trim() || null;
        const cleanBio = bio?.trim() || null;
        const cleanLinkedin = linkedin_url?.trim() || null;
        const cleanTwitter = twitter_url?.trim() || null;
        const cleanEmail = email?.trim() || null;

        if (!cleanName || !cleanTitle) {
            return res.status(400).json({ error: 'Name and title are required' });
        }

        // Accept expertise as array OR comma-separated string
        let expertiseArr = expertise;
        if (typeof expertise === 'string') {
            expertiseArr = expertise.split(',').map(s => s.trim()).filter(Boolean);
        }

        // ── Upload avatar to S3 if a file was provided ──────────────────────
        let avatar_url = null;
        if (req.file) {
            const mentorId = uuidv4(); // generate ID early, use as S3 filename
            avatar_url = await uploadImageToS3(
                req.file.buffer,
                'mentor-avatars',
                mentorId,
                req.file.mimetype
            );

            const mentor = await Mentor.create({
                id: mentorId,
                name: cleanName, title: cleanTitle, company: cleanCompany, bio: cleanBio,
                expertise: expertiseArr || [],
                avatar_url,
                linkedin_url: cleanLinkedin, twitter_url: cleanTwitter, email: cleanEmail,
                display_order: display_order || 0,
            });

            const resolved = await resolveAvatarUrl(mentor);
            return res.status(201).json(resolved);
        }

        // No file — create without avatar
        const mentor = await Mentor.create({
            name: cleanName, title: cleanTitle, company: cleanCompany, bio: cleanBio,
            expertise: expertiseArr || [],
            avatar_url: null,
            linkedin_url: cleanLinkedin, twitter_url: cleanTwitter, email: cleanEmail,
            display_order: display_order || 0,
        });

        res.status(201).json(mentor);
    } catch (error) {
        console.error('Create Mentor Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * PUT /api/mentors/:id
 * Admin: Update a mentor. Optionally replace avatar with a new image file.
 */
exports.updateMentor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, title, company, bio, expertise,
            linkedin_url, twitter_url, email,
            display_order, is_active,
        } = req.body;

        // Trim all incoming string fields
        const cleanName = name?.trim();
        const cleanTitle = title?.trim();
        const cleanCompany = company?.trim();
        const cleanBio = bio?.trim();
        const cleanLinkedin = linkedin_url?.trim();
        const cleanTwitter = twitter_url?.trim();
        const cleanEmail = email?.trim();

        const mentor = await Mentor.findByPk(id);
        if (!mentor) {
            return res.status(404).json({ error: 'Mentor not found' });
        }

        // Accept expertise as array OR comma-separated string
        let expertiseArr = mentor.expertise;
        if (expertise !== undefined) {
            expertiseArr = typeof expertise === 'string'
                ? expertise.split(',').map(s => s.trim()).filter(Boolean)
                : expertise;
        }

        // ── Upload new avatar if provided ────────────────────────────────────
        let newAvatarUrl = mentor.avatar_url;
        if (req.file) {
            newAvatarUrl = await uploadImageToS3(
                req.file.buffer,
                'mentor-avatars',
                id,                 // reuse mentor UUID as filename → overwrites old avatar in S3
                req.file.mimetype
            );
        }

        await mentor.update({
            name: cleanName ?? mentor.name,
            title: cleanTitle ?? mentor.title,
            company: company !== undefined ? cleanCompany : mentor.company,
            bio: bio !== undefined ? cleanBio : mentor.bio,
            expertise: expertiseArr,
            avatar_url: newAvatarUrl,
            linkedin_url: linkedin_url !== undefined ? cleanLinkedin : mentor.linkedin_url,
            twitter_url: twitter_url !== undefined ? cleanTwitter : mentor.twitter_url,
            email: email !== undefined ? cleanEmail : mentor.email,
            display_order: display_order !== undefined ? display_order : mentor.display_order,
            is_active: is_active !== undefined ? is_active : mentor.is_active,
        });

        const resolved = await resolveAvatarUrl(mentor);
        res.json({ message: 'Mentor updated successfully', mentor: resolved });
    } catch (error) {
        console.error('Update Mentor Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * DELETE /api/mentors/:id
 * Admin: Soft-delete (sets is_active = false).
 */
exports.deleteMentor = async (req, res) => {
    try {
        const { id } = req.params;
        const mentor = await Mentor.findByPk(id);
        if (!mentor) {
            return res.status(404).json({ error: 'Mentor not found' });
        }
        await mentor.destroy();
        res.json({ message: 'Mentor deleted successfully' });
    } catch (error) {
        console.error('Delete Mentor Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── Admin — list all (including inactive) ────────────────────────────────────

/**
 * GET /api/admin/mentors
 * Admin: All mentors including inactive, with presigned avatar URLs.
 */
exports.adminGetAllMentors = async (req, res) => {
    try {
        const mentors = await Mentor.findAll({
            order: [
                ['display_order', 'ASC'],
                ['createdAt', 'ASC'],
            ],
        });
        const resolved = await resolveMentorList(mentors);
        res.json(resolved);
    } catch (error) {
        console.error('Admin Get Mentors Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
