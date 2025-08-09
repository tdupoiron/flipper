// Configuration du jeu
const GAME_CONFIG = {
    width: 600,
    height: 800,
    gravity: 0.3, // Réduit pour que la balle aille plus haut
    friction: 0.99, // Augmenté pour ralentir la balle
    ballRadius: 8,
    flipperLength: 80,
    flipperWidth: 8,
    bumperRadius: 30,
    maxLaunchPower: 1.5,
    minLaunchPower: 0.3,
    chargeRate: 0.002, // Vitesse de charge de la puissance
    colors: {
        primary: '#00ff00',    // Vert
        secondary: '#ff4444',  // Rouge
        ball: '#ffffff',
        flipper: '#00ff00',
        bumper: '#ff4444',
        wall: '#00ff00'
    }
};

// Variables globales du jeu
let canvas, ctx;
let gameState = {
    isPlaying: false,
    isPaused: false,
    currentPlayer: 1,
    scores: [0, 0],
    lives: [3, 3],
    ball: null,
    flippers: [],
    bumpers: [],
    walls: [],
    keys: {},
    lastTime: 0,
    launchPower: 0,
    isCharging: false,
    chargeStartTime: 0
};

// Classe Ball
class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = GAME_CONFIG.ballRadius;
        this.trail = [];
        this.isLaunched = false; // Nouvelle propriété pour savoir si la balle a été lancée
    }

    update() {
        // N'appliquer la physique que si la balle a été lancée
        if (!this.isLaunched) {
            return;
        }
        
        // Appliquer la gravité
        this.vy += GAME_CONFIG.gravity;
        
        // Appliquer la friction
        this.vx *= GAME_CONFIG.friction;
        this.vy *= 0.999;
        
        // Mettre à jour la position
        this.x += this.vx;
        this.y += this.vy;
        
        // Ajouter à la traînée
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
        
        // Vérifier les collisions avec les murs
        this.checkWallCollisions();
        
        // Vérifier les collisions avec les bumpers
        this.checkBumperCollisions();
        
        // Vérifier les collisions avec les flippers
        this.checkFlipperCollisions();
        
        // Vérifier si la balle est sortie
        if (this.y > GAME_CONFIG.height + 50) {
            this.handleBallLost();
        }
    }

    checkWallCollisions() {
        // Murs latéraux
        if (this.x - this.radius <= 0) {
            this.x = this.radius;
            this.vx = -this.vx * 0.8;
        }
        if (this.x + this.radius >= GAME_CONFIG.width) {
            this.x = GAME_CONFIG.width - this.radius;
            this.vx = -this.vx * 0.8;
        }
        
        // Mur du haut
        if (this.y - this.radius <= 0) {
            this.y = this.radius;
            this.vy = -this.vy * 0.8;
        }
        
        // Collision avec le séparateur central entre les flippers
        if (this.y + this.radius >= GAME_CONFIG.height - 40 && 
            this.y - this.radius <= GAME_CONFIG.height &&
            this.x >= GAME_CONFIG.width * 0.5 - 20 && 
            this.x <= GAME_CONFIG.width * 0.5 + 20) {
            if (this.vy > 0) {
                this.y = GAME_CONFIG.height - 40 - this.radius;
                this.vy = -this.vy * 0.6;
            }
        }
    }

    checkBumperCollisions() {
        gameState.bumpers.forEach(bumper => {
            const dx = this.x - bumper.x;
            const dy = this.y - bumper.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.radius + bumper.radius) {
                // Collision détectée
                const angle = Math.atan2(dy, dx);
                const force = 8;
                
                this.vx = Math.cos(angle) * force;
                this.vy = Math.sin(angle) * force;
                
                // Séparer la balle du bumper
                const overlap = this.radius + bumper.radius - distance;
                this.x += Math.cos(angle) * overlap;
                this.y += Math.sin(angle) * overlap;
                
                // Ajouter des points
                addScore(100);
                bumper.hit();
            }
        });
    }

    checkFlipperCollisions() {
        gameState.flippers.forEach(flipper => {
            if (flipper.checkCollision(this)) {
                flipper.bounce(this);
                addScore(10);
            }
        });
    }

    handleBallLost() {
        gameState.lives[gameState.currentPlayer - 1]--;
        updateUI();
        
        if (gameState.lives[gameState.currentPlayer - 1] <= 0) {
            // Joueur éliminé, passer au suivant ou fin de partie
            if (gameState.currentPlayer === 1 && gameState.lives[1] > 0) {
                gameState.currentPlayer = 2;
                this.reset();
            } else if (gameState.currentPlayer === 2 && gameState.lives[0] > 0) {
                gameState.currentPlayer = 1;
                this.reset();
            } else {
                // Fin de partie
                endGame();
                return;
            }
        } else {
            this.reset();
        }
    }

    reset() {
        this.x = GAME_CONFIG.width - 50;
        this.y = GAME_CONFIG.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.trail = [];
        this.isLaunched = false;
        // Réinitialiser l'état de charge
        gameState.launchPower = 0;
        gameState.isCharging = false;
    }

    launch(power = null) {
        if (!this.isLaunched) {
            const launchPower = power || 1;
            this.vx = (-1 + Math.random() * 2) * launchPower;
            this.vy = (-25 - Math.random() * 10) * launchPower; // Plus haut
            this.isLaunched = true;
        }
    }

    draw() {
        // Dessiner la traînée seulement si la balle a été lancée
        if (this.isLaunched) {
            ctx.strokeStyle = GAME_CONFIG.colors.ball;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 1; i < this.trail.length; i++) {
                ctx.globalAlpha = i / this.trail.length * 0.5;
                ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        
        // Dessiner la balle
        ctx.fillStyle = this.isLaunched ? GAME_CONFIG.colors.ball : '#ffff00'; // Jaune si pas encore lancée
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Effet de brillance
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y - 2, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Indicateur visuel si la balle n'est pas encore lancée
        if (!this.isLaunched) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]); // Remettre les lignes pleines
        }
    }
}

