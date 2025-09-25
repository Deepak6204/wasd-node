const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
app.use(express.static(__dirname + "/"));
let onlineUsers = {};

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/:roomId", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Set up Socket.IO
io.on("connection", (socket) => {
  // Handle join room requests
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.emit("requestUsername", roomId); // Request the user's name
    // socket.broadcast.to(roomId).emit('newUserJoined', `A new user has joined the room!`);
  });

  // Handle incoming messages
  socket.on("sendMessage", (roomId, message, username) => {
    // Broadcast the message to all connected clients in the same room
    io.to(roomId).emit("newMessage", message, username);
  });

  // Handle username submission
  socket.on("submitUsername", (username) => {
    socket.username = username; // Store the user's name

    // Add the user to the online users list
    for (const roomId of socket.rooms) {
      if (!onlineUsers[roomId]) {
        onlineUsers[roomId] = [];
      }
      onlineUsers[roomId].push({ id: socket.id, username: socket.username });
      io.to(roomId).emit("onlineUsers", onlineUsers[roomId]);
      socket.broadcast
        .to(roomId)
        .emit("newUserJoined", `${username} has joined the room!`);
    }
  });

  // Handle leave room requests
  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);

    socket.broadcast
      .to(roomId)
      .emit("userLeft", `${socket.username} has left the room!`);
    // Remove the user from the online users list
    if (onlineUsers[roomId]) {
      onlineUsers[roomId] = onlineUsers[roomId].filter(
        (user) => user.id !== socket.id
      );
      io.to(roomId).emit("onlineUsers", onlineUsers[roomId]);
    }
    socket.emit("onlineUsers", []);
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    // Remove the user from the online users list
    for (const roomId in onlineUsers) {
      onlineUsers[roomId] = onlineUsers[roomId].filter(
        (user) => user.id !== socket.id
      );
      io.to(roomId).emit("onlineUsers", onlineUsers[roomId]);
    }
  });

  // Handle get online users
  socket.on("getOnlineUsers", (roomId) => {
    if (onlineUsers[roomId]) {
      socket.emit("onlineUsers", onlineUsers[roomId]);
    } else {
      socket.emit("onlineUsers", []);
    }
  });
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
