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

  // Handle connection request
  socket.on("sendConnectionRequest", (data) => {
    const { peerId, requesterUsername } = data;
    
    io.to(peerId).emit("connectionRequest", {
      requesterId: socket.id,
      requesterUsername: requesterUsername
    });
  });

  // Handle connection acceptance
  socket.on("acceptConnection", (data) => {
    const { peerId } = data;
    
    io.to(peerId).emit("connectionAccepted", {
      peerId: socket.id,
      peerUsername: socket.username
    });
  });

  // Handle connection rejection
  socket.on("rejectConnection", (data) => {
    const { peerId } = data;
    
    io.to(peerId).emit("connectionRejected", {
      peerId: socket.id,
      peerUsername: socket.username
    });
  });

  // Handle peer disconnection
  socket.on("disconnectPeer", (data) => {
    const { peerId } = data;
    
    io.to(peerId).emit("peerDisconnected", {
      peerId: socket.id,
      peerUsername: socket.username
    });
  });

  // Handle file transfer start
  socket.on("fileTransferStart", (data) => {
    const { fileId, fileName, fileSize, fileType, totalChunks, roomId, isPrivate, targetPeerId } = data;
    
    const transferData = {
      fileId,
      fileName,
      fileSize,
      fileType,
      totalChunks,
      sender: socket.username || "Anonymous"
    };

    if (isPrivate && targetPeerId) {
      // Send only to specific peer
      io.to(targetPeerId).emit("fileTransferStart", transferData);
    } else {
      // Broadcast to all users in the room except sender
      socket.broadcast.to(roomId).emit("fileTransferStart", transferData);
    }
  });

  // Handle file chunk transfer
  socket.on("fileChunk", (data) => {
    const { fileId, chunkIndex, chunk, roomId, isPrivate, targetPeerId } = data;
    
    const chunkData = {
      fileId,
      chunkIndex,
      chunk
    };

    if (isPrivate && targetPeerId) {
      // Send only to specific peer
      io.to(targetPeerId).emit("fileChunk", chunkData);
    } else {
      // Relay chunk to all users in the room except sender
      socket.broadcast.to(roomId).emit("fileChunk", chunkData);
    }
  });

  // Handle file transfer completion
  socket.on("fileTransferComplete", (data) => {
    const { fileId, roomId, isPrivate, targetPeerId } = data;
    
    const completeData = {
      fileId
    };

    if (isPrivate && targetPeerId) {
      // Notify only specific peer
      io.to(targetPeerId).emit("fileTransferComplete", completeData);
    } else {
      // Notify all users in the room except sender
      socket.broadcast.to(roomId).emit("fileTransferComplete", completeData);
    }
  });

  // Handle file transfer errors
  socket.on("fileTransferError", (data) => {
    const { fileId, error, roomId } = data;
    
    // Notify all users in the room
    io.to(roomId).emit("fileTransferError", {
      fileId,
      error
    });
  });
});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
