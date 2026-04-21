const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const players = {};
const projectiles = [];
let projIdCounter = 0;

// Game Config
const ARENA_SIZE = 1000;

io.on('connection', (socket) => {
    socket.on('joinGame', ({ username, character }) => {
        // Character Stats & Movesets
        let stats = { hp: 100, speed: 5, color: '#3b82f6' };
        if (character === 'Omni-Man') stats = { hp: 150, speed: 4.5, color: '#ef4444' };
        if (character === 'Atom Eve') stats = { hp: 90, speed: 5.5, color: '#ec4899' };

        players[socket.id] = {
            id: socket.id,
            username: username.substring(0, 10),
            character: character,
            x: Math.random() * ARENA_SIZE,
            y: Math.random() * ARENA_SIZE,
            angle: 0,
            hp: stats.hp,
            maxHp: stats.hp,
            speed: stats.speed,
            color: stats.color,
            isDead: false,
            score: 0
        };
        
        socket.emit('init', { id: socket.id, arenaSize: ARENA_SIZE });
    });

    // Player Movement (Client sends input, Server broadcasts position)
    socket.on('updatePosition', (data) => {
        if (players[socket.id] && !players[socket.id].isDead) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
        }
    });

    // M1 / Abilities Combat System
    socket.on('attack', (data) => {
        if (!players[socket.id] || players[socket.id].isDead) return;
        const attacker = players[socket.id];
        
        // Broadcast attack visual to others
        io.emit('attackVisual', { id: socket.id, type: data.type, x: data.x, y: data.y });

        if (data.type === 'projectile') {
            projectiles.push({
                id: projIdCounter++,
                ownerId: socket.id,
                x: data.x,
                y: data.y,
                vx: Math.cos(attacker.angle) * 15,
                vy: Math.sin(attacker.angle) * 15,
                life: 60, // frames
                damage: data.damage
            });
            return;
        }

        // Melee / AoE Hit Detection
        for (let targetId in players) {
            if (targetId !== socket.id && !players[targetId].isDead) {
                const target = players[targetId];
                const dist = Math.hypot(target.x - data.x, target.y - data.y);
                
                if (dist < data.range) {
                    target.hp -= data.damage;
                    
                    if (target.hp <= 0) {
                        target.hp = 0;
                        target.isDead = true;
                        attacker.score += 1;
                        
                        io.emit('killLog', `${attacker.username} killed ${target.username}`);
                        
                        // Respawn
                        setTimeout(() => {
                            if (players[targetId]) {
                                players[targetId].hp = players[targetId].maxHp;
                                players[targetId].x = Math.random() * ARENA_SIZE;
                                players[targetId].y = Math.random() * ARENA_SIZE;
                                players[targetId].isDead = false;
                            }
                        }, 3000);
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Server Game Loop (60 FPS tick)
setInterval(() => {
    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) {
            projectiles.splice(i, 1);
            continue;
        }

        // Projectile Collision
        for (let targetId in players) {
            if (targetId !== p.ownerId && !players[targetId].isDead) {
                let target = players[targetId];
                if (Math.hypot(target.x - p.x, target.y - p.y) < 30) {
                    target.hp -= p.damage;
                    projectiles.splice(i, 1);
                    break; // Hit someone, destroy projectile
                }
            }
        }
    }

    io.emit('gameState', { players, projectiles });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Battlegrounds Server running on port ${PORT}`);
});
