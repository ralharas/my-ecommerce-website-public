import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'fallback_secret_key'; // Use the same secret key

router.get('/login', async (req, res) => {
    try {
        let customer = null;
        const token = req.cookies['auth_token']; // Check for JWT token in cookies

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.SECRET_KEY); // Verify token
                console.log('Decoded JWT:', decoded); // Log decoded token

                const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [decoded.id]);
                customer = customerResult.rows[0]; // Retrieve customer data
                console.log('Fetched Customer:', customer); // Log customer data
            } catch (err) {
                console.error('JWT verification failed:', err.message);
                return res.render('login', { customer: null, message: 'Session expired, please log in again.', title: 'User Login' });
            }
        }

        // If the customer is logged in (valid token), redirect to profile or any other page
        if (customer) {
            return res.redirect('/profile'); // Adjust this route as needed
        }

        // Render the login page if not logged in
        res.render('login', { customer: null, message: null, title: 'User Login' }); // Render login page
    } catch (error) {
        console.error('Error during login route:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


      
       
        
router.get('/register', async (req, res) => {
    try {
        // Pass customer as null when rendering the registration page, because they're not logged in yet
        res.render('register', { customer: null, title: 'User Registration', message: null });
    } catch (error) {
        console.error('Error rendering registration page:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// User registration
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query to check if the user exists
        const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.render('register', {
                customer: null,
                title: 'User Registration',
                message: 'User already exists', // Pass error message
            });
        }

        // Continue with registration logic if user does not exist
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
            [username, hashedPassword, 'user']
        );

        res.redirect('/user/login'); // Redirect after successful registration
    } catch (error) {
        console.error('Error registering user:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


// User login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', {
                customer: null,
                message: 'Invalid username or password',
                title: 'User Login'
            });
        }

        const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, { expiresIn: '1h' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true });
        res.redirect('/');
    } catch (error) {
        console.error('Error logging in:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


// User logout
// User logout
router.get('/logout', async (req, res) => {
    try {
        console.log('Logout route accessed');

        // Clear the user authentication token (JWT)
        res.clearCookie('auth_token');

        // Fetch the homepage content from the homepage_content table
        const contentResult = await pool.query('SELECT * FROM homepage_content LIMIT 1');
        const homepageContent = contentResult.rows[0] || {}; 

        // Fetch products from the products table
        const productsResult = await pool.query('SELECT * FROM products');
        const products = productsResult.rows.map(product => ({
            ...product,
            price: product.price !== null ? Number(product.price) : null, // Ensure price is a number
            images: product.images || []  // Ensure images is an array
        }));

        // No customer data after logout, set customer to null
        const customer = null;

        // Log that the user has been logged out
        console.log('User successfully logged out.');

        // Render the index page with a success message
        res.render('index', { 
            customer, 
            title: 'Home', 
            products, 
            homepageContent, 
            message: 'User logged out successfully' // Pass success message
        });
    } catch (error) {
        console.error('Error during logout:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


export default router;