// Classe Flipper
class Flipper {
    constructor(x, y, side) {
        this.x = x;
        this.y = y;
        this.side = side; // 'left' ou 'right'
        // Angles plus réalistes pour un vrai flipper
        // Le flipper gauche pointe vers la droite, le flipper droit pointe vers la gauche
        this.angle = side === 'left' ? -0.5 : -2.6;  // Flipper droit orienté vers la gauche
        this.restAngle = this.angle;
        this.activeAngle = side === 'left' ? 0.2 : -3.3;  // Flipper droit se lève vers la gauche
        this.length = GAME_CONFIG.flipperLength;
        this.width = GAME_CONFIG.flipperWidth;
        this.isActive = false;
        this.speed = 0;
    }

    update() {
        const targetAngle = this.isActive ? this.activeAngle : this.restAngle;
        const diff = targetAngle - this.angle;
        this.speed = diff * 0.3;
        this.angle += this.speed;
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }

    checkCollision(ball) {
        const endX = this.x + Math.cos(this.angle) * this.length;
        const endY = this.y + Math.sin(this.angle) * this.length;
        
        // Distance point-ligne
        const A = ball.x - this.x;
        const B = ball.y - this.y;
        const C = endX - this.x;
        const D = endY - this.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = dot / lenSq;
        
        param = Math.max(0, Math.min(1, param));
        
        const closestX = this.x + param * C;
        const closestY = this.y + param * D;
        
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < ball.radius + this.width;
    }

    bounce(ball) {
        const force = Math.abs(this.speed) * 25 + 8;  // Force augmentée pour un meilleur gameplay
        // Angle de rebond amélioré pour un flipper réaliste
        const bounceAngle = this.side === 'left' ? 
            this.angle - Math.PI/3 :      // Rebond vers le haut et vers l'extérieur pour le flipper gauche
            this.angle + Math.PI/3 + Math.PI;   // Rebond vers le haut et vers l'extérieur pour le flipper droit (ajustement pour l'orientation)
        
        ball.vx = Math.cos(bounceAngle) * force;
        ball.vy = Math.sin(bounceAngle) * force;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Corps du flipper
        ctx.fillStyle = GAME_CONFIG.colors.flipper;
        ctx.fillRect(0, -this.width/2, this.length, this.width);
        
        // Effet de brillance
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, -this.width/4, this.length * 0.8, this.width/2);
        
        ctx.restore();
        
        // Pivot
        ctx.fillStyle = GAME_CONFIG.colors.flipper;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Classe Bumper
class Bumper {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = GAME_CONFIG.bumperRadius;
        this.hitTime = 0;
        this.baseRadius = this.radius;
    }

