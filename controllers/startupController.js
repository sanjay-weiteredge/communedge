const { Startup, StartupMetric, StartupPost, User, Category, Founder, StartupView, PostVote, PostComment, CommentVote, sequelize } = require('../models');
const { Op } = require('sequelize');
const { uploadImageToS3, getSignedUrlForView, isS3Value } = require('../services/s3Service');
const { sendStartupSubmittedEmail } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

/**
 * Given a plain Sequelize startup instance (toJSON'd), sign its logo_url,
 * incorporation certificate, founder photos, and media in posts.
 */
const signStartupUrls = async (s) => {
    // 1. Sign basic startup URLs
    if (s.logo_url && isS3Value(s.logo_url)) {
        s.logo_url = await getSignedUrlForView(s.logo_url);
    }
    if (s.banner_url && isS3Value(s.banner_url)) {
        s.banner_url = await getSignedUrlForView(s.banner_url);
    }
    if (s.incorporation_certificate_url && isS3Value(s.incorporation_certificate_url)) {
        s.incorporation_certificate_url = await getSignedUrlForView(s.incorporation_certificate_url);
    }

    // 1b. Sign Industry URLs
    if (Array.isArray(s.industries)) {
        await Promise.all(s.industries.map(async (ind) => {
            if (ind.image_url && isS3Value(ind.image_url)) {
                ind.image_url = await getSignedUrlForView(ind.image_url);
            }
        }));
    }

    // 2. Sign Founder photos
    if (Array.isArray(s.founders)) {
        await Promise.all(s.founders.map(async (f) => {
            if (f.photo_url && isS3Value(f.photo_url)) {
                f.photo_url = await getSignedUrlForView(f.photo_url);
            }
        }));
    }

    // 3. Sign Post media (images/videos)
    if (Array.isArray(s.posts)) {
        await Promise.all(s.posts.map(async (p) => {
            if (p.media_url) {
                try {
                    // media_url can be a plain string OR a JSON array of strings
                    const parsed = JSON.parse(p.media_url);
                    if (Array.isArray(parsed)) {
                        p.media_urls = await Promise.all(
                            parsed.map(u => isS3Value(u) ? getSignedUrlForView(u) : u)
                        );
                        p.media_url = p.media_urls[0]; // keep first as primary
                    } else {
                        throw new Error('not array');
                    }
                } catch {
                    // plain string (legacy single upload)
                    if (isS3Value(p.media_url)) {
                        p.media_url = await getSignedUrlForView(p.media_url);
                    }
                    p.media_urls = [p.media_url];
                }
            }
            if (p.thumbnail_url && isS3Value(p.thumbnail_url)) {
                p.thumbnail_url = await getSignedUrlForView(p.thumbnail_url);
            }
        }));
    }
    return s;
};

