/**
 * UIManager Module
 * Handles UI notifications and common UI operations
 */

class UIManager {
  constructor() {
    this.promptElement = document.getElementById('prompt');
    this.initializeEmptyStates();
  }

  /**
   * Initialize empty states for chat and users
   */
  initializeEmptyStates() {
    const chatLog = document.getElementById('chat-log');
    const onlineUsers = document.getElementById('online-users');

    if (!chatLog.children.length) {
      chatLog.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No messages yet</p></div>';
    }

    if (!onlineUsers.children.length) {
      onlineUsers.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>No users online</p></div>';
    }
  }

  /**
   * Show a notification prompt
   * @param {string} message - The message to display
   * @param {string} type - The type of prompt ('join' or 'leave')
   */
  showPrompt(message, type) {
    this.promptElement.textContent = message;
    this.promptElement.className = `prompt ${type}`;
    
    setTimeout(() => {
      this.promptElement.textContent = '';
      this.promptElement.className = 'prompt';
    }, 3000);
  }

  /**
   * Show loading state
   * @param {HTMLElement} element - The element to show loading on
   * @param {boolean} loading - Whether to show or hide loading
   */
  setLoading(element, loading) {
    if (loading) {
      element.disabled = true;
      element.classList.add('loading');
    } else {
      element.disabled = false;
      element.classList.remove('loading');
    }
  }

  /**
   * Clear chat log
   */
  clearChat() {
    const chatLog = document.getElementById('chat-log');
    chatLog.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No messages yet</p></div>';
  }

  /**
   * Clear online users
   */
  clearOnlineUsers() {
    const onlineUsers = document.getElementById('online-users');
    onlineUsers.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><p>No users online</p></div>';
  }
}

// Export for use in main script
window.UIManager = UIManager;
