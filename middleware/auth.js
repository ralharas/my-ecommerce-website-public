import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY || 'fallback_secret_key'; 
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export function authenticateToken(req, res, next) {
    const token = req.cookies['auth_token']; // Get token from cookies

    if (!token) {
        // If token is not present, redirect to login
        res.redirect('/auth/login');
        return;  // Ensure no further code is executed
    }

    try {
        // Verify the token
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified; 
        next();
    } catch (err) {
        console.error('Token verification failed:', err.message);
        // If token is invalid or expired, clear the cookie and redirect to login
        res.clearCookie('auth_token');
        res.redirect('/auth/login');
    }
}

// Middleware to check admin role
export function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Access Denied: Admins Only');
    }
    next();
}

// Login function to validate user credentials
export function loginAdmin(req, res) {
    const { username, password } = req.body;

    // Check if credentials match the environment variables
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Generate a token
        const token = jwt.sign({ role: 'admin', username }, SECRET_KEY, { expiresIn: '1h' });
        res.cookie('auth_token', token, { httpOnly: true, secure: false }); // Set token in cookies
        res.redirect('/admin');  // Redirect to admin page
    } else {
        res.status(401).render('login', { message: 'Invalid credentials' });  // Show error message
    }
}