    hit() {
        this.hitTime = Date.now();
        this.radius = this.baseRadius * 1.2;
    }

    update() {
        if (this.hitTime > 0 && Date.now() - this.hitTime > 200) {
            this.radius = this.baseRadius;
            this.hitTime = 0;
        }
    }

    draw() {
        const isHit = this.hitTime > 0;
        
        // Corps du bumper
        ctx.fillStyle = isHit ? '#ff6666' : GAME_CONFIG.colors.bumper;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Bordure
        ctx.strokeStyle = GAME_CONFIG.colors.primary;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Effet de brillance
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x - 8, this.y - 8, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Effet de pulsation quand touché
        if (isHit) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Fonctions de gestion du jeu
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Ajuster la taille du canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = GAME_CONFIG.width;
    canvas.height = GAME_CONFIG.height;
    
    setupGameObjects();
    setupEventListeners();
    loadHighScores();
    gameLoop();
}

function setupGameObjects() {
    // Créer la balle
    gameState.ball = new Ball(GAME_CONFIG.width - 50, GAME_CONFIG.height - 100);
    
    // Créer les flippers avec positions réalistes de flipper
    gameState.flippers = [
        new Flipper(GAME_CONFIG.width * 0.35, GAME_CONFIG.height - 60, 'left'),   // Plus à gauche et plus bas
        new Flipper(GAME_CONFIG.width * 0.65, GAME_CONFIG.height - 60, 'right')   // Plus à droite et plus bas
    ];
    
    // Créer les bumpers
    gameState.bumpers = [
        new Bumper(150, 200),
        new Bumper(300, 150),
        new Bumper(450, 200),
        new Bumper(200, 300),
        new Bumper(400, 320)
    ];
}

function setupEventListeners() {
    // Événements clavier
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Boutons
    document.getElementById('launchBtn').addEventListener('mousedown', () => {
        if (!gameState.ball.isLaunched && !gameState.isCharging) {
            gameState.isCharging = true;
            gameState.chargeStartTime = Date.now();
            gameState.launchPower = GAME_CONFIG.minLaunchPower;
        }
    });
    document.getElementById('launchBtn').addEventListener('mouseup', () => {
        if (gameState.isCharging && !gameState.ball.isLaunched) {
            gameState.ball.launch(gameState.launchPower);
            gameState.isCharging = false;
            gameState.launchPower = 0;
        }
    });
    document.getElementById('leftFlipperBtn').addEventListener('mousedown', () => gameState.flippers[0].activate());
    document.getElementById('leftFlipperBtn').addEventListener('mouseup', () => gameState.flippers[0].deactivate());
    document.getElementById('rightFlipperBtn').addEventListener('mousedown', () => gameState.flippers[1].activate());
    document.getElementById('rightFlipperBtn').addEventListener('mouseup', () => gameState.flippers[1].deactivate());
    
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('clearScores').addEventListener('click', clearHighScores);
    
    // Empêcher le défilement avec les flèches
    window.addEventListener('keydown', (e) => {
        if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code) > -1) {
            e.preventDefault();
        }
    }, false);
}

function handleKeyDown(e) {
    gameState.keys[e.code] = true;
    
    switch(e.code) {
        case 'Space':
            if (!gameState.ball.isLaunched && !gameState.isCharging) {
                gameState.isCharging = true;
                gameState.chargeStartTime = Date.now();
                gameState.launchPower = GAME_CONFIG.minLaunchPower;
            }
            break;
        case 'ArrowLeft':
            gameState.flippers[0].activate();
            break;
        case 'ArrowRight':
            gameState.flippers[1].activate();
            break;
        case 'KeyR':
            restartGame();
            break;
        case 'KeyP':
            togglePause();
            break;
    }
}

function handleKeyUp(e) {
    gameState.keys[e.code] = false;
    
    switch(e.code) {
        case 'Space':
            if (gameState.isCharging && !gameState.ball.isLaunched) {
                gameState.ball.launch(gameState.launchPower);
                gameState.isCharging = false;
                gameState.launchPower = 0;
            }
            break;
        case 'ArrowLeft':
            gameState.flippers[0].deactivate();
            break;
        case 'ArrowRight':
            gameState.flippers[1].deactivate();
            break;
    }
}

