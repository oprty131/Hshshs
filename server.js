const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    
    socket.on('joinRoom', ({ username, room }) => {
        // Check how many people are already in this specific room
        const clients = io.sockets.adapter.rooms.get(room);
        const numClients = clients ? clients.size : 0;

        if (numClients >= 2) {
            socket.emit('roomError', 'ROOM IS FULL');
            return;
        }

        // Join the room and assign player 1 or 2
        socket.join(room);
        const playerNum = numClients === 0 ? 1 : 2;
        socket.data = { username, room, playerNum };
        
        console.log(`${username} joined room ${room} as Player ${playerNum}`);
        
        // Tell the player who they are
        socket.emit('init', playerNum);

        // If player 2 joins, tell both players the game can start
        if (playerNum === 2) {
            io.to(room).emit('gameReady');
        }

        // Bounce data ONLY to the other person in the same room
        socket.on('move', (data) => {
            socket.to(room).emit('opponentMoved', data);
        });

        socket.on('shoot', (data) => {
            socket.to(room).emit('opponentShot', data);
        });
    });

    socket.on('disconnect', () => {
        if (socket.data && socket.data.room) {
            console.log(`${socket.data.username} left room ${socket.data.room}`);
            // Tell the other player their opponent left
            socket.to(socket.data.room).emit('opponentLeft');
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
