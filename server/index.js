// server/index.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from backend' });
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
