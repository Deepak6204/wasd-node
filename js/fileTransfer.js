/**
 * FileTransfer Module
 * Handles peer-to-peer file sharing using WebSockets with chunked transfer
 */

class FileTransfer {
  constructor(socket) {
    this.socket = socket;
    this.selectedFiles = [];
    this.CHUNK_SIZE = 64 * 1024; // 64KB chunks
    this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max
    this.activeTransfers = new Map();
    this.receivedChunks = new Map();
    
    this.initializeEventListeners();
    this.setupSocketListeners();
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInput = document.getElementById('file-input');
    const sendFileBtn = document.getElementById('send-file-btn');

    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      this.handleFileSelection(e.target.files);
    });

    sendFileBtn.addEventListener('click', () => {
      this.sendFiles();
    });
  }

  /**
   * Setup socket listeners for file transfer events
   */
  setupSocketListeners() {
    // Listen for file transfer initiation
    this.socket.on('fileTransferStart', (data) => {
      this.handleFileTransferStart(data);
    });

    // Listen for file chunks
    this.socket.on('fileChunk', (data) => {
      this.handleFileChunk(data);
    });

    // Listen for transfer completion
    this.socket.on('fileTransferComplete', (data) => {
      this.handleFileTransferComplete(data);
    });

    // Listen for transfer errors
    this.socket.on('fileTransferError', (data) => {
      this.handleFileTransferError(data);
    });
  }

  /**
   * Handle file selection from file input
   */
  handleFileSelection(files) {
    const fileArray = Array.from(files);
    const validFiles = [];

    for (const file of fileArray) {
      if (file.size > this.MAX_FILE_SIZE) {
        window.UIManager?.showPrompt(
          `File "${file.name}" exceeds 50MB limit`,
          'leave'
        );
        continue;
      }
      validFiles.push(file);
    }

    this.selectedFiles = validFiles;
    this.updateFilePreview();
    
    const sendBtn = document.getElementById('send-file-btn');
    sendBtn.disabled = validFiles.length === 0;
  }

  /**
   * Update file preview UI
   */
  updateFilePreview() {
    const previewContainer = document.getElementById('file-preview');
    previewContainer.innerHTML = '';

    this.selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-preview-item';
      fileItem.innerHTML = `
        <div class="file-info">
          <i class="fas fa-file text-purple-400"></i>
          <div class="flex-1 min-w-0">
            <div class="file-name">${this.escapeHtml(file.name)}</div>
            <div class="file-size">${this.formatFileSize(file.size)}</div>
          </div>
        </div>
        <i class="fas fa-times remove-file" data-index="${index}"></i>
      `;

      const removeBtn = fileItem.querySelector('.remove-file');
      removeBtn.addEventListener('click', () => {
        this.removeFile(index);
      });

      previewContainer.appendChild(fileItem);
    });
  }

  /**
   * Remove a file from selection
   */
  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.updateFilePreview();
    
    const sendBtn = document.getElementById('send-file-btn');
    sendBtn.disabled = this.selectedFiles.length === 0;
  }

  /**
   * Send selected files
   */
  async sendFiles() {
    if (this.selectedFiles.length === 0) return;

    const roomId = document.getElementById('room-id').value.trim();
    if (!roomId) {
      window.UIManager?.showPrompt('Please join a room first', 'leave');
      return;
    }

    // Check if private mode is active
    const isPrivateMode = window.privateConnectionManager?.isPrivateModeActive();
    const selectedPeerId = window.privateConnectionManager?.getSelectedPeerId();

    if (isPrivateMode) {
      if (!selectedPeerId) {
        window.UIManager?.showPrompt('Please select a connected peer', 'leave');
        return;
      }
    }

    for (const file of this.selectedFiles) {
      await this.sendFile(file, roomId, isPrivateMode, selectedPeerId);
    }

    // Clear selection after sending
    this.selectedFiles = [];
    this.updateFilePreview();
    document.getElementById('file-input').value = '';
    document.getElementById('send-file-btn').disabled = true;
  }

  /**
   * Send a single file in chunks
   */
  async sendFile(file, roomId, isPrivateMode = false, targetPeerId = null) {
    const fileId = this.generateFileId();
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

    // Notify start of transfer
    this.socket.emit('fileTransferStart', {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
      roomId,
      isPrivate: isPrivateMode,
      targetPeerId: targetPeerId
    });

    // Create transfer tracking
    this.activeTransfers.set(fileId, {
      fileName: file.name,
      totalChunks,
      sentChunks: 0,
      progress: 0
    });

    // Display upload progress in chat
    this.displayFileTransferProgress(fileId, file.name, file.size, 0, 'sending');

    // Read and send file in chunks
    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + this.CHUNK_SIZE);
      const arrayBuffer = await chunk.arrayBuffer();
      const base64Chunk = this.arrayBufferToBase64(arrayBuffer);

      this.socket.emit('fileChunk', {
        fileId,
        chunkIndex,
        chunk: base64Chunk,
        roomId,
        isPrivate: isPrivateMode,
        targetPeerId: targetPeerId
      });

      offset += this.CHUNK_SIZE;
      chunkIndex++;

      // Update progress
      const progress = Math.min((chunkIndex / totalChunks) * 100, 100);
      this.updateTransferProgress(fileId, progress, 'sending');

      // Small delay to prevent overwhelming the socket
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Notify completion
    this.socket.emit('fileTransferComplete', {
      fileId,
      roomId,
      isPrivate: isPrivateMode,
      targetPeerId: targetPeerId
    });
  }

  /**
   * Handle incoming file transfer start
   */
  handleFileTransferStart(data) {
    const { fileId, fileName, fileSize, totalChunks, sender } = data;

    console.log(`Starting file transfer: ${fileName} (${this.formatFileSize(fileSize)}) from ${sender}`);
    console.log(`Expected ${totalChunks} chunks`);

    this.receivedChunks.set(fileId, {
      fileName,
      fileSize,
      fileType: data.fileType || 'application/octet-stream',
      totalChunks,
      chunks: new Array(totalChunks), // Pre-allocate array with correct size
      receivedCount: 0,
      sender
    });

    this.displayFileTransferProgress(fileId, fileName, fileSize, 0, 'receiving', sender);
  }

  /**
   * Handle incoming file chunk
   */
  handleFileChunk(data) {
    const { fileId, chunkIndex, chunk } = data;
    const transfer = this.receivedChunks.get(fileId);

    if (!transfer) {
      console.warn('Received chunk for unknown transfer:', fileId);
      return;
    }

    // Store chunk at the correct index
    transfer.chunks[chunkIndex] = chunk;
    transfer.receivedCount++;

    const progress = (transfer.receivedCount / transfer.totalChunks) * 100;
    this.updateTransferProgress(fileId, progress, 'receiving');

    // Log progress
    if (transfer.receivedCount % 10 === 0 || transfer.receivedCount === transfer.totalChunks) {
      console.log(`Receiving ${transfer.fileName}: ${transfer.receivedCount}/${transfer.totalChunks} chunks (${Math.round(progress)}%)`);
    }

    // When all chunks received, verify completion
    if (transfer.receivedCount === transfer.totalChunks) {
      console.log('All chunks received, waiting for completion signal...');
    }
  }

  /**
   * Handle file transfer completion
   */
  handleFileTransferComplete(data) {
    const { fileId } = data;
    const transfer = this.receivedChunks.get(fileId);

    if (!transfer) {
      console.error('Transfer not found for fileId:', fileId);
      return;
    }

    // Verify all chunks are received
    if (transfer.receivedCount !== transfer.totalChunks) {
      console.warn(`Incomplete transfer: ${transfer.receivedCount}/${transfer.totalChunks} chunks`);
      window.UIManager?.showPrompt('File transfer incomplete. Try again.', 'leave');
      return;
    }

    try {
      // Reconstruct file from chunks (filter out undefined/null values)
      const base64Data = transfer.chunks.filter(chunk => chunk != null).join('');
      
      if (!base64Data) {
        throw new Error('No data received');
      }

      const binaryData = this.base64ToArrayBuffer(base64Data);
      const blob = new Blob([binaryData], { type: transfer.fileType || 'application/octet-stream' });

      // Update UI to show download button
      this.displayDownloadButton(fileId, transfer.fileName, blob);

      // Clean up
      this.receivedChunks.delete(fileId);
      
      console.log('File transfer completed successfully:', transfer.fileName);
    } catch (error) {
      console.error('Error reconstructing file:', error);
      window.UIManager?.showPrompt('Failed to reconstruct file', 'leave');
      
      // Show error in UI
      const transferElement = document.getElementById(`transfer-${fileId}`);
      if (transferElement) {
        const statusText = transferElement.querySelector('.file-transfer-status');
        if (statusText) {
          statusText.textContent = 'Error: Failed to reconstruct file';
          statusText.style.color = '#ef4444';
        }
      }
    }
  }

  /**
   * Handle file transfer error
   */
  handleFileTransferError(data) {
    const { fileId, error } = data;
    window.UIManager?.showPrompt(`File transfer failed: ${error}`, 'leave');
    
    // Clean up
    this.activeTransfers.delete(fileId);
    this.receivedChunks.delete(fileId);
  }

  /**
   * Display file transfer progress in chat
   */
  displayFileTransferProgress(fileId, fileName, fileSize, progress, status, sender = 'You') {
    const chatLog = document.getElementById('chat-log');
    
    // Remove empty state if present
    const emptyState = chatLog.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    let transferElement = document.getElementById(`transfer-${fileId}`);
    
    if (!transferElement) {
      transferElement = document.createElement('div');
      transferElement.id = `transfer-${fileId}`;
      transferElement.className = 'file-transfer-message';
      chatLog.appendChild(transferElement);
    }

    const statusText = status === 'sending' ? 'Sending' : 'Receiving';
    const statusIcon = status === 'sending' ? 'fa-upload' : 'fa-download';

    transferElement.innerHTML = `
      <div class="file-transfer-header">
        <div class="file-transfer-info">
          <i class="fas fa-file file-icon"></i>
          <div>
            <div class="file-transfer-name">${this.escapeHtml(fileName)}</div>
            <div class="file-transfer-size">${this.formatFileSize(fileSize)} • ${sender}</div>
          </div>
        </div>
        <i class="fas ${statusIcon} text-purple-400"></i>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="file-transfer-status">${statusText}... ${Math.round(progress)}%</div>
    `;

    chatLog.scrollTop = chatLog.scrollHeight;
  }

  /**
   * Update transfer progress
   */
  updateTransferProgress(fileId, progress, status) {
    const transferElement = document.getElementById(`transfer-${fileId}`);
    if (!transferElement) return;

    const progressFill = transferElement.querySelector('.progress-fill');
    const statusText = transferElement.querySelector('.file-transfer-status');
    
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    
    if (statusText) {
      const statusLabel = status === 'sending' ? 'Sending' : 'Receiving';
      statusText.textContent = `${statusLabel}... ${Math.round(progress)}%`;
    }
  }

  /**
   * Display download button when file is received
   */
  displayDownloadButton(fileId, fileName, blob) {
    const transferElement = document.getElementById(`transfer-${fileId}`);
    if (!transferElement) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'file-transfer-actions';
    actionsDiv.innerHTML = `
      <button class="download-btn" data-file-id="${fileId}">
        <i class="fas fa-download"></i>
        Download File
      </button>
    `;

    // Remove progress and status
    const progressBar = transferElement.querySelector('.progress-bar');
    const statusText = transferElement.querySelector('.file-transfer-status');
    if (progressBar) progressBar.remove();
    if (statusText) statusText.remove();

    transferElement.appendChild(actionsDiv);

    // Add download functionality
    const downloadBtn = actionsDiv.querySelector('.download-btn');
    downloadBtn.addEventListener('click', () => {
      this.downloadFile(blob, fileName);
    });
  }

  /**
   * Download file to user's device
   */
  downloadFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    window.UIManager?.showPrompt('File downloaded successfully!', 'join');
  }

  /**
   * Utility: Generate unique file ID
   */
  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
window.FileTransfer = FileTransfer;
