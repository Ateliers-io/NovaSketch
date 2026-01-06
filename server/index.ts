import { WebSocketServer } from 'ws';
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = 1234;
const wss = new WebSocketServer({ port: PORT });

console.log(`⚡ Bun Server ready on port ${PORT}`);

wss.on('connection', (ws, req) => {
  console.log('New client connected');
  
  // Basic YJS connection setup (Infrastructure)
  // Logic for rooms/auth should be added here by the team
  setupWSConnection(ws, req);
});