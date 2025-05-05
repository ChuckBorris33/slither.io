const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const myScoreEl = document.getElementById("myScore");
const leaderboardListEl = document.getElementById("leaderboard-list");
const deathScreenEl = document.getElementById("death-screen");
const deathMessageEl = document.getElementById("death-message");
const respawnButton = document.getElementById("respawn-button");
const debugEl = document.getElementById("debug");

let socket;
let myPlayerId = null;
let clientGameState = { players: {}, food: [] };
let serverGameSettings = {
  GAME_WORLD_WIDTH: 3000,
  GAME_WORLD_HEIGHT: 3000,
  SNAKE_BASE_SIZE: 16,
  // ... other settings will come from server
};
let isDead = false;
let mousePosition = { x: 0, y: 0 };
let isBoosting = false;

const camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  smoothing: 0.1, // Lower is smoother
};

const backgroundImage = new Image();
backgroundImage.src = "images/Map2.png"; // Original background

function setupCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Center camera initially if player exists
  if (myPlayerId && clientGameState.players[myPlayerId]) {
    const player = clientGameState.players[myPlayerId];
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
  } else {
    camera.x = serverGameSettings.GAME_WORLD_WIDTH / 2 - canvas.width / 2;
    camera.y = serverGameSettings.GAME_WORLD_HEIGHT / 2 - canvas.height / 2;
  }
}

window.addEventListener("resize", setupCanvas);

function connectToServer() {
  socket = io();

  socket.on("welcome", (data) => {
    myPlayerId = data.playerId;
    clientGameState = data.initialState; // Full initial state
    serverGameSettings = data.initialState.gameSettings;
    console.log(
      "Welcome! My ID:",
      myPlayerId,
      "Game Settings:",
      serverGameSettings
    );
    isDead = false;
    deathScreenEl.style.display = "none";
    setupCanvas(); // Setup canvas after getting game settings
    requestAnimationFrame(gameLoopClient);
  });

  socket.on("gameState", (newState) => {
    clientGameState = newState;
  });

  socket.on("playerJoined", (newPlayerData) => {
    Object.assign(clientGameState.players, newPlayerData);
  });

  socket.on("playerRespawned", (respawnedPlayerData) => {
    Object.assign(clientGameState.players, respawnedPlayerData);
    if (respawnedPlayerData[myPlayerId]) {
      // If it's me who respawned
      isDead = false;
      deathScreenEl.style.display = "none";
    }
  });

  socket.on("playerLeft", (playerId) => {
    if (clientGameState.players[playerId]) {
      delete clientGameState.players[playerId];
    }
  });

  socket.on("playerDied", (data) => {
    console.log(
      `${data.killerName} ate ${
        clientGameState.players[data.id]?.name || "Unknown"
      }. Score: ${data.score}`
    );
    if (data.id === myPlayerId) {
      isDead = true;
      deathMessageEl.textContent = `You were eaten by ${
        data.killerName
      }! Score: ${Math.floor(data.score)}`;
      deathScreenEl.style.display = "block";
    }
    // Mark player as dead or remove, server will stop sending them in main gameState soon
    if (clientGameState.players[data.id]) {
      delete clientGameState.players[data.id]; // Or mark as not alive
    }
  });

  // Input listeners
  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mousePosition.x = event.clientX - rect.left;
    mousePosition.y = event.clientY - rect.top;
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) isBoosting = true; // Left click
  });
  canvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) isBoosting = false;
  });
  // Touch events for mobile (simple boost on touch)
  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault(); // Prevent default touch actions (like scrolling)
      isBoosting = true;
      // Update mousePosition based on first touch for direction
      if (event.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mousePosition.x = event.touches[0].clientX - rect.left;
        mousePosition.y = event.touches[0].clientY - rect.top;
      }
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      isBoosting = false;
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      if (event.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mousePosition.x = event.touches[0].clientX - rect.left;
        mousePosition.y = event.touches[0].clientY - rect.top;
      }
    },
    { passive: false }
  );

  respawnButton.addEventListener("click", () => {
    socket.emit("requestRespawn");
  });
}

