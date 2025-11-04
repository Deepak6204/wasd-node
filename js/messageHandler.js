/**
 * MessageHandler Module
 * Handles sending and receiving chat messages
 */

class MessageHandler {
  constructor(socket, roomManager) {
    this.socket = socket;
    this.roomManager = roomManager;
    
    this.initializeElements();
    this.initializeEventListeners();
    this.setupSocketListeners();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.messageInput = document.getElementById('message-input');
    this.sendMessageBtn = document.getElementById('send-message');
    this.chatLog = document.getElementById('chat-log');
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    // Send message on button click
    this.sendMessageBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Send message on Enter key
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  /**
   * Setup socket listeners for message events
   */
  setupSocketListeners() {
    // Listen for new messages
    this.socket.on('newMessage', (message, senderUsername) => {
      this.displayMessage(message, senderUsername);
    });
  }

  /**
   * Send a message
   */
  sendMessage() {
    const message = this.messageInput.value.trim();
    const roomId = this.roomManager.getCurrentRoom();
    const username = this.roomManager.getUsername();

    if (!message) {
      return;
    }

    if (!roomId) {
      window.UIManager?.showPrompt('Please join a room first', 'leave');
      return;
    }

    if (!username) {
      window.UIManager?.showPrompt('Please set your username', 'leave');
      return;
    }

    // Emit message to server
    this.socket.emit('sendMessage', roomId, message, username);
    
    // Clear input
    this.messageInput.value = '';
  }

  /**
   * Display a message in the chat log
   */
  displayMessage(message, senderUsername) {
    // Remove empty state if present
    const emptyState = this.chatLog.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'message-bubble';

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageElement.innerHTML = `
      <div class="message-username">${this.escapeHtml(senderUsername)}</div>
      <div class="message-text">${this.escapeHtml(message)}</div>
      <div class="message-time">${currentTime}</div>
    `;

    this.chatLog.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  /**
   * Utility: Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Export for use in main script
window.MessageHandler = MessageHandler;
