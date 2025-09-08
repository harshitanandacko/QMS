// Minimal server test - no database operations
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal server running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Minimal server running on port ${port}`);
});

// Test if we can get this far
setTimeout(() => {
  console.log('✅ Server is stable after 3 seconds');
}, 3000);