exports.createStartup = async (req, res) => {
    try {
        const {
            name, tagline, description, industry_id, industry_ids,
            website_url, funding_stage, location, team_size,
            incorporation_certificate_url,
            linkedin_url, twitter_url, instagram_url, facebook_url
        } = req.body;

        console.log('Create Startup Request Body:', req.body);

        const owner_user_id = req.dbUser ? req.dbUser.id : req.body.owner_user_id;

        if (!owner_user_id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Startup name is required' });
        }

        // Upload logo to S3 if a file was provided
        let logo_url = null;
        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            const logoId = uuidv4();
            logo_url = await uploadImageToS3(
                logoFile.buffer,
                'startup-logos',
                logoId,
                logoFile.mimetype
            );
        }

        // Upload banner to S3 if provided
        let banner_url = null;
        const bannerFile = req.files?.banner?.[0];
        if (bannerFile) {
            const bannerId = uuidv4();
            banner_url = await uploadImageToS3(
                bannerFile.buffer,
                'startup-banners',
                bannerId,
                bannerFile.mimetype
            );
        }

        // Upload incorporation certificate to S3 if provided
        let incorporation_certificate_url_final = incorporation_certificate_url || null;
        const certFile = req.files?.incorporation_certificate?.[0];
        if (certFile) {
            const certId = uuidv4();
            incorporation_certificate_url_final = await uploadImageToS3(
                certFile.buffer,
                'incorporation-certs',
                certId,
                certFile.mimetype
            );
        }

        const startup = await Startup.create({
            name,
            tagline,
            description,
            industry_id,
            website_url: website_url || null,
            funding_stage: funding_stage || null,
            location: location || null,
            team_size: team_size ? parseInt(team_size, 10) : null,
            founded_year: req.body.founded_year ? parseInt(req.body.founded_year, 10) : null,
            logo_url,
            banner_url,
            owner_user_id,
            incorporation_certificate_url: incorporation_certificate_url_final,
            linkedin_url: linkedin_url || null,
            twitter_url: twitter_url || null,
            instagram_url: instagram_url || null,
            facebook_url: facebook_url || null,
            status: 'DRAFT'
        });

        await StartupMetric.create({ startup_id: startup.id });

        // Handle multiple industries
        let idsToSet = [];
        if (Array.isArray(industry_ids)) {
            idsToSet = industry_ids;
        } else if (industry_id) {
            idsToSet = [industry_id];
        }

        if (idsToSet.length > 0) {
            await startup.setIndustries(idsToSet);
        }

        // 📧 Email: Startup Submitted
        const ownerUser = req.dbUser;
        if (ownerUser?.email) {
            sendStartupSubmittedEmail({ to: ownerUser.email, startupName: startup.name });
        }

        res.status(201).json(startup);
    } catch (error) {
        console.error('Create Startup Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllStartups = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category || "All";
        const search = req.query.search || "";
        const isFeatured = req.query.featured === 'true';

        const whereClause = { status: 'APPROVED' };
        if (isFeatured) {
            whereClause.is_featured = true;
        }

        // Search filter: Check name, tagline, description, OR any of the industry names
        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { tagline: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
                { '$industry.name$': { [Op.iLike]: `%${search}%` } },
                { '$industries.name$': { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Industry filter: check both primary and many-to-many industries
        if (category !== "All") {
            whereClause[Op.or] = [
                ...(whereClause[Op.or] || []), // Merge with existing search filters if any
                { '$industry.name$': category },
                { '$industries.name$': category }
            ];
        }

        const include = [
            { model: StartupMetric, as: 'metrics' },
            {
                model: Category,
                as: 'industry',
                required: false
            },
            {
                model: Category,
                as: 'industries',
                required: false
            },
            {
                model: StartupPost,
                as: 'posts',
                where: { status: 'APPROVED' },
                required: false,
                attributes: {
                    include: [
                        [
                            Startup.sequelize.literal(`(
                                SELECT COUNT(*)
                                FROM post_votes AS pv
                                WHERE pv.post_id = posts.id AND pv.vote_type = 1
                            )`),
                            'total_upvotes'
                        ],
                        [
                            Startup.sequelize.literal(`(
                                SELECT COUNT(*)
                                FROM post_votes AS pv
                                WHERE pv.post_id = posts.id AND pv.vote_type = -1
                            )`),
                            'total_downvotes'
                        ],
                        [
                            Startup.sequelize.literal(`(
                                SELECT COUNT(*)
                                FROM post_comments AS pc
                                WHERE pc.post_id = posts.id
                            )`),
                            'comments_count'
                        ],
                        [
                            Startup.sequelize.literal(`(
                                SELECT vote_type
                                FROM post_votes AS pv
                                WHERE pv.post_id = posts.id AND pv.user_id = '${req.dbUser?.id || '00000000-0000-0000-0000-000000000000'}'
                                LIMIT 1
                            )`),
                            'userVote'
                        ]
                    ]
                }
            }
        ];

        const { count, rows: startups } = await Startup.findAndCountAll({
            where: whereClause,
            include,
            order: [['created_at', 'DESC']],
            limit,
            offset,
            distinct: true,
            subQuery: false // Required when joining M:M association with limit/offset and top-level filter
        });

        const signed = await Promise.all(startups.map(s => signStartupUrls(s.toJSON())));

        res.json({
            startups: signed,
            total: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get Startups Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getTrending = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 8;

        const startups = await Startup.findAll({
            where: { status: 'APPROVED' },
            include: [
                { model: StartupMetric, as: 'metrics' },
                { model: Category, as: 'industry' },
                { model: Category, as: 'industries', required: false },
                {
                    model: StartupPost,
                    as: 'posts',
                    where: { status: 'APPROVED' },
                    required: false,
                    attributes: {
                        include: [
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = 1
                                )`),
                                'total_upvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = -1
                                )`),
                                'total_downvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_comments AS pc
                                    WHERE pc.post_id = posts.id
                                )`),
                                'comments_count'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT vote_type
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.user_id = '${req.dbUser?.id || '00000000-0000-0000-0000-000000000000'}'
                                    LIMIT 1
                                )`),
                                'userVote'
                            ]
                        ]
                    }
                }
            ],
            order: [['metrics', 'trending_score', 'DESC']],
            limit: limit,
            distinct: true
        });

        const signed = await Promise.all(startups.map(s => signStartupUrls(s.toJSON())));
        res.json(signed);
    } catch (error) {
        console.error('Get Trending Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getStartupById = async (req, res) => {
    try {
        const { id } = req.params;
        const startup = await Startup.findByPk(id, {
            include: [
                { model: StartupMetric, as: 'metrics' },
                { model: Category, as: 'industry' },
                { model: Category, as: 'industries', required: false },
                {
                    model: StartupPost,
                    as: 'posts',
                    where: { status: 'APPROVED' },
                    required: false,
                    attributes: {
                        include: [
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = 1
                                )`),
                                'total_upvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = -1
                                )`),
                                'total_downvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_comments AS pc
                                    WHERE pc.post_id = posts.id
                                )`),
                                'comments_count'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT vote_type
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.user_id = '${req.dbUser?.id || '00000000-0000-0000-0000-000000000000'}'
                                    LIMIT 1
                                )`),
                                'userVote'
                            ]
                        ]
                    }
                },
                { model: User, as: 'owner', attributes: ['id', 'email'] },
                { model: Founder, as: 'founders' }
            ]
        });

        if (!startup) {
            return res.status(404).json({ error: 'Startup not found' });
        }

        // ── View tracking with 1-hour cooldown ──────────────────────────
        try {
            const user_id = req.dbUser?.id || null;
            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                || req.socket?.remoteAddress
                || null;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            // Build the dedup filter: match by user_id OR ip within last hour
            const whereClause = {
                startup_id: id,
                created_at: { [Op.gte]: oneHourAgo },
                [Op.or]: [
                    ...(user_id ? [{ user_id }] : []),
                    ...(ip ? [{ ip_address: ip }] : []),
                ],
            };

            const recentView = await StartupView.findOne({ where: whereClause });

            if (!recentView) {
                await StartupView.create({
                    startup_id: id,
                    user_id,
                    ip_address: ip,
                    user_agent: req.headers['user-agent'] || null,
                });
                // afterCreate hook on StartupView auto-increments total_views
                // and trending_score on StartupMetric
            }
        } catch (viewErr) {
            // Non-fatal — never block the response because of view tracking
            console.error('View tracking error:', viewErr.message);
        }
        // ────────────────────────────────────────────────────────────────

        const signed = await signStartupUrls(startup.toJSON());
        res.json(signed);
    } catch (error) {
        console.error('Get Startup Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getMyStartup = async (req, res) => {
    try {
        const owner_user_id = req.dbUser?.id;
        if (!owner_user_id) return res.status(401).json({ error: 'Not authenticated' });

        const startup = await Startup.findOne({
            where: { owner_user_id },
            include: [
                { model: StartupMetric, as: 'metrics' },
                { model: Category, as: 'industry' },
                { model: Category, as: 'industries', required: false },
                {
                    model: StartupPost,
                    as: 'posts',
                    attributes: {
                        include: [
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = 1
                                )`),
                                'total_upvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.vote_type = -1
                                )`),
                                'total_downvotes'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM post_comments AS pc
                                    WHERE pc.post_id = posts.id
                                )`),
                                'comments_count'
                            ],
                            [
                                Startup.sequelize.literal(`(
                                    SELECT vote_type
                                    FROM post_votes AS pv
                                    WHERE pv.post_id = posts.id AND pv.user_id = '${req.dbUser?.id || '00000000-0000-0000-0000-000000000000'}'
                                    LIMIT 1
                                )`),
                                'userVote'
                            ]
                        ]
                    }
                },
                { model: Founder, as: 'founders' },
            ]
        });

        if (!startup) return res.status(404).json({ error: 'No startup found for this user' });

        const signed = await signStartupUrls(startup.toJSON());
        res.json(signed);
    } catch (error) {
        console.error('Get My Startup Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ── Update Startup ────────────────────────────────────────────────────────────
// NOTE: Posts keep their own status (APPROVED posts stay visible).
// Only the startup profile goes to PENDING for re-approval.
exports.updateStartup = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_user_id = req.dbUser?.id;

        const startup = await Startup.findByPk(id);
        if (!startup) return res.status(404).json({ error: 'Startup not found' });

        if (startup.owner_user_id !== owner_user_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const {
            name, tagline, description, industry_id, industry_ids,
            website_url, funding_stage, location, team_size, founded_year,
            linkedin_url, twitter_url, instagram_url, facebook_url
        } = req.body;

        console.log('Update Startup Request Body:', req.body);

        if (name !== undefined) startup.name = name;
        if (tagline !== undefined) startup.tagline = tagline;
        if (description !== undefined) startup.description = description;
        if (industry_id !== undefined) startup.industry_id = industry_id;
        if (website_url !== undefined) startup.website_url = website_url || null;
        if (funding_stage !== undefined) startup.funding_stage = funding_stage || null;
        if (location !== undefined) startup.location = location || null;
        if (team_size !== undefined) startup.team_size = parseInt(team_size, 10) || null;
        if (founded_year !== undefined) startup.founded_year = parseInt(founded_year, 10) || null;
        if (linkedin_url !== undefined) startup.linkedin_url = linkedin_url || null;
        if (twitter_url !== undefined) startup.twitter_url = twitter_url || null;
        if (instagram_url !== undefined) startup.instagram_url = instagram_url || null;
        if (facebook_url !== undefined) startup.facebook_url = facebook_url || null;

        // Update multiple industries if provided
        if (industry_ids !== undefined) {
            const idsToSet = Array.isArray(industry_ids) ? industry_ids : [industry_ids];
            await startup.setIndustries(idsToSet);
            // Also update legacy industry_id if needed
            if (idsToSet.length > 0) {
                startup.industry_id = idsToSet[0];
            }
        }

        // New logo upload
        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            startup.logo_url = await uploadImageToS3(
                logoFile.buffer, 'startup-logos', uuidv4(), logoFile.mimetype
            );
        }

        // New banner upload
        const bannerFile = req.files?.banner?.[0];
        if (bannerFile) {
            startup.banner_url = await uploadImageToS3(
                bannerFile.buffer, 'startup-banners', uuidv4(), bannerFile.mimetype
            );
        }

        // New incorporation cert upload
        const certFile = req.files?.incorporation_certificate?.[0];
        if (certFile) {
            startup.incorporation_certificate_url = await uploadImageToS3(
                certFile.buffer, 'incorporation-certs', uuidv4(), certFile.mimetype
            );
        }

        // Reset to PENDING for re-approval. Posts are NOT affected.
        startup.status = 'PENDING';
        await startup.save();

        const signed = await signStartupUrls(startup.toJSON());
        res.json({ message: 'Startup updated successfully. Pending re-approval.', startup: signed });
    } catch (error) {
        console.error('Update Startup Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ── Delete Startup (owner only, full cascade) ─────────────────────────────────
exports.deleteStartup = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const owner_user_id = req.dbUser?.id;

        const startup = await Startup.findByPk(id, { transaction: t });
        if (!startup) {
            await t.rollback();
            return res.status(404).json({ error: 'Startup not found' });
        }

        // Only the owner can delete their own startup
        if (startup.owner_user_id !== owner_user_id) {
            await t.rollback();
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // 1. Get all post IDs for this startup
        const posts = await StartupPost.findAll({
            where: { startup_id: id },
            attributes: ['id'],
            transaction: t,
        });
        const postIds = posts.map(p => p.id);

        // 2. Cascade delete post children
        if (postIds.length > 0) {
            await PostVote.destroy({ where: { post_id: postIds }, transaction: t });
            const comments = await PostComment.findAll({
                where: { post_id: postIds },
                attributes: ['id'],
                transaction: t,
            });
            const commentIds = comments.map(c => c.id);
            if (commentIds.length > 0) {
                await CommentVote.destroy({ where: { comment_id: commentIds }, transaction: t });
            }
            await PostComment.destroy({ where: { post_id: postIds }, transaction: t });
            await StartupPost.destroy({ where: { startup_id: id }, transaction: t });
        }

        // 3. Delete founders, metrics, views
        await Founder.destroy({ where: { startup_id: id }, transaction: t });
        await StartupMetric.destroy({ where: { startup_id: id }, transaction: t });
        await StartupView.destroy({ where: { startup_id: id }, transaction: t });

        // 4. Downgrade owner back to USER role
        const owner = await User.findByPk(owner_user_id, { transaction: t });
        if (owner && owner.role === 'STARTUP') {
            owner.role = 'USER';
            await owner.save({ transaction: t });
        }

        // 5. Delete the startup itself
        await startup.destroy({ transaction: t });
        await t.commit();

        res.json({ message: 'Startup deleted successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Delete Startup Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
