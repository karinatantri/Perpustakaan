const app = require('./app');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Backend API listening on http://${HOST}:${PORT} (akses LAN: http://<IP-PC>:${PORT})`);
});


