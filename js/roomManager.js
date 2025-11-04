/**
 * RoomManager Module
 * Handles room joining, leaving, and sharing functionality
 */

class RoomManager {
  constructor(socket) {
    this.socket = socket;
    this.currentRoom = null;
    this.username = null;
    
    this.initializeElements();
    this.initializeEventListeners();
    this.setupSocketListeners();
    this.checkURLForRoomId();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.roomInput = document.getElementById('room-id');
    this.roomIdDisplay = document.getElementById('room-id-display');
    this.joinRoomBtn = document.getElementById('join-room');
    this.leaveRoomBtn = document.getElementById('leave-room');
    this.shareRoomBtn = document.getElementById('share-room');
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    this.joinRoomBtn.addEventListener('click', () => {
      this.joinRoom();
    });

    this.leaveRoomBtn.addEventListener('click', () => {
      this.leaveRoom();
    });

    this.shareRoomBtn.addEventListener('click', () => {
      this.shareRoom();
    });
  }

  /**
   * Setup socket listeners for room events
   */
  setupSocketListeners() {
    // Request username when joining a room
    this.socket.on('requestUsername', (roomId) => {
      this.currentRoom = roomId;
      this.showUsernameModal();
    });

    // User joined notification
    this.socket.on('newUserJoined', (message) => {
      window.UIManager?.showPrompt(message, 'join');
    });

    // User left notification
    this.socket.on('userLeft', (message) => {
      window.UIManager?.showPrompt(message, 'leave');
    });

    // Online users update
    this.socket.on('onlineUsers', (users) => {
      this.updateOnlineUsers(users);
    });
  }

  /**
   * Check URL for roomId parameter and auto-join
   */
  checkURLForRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromURL = urlParams.get('roomId');
    
    if (roomIdFromURL) {
      this.roomInput.value = roomIdFromURL;
      this.currentRoom = roomIdFromURL;
      this.socket.emit('joinRoom', roomIdFromURL);
    }
  }

  /**
   * Join a room
   */
  joinRoom() {
    const roomId = this.roomInput.value.trim();
    
    if (!roomId) {
      window.UIManager?.showPrompt('Please enter a room ID', 'leave');
      return;
    }

    this.currentRoom = roomId;
    this.updateRoomDisplay(roomId);
    this.socket.emit('joinRoom', roomId);
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    const roomId = this.roomInput.value.trim();
    
    if (!roomId) {
      window.UIManager?.showPrompt('You are not in any room', 'leave');
      return;
    }

    this.socket.emit('leaveRoom', roomId);
    this.clearRoom();
  }

  /**
   * Share room link
   */
  async shareRoom() {
    const roomId = this.roomInput.value.trim();

    if (!roomId) {
      window.UIManager?.showPrompt('Please join a room first', 'leave');
      return;
    }

    const roomUrl = `${window.location.origin}?roomId=${encodeURIComponent(roomId)}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomUrl);
        window.UIManager?.showPrompt('Room link copied to clipboard! 📋', 'join');
      } else {
        this.fallbackCopyTextToClipboard(roomUrl);
      }
    } catch (err) {
      console.error('Clipboard write failed:', err);
      this.fallbackCopyTextToClipboard(roomUrl);
    }
  }

  /**
   * Fallback method for copying to clipboard
   */
  fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-1000px';
    textArea.style.left = '-1000px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        window.UIManager?.showPrompt('Room link copied to clipboard! 📋', 'join');
      } else {
        window.UIManager?.showPrompt('Failed to copy room link', 'leave');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      window.UIManager?.showPrompt('Failed to copy room link', 'leave');
    }

    document.body.removeChild(textArea);
  }

  /**
   * Show username modal
   */
  showUsernameModal() {
    const modal = document.getElementById('username-modal');
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');

    modal.classList.add('show');
    input.focus();

    // Handle form submission
    const handleSubmit = (e) => {
      e.preventDefault();
      const username = input.value.trim();

      if (username && username.length >= 2) {
        this.username = username;
        this.socket.emit('submitUsername', username);
        modal.classList.remove('show');
        this.updateRoomDisplay(this.currentRoom);
        
        // Remove event listener after use
        form.removeEventListener('submit', handleSubmit);
      } else {
        window.UIManager?.showPrompt('Username must be at least 2 characters', 'leave');
      }
    };

    form.addEventListener('submit', handleSubmit);
  }

  /**
   * Update room display in header
   */
  updateRoomDisplay(roomId) {
    this.roomIdDisplay.innerHTML = `
      <span class="room-badge">
        <i class="fas fa-door-open"></i> ${this.escapeHtml(roomId)}
      </span>
    `;
  }

  /**
   * Clear room when leaving
   */
  clearRoom() {
    this.currentRoom = null;
    this.roomIdDisplay.innerHTML = '';
    
    // Clear chat log
    const chatLog = document.getElementById('chat-log');
    chatLog.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No messages yet</p></div>';
    
    window.UIManager?.showPrompt('Left the room', 'leave');
  }

  /**
   * Update online users list
   */
  updateOnlineUsers(users) {
    const onlineUsersElement = document.getElementById('online-users');
    
    if (users.length === 0) {
      onlineUsersElement.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>No users online</p></div>';
      return;
    }
    
    onlineUsersElement.innerHTML = '';
    users.forEach((user) => {
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.innerHTML = `
        <span class="online-indicator"></span>
        <span style="color: #e2e8f0; font-weight: 500;">${this.escapeHtml(user.username)}</span>
      `;
      onlineUsersElement.appendChild(userElement);
    });
  }

  /**
   * Get current username
   */
  getUsername() {
    return this.username;
  }

  /**
   * Get current room
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Utility: Escape HTML
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
window.RoomManager = RoomManager;
