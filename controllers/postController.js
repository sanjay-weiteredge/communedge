const { StartupPost, Startup, PostComment, PostMetric, PostView, PostVote, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { uploadImageToS3, getSignedUrlForView, isS3Value } = require('../services/s3Service');
const { sendPostSubmittedEmail } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

const signPostUrls = async (post) => {
    if (post.media_url) {
        try {
            const parsed = JSON.parse(post.media_url);
            if (Array.isArray(parsed)) {
                post.media_urls = await Promise.all(
                    parsed.map(u => isS3Value(u) ? getSignedUrlForView(u) : u)
                );
                post.media_url = post.media_urls[0];
            } else {
                throw new Error('not array');
            }
        } catch {
            if (isS3Value(post.media_url)) {
                post.media_url = await getSignedUrlForView(post.media_url);
            }
            post.media_urls = [post.media_url];
        }
    }
    if (post.thumbnail_url && isS3Value(post.thumbnail_url)) {
        post.thumbnail_url = await getSignedUrlForView(post.thumbnail_url);
    }
    if (post.startup && post.startup.logo_url && isS3Value(post.startup.logo_url)) {
        post.startup.logo_url = await getSignedUrlForView(post.startup.logo_url);
    }
    return post;
};

exports.addPost = async (req, res) => {
    try {
        const { startup_id, title, content, media_type, post_type, demo_link, external_link, comments_enabled } = req.body;

        if (!startup_id) {
            return res.status(400).json({ error: 'startup_id is required' });
        }

        let media_url = req.body.media_url || null;
        let thumbnail_url = req.body.thumbnail_url || null;
        let media_type_resolved = media_type;

        if (req.files) {
            if (req.files.media && req.files.media.length > 0) {
                const mediaFiles = req.files.media;
                const uploadedUrls = await Promise.all(
                    mediaFiles.map(async (mediaFile) => {
                        const mediaId = uuidv4();
                        return uploadImageToS3(
                            mediaFile.buffer,
                            'startup-posts',
                            mediaId,
                            mediaFile.mimetype
                        );
                    })
                );
                media_url = uploadedUrls.length === 1
                    ? uploadedUrls[0]
                    : JSON.stringify(uploadedUrls);

                if (!media_type_resolved) {
                    media_type_resolved = mediaFiles[0].mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';
                }
            }

            if (req.files.thumbnail?.[0]) {
                const thumbFile = req.files.thumbnail[0];
                const thumbId = uuidv4();
                thumbnail_url = await uploadImageToS3(
                    thumbFile.buffer,
                    'startup-post-thumbnails',
                    thumbId,
                    thumbFile.mimetype
                );
            }
        }

        const post = await StartupPost.create({
            startup_id,
            title,
            content,
            media_url,
            media_type: media_type_resolved || media_type || 'IMAGE',
            thumbnail_url,
            post_type: post_type || 'UPDATE',
            demo_link,
            external_link,
            comments_enabled: comments_enabled === 'false' || comments_enabled === false ? false : true,
            status: 'PENDING'
        });

        await PostMetric.create({ post_id: post.id });

        // 📧 Email: Post Submitted — fetch startup owner's email
        try {
            const startup = await Startup.findByPk(startup_id, {
                include: [{ model: User, as: 'owner', attributes: ['email'] }]
            });
            const ownerEmail = startup?.owner?.email;
            if (ownerEmail) {
                sendPostSubmittedEmail({ to: ownerEmail, startupName: startup.name, postTitle: title });
            }
        } catch (emailErr) {
            console.error('Post email lookup failed:', emailErr.message);
        }

        res.status(201).json(post);
    } catch (error) {
        console.error('Add Post Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getPostsByStartup = async (req, res) => {
    try {
        const { startup_id } = req.params;
        const posts = await StartupPost.findAll({
            where: { startup_id, status: 'APPROVED' },
            include: [{ model: PostMetric, as: 'metrics' }],
            order: [['created_at', 'DESC']]
        });
        const postsJson = posts.map(p => p.toJSON());
        const signedPosts = await Promise.all(postsJson.map(async (p) => {
            p.comments_count = await PostComment.count({ where: { post_id: p.id, status: 'ACTIVE' } });

            // Check for user vote if authenticated
            if (req.dbUser) {
                const userVote = await PostVote.findOne({
                    where: { post_id: p.id, user_id: req.dbUser.id }
                });
                p.userVote = userVote ? userVote.vote_type : 0;
            } else {
                p.userVote = 0;
            }

            return await signPostUrls(p);
        }));
        res.json(signedPosts);
    } catch (error) {
        console.error('Get Posts Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllPosts = async (req, res) => {
    try {
        let whereClause = { status: 'APPROVED' };
        if (req.dbUser) {
            const userStartup = await Startup.findOne({ where: { owner_user_id: req.dbUser.id } });
            if (userStartup) {
                const { Op } = require('sequelize');
                whereClause.startup_id = { [Op.ne]: userStartup.id };
            }
        }

        const posts = await StartupPost.findAll({
            where: whereClause,
            include: [
                { model: Startup, as: 'startup', attributes: ['name', 'logo_url', 'tagline', 'owner_user_id'] },
                { model: PostMetric, as: 'metrics' }
            ],
            order: [['created_at', 'DESC']]
        });
        const postsJson = posts.map(p => p.toJSON());
        const signedPosts = await Promise.all(postsJson.map(async (p) => {
            p.comments_count = await PostComment.count({ where: { post_id: p.id, status: 'ACTIVE' } });

            if (req.dbUser) {
                const userVote = await PostVote.findOne({
                    where: { post_id: p.id, user_id: req.dbUser.id }
                });
                p.userVote = userVote ? userVote.vote_type : 0;
            } else {
                p.userVote = 0;
            }

            return await signPostUrls(p);
        }));
        res.json(signedPosts);
    } catch (error) {
        console.error('Get All Posts Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, media_type, post_type, demo_link, external_link, comments_enabled, keep_media } = req.body;

        const post = await StartupPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        let keptUrls = [];
        if (keep_media !== undefined) {
            try {
                const parsed = JSON.parse(keep_media);
                keptUrls = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                if (keep_media) keptUrls = [keep_media];
            }
        } else {
            if (post.media_url) {
                try {
                    const parsed = JSON.parse(post.media_url);
                    keptUrls = Array.isArray(parsed) ? parsed : [post.media_url];
                } catch {
                    keptUrls = [post.media_url];
                }
            }
        }

        let newlyUploadedUrls = [];
        let detectedMediaType = null;

        if (req.files && req.files.media && req.files.media.length > 0) {
            const mediaFiles = req.files.media;
            newlyUploadedUrls = await Promise.all(
                mediaFiles.map(async (mediaFile) => {
                    const mediaId = uuidv4();
                    return uploadImageToS3(
                        mediaFile.buffer,
                        'startup-posts',
                        mediaId,
                        mediaFile.mimetype
                    );
                })
            );
            if (!media_type) {
                detectedMediaType = mediaFiles[0].mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';
            }
        }

        const allUrls = [...keptUrls, ...newlyUploadedUrls];
        let media_url;
        if (allUrls.length === 0) {
            media_url = null;
        } else if (allUrls.length === 1) {
            media_url = allUrls[0];
        } else {
            media_url = JSON.stringify(allUrls);
        }

        let thumbnail_url = post.thumbnail_url;
        if (req.files && req.files.thumbnail?.[0]) {
            const thumbFile = req.files.thumbnail[0];
            const thumbId = uuidv4();
            thumbnail_url = await uploadImageToS3(
                thumbFile.buffer,
                'startup-post-thumbnails',
                thumbId,
                thumbFile.mimetype
            );
        }

        await post.update({
            title: title !== undefined ? title : post.title,
            content: content !== undefined ? content : post.content,
            media_url,
            media_type: media_type !== undefined ? media_type : (detectedMediaType || post.media_type),
            thumbnail_url,
            post_type: post_type !== undefined ? post_type : post.post_type,
            demo_link: demo_link !== undefined ? demo_link : post.demo_link,
            external_link: external_link !== undefined ? external_link : post.external_link,
            comments_enabled: comments_enabled !== undefined
                ? (comments_enabled === 'false' || comments_enabled === false ? false : true)
                : post.comments_enabled,
            status: 'PENDING' // reset to pending for re-approval after edit
        });

        // Re-fetch to return the latest snapshot
        const updated = await StartupPost.findByPk(id);
        res.json({ message: 'Post updated successfully', post: updated });
    } catch (error) {
        console.error('Update Post Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const { id } = req.params;

        const post = await StartupPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Manually delete dependent records to avoid foreign key constraint errors
        await PostVote.destroy({ where: { post_id: id } });
        await PostComment.destroy({ where: { post_id: id } });
        await PostMetric.destroy({ where: { post_id: id } });
        await PostView.destroy({ where: { post_id: id } });

        await post.destroy();

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete Post Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
exports.getTrendingPosts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const posts = await StartupPost.findAll({
            where: { status: 'APPROVED' },
            include: [
                { model: Startup, as: 'startup', attributes: ['name', 'logo_url', 'tagline'] },
                { model: PostMetric, as: 'metrics' }
            ],
            order: [
                ['is_pinned_trending', 'DESC'],
                [{ model: PostMetric, as: 'metrics' }, 'trending_score', 'DESC']
            ],
            limit
        });

        const postsJson = posts.map(p => p.toJSON());
        const signedPosts = await Promise.all(postsJson.map(async (p) => {
            p.comments_count = await PostComment.count({ where: { post_id: p.id, status: 'ACTIVE' } });
            if (req.dbUser) {
                const userVote = await PostVote.findOne({
                    where: { post_id: p.id, user_id: req.dbUser.id }
                });
                p.userVote = userVote ? userVote.vote_type : 0;
            } else {
                p.userVote = 0;
            }
            return await signPostUrls(p);
        }));

        res.json(signedPosts);
    } catch (error) {
        console.error('Get Trending Posts Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.trackPostView = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.dbUser?.id || null;
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket?.remoteAddress
            || null;

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const whereClause = {
            post_id: id,
            created_at: { [Op.gte]: oneHourAgo },
            [Op.or]: [
                ...(user_id ? [{ user_id }] : []),
                ...(ip ? [{ ip_address: ip }] : []),
            ],
        };

        const recentView = await PostView.findOne({ where: whereClause });

        if (!recentView) {
            await PostView.create({
                post_id: id,
                user_id,
                ip_address: ip,
                user_agent: req.headers['user-agent'] || null,
            });
            // Hook in PostView handles incrementing total_views
            // We can also trigger a background recalculation here if we want scores to reflect views immediately
            PostVote.recalculateIndividualPostMetrics(id);
        }

        res.status(200).json({ status: 'tracked' });
    } catch (error) {
        console.error('Track Post View Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
