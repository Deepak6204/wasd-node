/**
 * Main Application Script
 * Initializes all modules and manages the application lifecycle
 */

// Initialize Socket.IO connection
const socket = io();

// Initialize managers and handlers
let uiManager;
let roomManager;
let messageHandler;
let fileTransfer;
let privateConnectionManager;

/**
 * Initialize the application
 */
function initializeApp() {
  // Create UI Manager first
  uiManager = new UIManager();
  window.UIManager = uiManager; // Make it globally accessible

  // Create Room Manager
  roomManager = new RoomManager(socket);

  // Create Private Connection Manager
  privateConnectionManager = new PrivateConnectionManager(socket, roomManager);
  window.privateConnectionManager = privateConnectionManager; // Make it globally accessible

  // Create Message Handler
  messageHandler = new MessageHandler(socket, roomManager);

  // Create File Transfer Handler
  fileTransfer = new FileTransfer(socket);

  console.log('🚀 Application initialized successfully');
  console.log('✨ Private P2P connections enabled');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
