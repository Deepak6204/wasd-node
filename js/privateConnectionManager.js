/**
 * PrivateConnectionManager Module
 * Handles peer-to-peer connection requests and private file sharing
 */

class PrivateConnectionManager {
  constructor(socket, roomManager) {
    this.socket = socket;
    this.roomManager = roomManager;
    this.connectedPeers = new Map(); // Map of socketId -> {username, status}
    this.pendingRequests = new Map(); // Map of socketId -> {username, direction: 'outgoing'|'incoming'}
    this.isPrivateMode = false;
    this.selectedPeerId = null;
    
    this.initializeElements();
    this.initializeEventListeners();
    this.setupSocketListeners();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.connectionModal = document.getElementById('connection-request-modal');
    this.requesterNameSpan = document.getElementById('requester-name');
    this.acceptBtn = document.getElementById('accept-connection-btn');
    this.rejectBtn = document.getElementById('reject-connection-btn');
    this.connectedPeersContainer = document.getElementById('connected-peers');
    this.connectedCountBadge = document.getElementById('connected-count');
    this.publicModeBtn = document.getElementById('public-mode-btn');
    this.privateModeBtn = document.getElementById('private-mode-btn');
    this.peerSelectorContainer = document.getElementById('peer-selector-container');
    this.peerSelector = document.getElementById('peer-selector');
    this.sendFileText = document.getElementById('send-file-text');
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    // Mode toggle buttons
    this.publicModeBtn.addEventListener('click', () => {
      this.setMode('public');
    });

    this.privateModeBtn.addEventListener('click', () => {
      this.setMode('private');
    });

    // Peer selector
    this.peerSelector.addEventListener('change', (e) => {
      this.selectedPeerId = e.target.value;
    });

    // Connection modal buttons
    this.acceptBtn.addEventListener('click', () => {
      this.acceptConnection();
    });

    this.rejectBtn.addEventListener('click', () => {
      this.rejectConnection();
    });
  }

  /**
   * Setup socket listeners for connection events
   */
  setupSocketListeners() {
    // Incoming connection request
    this.socket.on('connectionRequest', (data) => {
      this.handleConnectionRequest(data);
    });

    // Connection accepted
    this.socket.on('connectionAccepted', (data) => {
      this.handleConnectionAccepted(data);
    });

    // Connection rejected
    this.socket.on('connectionRejected', (data) => {
      this.handleConnectionRejected(data);
    });

    // Peer disconnected
    this.socket.on('peerDisconnected', (data) => {
      this.handlePeerDisconnected(data);
    });

    // Update online users with connect buttons
    this.socket.on('onlineUsers', (users) => {
      this.updateOnlineUsersWithConnectButtons(users);
    });
  }

  /**
   * Send connection request to a user
   */
  sendConnectionRequest(peerId, peerUsername) {
    if (this.connectedPeers.has(peerId)) {
      window.UIManager?.showPrompt('Already connected to this user', 'leave');
      return;
    }

    if (this.pendingRequests.has(peerId)) {
      window.UIManager?.showPrompt('Request already pending', 'leave');
      return;
    }

    this.socket.emit('sendConnectionRequest', {
      peerId,
      requesterUsername: this.roomManager.getUsername()
    });

    this.pendingRequests.set(peerId, {
      username: peerUsername,
      direction: 'outgoing'
    });

    window.UIManager?.showPrompt(`Connection request sent to ${peerUsername}`, 'join');
    this.updateOnlineUsersUI();
  }

  /**
   * Handle incoming connection request
   */
  handleConnectionRequest(data) {
    const { requesterId, requesterUsername } = data;
    
    this.currentRequesterId = requesterId;
    this.pendingRequests.set(requesterId, {
      username: requesterUsername,
      direction: 'incoming'
    });

    // Show modal
    this.requesterNameSpan.textContent = requesterUsername;
    this.connectionModal.classList.add('show');
  }