function sendInput() {
  if (!myPlayerId || isDead || !clientGameState.players[myPlayerId]) return;

  const playerSelf = clientGameState.players[myPlayerId];
  if (!playerSelf || !playerSelf.segments || playerSelf.segments.length === 0)
    return;

  // Calculate angle from player head to mouse cursor
  // Player's head is at (playerSelf.x, playerSelf.y) in world coordinates
  // Mouse is at (mousePosition.x, mousePosition.y) in screen coordinates
  // We need mouse in world coordinates: mouseWorldX = mousePosition.x + camera.x
  const headScreenX = playerSelf.segments[0].x - camera.x;
  const headScreenY = playerSelf.segments[0].y - camera.y;

  const angle = Math.atan2(
    mousePosition.y - headScreenY,
    mousePosition.x - headScreenX
  );
  socket.emit("playerInput", { angle, boosting: isBoosting });
}

function updateCamera() {
  if (myPlayerId && clientGameState.players[myPlayerId] && !isDead) {
    const player = clientGameState.players[myPlayerId];
    // Target camera to player's head, centered on screen
    camera.targetX = player.segments[0].x - canvas.width / 2;
    camera.targetY = player.segments[0].y - canvas.height / 2;
  }
  // Smooth camera movement
  camera.x += (camera.targetX - camera.x) * camera.smoothing;
  camera.y += (camera.targetY - camera.y) * camera.smoothing;

  // Clamp camera to world boundaries (optional, slither.io wraps)
  // camera.x = Math.max(0, Math.min(camera.x, serverGameSettings.GAME_WORLD_WIDTH - canvas.width));
  // camera.y = Math.max(0, Math.min(camera.y, serverGameSettings.GAME_WORLD_HEIGHT - canvas.height));
}

function drawBackground() {
  // Fill the entire canvas with a base color first (e.g., for areas outside the map)
  ctx.fillStyle = "#111"; // A very dark color for out-of-bounds
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (backgroundImage.complete) {
    // Tiled background, similar to original
    const pattern = ctx.createPattern(backgroundImage, "repeat");
    ctx.fillStyle = pattern;

    // Calculate the on-screen coordinates of the game world boundaries
    const worldScreenX = -camera.x;
    const worldScreenY = -camera.y;
    const worldScreenWidth = serverGameSettings.GAME_WORLD_WIDTH;
    const worldScreenHeight = serverGameSettings.GAME_WORLD_HEIGHT;

    // Determine the intersection of the game world with the canvas viewport
    const drawX = Math.max(0, worldScreenX);
    const drawY = Math.max(0, worldScreenY);
    const drawWidth =
      Math.min(canvas.width, worldScreenX + worldScreenWidth) - drawX;
    const drawHeight =
      Math.min(canvas.height, worldScreenY + worldScreenHeight) - drawY;

    if (drawWidth <= 0 || drawHeight <= 0) {
      // World is completely off-screen
      return;
    }

    ctx.save();
    // Translate the pattern so it aligns with the world origin
    ctx.translate(worldScreenX, worldScreenY);
    // Fill only the portion of the game world that is visible on canvas
    ctx.fillRect(
      drawX - worldScreenX,
      drawY - worldScreenY,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  }
}

function drawGame() {
  drawBackground();

  clientGameState.food.forEach((foodItem) => {
    FoodRenderer.draw(ctx, foodItem, camera);
  });

  Object.values(clientGameState.players).forEach((playerData) => {
    SnakeRenderer.draw(ctx, playerData, camera, serverGameSettings);
  });
}

function updateUI() {
  if (myPlayerId && clientGameState.players[myPlayerId] && !isDead) {
    myScoreEl.textContent = clientGameState.players[myPlayerId].score;
  } else if (isDead) {
    // Score is on death message
  } else {
    myScoreEl.textContent = "0";
  }

  // Leaderboard
  leaderboardListEl.innerHTML = "";
  const sortedPlayers = Object.values(clientGameState.players)
    .filter((p) => p.segments && p.segments.length > 0) // Ensure player is valid and alive
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  sortedPlayers.forEach((player, index) => {
    const li = document.createElement("li");
    li.textContent = `#${index + 1} ${player.name}: ${player.score}`;
    if (player.id === myPlayerId) {
      li.style.fontWeight = "bold";
      li.style.color = "lightgreen";
    }
    leaderboardListEl.appendChild(li);
  });
  debugEl.textContent = `Players: ${
    Object.keys(clientGameState.players).length
  }, Food: ${clientGameState.food.length}, Cam:(${Math.round(
    camera.x
  )},${Math.round(camera.y)})`;
}

function gameLoopClient() {
  if (!socket) return; // Wait for connection

  sendInput();
  updateCamera();

  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen
  if (!isDead) {
    drawGame();
  }
  updateUI();

  requestAnimationFrame(gameLoopClient);
}

connectToServer();
