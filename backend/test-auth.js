const axios = require('axios');

// Ignore SSL certificate warnings
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testAuth() {
    try {
        console.log('Testing login...');
        const response = await axios.post('https://localhost:5000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        console.log('Login successful!');
        console.log('Response:', response.data);
        
        if (response.data.accessToken) {
            console.log('Access token received:', response.data.accessToken.substring(0, 20) + '...');
        }
    } catch (error) {
        console.error('Login failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAuth();