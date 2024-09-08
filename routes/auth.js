import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.render('register', { customer: null, title: 'Register', message: 'User already exists' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
            [username, hashedPassword, 'user']
        );

        res.status(201).send('User registered successfully');
    } catch (error) {
        console.error('Error registering user:', error.message); 
        res.render('register', { customer: null, title: 'Register', message: 'Internal Server Error. Please try again later.' });
    }
});


router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).send('Invalid username or password');
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).send('Invalid username or password');
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.SECRET_KEY, { expiresIn: '1h' });
        res.cookie('auth_token', token, { httpOnly: true, secure: true });

        res.redirect('/admin');
    } catch (error) {
        console.error('Error logging in:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Route to render login page
router.get('/login', (req, res) => {
    // Check if the customer is logged in
    if (req.customer) {
        return res.redirect('/'); // Redirect logged-in users to the home page or another page
    }

    // If not logged in, render the login page
    res.render('login', { customer: null, title: 'Login', message: null});
});


// Route to render register page
router.get('/register', (req, res) => {
    // Check if the customer is logged in
    if (req.customer) {
        return res.redirect('/'); // Redirect logged-in users to the home page or a different page
    }

    // If not logged in, render the registration page
    res.render('register', { customer: null, title: 'Register', message: null });
});


export default router;
