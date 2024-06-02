document.addEventListener('DOMContentLoaded', () => {
    const playerMonsters = ['vampire', 'werewolf', 'ghost'];
    let selectedMonster = null;
    let isPlacingMonster = false;
  
    document.getElementById('grid').addEventListener('click', (event) => {
      const cell = event.target;
      if (cell.classList.contains('cell')) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
  
        if (isPlacingMonster && selectedMonster) {
          socket.emit('placeMonster', selectedMonster, x, y);
          isPlacingMonster = false;
          selectedMonster = null;
        } else {
         
        }
      }
    });
  
    // Event listeners for selecting a monster to place
    playerMonsters.forEach(monster => {
      document.getElementById(monster).addEventListener('click', () => {
        selectedMonster = monster;
        isPlacingMonster = true;
      });
    });
  });
  