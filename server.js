const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let games = [];
let playerStats = {};

class Game {
  constructor() {
    this.grid = Array(10).fill(null).map(() => Array(10).fill(null));
    this.players = [];
    this.turnIndex = 0;
    this.roundIndex = 0;
  }

  addPlayer(playerId) {
    if (this.players.length < 4) {
      this.players.push({ id: playerId, monsters: [], removedMonsters: 0, win: 0, loss: 0 });
    }
  }

  getCurrentPlayer() {
    return this.players[this.turnIndex % this.players.length];
  }

  nextTurn() {
    this.turnIndex++;
    if (this.turnIndex % this.players.length === 0) {
      this.roundIndex++;
    }
  }

  placeMonster(playerId, monsterType, x, y) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.grid[x][y] || (x !== 0 && x !== 9 && y !== 0 && y !== 9)) return false;

    this.grid[x][y] = { type: monsterType, player: playerId, canMove: false };
    player.monsters.push({ type: monsterType, x, y });
    return true;
  }

  moveMonster(playerId, fromX, fromY, toX, toY) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !this.grid[fromX][fromY] || this.grid[toX][toY] || this.grid[fromX][fromY].player !== playerId || !this.grid[fromX][fromY].canMove) return false;

    if (Math.abs(toX - fromX) > 2 || Math.abs(toY - fromY) > 2) return false;
    if (Math.abs(toX - fromX) > 1 && Math.abs(toY - fromY) > 1) return false;

    const monster = this.grid[fromX][fromY];
    this.grid[fromX][fromY] = null;
    this.grid[toX][toY] = monster;
    monster.canMove = true;

    const existingMonster = player.monsters.find(m => m.x === fromX && m.y === fromY);
    existingMonster.x = toX;
    existingMonster.y = toY;

    return true;
  }

  resolveConflicts() {
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const cell = this.grid[x][y];
        if (!cell) continue;

        const conflictingCell = this.players
          .flatMap(player => player.monsters)
          .filter(monster => monster.x === x && monster.y === y && monster.player !== cell.player)
          .map(monster => this.grid[monster.x][monster.y]);

        if (conflictingCell.length > 0) {
          const conflictType = conflictingCell[0].type;
          if (conflictType === 'vampire' && cell.type === 'werewolf') this.grid[x][y] = null;
          else if (conflictType === 'werewolf' && cell.type === 'ghost') this.grid[x][y] = null;
          else if (conflictType === 'ghost' && cell.type === 'vampire') this.grid[x][y] = null;
          else if (conflictType === cell.type) this.grid[x][y] = null;
        }
      }
    }
  }

  checkWinCondition() {
    this.players.forEach(player => {
      if (player.removedMonsters >= 10) {
        player.loss++;
        this.players = this.players.filter(p => p.id !== player.id);
      }
    });

    if (this.players.length === 1) {
      const winner = this.players[0];
      winner.win++;
      return winner.id;
    }

    return null;
  }
}

io.on('connection', (socket) => {
  socket.on('joinGame', () => {
    let game = games.find(g => g.players.length < 4);
    if (!game) {
      game = new Game();
      games.push(game);
    }
    game.addPlayer(socket.id);

    playerStats[socket.id] = playerStats[socket.id] || { wins: 0, losses: 0 };

    socket.join(game);
    io.to(socket.id).emit('gameJoined', game);
  });

  socket.on('placeMonster', (monsterType, x, y) => {
    const game = games.find(g => g.players.some(p => p.id === socket.id));
    if (game) {
      if (game.placeMonster(socket.id, monsterType, x, y)) {
        io.to(socket.id).emit('updateGrid', game.grid);
        game.nextTurn();
        io.to(socket.id).emit('nextTurn', game.getCurrentPlayer().id);
        game.resolveConflicts();
        const winnerId = game.checkWinCondition();
        if (winnerId) {
          io.to(winnerId).emit('gameWon');
        }
      }
    }
  });

  socket.on('moveMonster', (fromX, fromY, toX, toY) => {
    const game = games.find(g => g.players.some(p => p.id === socket.id));
    if (game) {
      if (game.moveMonster(socket.id, fromX, fromY, toX, toY)) {
        io.to(socket.id).emit('updateGrid', game.grid);
        game.nextTurn();
        io.to(socket.id).emit('nextTurn', game.getCurrentPlayer().id);
        game.resolveConflicts();
        const winnerId = game.checkWinCondition();
        if (winnerId) {
          io.to(winnerId).emit('gameWon');
        }
      }
    }
  });

  socket.on('disconnect', () => {
    games.forEach(game => game.removePlayer(socket.id));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
