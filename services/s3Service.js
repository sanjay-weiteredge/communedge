const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const axios = require('axios');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    },
    // Prevent inclusion of checksum headers in presigned URLs which can cause 403 for some objects
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
});

// ── Presigned URL In-Memory Cache ─────────────────────────────────────────────
// S3 presigned URLs are valid for 24h (86400s). We cache them for 23h (82800s)
// to safely reuse across requests without worrying about expiry edge cases.
const CACHE_TTL_MS = 82800 * 1000; // 23 hours
const urlCache = new Map(); // key: S3 key string, value: { url, expiresAt }

const getCachedUrl = (key) => {
    const entry = urlCache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
        urlCache.delete(key); // evict stale entry
        return null;
    }
    return entry.url;
};

const setCachedUrl = (key, url) => {
    urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
};
// ─────────────────────────────────────────────────────────────────────────────

const isS3Value = (value) => {
    if (!value) return false;
    const clean = value.replace(/[\r\n\t\0\x0B\x0C]/g, '').trim();
    return (
        clean.startsWith('profile-pictures/') ||
        clean.startsWith('startup-logos/') ||
        clean.startsWith('startup-banners/') ||
        clean.startsWith('founder-photos/') ||
        clean.startsWith('incorporation-certs/') ||
        clean.startsWith('categories/') ||
        clean.startsWith('startup-posts/') ||
        clean.startsWith('startup-post-thumbnails/') ||
        clean.startsWith('mentor-avatars/') ||
        clean.includes('amazonaws.com')
    );
};


const extractS3Key = (value) => {
    if (!value) return null;
    const clean = value.replace(/[\r\n\t\0\x0B\x0C]/g, '').trim();
    if (clean.includes('amazonaws.com')) {
        const parts = clean.split('.amazonaws.com/');
        return parts[1]?.split('?')[0] || null;
    }
    return clean.split('?')[0];
};

/**
 * Downloads an image from a URL and uploads it to S3.
 * Returns the SHORT S3 key (e.g. "profile-pictures/uid.png") — not the full URL.
 *
 * @param {string} imageUrl - Remote image URL (e.g. Google profile pic)
 * @param {string} userId   - Firebase UID, used as filename
 * @returns {Promise<string|null>} - S3 key or null on failure
 */
const uploadProfileImageToS3 = async (imageUrl, userId) => {
    try {
        if (!imageUrl) return null;

        if (isS3Value(imageUrl)) {
            return extractS3Key(imageUrl);
        }

        const response = await axios({ url: imageUrl, method: 'GET', responseType: 'arraybuffer' });

        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const rawExt = contentType.split('/')[1] || 'jpg';
        const extension = rawExt.includes('+') ? rawExt.split('+')[0] : (rawExt === 'jpeg' ? 'jpg' : rawExt);
        const key = `profile-pictures/${userId}.${extension}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }));

        console.log(`✅ Uploaded profile pic to S3 (key: ${key})`);
        return key;
    } catch (error) {
        console.error("❌ Error uploading to S3:", error.message);
        return null;
    }
};

/**
 * Generates a 24h presigned URL for viewing an S3 object.
 * Accepts either a short key OR a legacy full URL.
 *
 * @param {string} s3Value - S3 key or full URL
 * @returns {Promise<string|null>} - Signed URL or null on failure
 */
const getSignedUrlForView = async (s3Value) => {
    try {
        const key = extractS3Key(s3Value);
        if (!key) return null;

        // ── Cache hit: return immediately without calling AWS ──────────────
        const cached = getCachedUrl(key);
        if (cached) return cached;
        // ──────────────────────────────────────────────────────────────────

        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 }); // 24h
        setCachedUrl(key, url); // store for next 23h
        return url;
    } catch (error) {
        console.error(`❌ getSignedUrlForView failed for key="${extractS3Key(s3Value)}" — ${error.name}: ${error.message}`);
        console.error(`   Bucket: ${process.env.S3_BUCKET_NAME} | Region: ${process.env.S3_REGION}`);
        return null;
    }
};

/**
 * Uploads a raw file buffer to S3 (used for direct file uploads from frontend).
 * Returns the SHORT S3 key.
 *
 * @param {Buffer} buffer      - File buffer from multer
 * @param {string} userId      - Firebase UID
 * @param {string} contentType - MIME type
 * @returns {Promise<string>}  - S3 key
 */
const uploadFileBufferToS3 = async (buffer, userId, contentType) => {
    try {
        if (!buffer || !userId) throw new Error('Buffer and userId are required');

        const rawExt = contentType.split('/')[1] || 'jpeg';
        const extension = rawExt.includes('+') ? rawExt.split('+')[0] : (rawExt === 'jpeg' ? 'jpg' : rawExt);
        const key = `profile-pictures/${userId}.${extension}`;

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        }));

        console.log(`✅ Uploaded file to S3 (key: ${key})`);
        return key;
    } catch (error) {
        console.error("❌ Error uploading file to S3:", error.message);
        throw error;
    }
};

/**
 * Generic image upload to S3 with a custom folder and filename.
 * Returns the SHORT S3 key (e.g. "startup-logos/abc123.jpg").
 *
 * @param {Buffer} buffer      - File buffer (from multer memoryStorage)
 * @param {string} folder      - S3 folder prefix, e.g. "startup-logos"
 * @param {string} filename    - Base filename without extension (e.g. startup id / uuid)
 * @param {string} contentType - MIME type, e.g. "image/jpeg"
 * @returns {Promise<string>}  - S3 key
 */
const uploadImageToS3 = async (buffer, folder, filename, contentType) => {
    if (!buffer || !folder || !filename) throw new Error('buffer, folder and filename are required');

    const rawExt = contentType.split('/')[1] || 'jpeg';
    const extension = rawExt.includes('+') ? rawExt.split('+')[0] : (rawExt === 'jpeg' ? 'jpg' : rawExt);
    const key = `${folder}/${filename}.${extension}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));

    console.log(`✅ Uploaded to S3 (key: ${key})`);
    return key;
};

module.exports = { s3Client, uploadProfileImageToS3, getSignedUrlForView, uploadFileBufferToS3, uploadImageToS3, isS3Value, extractS3Key };
