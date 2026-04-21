const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Store active rooms and their players
const rooms = {};

io.on('connection', (socket) => {
    
    socket.on('joinRoom', ({ username, room, character }) => {
        const clients = io.sockets.adapter.rooms.get(room);
        const numClients = clients ? clients.size : 0;

        if (numClients >= 14) {
            socket.emit('roomError', 'ARENA IS FULL (14/14)');
            return;
        }

        socket.join(room);
        socket.data = { username, room, id: socket.id };

        if (!rooms[room]) rooms[room] = { players: {} };
        
        // Register the new player
        rooms[room].players[socket.id] = {
            id: socket.id,
            username: username.substring(0, 10),
            character: character,
            score: 0
        };
        
        console.log(`${username} joined arena ${room} as ${character}`);
        
        // Send the joining player their ID and current room state
        socket.emit('init', { id: socket.id, players: rooms[room].players });
        
        // Tell everyone else someone new arrived
        socket.to(room).emit('playerJoined', rooms[room].players[socket.id]);

        // Broadcast movements
        socket.on('move', (data) => {
            socket.to(room).emit('opponentMoved', { id: socket.id, ...data });
        });

        // Broadcast attacks/actions
        socket.on('action', (data) => {
            socket.to(room).emit('opponentAction', { id: socket.id, ...data });
        });

        // Handle kills for the leaderboard
        socket.on('scoredKill', (killerId) => {
            if (rooms[room] && rooms[room].players[killerId]) {
                rooms[room].players[killerId].score += 1;
                io.to(room).emit('updateLeaderboard', rooms[room].players);
            }
        });
    });

    socket.on('disconnect', () => {
        if (socket.data && socket.data.room) {
            console.log(`${socket.data.username} left arena ${socket.data.room}`);
            const room = socket.data.room;
            
            if (rooms[room]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('playerLeft', socket.id);
                io.to(room).emit('updateLeaderboard', rooms[room].players);
                
                // Cleanup empty rooms
                if (Object.keys(rooms[room].players).length === 0) {
                    delete rooms[room];
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
