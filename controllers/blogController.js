const { Blog } = require('../models');

exports.createBlog = async (req, res) => {
    try {
        const { title, content, author, image_url, category, status, slug } = req.body;

        if (!title || !content || !slug) {
            return res.status(400).json({ error: 'Title, content, and slug are required' });
        }

        const blog = await Blog.create({
            title,
            content,
            author,
            image_url,
            category,
            status,
            slug
        });

        res.status(201).json(blog);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Slug already exists' });
        }
        console.error('Error creating blog:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.findAll({
            where: { status: 'PUBLISHED' },
            order: [['published_at', 'DESC']]
        });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const blog = await Blog.findOne({
            where: { slug }
        });

        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        res.json(blog);
    } catch (error) {
        console.error('Error fetching blog by slug:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, author, image_url, category, status, slug } = req.body;

        const blog = await Blog.findByPk(id);
        if (!blog) return res.status(404).json({ error: 'Blog not found' });

        await blog.update({
            title: title || blog.title,
            content: content || blog.content,
            author: author || blog.author,
            image_url: image_url || blog.image_url,
            category: category || blog.category,
            status: status || blog.status,
            slug: slug || blog.slug
        });

        res.json(blog);
    } catch (error) {
        console.error('Error updating blog:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findByPk(id);
        if (!blog) return res.status(404).json({ error: 'Blog not found' });

        await blog.destroy();
        res.json({ message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
