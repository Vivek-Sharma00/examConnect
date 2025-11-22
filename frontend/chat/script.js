import apiService from '../services/api.js';
import socketService from '../services/socket.js';
import config from '../config.js';

class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentGroup = null;
        this.groups = [];
        this.messages = new Map(); // groupId -> messages array
        this.isConnected = false;
        this.typingUsers = new Map(); // groupId -> Set of user names

        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Check authentication
            if (!apiService.isAuthenticated()) {
                window.location.href = '../authentication/index.html';
                return;
            }

            // Load current user
            await this.loadCurrentUser();

            // Initialize socket connection
            this.initializeSocket();

            // Load groups
            await this.loadGroups();

            // Setup event listeners
            this.setupEventListeners();

            // Update UI
            this.updateUI();

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to load chat. Please refresh the page.');
        }
    }

    async loadCurrentUser() {
        try {
            const user = apiService.getCurrentUserFromStorage();
            if (user) {
                this.currentUser = user;
                this.updateUserInfo();
            } else {
                const response = await apiService.getCurrentUser();
                if (response.success) {
                    this.currentUser = response.user;
                    this.updateUserInfo();
                } else {
                    throw new Error('Failed to load user data');
                }
            }
        } catch (error) {
            console.error('Error loading user:', error);
            throw error;
        }
    }

    async loadGroups() {
        try {
            this.showGroupsLoading();

            const response = await apiService.getGroups();

            if (response.success) {
                this.groups = response.data;
                this.renderGroups();

                // Join socket rooms for all groups
                const groupIds = this.groups.map(group => group._id);
                socketService.joinGroups(groupIds);
            } else {
                throw new Error(response.message || 'Failed to load groups');
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            this.showGroupsError(error.message);
        }
    }

    async loadMessages(groupId) {
        try {
            this.showMessagesLoading();

            const response = await apiService.getGroupMessages(groupId);

            if (response.success) {
                this.messages.set(groupId, response.data);
                this.renderMessages();

                // Mark all messages as read
                await apiService.markAllAsRead(groupId);
            } else {
                throw new Error(response.message || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showMessagesError(error.message);
        }
    }

    initializeSocket() {
        // Connect to socket
        socketService.connect();

        // Setup socket event listeners
        socketService.on('socket-connected', () => {
            this.handleSocketConnected();
        });

        socketService.on('socket-disconnected', (data) => {
            this.handleSocketDisconnected(data);
        });

        socketService.on('new-message', (data) => {
            this.handleNewMessage(data);
        });

        socketService.on('user-typing', (data) => {
            this.handleUserTyping(data);
        });

        socketService.on('user-stop-typing', (data) => {
            this.handleUserStopTyping(data);
        });

        socketService.on('message-read', (data) => {
            this.handleMessageRead(data);
        });

        socketService.on('user-status-change', (data) => {
            this.handleUserStatusChange(data);
        });

        socketService.on('socket-error', (data) => {
            this.handleSocketError(data);
        });
    }

    setupEventListeners() {
        // Message input
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-message-btn');

        messageInput.addEventListener('input', () => {
            this.handleMessageInput();
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Group search
        const groupSearch = document.getElementById('group-search');
        groupSearch.addEventListener('input', (e) => {
            this.filterGroups(e.target.value);
        });

        // Modal handlers
        this.setupModalHandlers();

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshData();
        });
    }

    setupModalHandlers() {
        // Create group modal
        document.getElementById('create-group-btn').addEventListener('click', () => {
            this.openModal('create-group-modal');
        });

        document.getElementById('create-group-submit').addEventListener('click', () => {
            this.createGroup();
        });

        // Quiz modal
        document.getElementById('send-quiz-btn').addEventListener('click', () => {
            this.openModal('quiz-modal');
        });

        document.getElementById('send-quiz-submit').addEventListener('click', () => {
            this.sendQuiz();
        });

        // File modal
        document.getElementById('attach-file-btn').addEventListener('click', () => {
            this.openModal('file-modal');
        });

        document.getElementById('send-file-btn').addEventListener('click', () => {
            this.sendFile();
        });

        // File upload handling
        const fileInput = document.getElementById('file-input');
        const fileUploadArea = document.getElementById('file-upload-area');

        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.style.borderColor = 'var(--secondary-color)';
            fileUploadArea.style.background = 'rgba(37, 117, 252, 0.1)';
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            fileUploadArea.style.background = 'transparent';
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            fileUploadArea.style.background = 'transparent';

            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // UI Update Methods
    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('user-name').textContent = this.currentUser.name;
            document.getElementById('user-role').textContent = this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1);
        }
    }

    renderGroups() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = '';

        if (this.groups.length === 0) {
            groupsList.innerHTML = `
                <div class="no-groups">
                    <i class="fas fa-users"></i>
                    <p>No groups yet</p>
                    <button class="btn-secondary" onclick="chatApp.openModal('create-group-modal')">
                        Create Your First Group
                    </button>
                </div>
            `;
            return;
        }

        this.groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = `group-item ${this.currentGroup?._id === group._id ? 'active' : ''}`;
            groupElement.innerHTML = `
                <div class="group-icon">${group.name.charAt(0).toUpperCase()}</div>
                <div class="group-info">
                    <div class="group-name">${group.name}</div>
                    <div class="group-members">${group.memberCount || group.members.length} members</div>
                </div>
                ${this.hasUnreadMessages(group._id) ? '<div class="notification-badge"></div>' : ''}
            `;

            groupElement.addEventListener('click', () => {
                this.selectGroup(group);
            });

            groupsList.appendChild(groupElement);
        });
    }

    renderMessages() {
        const messagesContainer = document.getElementById('messages-container');

        if (!this.currentGroup) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to ExamConnect Chat</h3>
                    <p>Select a group from the sidebar to start chatting</p>
                </div>
            `;
            return;
        }

        const messages = this.messages.get(this.currentGroup._id) || [];

        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation by sending the first message</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        const isCurrentUser = message.senderId._id === this.currentUser.id;

        messageDiv.className = `message ${message.senderId.role} ${isCurrentUser ? 'own-message' : ''}`;

        if (message.type === 'text') {
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="sender-name">${message.senderId.name}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.content.text)}</div>
                ${message.edited?.isEdited ? '<div class="message-edited">(edited)</div>' : ''}
            `;
        } else if (message.type === 'file') {
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="sender-name">${message.senderId.name}</span>
                    <span class="message-time">${this.formatTime(message.timestamp)}</span>
                </div>
                <div class="file-message">
                    <div class="file-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${message.content.file.originalName}</div>
                        <div class="file-size">${this.formatFileSize(message.content.file.fileSize)}</div>
                    </div>
                    <button class="download-btn" title="Download file" onclick="chatApp.downloadFile('${message.content.file.url}', '${message.content.file.originalName}')">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
        } else if (message.type === 'system') {
            messageDiv.className = 'message system';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-info-circle"></i> ${message.content.text}
                </div>
            `;
        }

        return messageDiv;
    }

    // Message Handling
    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();

        if (!content || !this.currentGroup) return;

        try {
            // Disable input while sending
            messageInput.disabled = true;

            if (socketService.getConnectionStatus()) {
                // Send via WebSocket for real-time delivery
                socketService.sendMessage(this.currentGroup._id, { text: content }, 'text');
            } else {
                // Fallback to REST API
                const response = await apiService.sendMessage(this.currentGroup._id, { text: content }, 'text');

                if (response.success) {
                    this.handleNewMessage({ data: response.data });
                } else {
                    throw new Error(response.message || 'Failed to send message');
                }
            }

            // Clear input
            messageInput.value = '';
            this.stopTyping();

        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message: ' + error.message);
        } finally {
            messageInput.disabled = false;
            messageInput.focus();
        }
    }

    async sendFile() {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];

        if (!file || !this.currentGroup) return;

        try {
            this.setButtonLoading('send-file-btn', true);

            // Validate file
            apiService.validateFile(file);

            // Send file
            const response = await apiService.sendFileMessage(this.currentGroup._id, file);

            if (response.success) {
                this.handleNewMessage({ data: response.data });
                this.closeModal('file-modal');
                this.clearFileInput();
            } else {
                throw new Error(response.message || 'Failed to upload file');
            }

        } catch (error) {
            console.error('Error sending file:', error);
            this.showError('Failed to upload file: ' + error.message);
        } finally {
            this.setButtonLoading('send-file-btn', false);
        }
    }

    // Group Management
    async selectGroup(group) {
        this.currentGroup = group;

        // Update UI
        this.updateGroupHeader();
        this.enableMessageInput();
        this.renderGroups(); // Re-render to update active state

        // Load messages
        await this.loadMessages(group._id);

        // Notify socket of group selection
        socketService.leaveGroup(this.currentGroup._id);
        socketService.joinGroups([this.currentGroup._id]);
    }

    async createGroup() {
        const name = document.getElementById('group-name').value.trim();
        const description = document.getElementById('group-description').value.trim();

        if (!name) {
            this.showError('Group name is required');
            return;
        }

        try {
            this.setButtonLoading('create-group-submit', true);

            const response = await apiService.createGroup({
                name,
                description,
                maxMembers: 500
            });

            if (response.success) {
                this.groups.push(response.data);
                this.renderGroups();
                this.closeModal('create-group-modal');
                this.clearCreateGroupForm();

                // Select the new group
                this.selectGroup(response.data);
            } else {
                throw new Error(response.message || 'Failed to create group');
            }

        } catch (error) {
            console.error('Error creating group:', error);
            this.showError('Failed to create group: ' + error.message);
        } finally {
            this.setButtonLoading('create-group-submit', false);
        }
    }

    // Socket Event Handlers
    handleSocketConnected() {
        this.isConnected = true;
        this.updateConnectionStatus('connected', 'Connected');

        // Rejoin current group if any
        if (this.currentGroup) {
            socketService.joinGroups([this.currentGroup._id]);
        }
    }

    handleSocketDisconnected(data) {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
    }

    handleNewMessage(data) {
        if (!data.data) return;

        const message = data.data;

        // Add message to appropriate group
        if (!this.messages.has(message.groupId)) {
            this.messages.set(message.groupId, []);
        }

        const groupMessages = this.messages.get(message.groupId);
        groupMessages.push(message);

        // Update UI if this is the current group
        if (this.currentGroup && this.currentGroup._id === message.groupId) {
            this.renderMessages();

            // Mark as read if not our own message
            if (message.senderId._id !== this.currentUser.id) {
                socketService.markMessageRead(message._id);
            }
        } else {
            // Show notification badge
            this.renderGroups();
        }
    }

    handleUserTyping(data) {
        if (!this.currentGroup || data.groupId !== this.currentGroup._id) return;

        if (!this.typingUsers.has(data.groupId)) {
            this.typingUsers.set(data.groupId, new Set());
        }

        const typingUsers = this.typingUsers.get(data.groupId);
        typingUsers.add(data.userName);

        this.showTypingIndicator();
    }

    handleUserStopTyping(data) {
        if (!this.currentGroup || data.groupId !== this.currentGroup._id) return;

        const typingUsers = this.typingUsers.get(data.groupId);
        if (typingUsers) {
            // We don't know which user stopped, so we'll clear after a delay
            setTimeout(() => {
                this.hideTypingIndicator();
            }, 1000);
        }
    }

    // Utility Methods
    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateConnectionStatus(status, message) {
        const statusElement = document.getElementById('connection-status');
        statusElement.className = `connection-status ${status}`;
        statusElement.innerHTML = `<i class="fas fa-wifi"></i><span>${message}</span>`;
    }

    showError(message) {
        // You can implement a toast notification system here
        alert(message); // Temporary simple alert
    }

    // ... (other utility methods)

    handleMessageInput() {
        if (this.currentGroup && socketService.getConnectionStatus()) {
            socketService.startTyping(this.currentGroup._id);

            // Clear typing timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }

            this.typingTimeout = setTimeout(() => {
                this.stopTyping();
            }, 1000);
        }
    }

    stopTyping() {
        if (this.currentGroup && socketService.getConnectionStatus()) {
            socketService.stopTyping(this.currentGroup._id);
        }

        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }

    showTypingIndicator() {
        let indicator = document.getElementById('typing-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'typing-indicator';
            document.getElementById('messages-container').appendChild(indicator);
        }

        const typingUsers = Array.from(this.typingUsers.get(this.currentGroup._id) || []);
        const names = typingUsers.join(', ');

        indicator.innerHTML = `
            <div class="typing-dots">
                ${names} is typing<span>.</span><span>.</span><span>.</span>
            </div>
        `;

        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    hasUnreadMessages(groupId) {
        // Implement logic to check for unread messages
        return false; // Placeholder
    }

    downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    }

    // Modal Methods
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // ... (other modal methods)

    updateGroupHeader() {
        if (this.currentGroup) {
            document.getElementById('current-group-name').textContent = this.currentGroup.name;
            document.getElementById('member-count').textContent = `${this.currentGroup.memberCount || this.currentGroup.members.length} members`;
        }
    }

    enableMessageInput() {
        document.getElementById('message-input').disabled = false;
        document.getElementById('send-message-btn').disabled = false;
    }

    showGroupsLoading() {
        document.getElementById('groups-list').innerHTML = `
            <div class="loading-groups">
                <i class="fas fa-spinner fa-spin"></i> Loading groups...
            </div>
        `;
    }

    showGroupsError(message) {
        document.getElementById('groups-list').innerHTML = `
            <div class="error-message">
                <p>Failed to load groups: ${message}</p>
                <button class="retry-button" onclick="chatApp.loadGroups()">Retry</button>
            </div>
        `;
    }

    showMessagesLoading() {
        document.getElementById('messages-container').innerHTML = `
            <div class="loading-messages">
                <i class="fas fa-spinner fa-spin"></i> Loading messages...
            </div>
        `;
    }

    showMessagesError(message) {
        document.getElementById('messages-container').innerHTML = `
            <div class="error-message">
                <p>Failed to load messages: ${message}</p>
                <button class="retry-button" onclick="chatApp.loadMessages('${this.currentGroup._id}')">Retry</button>
            </div>
        `;
    }

    setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const text = document.getElementById(buttonId + '-text');
        const spinner = document.getElementById(buttonId + '-spinner');

        if (isLoading) {
            button.disabled = true;
            button.classList.add('btn-loading');
            if (text) text.style.display = 'none';
            if (spinner) spinner.style.display = 'inline';
        } else {
            button.disabled = false;
            button.classList.remove('btn-loading');
            if (text) text.style.display = 'inline';
            if (spinner) spinner.style.display = 'none';
        }
    }

    handleFileSelect(file) {
        try {
            apiService.validateFile(file);

            // Show file preview
            const preview = document.getElementById('file-preview');
            const fileName = document.getElementById('file-name');
            const sendButton = document.getElementById('send-file-btn');

            fileName.textContent = file.name;
            preview.style.display = 'block';
            sendButton.disabled = false;

        } catch (error) {
            this.showError(error.message);
            this.clearFileInput();
        }
    }

    clearFileInput() {
        const fileInput = document.getElementById('file-input');
        const preview = document.getElementById('file-preview');
        const sendButton = document.getElementById('send-file-btn');

        fileInput.value = '';
        preview.style.display = 'none';
        sendButton.disabled = true;
    }

    clearCreateGroupForm() {
        document.getElementById('group-name').value = '';
        document.getElementById('group-description').value = '';
    }

    filterGroups(searchTerm) {
        const groupItems = document.querySelectorAll('.group-item');

        groupItems.forEach(item => {
            const groupName = item.querySelector('.group-name').textContent.toLowerCase();
            if (groupName.includes(searchTerm.toLowerCase())) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async refreshData() {
        try {
            await this.loadGroups();
            if (this.currentGroup) {
                await this.loadMessages(this.currentGroup._id);
            }
            this.showError('Data refreshed successfully');
        } catch (error) {
            this.showError('Failed to refresh data: ' + error.message);
        }
    }

    handleMessageRead(data) {
        // Update message read status in UI if needed
        console.log('Message read:', data);
    }

    handleUserStatusChange(data) {
        // Update user online status in UI if needed
        console.log('User status changed:', data);
    }

    handleSocketError(data) {
        console.error('Socket error:', data.error);
        this.showError('Connection error: ' + (data.error?.message || 'Unknown error'));
    }

    // Quiz functionality (simplified)
    sendQuiz() {
        // Implement quiz creation and sending
        this.showError('Quiz functionality coming soon!');
        this.closeModal('quiz-modal');
    }

    // Logout functionality
    logout() {
        socketService.disconnect();
        apiService.logout();
        window.location.href = '../index.html';
    }

    // Update UI state
    updateUI() {
        // Add logout button to header
        const chatHeader = document.querySelector('.chat-header .chat-actions');
        if (!document.getElementById('logout-btn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logout-btn';
            logoutBtn.className = 'icon-btn';
            logoutBtn.title = 'Logout';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            logoutBtn.addEventListener('click', () => this.logout());
            chatHeader.appendChild(logoutBtn);
        }
    }
}

// Initialize the chat application when DOM is loaded
let chatApp;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        chatApp = new ChatApp();

        // Make chatApp globally available for HTML onclick handlers
        window.chatApp = chatApp;

        // Global function for file handling
        window.clearFile = () => chatApp.clearFileInput();

    } catch (error) {
        console.error('Failed to initialize chat application:', error);
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; color: white;">
                <h2>Failed to load chat</h2>
                <p>${error.message}</p>
                <button onclick="window.location.href='../authentication/index.html'" 
                        style="padding: 10px 20px; background: #2575fc; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px;">
                    Go to Login
                </button>
            </div>
        `;
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (chatApp) {
        chatApp.stopTyping();
        socketService.disconnect();
    }
});

// Export for testing
export default ChatApp;