import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path"; 
import { fileURLToPath } from "url"; 
import indexRoutes from "./routes/index.js"; 
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import pool from './db/db.js';

dotenv.config();
import { authenticateToken } from './middleware/auth.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cookieParser());  
app.use(
    session({
      secret: process.env.SESSION_SECRET, 
      resave: false, 
      saveUninitialized: true, 
      cookie: { secure: process.env.NODE_ENV === 'production' },  
    })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const getCustomerInfo = async (req, res, next) => {
    try {
        let customer = null;
        const token = req.cookies['auth_token'];
        if (token) {
            try {
                const decodedToken = jwt.verify(token, process.env.SECRET_KEY); // Verify token
                const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [decodedToken.id]);
                customer = customerResult.rows[0];
            } catch (err) {
                if (err.name === 'TokenExpiredError') {
                    console.log('JWT verification failed: token expired');
                    res.clearCookie('auth_token'); // Clear expired token cookie
                    return res.redirect('/auth/login'); // Redirect to login
                }
                console.error('JWT verification failed:', err.message);
            }
        }
        req.customer = customer;
        next();
    } catch (error) {
        console.error('Error fetching customer info:', error.message);
        next();
    }
};

app.use(getCustomerInfo);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));


app.use("/", indexRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);


app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);  
    res.status(500).send(
        'Something went wrong and our team is currently addressing the issue, please try again later.'
    );
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;