function gameLoop(currentTime) {
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    
    if (!gameState.isPaused && gameState.isPlaying) {
        update();
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Mise à jour de la puissance de lancement si en cours de charge
    if (gameState.isCharging && !gameState.ball.isLaunched) {
        const chargeTime = Date.now() - gameState.chargeStartTime;
        gameState.launchPower = Math.min(
            GAME_CONFIG.maxLaunchPower,
            GAME_CONFIG.minLaunchPower + (chargeTime * GAME_CONFIG.chargeRate)
        );
    }
    
    gameState.ball.update();
    gameState.flippers.forEach(flipper => flipper.update());
    gameState.bumpers.forEach(bumper => bumper.update());
}

function draw() {
    // Effacer le canvas
    ctx.fillStyle = 'rgba(0, 26, 0, 0.1)';
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    
    // Dessiner le terrain
    drawField();
    
    // Dessiner les objets du jeu
    gameState.bumpers.forEach(bumper => bumper.draw());
    gameState.flippers.forEach(flipper => flipper.draw());
    gameState.ball.draw();
    
    // Dessiner l'interface
    drawUI();
}

function drawField() {
    // Bordures du terrain
    ctx.strokeStyle = GAME_CONFIG.colors.wall;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(GAME_CONFIG.width, 0);
    ctx.lineTo(GAME_CONFIG.width, GAME_CONFIG.height);
    ctx.lineTo(0, GAME_CONFIG.height);
    ctx.lineTo(0, 0);
    ctx.stroke();
    
    // Lanceur de balle
    ctx.fillStyle = GAME_CONFIG.colors.secondary;
    ctx.fillRect(GAME_CONFIG.width - 60, GAME_CONFIG.height - 150, 50, 100);
    
    // Guides latéraux améliorés pour diriger vers les flippers
    ctx.strokeStyle = GAME_CONFIG.colors.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Guide gauche - dirige vers le flipper gauche
    ctx.moveTo(60, GAME_CONFIG.height - 180);
    ctx.lineTo(GAME_CONFIG.width * 0.25, GAME_CONFIG.height - 80);
    // Guide droit - dirige vers le flipper droit  
    ctx.moveTo(GAME_CONFIG.width - 60, GAME_CONFIG.height - 180);
    ctx.lineTo(GAME_CONFIG.width * 0.75, GAME_CONFIG.height - 80);
    ctx.stroke();
    
    // Séparateur central entre les flippers
    ctx.strokeStyle = GAME_CONFIG.colors.wall;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.width * 0.5 - 20, GAME_CONFIG.height - 40);
    ctx.lineTo(GAME_CONFIG.width * 0.5 + 20, GAME_CONFIG.height - 40);
    ctx.stroke();
    
    // Ouverture de sortie entre les flippers
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(GAME_CONFIG.width * 0.45, GAME_CONFIG.height - 40, GAME_CONFIG.width * 0.1, 40);
}

