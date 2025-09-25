const socket = io();

const promptElement = document.getElementById("prompt");
const roomIdDisplay = document.getElementById("room-id-display");
const roomInput = document.getElementById("room-id");

// Get roomId from URL and auto-fill
const urlParams = new URLSearchParams(window.location.search);
const roomIdFromURL = urlParams.get("roomId");
if (roomIdFromURL) {
  roomIdDisplay.innerText = roomIdFromURL;
  roomInput.value = roomIdFromURL;
  socket.emit("joinRoom", roomIdFromURL);
}

// Function to update prompt
function updatePrompt(message, type) {
  promptElement.textContent = message;
  promptElement.className = `prompt ${type}`;
  setTimeout(() => {
    promptElement.textContent = "";
    promptElement.className = "prompt";
  }, 3000);
}

// Request username from user
let username;
socket.on("requestUsername", (roomId) => {
  while (!username) {
    username = prompt("Please enter your name:");
    if (!username) alert("Username cannot be empty. Please try again.");
  }
  roomIdDisplay.innerText = roomId;
  socket.emit("submitUsername", username);
});

// Join room
document.getElementById("join-room").addEventListener("click", () => {
  const roomId = roomInput.value.trim();
  if (roomId) {
    roomIdDisplay.innerText = roomId;
    socket.emit("joinRoom", roomId);
  }
});

// Leave room
document.getElementById("leave-room").addEventListener("click", () => {
  const roomId = roomInput.value.trim();
  if (roomId) {
    socket.emit("leaveRoom", roomId);
    document.getElementById("chat-log").innerHTML = "";
  }
});

// Send message
document.getElementById("send-message").addEventListener("click", () => {
  const message = document.getElementById("message-input").value.trim();
  const roomId = roomInput.value.trim();
  if (message && roomId && username) {
    socket.emit("sendMessage", roomId, message, username);
    document.getElementById("message-input").value = "";
  }
});

// Display new message
socket.on("newMessage", (message, senderUsername) => {
  const chatLog = document.getElementById("chat-log");
  const messageElement = document.createElement("p");
  messageElement.innerText = `${senderUsername}: ${message}`;
  chatLog.appendChild(messageElement);
  chatLog.scrollTop = chatLog.scrollHeight;
});

// User joined
socket.on("newUserJoined", (message) => {
  updatePrompt(message, "join");
});

// User left
socket.on("userLeft", (message) => {
  updatePrompt(message, "leave");
});

// Show online users
socket.on("onlineUsers", (users) => {
  const onlineUsersElement = document.getElementById("online-users");
  onlineUsersElement.innerHTML = "";
  users.forEach((user) => {
    const userElement = document.createElement("p");
    const onlineIcon = document.createElement("i");
    onlineIcon.className = "fas fa-circle text-green-500 mr-2";
    userElement.appendChild(onlineIcon);
    userElement.appendChild(document.createTextNode(user.username));
    onlineUsersElement.appendChild(userElement);
  });
});

const shareRoomButton = document.getElementById("share-room");

shareRoomButton.addEventListener("click", async () => {
  const roomId = document.getElementById("room-id-display").innerText.trim();

  if (!roomId) {
    alert("Please join a room first.");
    return;
  }

  const roomUrl = `${window.location.origin}?roomId=${encodeURIComponent(
    roomId
  )}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(roomUrl);
      alert("Room link copied to clipboard!");
    } else {
      fallbackCopyTextToClipboard(roomUrl);
    }
  } catch (err) {
    console.error("Clipboard write failed:", err);
    fallbackCopyTextToClipboard(roomUrl);
  }
});

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  textArea.style.left = "-1000px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      alert("Room link copied to clipboard!");
    } else {
      alert("Failed to copy. Please copy manually:\n" + text);
    }
  } catch (err) {
    console.error("Fallback copy failed:", err);
    alert("Failed to copy. Please copy manually:\n" + text);
  }

  document.body.removeChild(textArea);
}
