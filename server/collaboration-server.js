#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

class CollaborationServer {
    constructor() {
        this.clients = new Map();
        this.tasks = new Map();
        this.rooms = new Map(); // Support for different project rooms
        this.setupServer();
    }

    setupServer() {
        // Create HTTP server with health check endpoint
        const server = http.createServer((req, res) => {
            const pathname = url.parse(req.url).pathname;
            
            if (pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'healthy',
                    connectedClients: this.clients.size,
                    totalTasks: this.tasks.size,
                    rooms: this.rooms.size,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }));
                return;
            }
            
            if (pathname === '/stats') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.getDetailedStats()));
                return;
            }
            
            // Default response
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Collaborative Todo List WebSocket Server\\nUse WebSocket connection for real-time collaboration.\\n\\nEndpoints:\\n/health - Health check\\n/stats - Detailed statistics');
        });
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
            server,
            verifyClient: (info) => {
                return true;
            }
        });
        
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const clientIp = req.socket.remoteAddress;
            
            console.log(`[${new Date().toISOString()}] New client connected: ${clientId} from ${clientIp}`);
            
            ws.on('message', (data) => {
                try {
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error handling message:`, error);
                    this.sendError(ws, 'Invalid message format');
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });
            
            ws.on('error', (error) => {
                console.error(`[${new Date().toISOString()}] WebSocket error for client ${clientId}:`, error);
                this.handleDisconnect(ws);
            });
            
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            
            // Store client info
            ws.clientId = clientId;
            ws.isAlive = true;
            ws.connectedAt = new Date();
        });
        
        // Setup heartbeat to detect broken connections
        this.setupHeartbeat();
        
        const PORT = process.env.PORT || 3001;
        const HOST = process.env.HOST || '0.0.0.0';
        
        server.listen(PORT, HOST, () => {
            console.log(`[${new Date().toISOString()}] Collaboration server running on ${HOST}:${PORT}`);
            console.log(`WebSocket URL: ws://${HOST}:${PORT}`);
            console.log(`Health check: http://${HOST}:${PORT}/health`);
            console.log(`Statistics: http://${HOST}:${PORT}/stats`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    setupHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    console.log(`[${new Date().toISOString()}] Terminating dead connection: ${ws.clientId}`);
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // Check every 30 seconds
    }

    handleMessage(ws, data) {
        const message = JSON.parse(data);
        const timestamp = new Date().toISOString();
        
        console.log(`[${timestamp}] Received message from ${ws.clientId}:`, message.type);
        
        switch (message.type) {
            case 'CONNECT':
                this.handleConnect(ws, message);
                break;
                
            case 'JOIN_ROOM':
                this.handleJoinRoom(ws, message);
                break;
                
            case 'TASK_UPDATE':
                this.handleTaskUpdate(ws, message);
                break;
                
            case 'GET_TASKS':
                this.handleGetTasks(ws, message);
                break;
                
            case 'PING':
                this.sendToClient(ws, { type: 'PONG', timestamp: new Date() });
                break;
                
            default:
                console.warn(`[${timestamp}] Unknown message type: ${message.type}`);
                this.sendError(ws, `Unknown message type: ${message.type}`);
        }
    }

    handleConnect(ws, message) {
        const username = message.username || 'Unknown User';
        const room = message.room || 'default';
        
        this.clients.set(ws, {
            id: ws.clientId,
            username: username,
            room: room,
            connectedAt: ws.connectedAt
        });
        
        // Add to room
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room).add(ws);
        
        console.log(`[${new Date().toISOString()}] User ${username} connected to room ${room} (${ws.clientId})`);
        
        // Notify other clients in the same room
        this.broadcastToRoom(room, {
            type: 'USER_JOINED',
            username: username,
            room: room,
            timestamp: new Date()
        }, ws);
        
        // Send current tasks to the new client
        this.sendToClient(ws, {
            type: 'INITIAL_TASKS',
            tasks: this.getTasksForRoom(room),
            room: room,
            timestamp: new Date()
        });
        
        // Send welcome message
        this.sendToClient(ws, {
            type: 'CONNECTED',
            clientId: ws.clientId,
            room: room,
            connectedUsers: this.getUsersInRoom(room),
            timestamp: new Date()
        });
    }

    handleJoinRoom(ws, message) {
        const client = this.clients.get(ws);
        if (!client) return;
        
        const oldRoom = client.room;
        const newRoom = message.room || 'default';
        
        // Remove from old room
        if (this.rooms.has(oldRoom)) {
            this.rooms.get(oldRoom).delete(ws);
            this.broadcastToRoom(oldRoom, {
                type: 'USER_LEFT',
                username: client.username,
                room: oldRoom,
                timestamp: new Date()
            }, ws);
        }
        
        // Add to new room
        client.room = newRoom;
        if (!this.rooms.has(newRoom)) {
            this.rooms.set(newRoom, new Set());
        }
        this.rooms.get(newRoom).add(ws);
        
        console.log(`[${new Date().toISOString()}] User ${client.username} moved from ${oldRoom} to ${newRoom}`);
        
        // Notify new room
        this.broadcastToRoom(newRoom, {
            type: 'USER_JOINED',
            username: client.username,
            room: newRoom,
            timestamp: new Date()
        }, ws);
        
        // Send tasks for new room
        this.sendToClient(ws, {
            type: 'ROOM_TASKS',
            tasks: this.getTasksForRoom(newRoom),
            room: newRoom,
            timestamp: new Date()
        });
    }

    handleTaskUpdate(ws, message) {
        const client = this.clients.get(ws);
        if (!client) {
            this.sendError(ws, 'Client not registered');
            return;
        }
        
        const task = message.task;
        const room = client.room;
        const taskKey = `${room}:${task.id}`;
        
        switch (message.updateType) {
            case 'CREATE':
            case 'UPDATE':
                task.room = room; // Ensure task belongs to the correct room
                this.tasks.set(taskKey, task);
                break;
                
            case 'DELETE':
                this.tasks.delete(taskKey);
                break;
        }
        
        console.log(`[${new Date().toISOString()}] Task ${message.updateType.toLowerCase()}d by ${client.username} in room ${room}: ${task.title}`);
        
        // Broadcast to all other clients in the same room
        this.broadcastToRoom(room, {
            type: 'TASK_UPDATE',
            updateType: message.updateType,
            task: task,
            updatedBy: client.username,
            room: room,
            timestamp: new Date()
        }, ws);
    }

    handleGetTasks(ws, message) {
        const client = this.clients.get(ws);
        if (!client) return;
        
        const room = message.room || client.room;
        
        this.sendToClient(ws, {
            type: 'TASKS_LIST',
            tasks: this.getTasksForRoom(room),
            room: room,
            timestamp: new Date()
        });
    }

    handleDisconnect(ws) {
        const client = this.clients.get(ws);
        if (client) {
            console.log(`[${new Date().toISOString()}] User ${client.username} disconnected from room ${client.room} (${ws.clientId})`);
            
            // Remove from room
            if (this.rooms.has(client.room)) {
                this.rooms.get(client.room).delete(ws);
                
                // Notify other clients in the room
                this.broadcastToRoom(client.room, {
                    type: 'USER_LEFT',
                    username: client.username,
                    room: client.room,
                    timestamp: new Date()
                }, ws);
                
                // Clean up empty rooms
                if (this.rooms.get(client.room).size === 0) {
                    this.rooms.delete(client.room);
                    console.log(`[${new Date().toISOString()}] Room ${client.room} deleted (empty)`);
                }
            }
            
            this.clients.delete(ws);
        }
    }

    broadcastToRoom(room, message, excludeClient = null) {
        if (!this.rooms.has(room)) return;
        
        const messageStr = JSON.stringify(message);
        
        this.rooms.get(room).forEach((ws) => {
            if (ws !== excludeClient && ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, errorMessage) {
        this.sendToClient(ws, {
            type: 'ERROR',
            message: errorMessage,
            timestamp: new Date()
        });
    }

    getTasksForRoom(room) {
        const roomTasks = [];
        for (const [key, task] of this.tasks.entries()) {
            if (key.startsWith(`${room}:`)) {
                roomTasks.push(task);
            }
        }
        return roomTasks;
    }

    getUsersInRoom(room) {
        if (!this.rooms.has(room)) return [];
        
        const users = [];
        this.rooms.get(room).forEach((ws) => {
            const client = this.clients.get(ws);
            if (client) {
                users.push({
                    username: client.username,
                    connectedAt: client.connectedAt
                });
            }
        });
        return users;
    }

    generateClientId() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    getDetailedStats() {
        const roomStats = {};
        for (const [room, clients] of this.rooms.entries()) {
            roomStats[room] = {
                connectedUsers: clients.size,
                tasks: this.getTasksForRoom(room).length,
                users: this.getUsersInRoom(room)
            };
        }

        return {
            server: {
                status: 'running',
                uptime: process.uptime(),
                startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
                currentTime: new Date().toISOString()
            },
            totals: {
                connectedClients: this.clients.size,
                totalTasks: this.tasks.size,
                activeRooms: this.rooms.size
            },
            rooms: roomStats,
            memory: process.memoryUsage()
        };
    }

    shutdown() {
        console.log(`[${new Date().toISOString()}] Shutting down collaboration server...`);
        
        // Notify all clients
        this.wss.clients.forEach((ws) => {
            this.sendToClient(ws, {
                type: 'SERVER_SHUTDOWN',
                message: 'Server is shutting down',
                timestamp: new Date()
            });
            ws.close();
        });
        
        // Close server
        this.wss.close(() => {
            console.log(`[${new Date().toISOString()}] WebSocket server closed`);
            process.exit(0);
        });
    }
}

// Start the server
const server = new CollaborationServer();

// Export for testing
module.exports = CollaborationServer;
