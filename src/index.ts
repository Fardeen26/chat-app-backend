import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

let allSockets = new Map();

wss.on('connection', (socket) => {
    socket.on('message', (message) => {
        socket.send(message.toString())
    })
})