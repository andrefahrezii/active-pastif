const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const winston = require('winston');
const expressWinston = require('express-winston');

const app = express();

// Aktifkan trust proxy
app.set('trust proxy', true);

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/combined.log' })
    ]
});

// Middleware untuk keamanan dasar
app.use(helmet());

// Middleware untuk rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // batas maksimum request per IP
    trustProxy: true, // Aktifkan trust proxy di express-rate-limit
    proxyIpHeader: 'X-Forwarded-For',
});
app.use(limiter);

// Middleware untuk parsing body request
app.use(bodyParser.json());

// Logger middleware
app.use(expressWinston.logger({
    winstonInstance: logger,
    statusLevels: true
}));

// Pool Koneksi untuk Database Master (untuk menulis)
const masterPool = mysql.createPool({
    host: process.env.MYSQL_HOST_DB1 || 'db1' || 'localhost:3306',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DB || 'mydatabase',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Pool Koneksi untuk Database Slave (untuk membaca)
const slavePool = mysql.createPool({
    host: process.env.MYSQL_HOST_DB2 || 'db2' || 'localhost:3307',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DB || 'mydatabase',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Tes Koneksi
async function testConnections() {
    try {
        const connection1 = await masterPool.getConnection();
        console.log('Connected to MySQL Master');
        connection1.release();

        const connection2 = await slavePool.getConnection();
        console.log('Connected to MySQL Slave');
        connection2.release();
    } catch (error) {
        console.error('Error connecting to MySQL databases:', error.message);
    }
}

testConnections();

// Create route
app.post('/api/create', async (req, res) => {
    const { name, email } = req.body;
    try {
        const [result] = await masterPool.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
        res.status(201).json({ id: result.insertId, name, email });
    } catch (error) {
        logger.error(`Error creating user: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await slavePool.query('SELECT * FROM users');
        res.status(200).json(rows);
    } catch (error) {
        logger.error(`Error fetching users: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(3000, () => {
    logger.info('Server running on port 3000');
});