function drawUI() {
    // Affichage du joueur actuel sur le terrain
    ctx.fillStyle = GAME_CONFIG.colors.primary;
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Joueur ${gameState.currentPlayer}`, GAME_CONFIG.width / 2, 30);
    
    // Instructions pour lancer si la balle n'est pas encore lancée
    if (!gameState.ball.isLaunched) {
        ctx.fillStyle = GAME_CONFIG.colors.secondary;
        ctx.font = '16px Arial';
        if (gameState.isCharging) {
            // Barre de puissance
            const barWidth = 200;
            const barHeight = 20;
            const barX = (GAME_CONFIG.width - barWidth) / 2;
            const barY = 70;
            
            // Fond de la barre
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Barre de puissance
            const powerRatio = (gameState.launchPower - GAME_CONFIG.minLaunchPower) / 
                              (GAME_CONFIG.maxLaunchPower - GAME_CONFIG.minLaunchPower);
            const powerWidth = barWidth * powerRatio;
            
            // Couleur en dégradé selon la puissance
            if (powerRatio < 0.5) {
                ctx.fillStyle = `rgb(${Math.floor(255 * powerRatio * 2)}, 255, 0)`;
            } else {
                ctx.fillStyle = `rgb(255, ${Math.floor(255 * (1 - powerRatio) * 2)}, 0)`;
            }
            
            ctx.fillRect(barX, barY, powerWidth, barHeight);
            
            // Bordure
            ctx.strokeStyle = GAME_CONFIG.colors.primary;
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = GAME_CONFIG.colors.secondary;
            ctx.fillText('Maintenez ESPACE pour charger - Relâchez pour lancer', GAME_CONFIG.width / 2, 60);
        } else {
            ctx.fillText('Appuyez sur ESPACE pour lancer', GAME_CONFIG.width / 2, 60);
        }
    }
    
    if (gameState.isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
        ctx.fillStyle = GAME_CONFIG.colors.secondary;
        ctx.font = '40px Arial';
        ctx.fillText('PAUSE', GAME_CONFIG.width / 2, GAME_CONFIG.height / 2);
    }
}

function addScore(points) {
    gameState.scores[gameState.currentPlayer - 1] += points;
    updateUI();
    
    // Animation du score
    const scoreElement = document.getElementById(`score${gameState.currentPlayer}`);
    scoreElement.classList.add('pulse');
    setTimeout(() => scoreElement.classList.remove('pulse'), 500);
}

function updateUI() {
    document.getElementById('score1').textContent = gameState.scores[0];
    document.getElementById('score2').textContent = gameState.scores[1];
    document.getElementById('lives1').textContent = gameState.lives[0];
    document.getElementById('lives2').textContent = gameState.lives[1];
    document.getElementById('currentPlayer').textContent = `Joueur ${gameState.currentPlayer}`;
}

function restartGame() {
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.currentPlayer = 1;
    gameState.scores = [0, 0];
    gameState.lives = [3, 3];
    gameState.launchPower = 0;
    gameState.isCharging = false;
    
    gameState.ball.reset();
    gameState.flippers.forEach(flipper => {
        flipper.angle = flipper.restAngle;
        flipper.isActive = false;
    });
    
    updateUI();
    hideModal('gameOverModal');
    hideModal('pauseModal');
}

function endGame() {
    gameState.isPlaying = false;
    
    const winner = gameState.scores[0] > gameState.scores[1] ? 1 : 
                   gameState.scores[1] > gameState.scores[0] ? 2 : 0;
    
    let winnerText = winner === 0 ? 'Égalité !' : `Joueur ${winner} gagne !`;
    
    document.getElementById('finalScores').textContent = 
        `Joueur 1: ${gameState.scores[0]} - Joueur 2: ${gameState.scores[1]}`;
    document.getElementById('winner').textContent = winnerText;
    
    // Sauvegarder les scores
    saveScore(gameState.scores[0], 'Joueur 1');
    saveScore(gameState.scores[1], 'Joueur 2');
    
    showModal('gameOverModal');
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    if (gameState.isPaused) {
        showModal('pauseModal');
    } else {
        hideModal('pauseModal');
    }
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Système de sauvegarde des scores
function saveScore(score, playerName) {
    let highScores = JSON.parse(localStorage.getItem('flipperHighScores') || '[]');
    
    highScores.push({
        score: score,
        name: playerName,
        date: new Date().toLocaleDateString()
    });
    
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10); // Garder seulement les 10 meilleurs
    
    localStorage.setItem('flipperHighScores', JSON.stringify(highScores));
    displayHighScores();
}

function loadHighScores() {
    displayHighScores();
}

function displayHighScores() {
    const highScores = JSON.parse(localStorage.getItem('flipperHighScores') || '[]');
    const list = document.getElementById('highScoresList');
    
    if (highScores.length === 0) {
        list.innerHTML = '<p style="color: #666;">Aucun score enregistré</p>';
        return;
    }
    
    list.innerHTML = highScores.map((score, index) => `
        <div class="score-entry">
            <span class="rank">${index + 1}.</span>
            <span class="name">${score.name}</span>
            <span class="points">${score.score}</span>
        </div>
    `).join('');
}

function clearHighScores() {
    if (confirm('Êtes-vous sûr de vouloir effacer tous les scores ?')) {
        localStorage.removeItem('flipperHighScores');
        displayHighScores();
    }
}

// Initialisation du jeu
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    restartGame();
});

// Gestion du redimensionnement
window.addEventListener('resize', () => {
    const canvas = document.getElementById('gameCanvas');
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Maintenir les proportions
    const scale = Math.min(rect.width / GAME_CONFIG.width, rect.height / GAME_CONFIG.height);
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
});
