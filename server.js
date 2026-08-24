const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
