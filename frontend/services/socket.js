import config from '../config.js';
import apiService from './api.js';

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Event listeners
        this.listeners = new Map();
    }

    connect() {
        if (this.socket) {
            this.disconnect();
        }

        try {
            this.socket = io(config.SOCKET_URL, {
                auth: {
                    token: apiService.getToken()
                },
                transports: ['websocket', 'polling']
            });

            this.setupEventListeners();
        } catch (error) {
            console.error('Socket connection failed:', error);
            this.handleReconnection();
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('socket-connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.isConnected = false;
            this.emit('socket-disconnected', { reason });
            
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, try to reconnect
                this.socket.connect();
            } else {
                this.handleReconnection();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.emit('socket-error', { error });
            this.handleReconnection();
        });

        this.socket.on('new-message', (data) => {
            this.emit('new-message', data);
        });

        this.socket.on('user-typing', (data) => {
            this.emit('user-typing', data);
        });

        this.socket.on('user-stop-typing', (data) => {
            this.emit('user-stop-typing', data);
        });

        this.socket.on('message-read', (data) => {
            this.emit('message-read', data);
        });

        this.socket.on('quiz-submission-update', (data) => {
            this.emit('quiz-submission-update', data);
        });

        this.socket.on('user-status-change', (data) => {
            this.emit('user-status-change', data);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.emit('socket-error', { error });
        });
    }

    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('socket-reconnect-failed');
        }
    }

    // Join group rooms
    joinGroups(groupIds) {
        if (this.isConnected && this.socket) {
            this.socket.emit('join-groups', groupIds);
        }
    }

    leaveGroup(groupId) {
        if (this.isConnected && this.socket) {
            this.socket.emit('leave-group', groupId);
        }
    }

    // Send message
    sendMessage(groupId, content, type = 'text', replyTo = null) {
        if (this.isConnected && this.socket) {
            this.socket.emit('send-message', {
                groupId,
                content,
                type,
                replyTo
            });
        } else {
            throw new Error('Socket not connected');
        }
    }

    // Typing indicators
    startTyping(groupId) {
        if (this.isConnected && this.socket) {
            this.socket.emit('typing-start', { groupId });
        }
    }

    stopTyping(groupId) {
        if (this.isConnected && this.socket) {
            this.socket.emit('typing-stop', { groupId });
        }
    }

    // Mark message as read
    markMessageRead(messageId) {
        if (this.isConnected && this.socket) {
            this.socket.emit('mark-message-read', { messageId });
        }
    }

    // Quiz events
    notifyQuizSubmitted(groupId, quizId) {
        if (this.isConnected && this.socket) {
            this.socket.emit('quiz-submitted', {
                groupId,
                quizId,
                userId: apiService.getCurrentUserFromStorage()?.id
            });
        }
    }

    // User presence
    notifyUserOnline() {
        if (this.isConnected && this.socket) {
            this.socket.emit('user-online');
        }
    }

    // Event system for components
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Utility methods
    getConnectionStatus() {
        return this.isConnected;
    }

    // Reconnect manually
    reconnect() {
        this.reconnectAttempts = 0;
        this.connect();
    }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;