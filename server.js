const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room, character }) => {
        const clients = io.sockets.adapter.rooms.get(room);
        if (clients && clients.size >= 14) {
            socket.emit('roomError', 'ARENA IS FULL (14/14)');
            return;
        }

        socket.join(room);
        socket.data = { username, room, id: socket.id };

        if (!rooms[room]) rooms[room] = { players: {} };
        
        // Base stats based on character
        let maxHp = character === 'omniman' ? 150 : 100;

        rooms[room].players[socket.id] = {
            id: socket.id,
            username: username.substring(0, 10),
            character: character,
            score: 0,
            hp: maxHp,
            maxHp: maxHp,
            isDead: false
        };
        
        console.log(`${username} joined arena ${room} as ${character}`);
        socket.emit('init', { id: socket.id, players: rooms[room].players });
        socket.to(room).emit('playerJoined', rooms[room].players[socket.id]);

        // Sync movements
        socket.on('move', (data) => {
            socket.to(room).emit('opponentMoved', { id: socket.id, ...data });
        });

        // Sync Visual Actions/Attacks
        socket.on('action', (data) => {
            socket.to(room).emit('opponentAction', { id: socket.id, ...data });
        });

        // Handle Damage & Kills securely on the server
        socket.on('dealDamage', ({ targetId, amount, knockback }) => {
            const roomData = rooms[room];
            if (roomData && roomData.players[targetId] && !roomData.players[targetId].isDead) {
                
                roomData.players[targetId].hp -= amount;
                
                if (roomData.players[targetId].hp <= 0) {
                    // Player Died
                    roomData.players[targetId].hp = 0;
                    roomData.players[targetId].isDead = true;
                    
                    // Award kill to attacker
                    if (roomData.players[socket.id]) {
                        roomData.players[socket.id].score += 1;
                    }
                    
                    io.to(room).emit('playerDied', { victimId: targetId, killerId: socket.id });
                    io.to(room).emit('updateLeaderboard', roomData.players);

                    // Respawn after 3 seconds
                    setTimeout(() => {
                        if (rooms[room] && rooms[room].players[targetId]) {
                            rooms[room].players[targetId].hp = rooms[room].players[targetId].maxHp;
                            rooms[room].players[targetId].isDead = false;
                            io.to(room).emit('playerRespawned', targetId);
                        }
                    }, 3000);

                } else {
                    // Just damaged
                    io.to(room).emit('playerDamaged', { 
                        targetId, 
                        hp: roomData.players[targetId].hp,
                        attackerId: socket.id,
                        knockback
                    });
                }
            }
        });
    });

    socket.on('disconnect', () => {
        if (socket.data && socket.data.room) {
            const room = socket.data.room;
            if (rooms[room]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit('playerLeft', socket.id);
                io.to(room).emit('updateLeaderboard', rooms[room].players);
                if (Object.keys(rooms[room].players).length === 0) delete rooms[room];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
