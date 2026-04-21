const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Serve the 'public' folder where your index.html lives
app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    let currentPlayers = Object.keys(players).length;
    
    // Limit to 2 players
    if (currentPlayers >= 2) {
        socket.emit('serverFull');
        socket.disconnect();
        return;
    }

    // Assign Player 1 or Player 2 based on who is already in
    let isP1Taken = Object.values(players).some(p => p.playerNum === 1);
    let playerNum = isP1Taken ? 2 : 1;

    players[socket.id] = { id: socket.id, playerNum: playerNum };
    console.log(`Player ${playerNum} connected!`);
    
    // Tell the client which player they are
    socket.emit('init', playerNum);

    // Receive movement from one player, broadcast to the other
    socket.on('move', (data) => {
        socket.broadcast.emit('opponentMoved', data);
    });

    // Receive shooting event, broadcast to the other
    socket.on('shoot', (data) => {
        socket.broadcast.emit('opponentShot', data);
    });

    socket.on('disconnect', () => {
        console.log(`Player ${players[socket.id]?.playerNum} disconnected.`);
        delete players[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
