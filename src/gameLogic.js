// --- Game Constants ---
const GAME_WORLD_WIDTH = 2000; // Increased world size for bounded map
const GAME_WORLD_HEIGHT = 2000;
const PLAYER_INITIAL_SPEED = 6; // A starting point, can be adjusted
const PLAYER_BOOST_SPEED_MULTIPLIER = 2;
const SNAKE_INITIAL_LENGTH = 10; // Number of segments
const SNAKE_SEGMENT_DISTANCE = 8; // Distance between segment centers
const SNAKE_BASE_SIZE = 16; // Base diameter of a segment, can scale with score
const FOOD_RADIUS_MIN = 5;
const FOOD_RADIUS_MAX = 10;
const MAX_FOOD_ITEMS = 500; // Original NFood was 2000, but that might be too much for sync
const GAME_TICK_RATE = 1000 / 30; // 30 updates per second
const MIN_BOTS = 5; // Ensure at least this many bots if player count is low
const MAX_TOTAL_SNAKES = 10; // Max players + bots

const BOT_NAMES = [
  "Byte",
  "Pixel",
  "Vector",
  "Glitch",
  "Syntax",
  "Kernel",
  "Cipher",
  "Render",
  "Vertex",
  "Shader",
  "Algo",
  "Recursion",
  "Stack",
  "Heap",
  "Pointer",
];
const SNAKE_BODY_IMAGE_COUNT = 13; // From original Nball

// --- Game State ---
let players = {}; // { socketId: snakeObject }
let foodItems = [];
let botCounter = 0;

export const gameState = {
  players: players, // Send all current players
  food: foodItems,
  gameSettings: {
    GAME_WORLD_WIDTH,
    GAME_WORLD_HEIGHT,
    SNAKE_BASE_SIZE,
    SNAKE_SEGMENT_DISTANCE,
    FOOD_RADIUS_MIN,
    FOOD_RADIUS_MAX,
    SNAKE_BODY_IMAGE_COUNT,
  },
};

// --- Helper Functions ---
function getRandomPosition(padding = 50) {
  return {
    x: Math.random() * (GAME_WORLD_WIDTH - padding * 2) + padding,
    y: Math.random() * (GAME_WORLD_HEIGHT - padding * 2) + padding,
  };
}

function getRandomColor() {
  const r = Math.floor(Math.random() * 200 + 55);
  const g = Math.floor(Math.random() * 200 + 55);
  const b = Math.floor(Math.random() * 200 + 55);
  return `rgb(${r},${g},${b})`;
}

