import http from 'node:http';
import handler from './api/index.js';

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(PORT, () => {
  console.log(`Render server listening on port ${PORT}`);
});
