import express from 'express';
import pool from '../db/db.js';
import jwt from 'jsonwebtoken';
import moment from 'moment';  
import { authenticateToken } from '../middleware/auth.js';
import getCustomerInfo from '../app.js';
import calculateTotalAmount from '../js/utils.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log('Request received on / route');

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

        // Initialize customer and message variables
        const customer = req.customer || null;
        const message = req.query.message || null; // Default to null if no message is provided

        // Render the index.ejs template with all necessary data
        res.render('index', { 
            customer, 
            products, 
            title: 'Home', 
            homepageContent,
            message  // Pass message to the view
        });
        
    } catch (error) {
        console.error('Error fetching homepage content:', error.message);
        res.status(500).send('Internal Server Error');
    }
});




router.get('/about', async (req, res) => {
    let customer = null;
    const token = req.cookies['auth_token'];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [decoded.id]);
            customer = customerResult.rows[0];
        } catch (err) {
            console.error('JWT verification failed or customer not found:', err.message);
        }
    }

    res.render('about', { customer, title: 'About' });
});


router.get('/listings', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const itemsPerPage = 6;

       
        const offset = (page - 1) * itemsPerPage;

       
        const countResult = await pool.query('SELECT COUNT(*) FROM products');
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / itemsPerPage);

       
        const productsResult = await pool.query(`
            SELECT * FROM products 
            ORDER BY clicks DESC 
            LIMIT $1 OFFSET $2`, [itemsPerPage, offset]);

        const products = productsResult.rows.map(product => ({
            ...product,
            price: product.price !== null ? Number(product.price) : null,
            images: product.images || []
        }));

        
        const customer = req.customer || null;

        
        res.render('listings', { 
            products, 
            currentPage: page, 
            totalPages, 
            customer 
        });
    } catch (error) {
        console.error('Error fetching products for listings:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        product.reviews = product.reviews || [];
        const customer = req.customer;
        res.render('product', { customer, product });
    } catch (error) {
        console.error('Error fetching product details:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/cart', async (req, res) => {
    try {
        let cartItems = [];
        
        // Check if the customer is logged in
        if (req.customer) {
            // Fetch the cart items for the logged-in customer
            const cartResult = await pool.query('SELECT * FROM cart WHERE customer_id = $1', [req.customer.id]);
            cartItems = cartResult.rows;
        } else if (req.session.cart) {
            // For guests, cart items are stored in the session
            cartItems = req.session.cart;
        }

        // Render the cart page with cart items
        res.render('cart', { cartItems, customer: req.customer || null });
    } catch (error) {
        console.error('Error fetching cart details:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/cart/add', async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (req.customer) {
            // Logged-in user: save cart items to the database
            await pool.query(
                'INSERT INTO cart (customer_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = cart.quantity + $3',
                [req.customer.id, productId, quantity]
            );
        } else {
            // Guest user: store cart items in the session
            if (!req.session.cart) {
                req.session.cart = [];
            }

            const cartItem = req.session.cart.find(item => item.productId === productId);
            if (cartItem) {
                cartItem.quantity += quantity;
            } else {
                req.session.cart.push({ productId, quantity });
            }
        }

        res.json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Update quantity in cart
router.post('/cart/update', async (req, res) => {
    const { productId, change } = req.body;
    try {
        // If the user is logged in, update the cart in the database
        const customerId = req.customer ? req.customer.id : null;

        if (!customerId && !req.session.cart) {
            return res.status(400).json({ success: false, message: 'No active cart or customer session' });
        }

        // If the user is logged in, update the cart in the database
        if (customerId) {
            const cartItemResult = await pool.query('SELECT * FROM cart WHERE customer_id = $1 AND product_id = $2', [customerId, productId]);

            if (cartItemResult.rows.length > 0) {
                const currentQuantity = cartItemResult.rows[0].quantity;
                const newQuantity = currentQuantity + change;

                if (newQuantity <= 0) {
                    await pool.query('DELETE FROM cart WHERE customer_id = $1 AND product_id = $2', [customerId, productId]);
                } else {
                    await pool.query('UPDATE cart SET quantity = $1 WHERE customer_id = $2 AND product_id = $3', [newQuantity, customerId, productId]);
                }

                return res.json({ success: true, message: 'Cart updated successfully' });
            }
        }

        // If the user is not logged in (guest checkout), update the session cart
        if (!customerId) {
            const cartItem = req.session.cart.find(item => item.productId === productId);
            if (cartItem) {
                cartItem.quantity += change;
                if (cartItem.quantity <= 0) {
                    req.session.cart = req.session.cart.filter(item => item.productId !== productId);
                }
            }
            return res.json({ success: true, message: 'Session cart updated successfully' });
        }

    } catch (error) {
        console.error('Error updating cart:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


// Remove item from cart
router.post('/cart/remove', async (req, res) => {
    const { productId } = req.body;
    try {
        const customerId = req.customer ? req.customer.id : null;

        if (!customerId && !req.session.cart) {
            return res.status(400).json({ success: false, message: 'No active cart or customer session' });
        }

        // If the user is logged in, remove the item from the cart in the database
        if (customerId) {
            await pool.query('DELETE FROM cart WHERE customer_id = $1 AND product_id = $2', [customerId, productId]);
            return res.json({ success: true, message: 'Product removed from cart' });
        }

        // If the user is not logged in (guest checkout), remove from session cart
        if (!customerId) {
            req.session.cart = req.session.cart.filter(item => item.productId !== productId);
            return res.json({ success: true, message: 'Product removed from session cart' });
        }

    } catch (error) {
        console.error('Error removing product from cart:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

  // Route to display orders
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const customerId = req.customer.id;
        const ordersResult = await pool.query('SELECT * FROM orders WHERE customer_id = $1', [customerId]);
        const orders = ordersResult.rows;
        res.render('orders', { customer: req.customer, orders, title: 'Your Orders' });
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Profile route
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const customer = req.customer;

        // Ensure customer is defined
        if (!customer) {
            return res.status(400).send("No customer information found.");
        }

        // Render the profile page and pass the customer data
        res.render('profile', { customer, title: 'Your Profile' });
    } catch (error) {
        console.error('Error fetching profile:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/checkout', async (req, res) => {
    try {
        let cartItems = [];

        // Check if the customer is logged in
        if (req.customer) {
            // Fetch the cart items for the logged-in customer
            const cartResult = await pool.query('SELECT * FROM cart WHERE customer_id = $1', [req.customer.id]);
            cartItems = cartResult.rows;
        } else {
            // For guests, cart items are stored in the session
            if (!req.session.cart) {
                req.session.cart = []; // Initialize session cart if not exists
            }
            cartItems = req.session.cart;
        }

        // Render the checkout page with cart items
        res.render('checkout', { cartItems, customer: req.customer || null });
    } catch (error) {
        console.error('Error loading checkout page:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/checkout', async (req, res) => {
    try {
        const { fullName, email, address, city, paymentMethod } = req.body;
        let cartItems = [];

        if (req.customer) {
            const cartResult = await pool.query('SELECT * FROM cart WHERE customer_id = $1', [req.customer.id]);
            cartItems = cartResult.rows;
        } else {
            cartItems = req.session.cart || [];
        }

        if (cartItems.length === 0) {
            return res.status(400).send('Your cart is empty.');
        }

        const orderResult = await pool.query(
            `INSERT INTO orders (customer_id, full_name, email, address, city, payment_method, total_amount) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                req.customer ? req.customer.id : null,
                fullName,
                email,
                address,
                city,
                paymentMethod,
                calculateTotalAmount(cartItems)  // Use the imported function
            ]
        );

        const orderId = orderResult.rows[0].id;

        for (const item of cartItems) {
            await pool.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price) 
                 VALUES ($1, $2, $3, $4)`,
                [orderId, item.product_id, item.quantity, item.price]
            );
        }

        if (!req.customer) {
            req.session.cart = [];
        }

        res.render('checkoutSuccess', { orderId });
    } catch (error) {
        console.error('Error during checkout:', error.message);
        res.status(500).send('Internal Server Error');
    }
});



export default router;
