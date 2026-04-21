const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Initialize the Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time communication
const io = new Server(server);

// Serve your static files (like your index.html, css, and client-side js)
// Put your index.html in a folder called "public"
app.use(express.static('public'));

// Game State: Store all connected players
const players = {};

// Listen for connections from clients (browsers)
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create a new player profile when they join
    players[socket.id] = {
        id: socket.id,
        x: 0, // Starting X position
        y: 0, // Starting Y position
        character: 'Invincible', // Default character
        health: 100
    };

    // Send the new player the current state of all players
    socket.emit('currentPlayers', players);

    // Tell everyone else that a new player has joined
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle player movement input from the client
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            
            // Broadcast the new position to all OTHER players
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle player disconnecting
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Remove player from game state
        delete players[socket.id];
        
        // Tell everyone else this player left so they disappear from the screen
        io.emit('playerDisconnected', socket.id);
    });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Battlegrounds Server running on http://localhost:${PORT}`);
});
