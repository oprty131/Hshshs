const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

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
        
        rooms[room].players[socket.id] = {
            id: socket.id,
            username: username.substring(0, 12),
            character: character,
            score: 0
        };
        
        console.log(`${username} joined arena ${room} as ${character}`);
        
        socket.emit('init', { id: socket.id, players: rooms[room].players });
        socket.to(room).emit('playerJoined', rooms[room].players[socket.id]);

        socket.on('move', (data) => {
            socket.to(room).emit('opponentMoved', { id: socket.id, ...data });
        });

        socket.on('action', (data) => {
            socket.to(room).emit('opponentAction', { id: socket.id, ...data });
        });

        socket.on('dealDamage', (data) => {
            socket.to(room).emit('playerDamaged', data);
            
            // If the damage killed them, notify everyone and update leaderboard
            if (data.killed) {
                if (rooms[room] && rooms[room].players[socket.id]) {
                    rooms[room].players[socket.id].score += 1;
                    io.to(room).emit('playerDied', { victimId: data.targetId, killerId: socket.id });
                    io.to(room).emit('updateLeaderboard', rooms[room].players);
                }
            }
        });

        socket.on('respawn', () => {
            io.to(room).emit('playerRespawned', socket.id);
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
