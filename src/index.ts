import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface User {
    id: string;
    socket: WebSocket;
    room: string | null;
}

interface Room {
    id: string;
    users: User[];
}

const rooms: Room[] = [];
const users: User[] = [];

wss.on('connection', (socket: WebSocket) => {
    const user: User = { id: uuidv4(), socket, room: null };
    users.push(user);
    console.log(`User connected: ${user.id}`);

    socket.on('message', (message: string) => {
        const data = JSON.parse(message);
        console.log(`Received message from ${user.id}:`, data);

        switch (data.type) {
            case 'create':
                createRoom(user);
                break;
            case 'join':
                joinRoom(user, data.payload.roomId);
                break;
            case 'chat':
                sendMessage(user, data.payload.message);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    });

    socket.on('close', () => {
        console.log(`User disconnected: ${user.id}`);
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) {
            users.splice(index, 1);
        }
        if (user.room) {
            leaveRoom(user);
        }
    });
});

function createRoom(user: User) {
    const roomId = generateRoomCode();
    const room: Room = { id: roomId, users: [user] };
    rooms.push(room);
    user.room = roomId;
    console.log(`Room created: ${roomId} by user ${user.id}`);
    user.socket.send(JSON.stringify({ type: 'roomCreated', payload: { roomId } }));
}

function joinRoom(user: User, roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
        room.users.push(user);
        user.room = roomId;
        console.log(`User ${user.id} joined room ${roomId}`);
        user.socket.send(JSON.stringify({ type: 'roomJoined', payload: { roomId } }));
        broadcastToRoom(room, { type: 'userJoined', payload: { userId: user.id } });
    } else {
        console.log(`Room not found: ${roomId}`);
        user.socket.send(JSON.stringify({ type: 'error', payload: { message: 'Room not found' } }));
    }
}

function leaveRoom(user: User) {
    if (!user.room) return;

    const room = rooms.find(r => r.id === user.room);
    if (room) {
        const index = room.users.findIndex(u => u.id === user.id);
        if (index !== -1) {
            room.users.splice(index, 1);
        }
        console.log(`User ${user.id} left room ${room.id}`);
        broadcastToRoom(room, { type: 'userLeft', payload: { userId: user.id } });

        if (room.users.length === 0) {
            const roomIndex = rooms.findIndex(r => r.id === room.id);
            if (roomIndex !== -1) {
                rooms.splice(roomIndex, 1);
                console.log(`Room ${room.id} deleted (no users left)`);
            }
        }
    }
    user.room = null;
}

function sendMessage(user: User, message: string) {
    if (!user.room) return;

    const room = rooms.find(r => r.id === user.room);
    if (room) {
        console.log(`Message sent in room ${room.id} by user ${user.id}: ${message}`);
        broadcastToRoom(room, {
            type: 'chat',
            payload: {
                userId: user.id,
                message: message
            }
        });
    }
}

function broadcastToRoom(room: Room, message: any) {
    console.log(`Broadcasting to room ${room.id}:`, message);
    room.users.forEach(user => {
        user.socket.send(JSON.stringify(message));
    });
}

function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});