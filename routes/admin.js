import express from 'express';
import pool from '../db/db.js';
import { authenticateToken, isAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import moment from 'moment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const uploadDir = path.join(__dirname, '../public/uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filenames to remove special characters
        const sanitizedFilename = file.originalname.replace(/[^\w.-]/g, '');
        cb(null, Date.now() + '-' + sanitizedFilename);
    }
});
const upload = multer({ storage });

router.get('/', authenticateToken, isAdmin, (req, res) => {
    res.render('admin', { title: 'Admin Dashboard' });
});


router.get('/add-product', authenticateToken, isAdmin, (req, res) => {
    res.render('addProduct', { title: 'Add New Product' });
});

router.get('/logout', (req, res) => {
    console.log('Logout route hit'); 
    res.clearCookie('auth_token');
    console.log('Cookie cleared'); 
    res.redirect('/');
});

router.post('/add-product', authenticateToken, isAdmin, upload.array('images', 10), async (req, res) => {
    const { title, description, price } = req.body; 
    const imageFiles = req.files;
    const imageArray = imageFiles.map(file => `/uploads/${file.filename}`);
    const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

    try {
        await pool.query(
            'INSERT INTO products (title, description, price, images, created_at) VALUES ($1, $2, $3, $4, $5)',
            [title, description, price, JSON.stringify(imageArray), createdAt]
        );
        res.send(`
            <html>
                <body>
                    <h1>Upload successful</h1>
                    <p>Redirecting to homepage...</p>
                    <script>
                        setTimeout(function() {
                            window.location.href = '/';
                        }, 3000);
                    </script>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error adding product:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/edit-home-page', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Fetch homepage content from the database
        const result = await pool.query('SELECT * FROM homepage_content LIMIT 1');
        const homepageContent = result.rows[0]; // Get the first row or null if none

        // Render the editHomePage template with fetched content
        res.render('editHomePage', {
            title: 'Edit Home Page',
            homepageContent: homepageContent || {} // Ensure homepageContent is at least an empty object
        });
    } catch (error) {
        console.error('Error fetching homepage content:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/edit-home-page', authenticateToken, isAdmin, async (req, res) => {
    const { featuredImage, headline, subheadline } = req.body;

    try {
        // Update the homepage content in the database
        await pool.query(
            'UPDATE homepage_content SET featured_image = $1, headline = $2, subheadline = $3 WHERE id = 1',
            [featuredImage, headline, subheadline]
        );

        res.redirect('/admin'); // Redirect back to admin page after saving
    } catch (error) {
        console.error('Error updating homepage content:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/manage-products', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        const products = result.rows.map(product => ({
            ...product,
            price: product.price !== null ? Number(product.price) : null 
        }));
        res.render('manageProducts', { title: 'Manage Products', products });
    } catch (error) {
        console.error('Error fetching products:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/delete-product/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.redirect('/admin/manage-products');
    } catch (error) {
        console.error('Error deleting product:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

export default router;