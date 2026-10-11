const serverless = require('serverless-http');
const app = require('../../backend/src/app');

module.exports.handler = serverless(app);