  /**
   * Accept connection request
   */
  acceptConnection() {
    if (!this.currentRequesterId) return;

    this.socket.emit('acceptConnection', {
      peerId: this.currentRequesterId
    });

    const request = this.pendingRequests.get(this.currentRequesterId);
    if (request) {
      this.connectedPeers.set(this.currentRequesterId, {
        username: request.username,
        socketId: this.currentRequesterId
      });
      this.pendingRequests.delete(this.currentRequesterId);
    }

    this.connectionModal.classList.remove('show');
    this.currentRequesterId = null;
    
    this.updateConnectedPeersUI();
    this.updateOnlineUsersUI();
    this.updatePeerSelector();
    
    window.UIManager?.showPrompt('Connection established!', 'join');
  }

  /**
   * Reject connection request
   */
  rejectConnection() {
    if (!this.currentRequesterId) return;

    this.socket.emit('rejectConnection', {
      peerId: this.currentRequesterId
    });

    this.pendingRequests.delete(this.currentRequesterId);
    this.connectionModal.classList.remove('show');
    this.currentRequesterId = null;
    
    this.updateOnlineUsersUI();
  }

  /**
   * Handle connection accepted by peer
   */
  handleConnectionAccepted(data) {
    const { peerId, peerUsername } = data;
    
    this.connectedPeers.set(peerId, {
      username: peerUsername,
      socketId: peerId
    });
    this.pendingRequests.delete(peerId);
    
    this.updateConnectedPeersUI();
    this.updateOnlineUsersUI();
    this.updatePeerSelector();
    
    window.UIManager?.showPrompt(`${peerUsername} accepted your request!`, 'join');
  }

  /**
   * Handle connection rejected by peer
   */
  handleConnectionRejected(data) {
    const { peerId, peerUsername } = data;
    
    this.pendingRequests.delete(peerId);
    this.updateOnlineUsersUI();
    
    window.UIManager?.showPrompt(`${peerUsername} declined your request`, 'leave');
  }

  /**
   * Disconnect from a peer
   */
  disconnectPeer(peerId) {
    const peer = this.connectedPeers.get(peerId);
    if (!peer) return;

    this.socket.emit('disconnectPeer', { peerId });
    
    this.connectedPeers.delete(peerId);
    this.updateConnectedPeersUI();
    this.updateOnlineUsersUI();
    this.updatePeerSelector();
    
    window.UIManager?.showPrompt(`Disconnected from ${peer.username}`, 'leave');
  }

  /**
   * Handle peer disconnected
   */
  handlePeerDisconnected(data) {
    const { peerId, peerUsername } = data;
    
    this.connectedPeers.delete(peerId);
    this.pendingRequests.delete(peerId);
    
    this.updateConnectedPeersUI();
    this.updateOnlineUsersUI();
    this.updatePeerSelector();
    
    if (peerUsername) {
      window.UIManager?.showPrompt(`${peerUsername} disconnected`, 'leave');
    }
  }

  /**
   * Set file sharing mode (public/private)
   */
  setMode(mode) {
    this.isPrivateMode = mode === 'private';
    
    if (this.isPrivateMode) {
      this.publicModeBtn.classList.remove('active');
      this.privateModeBtn.classList.add('active');
      this.peerSelectorContainer.classList.remove('hidden');
      this.sendFileText.textContent = 'Send to Peer';
      
      if (this.connectedPeers.size === 0) {
        window.UIManager?.showPrompt('Connect to a peer first for private sharing', 'leave');
      }
    } else {
      this.publicModeBtn.classList.add('active');
      this.privateModeBtn.classList.remove('active');
      this.peerSelectorContainer.classList.add('hidden');
      this.sendFileText.textContent = 'Send to Room';
    }
  }

