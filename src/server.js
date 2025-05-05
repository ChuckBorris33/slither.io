import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  createSnake,
  dropFoodFromSnake,
  gameState,
  initGame,
  manageBots,
} from "./gameLogic.js";

const __filename = fileURLToPath(import.meta.url);
// Assuming server.js is in /home/boris/projects/slither.io/src
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Configure CORS appropriately for production
    methods: ["GET", "POST"],
  },
});

app.use(cors()); // Apply CORS middleware

// --- Static File Serving ---
const publicDirectoryPath = path.join(__dirname, "../public");
app.use(express.static(publicDirectoryPath));
// --------------------------

// --- Main route ---
app.get("/", (req, res) => {
  // Send index.html from the public directory
  res.sendFile(path.join(publicDirectoryPath, "index.html"));
});

const players = gameState.players;

// --- Socket.IO Logic ---
io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  // Simple name for now, could be user input later
  const playerName = `Player_${socket.id.substring(0, 4)}`;
  players[socket.id] = createSnake(socket.id, playerName, false);

  socket.emit("welcome", {
    playerId: socket.id,
    initialState: gameState,
  });

  // Inform other players about the new player
  socket.broadcast.emit("playerJoined", { [socket.id]: players[socket.id] });

  manageBots();

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    if (players[socket.id]) {
      if (players[socket.id].alive) {
        // Turn player into food upon disconnect if alive
        for (let i = 0; i < players[socket.id].segments.length; i += 3) {
          dropFoodFromSnake(players[socket.id], i);
        }
      }
      delete players[socket.id];
      io.emit("playerLeft", socket.id);
    }
    manageBots();
  });

  socket.on("playerInput", (input) => {
    const player = players[socket.id];
    if (player && player.alive) {
      player.targetAngle = input.angle;
      player.boosting = input.boosting || false;
    }
  });

  socket.on("requestRespawn", () => {
    if (players[socket.id] && !players[socket.id].alive) {
      const oldName = players[socket.id].name; // Preserve name if desired
      players[socket.id] = createSnake(socket.id, oldName, false);
      io.emit("playerRespawned", { [socket.id]: players[socket.id] });
    } else if (!players[socket.id]) {
      // Edge case: player reconnected quickly
      const playerName = `Player_${socket.id.substring(0, 4)}`;
      players[socket.id] = createSnake(socket.id, playerName, false);
      io.emit("playerRespawned", { [socket.id]: players[socket.id] });
    }
  });
});

initGame(io);

const PORT = process.env.PORT || 5555; // Use environment variable or default
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
