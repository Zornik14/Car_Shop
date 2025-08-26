// Using connection pool for better performance

const sql = require('mssql');

// MSSQL connection configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Set to true if using Azure
        trustServerCertificate: true // For development with self-signed certificates
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 60000
    }
};

// Create connection pool
const dbPool = new sql.ConnectionPool(dbConfig);

// Connect to database when the app starts
dbPool.connect().then(pool => {
    if (pool.connecting) {
        console.log('Connecting to MSSQL database...');
    }
    if (pool.connected) {
        console.log('Database connected successfully');
    }
}).catch(error => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
});

// Handle connection errors
dbPool.on('error', error => {
    console.error('Database pool error:', error);
});

// Helper function to execute queries with promises
// This makes it easier to use async/await instead of callbacks
const executeQuery = async (sqlQuery, params = {}) => {
    try {
        const pool = await dbPool;
        const request = pool.request();
        
        // Add parameters to request
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });
        
        const result = await request.query(sqlQuery);
        return result.recordset;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Helper function for prepared statements (prevents SQL injection)
const executePreparedQuery = async (sqlQuery, inputs = {}, params = {}) => {
    try {
        const pool = await dbPool;
        const ps = new sql.PreparedStatement(pool);
        
        // Define input parameters
        Object.keys(inputs).forEach(key => {
            ps.input(key, inputs[key]);
        });
        
        await ps.prepare(sqlQuery);
        const result = await ps.execute(params);
        await ps.unprepare();
        
        return result.recordset;
    } catch (error) {
        console.error('Prepared query error:', error);
        throw error;
    }
};

module.exports = { 
    pool: dbPool, 
    query: executeQuery,
    preparedQuery: executePreparedQuery,
    sql // Export sql types for parameter definitions
};