  /**
   * Update online users UI with connect buttons
   */
  updateOnlineUsersWithConnectButtons(users) {
    const onlineUsersElement = document.getElementById('online-users');
    const currentUserId = this.socket.id;
    
    if (users.length === 0) {
      onlineUsersElement.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>No users online</p></div>';
      return;
    }
    
    onlineUsersElement.innerHTML = '';
    users.forEach((user) => {
      if (user.id === currentUserId) return; // Don't show self
      
      const userElement = document.createElement('div');
      userElement.className = 'user-item-with-action';
      
      const isConnected = this.connectedPeers.has(user.id);
      const isPending = this.pendingRequests.has(user.id);
      
      let actionButton = '';
      if (isConnected) {
        actionButton = `
          <button class="disconnect-btn" data-peer-id="${user.id}">
            <i class="fas fa-unlink"></i>
            Disconnect
          </button>
        `;
      } else if (isPending) {
        actionButton = `
          <button class="connect-btn pending" disabled>
            <i class="fas fa-clock"></i>
            Pending...
          </button>
        `;
      } else {
        actionButton = `
          <button class="connect-btn" data-peer-id="${user.id}" data-peer-username="${this.escapeHtml(user.username)}">
            <i class="fas fa-link"></i>
            Connect
          </button>
        `;
      }
      
      userElement.innerHTML = `
        <div class="user-info-section">
          <span class="online-indicator"></span>
          <span style="color: #e2e8f0; font-weight: 500;">${this.escapeHtml(user.username)}</span>
        </div>
        ${actionButton}
      `;
      
      const button = userElement.querySelector('.connect-btn:not(.pending), .disconnect-btn');
      if (button) {
        button.addEventListener('click', (e) => {
          const peerId = e.currentTarget.dataset.peerId;
          if (e.currentTarget.classList.contains('disconnect-btn')) {
            this.disconnectPeer(peerId);
          } else {
            const peerUsername = e.currentTarget.dataset.peerUsername;
            this.sendConnectionRequest(peerId, peerUsername);
          }
        });
      }
      
      onlineUsersElement.appendChild(userElement);
    });
  }

  /**
   * Update online users UI (refresh after connection changes)
   */
  updateOnlineUsersUI() {
    // Trigger a refresh by emitting getOnlineUsers
    const roomId = this.roomManager.getCurrentRoom();
    if (roomId) {
      this.socket.emit('getOnlineUsers', roomId);
    }
  }

  /**
   * Update connected peers UI
   */
  updateConnectedPeersUI() {
    if (this.connectedPeers.size === 0) {
      this.connectedPeersContainer.innerHTML = `
        <div class="empty-state-small">
          <i class="fas fa-user-lock text-gray-600 text-2xl mb-1"></i>
          <p class="text-xs">No private connections</p>
        </div>
      `;
      this.connectedCountBadge.textContent = '0';
      return;
    }
    
    this.connectedCountBadge.textContent = this.connectedPeers.size.toString();
    this.connectedPeersContainer.innerHTML = '';
    
    this.connectedPeers.forEach((peer, peerId) => {
      const peerElement = document.createElement('div');
      peerElement.className = 'connected-peer-item';
      peerElement.innerHTML = `
        <div class="peer-name">
          <i class="fas fa-user-check"></i>
          ${this.escapeHtml(peer.username)}
        </div>
        <button class="disconnect-btn" data-peer-id="${peerId}">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      const disconnectBtn = peerElement.querySelector('.disconnect-btn');
      disconnectBtn.addEventListener('click', () => {
        this.disconnectPeer(peerId);
      });
      
      this.connectedPeersContainer.appendChild(peerElement);
    });
  }

  /**
   * Update peer selector dropdown
   */
  updatePeerSelector() {
    this.peerSelector.innerHTML = '<option value="">Select a connected peer...</option>';
    
    this.connectedPeers.forEach((peer, peerId) => {
      const option = document.createElement('option');
      option.value = peerId;
      option.textContent = peer.username;
      this.peerSelector.appendChild(option);
    });
    
    this.selectedPeerId = null;
  }

  /**
   * Get current mode
   */
  isPrivateModeActive() {
    return this.isPrivateMode;
  }

  /**
   * Get selected peer ID
   */
  getSelectedPeerId() {
    return this.selectedPeerId;
  }

  /**
   * Get connected peers
   */
  getConnectedPeers() {
    return this.connectedPeers;
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
window.PrivateConnectionManager = PrivateConnectionManager;
