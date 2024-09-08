import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'postgres',  
    host: 'localhost',
    database: 'ecommerce',
    password: 'Rawad2004',  
    port: 5433, 
});

export default pool;
