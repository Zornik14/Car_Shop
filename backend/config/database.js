const sql = require('mssql');

// MSSQL connection configuration using SQL Server Authentication
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 60000
    },
    connectionTimeout: 60000,
    requestTimeout: 60000
};

// Create connection pool
const dbPool = new sql.ConnectionPool(dbConfig);

// Connect to database when the app starts
dbPool.connect().then(() => {
    console.log('Database connected successfully');
}).catch(error => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
});

// Handle connection errors
dbPool.on('error', error => {
    console.error('Database pool error:', error);
});

// Helper function to execute queries with promises
const executeQuery = async (sqlQuery, params = {}) => {
    try {
        const pool = await dbPool;
        const request = pool.request();
        
        // Add parameters to request
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });
        
        const result = await request.query(sqlQuery);
        return result.recordset || [];
    } catch (error) {
        console.error('Database query error:', error.message);
        console.error('Query:', sqlQuery);
        console.error('Params:', params);
        throw error;
    }
};

module.exports = { 
    pool: dbPool, 
    query: executeQuery,
    sql
};