require('dotenv').config();
const app = require('./app');
require('./jobs/scheduleBackup');

const PORT = process.env.PORT || 4000;

// NOTE: In production this process should sit behind a reverse proxy
// (nginx/Caddy) that terminates TLS, so ALL traffic reaching the browser
// is HTTPS. The Node process itself can run plain HTTP internally.
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