function createFoodItem(id) {
  const pos = getRandomPosition();
  return {
    id: id || `food_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    x: pos.x,
    y: pos.y,
    size: Math.random() * (FOOD_RADIUS_MAX - FOOD_RADIUS_MIN) + FOOD_RADIUS_MIN,
    color: getRandomColor(), // Client can override with its own color array if needed
    value: Math.floor(
      Math.random() * (FOOD_RADIUS_MAX - FOOD_RADIUS_MIN) + FOOD_RADIUS_MIN
    ), // Score value
  };
}

function spawnInitialFood() {
  for (let i = 0; i < MAX_FOOD_ITEMS; i++) {
    foodItems.push(createFoodItem());
  }
}

export function createSnake(id, name, isBot = false) {
  const position = getRandomPosition(200);
  const initialAngle = Math.random() * 2 * Math.PI;
  const snake = {
    id: id,
    name: name,
    x: position.x,
    y: position.y,
    angle: initialAngle,
    targetAngle: initialAngle,
    speed: PLAYER_INITIAL_SPEED,
    boosting: false,
    score: 200, // Original minScore
    segments: [],
    color: getRandomColor(), // Server assigns a base color
    bodyImageIndex: Math.floor(Math.random() * SNAKE_BODY_IMAGE_COUNT), // For client to pick body img
    alive: true,
    isBot: isBot,
    sizeMultiplier: 1, // Scales with score
    targetLength: SNAKE_INITIAL_LENGTH, // How many segments it *should* have
    boostCooldown: 0,
    lastBoostDrop: 0, // Timestamp of last food drop due to boost
  };

  for (let i = 0; i < snake.targetLength; i++) {
    snake.segments.push({
      x: snake.x - i * SNAKE_SEGMENT_DISTANCE * Math.cos(snake.angle),
      y: snake.y - i * SNAKE_SEGMENT_DISTANCE * Math.sin(snake.angle),
    });
  }
  return snake;
}

export function manageBots() {
  const currentSnakes = Object.values(players).filter((p) => p.alive).length;
  let botsToSpawn = 0;
  if (currentSnakes < MIN_BOTS) {
    botsToSpawn = MIN_BOTS - currentSnakes;
  }
  botsToSpawn = Math.min(botsToSpawn, MAX_TOTAL_SNAKES - currentSnakes);

  for (let i = 0; i < botsToSpawn; i++) {
    const botId = `bot_${botCounter++}`;
    const botName =
      BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] +
      `_${botId.slice(-2)}`;
    players[botId] = createSnake(botId, botName, true);
    console.log(`Bot ${botName} spawned.`);
  }
}

export function dropFoodFromSnake(snake, segmentIndex) {
  const segment = snake.segments[segmentIndex];
  if (!segment) return;

  const food = createFoodItem();
  food.x = segment.x + (Math.random() - 0.5) * 10;
  food.y = segment.y + (Math.random() - 0.5) * 10;
  food.value = Math.max(1, Math.floor(snake.score / snake.segments.length / 2)); // Drop some value
  food.color = snake.color; // Food is snake's color

  // Make dropped food larger than regular food
  // Regular food size is FOOD_RADIUS_MIN (5) to FOOD_RADIUS_MAX (10)
  // New size will be at least FOOD_RADIUS_MAX, and can scale up a bit more.
  food.size =
    FOOD_RADIUS_MAX + Math.min(food.value / 4, FOOD_RADIUS_MAX * 0.75);
  foodItems.push(food);
}

// --- Game Loop ---
function gameLoop(io) {
  const now = Date.now();
  // 1. Update Bots AI
  Object.values(players).forEach((p) => {
    if (p.isBot && p.alive) {
      if (Math.random() < 0.05) {
        // Chance to change target
        p.targetAngle = Math.random() * 2 * Math.PI;
      }
      // Simple: move towards random food if nearby, or just wander
      if (foodItems.length > 0 && Math.random() < 0.1) {
        const targetFood =
          foodItems[Math.floor(Math.random() * foodItems.length)];
        p.targetAngle = Math.atan2(targetFood.y - p.y, targetFood.x - p.x);
      }
      p.boosting = Math.random() < 0.02; // Bots occasionally boost
    }
  });

  // 2. Update all snake positions
  Object.values(players).forEach((player) => {
    if (!player.alive) return;

    // Angle smoothing
    let angleDiff = player.targetAngle - player.angle;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    player.angle += angleDiff * 0.15; // Turn speed

    let currentSpeed = player.speed;
    if (player.boosting && player.score > 250 && player.boostCooldown <= 0) {
      // Min score to boost
      currentSpeed *= PLAYER_BOOST_SPEED_MULTIPLIER;
      player.score -= 0.5; // Cost of boosting
      if (player.score < 200) player.score = 200;

      if (
        now - player.lastBoostDrop > 200 &&
        player.segments.length > SNAKE_INITIAL_LENGTH / 2
      ) {
        // Reduce length shen boosting
        player.targetLength = Math.max(
          SNAKE_INITIAL_LENGTH / 2,
          player.targetLength - 0.2
        ); // Shrink slightly
        player.lastBoostDrop = now;
      }
    } else {
      player.boosting = false; // Stop boosting if score too low or on cooldown
    }
    if (player.boostCooldown > 0) player.boostCooldown -= GAME_TICK_RATE;

    player.x += Math.cos(player.angle) * currentSpeed;
    player.y += Math.sin(player.angle) * currentSpeed;

    // Wall collision - Die if hit boundary
    const headRadius = (SNAKE_BASE_SIZE * player.sizeMultiplier) / 2; // Approximate head radius
    if (
      player.x - headRadius < 0 ||
      player.x + headRadius > GAME_WORLD_WIDTH ||
      player.y - headRadius < 0 ||
      player.y + headRadius > GAME_WORLD_HEIGHT
    ) {
      if (player.alive) {
        // Check if player is already marked dead in this tick (e.g. by another collision)
        player.alive = false;
        // Turn dead player into food
        for (let k = 0; k < player.segments.length; k += 2) {
          dropFoodFromSnake(player, k);
        }
        io.emit("playerDied", {
          id: player.id,
          killerId: null,
          killerName: "the void",
          score: player.score,
        });
        if (player.isBot) delete players[player.id]; // Remove bot immediately
        // Player is now dead, skip further updates for this player in this tick
        return;
      }
    }

    // Update segments
    player.segments.unshift({ x: player.x, y: player.y });

    // Adjust actual segment length towards targetLength
    const desiredSegmentCount = Math.floor(player.targetLength);
    while (
      player.segments.length > desiredSegmentCount &&
      player.segments.length > 2
    ) {
      player.segments.pop();
    }
    // Ensure segments follow smoothly (like original snake.js)
    for (let i = 1; i < player.segments.length; i++) {
      const leader = player.segments[i - 1];
      const follower = player.segments[i];
      const dx = leader.x - follower.x;
      const dy = leader.y - follower.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > SNAKE_SEGMENT_DISTANCE) {
        const moveX = (dx / dist) * (dist - SNAKE_SEGMENT_DISTANCE);
        const moveY = (dy / dist) * (dist - SNAKE_SEGMENT_DISTANCE);
        follower.x += moveX;
        follower.y += moveY;
      }
    }

    // Grow snake based on score (simplified from original)
    player.targetLength = SNAKE_INITIAL_LENGTH + Math.floor(player.score / 50);
    player.sizeMultiplier = 1 + Math.pow(player.score / 1000, 1 / 5);

    // Food consumption
    for (let i = foodItems.length - 1; i >= 0; i--) {
      const food = foodItems[i];
      const dist = Math.hypot(player.x - food.x, player.y - food.y);
      const collisionThreshold =
        (SNAKE_BASE_SIZE * player.sizeMultiplier) / 2 + food.size;
      if (dist < collisionThreshold) {
        player.score += food.value;
        foodItems.splice(i, 1);
        if (foodItems.length < MAX_FOOD_ITEMS) {
          foodItems.push(createFoodItem());
        } // Replenish food
      }
    }

    // Snake vs Snake collision
    Object.values(players).forEach((otherPlayer) => {
      if (!otherPlayer.alive || player.id === otherPlayer.id || !player.alive)
        return;

      // Check player's head against otherPlayer's segments
      for (let j = 0; j < otherPlayer.segments.length; j++) {
        const seg = otherPlayer.segments[j];
        const dist = Math.hypot(player.x - seg.x, player.y - seg.y);
        const collisionRadius =
          (SNAKE_BASE_SIZE * otherPlayer.sizeMultiplier) / 2;
        if (dist < collisionRadius) {
          player.alive = false;
          // Turn dead player into food
          for (let k = 0; k < player.segments.length; k += 2) {
            // Drop food from every 2nd segment
            dropFoodFromSnake(player, k);
          }
          otherPlayer.score += Math.floor(player.score / 2); // Killer gets points
          io.emit("playerDied", {
            id: player.id,
            killerId: otherPlayer.id,
            killerName: otherPlayer.name,
            score: player.score,
          });
          if (player.isBot) delete players[player.id]; // Remove bot immediately
          return; // Player died, no need to check further for this player
        }
      }
    });
  });

  manageBots(); // Ensure bot count

  // 3. Broadcast game state
  const stateToBroadcast = {
    players: {},
    food: foodItems.map((f) => ({
      id: f.id,
      x: f.x,
      y: f.y,
      size: f.size,
      color: f.color,
    })), // Send minimal food data
  };
  Object.values(players).forEach((p) => {
    if (p.alive) {
      stateToBroadcast.players[p.id] = {
        id: p.id,
        name: p.name,
        x: p.x, // Current head x (for client camera focus)
        y: p.y, // Current head y
        segments: p.segments.map((s) => ({
          x: Math.round(s.x),
          y: Math.round(s.y),
        })),
        color: p.color,
        bodyImageIndex: p.bodyImageIndex,
        score: Math.floor(p.score),
        sizeMultiplier: p.sizeMultiplier,
        angle: p.angle, // For head orientation
        isBot: p.isBot,
        boosting: p.boosting,
      };
    }
  });

  io.emit("gameState", stateToBroadcast);
}

export const initGame = (io) => {
  spawnInitialFood();
  manageBots(); // Initial bot spawn
  setInterval(() => gameLoop(io), GAME_TICK_RATE);
};
