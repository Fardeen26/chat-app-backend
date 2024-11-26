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

    socket.on('message', (message: string) => {
        const data = JSON.parse(message);

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
    user.socket.send(JSON.stringify({ type: 'roomCreated', payload: { roomId } }));
}

function joinRoom(user: User, roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
        if (!room.users.some(u => u.id === user.id)) {
            room.users.push(user);
        }
        user.room = roomId;
        user.socket.send(JSON.stringify({ type: 'roomJoined', payload: { roomId } }));
        broadcastToRoom(room, { type: 'userJoined', payload: { userId: user.id } });
    } else {
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
        broadcastToRoom(room, { type: 'userLeft', payload: { userId: user.id } });

        if (room.users.length === 0) {
            const roomIndex = rooms.findIndex(r => r.id === room.id);
            if (roomIndex !== -1) {
                rooms.splice(roomIndex, 1);
            }
        }
    }
    user.room = null;
}

function sendMessage(user: User, message: string) {
    if (!user.room) return;

    const room = rooms.find(r => r.id === user.room);
    if (room) {
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
    room.users.forEach(user => {
        console.log(user.id)
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