require('dotenv').config({ path: '.env.local' });
const { appendToGoogleSheet } = require('./lib/google-sheets');
// using ts-node to run the ts file directly
