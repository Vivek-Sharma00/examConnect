import getConfig from '../config.js';
const config = getConfig();

class ApiService {
    constructor() {
        this.baseURL = config.API_BASE_URL;
        this.token = this.getToken();
    }

    // Token management
    getToken() {
        return localStorage.getItem(config.STORAGE_KEYS.TOKEN);
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem(config.STORAGE_KEYS.TOKEN, token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem(config.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(config.STORAGE_KEYS.USER);
    }

    // Get headers for requests
    getHeaders(additionalHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: this.getHeaders(options.headers),
            ...options
        };

        // Handle request body
        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle specific HTTP errors
                if (response.status === 401) {
                    this.removeToken();
                    window.location.href = '/authentication/index.html';
                    throw new Error('Authentication required');
                }

                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: { email, password }
        });

        if (data.success && data.token) {
            this.setToken(data.token);
            localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(data.user));
        }

        return data;
    }

    async register(userData) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: userData
        });

        if (data.success && data.token) {
            this.setToken(data.token);
            localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(data.user));
        }

        return data;
    }

    async logout() {
        try {
            await this.request('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.removeToken();
        }
    }

    async getCurrentUser() {
        const data = await this.request('/auth/me');
        if (data.success) {
            localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(data.user));
        }
        return data;
    }

    // User methods
    async updateProfile(profileData) {
        return await this.request('/auth/updatedetails', {
            method: 'PUT',
            body: profileData
        });
    }

    async updatePassword(currentPassword, newPassword) {
        return await this.request('/auth/updatepassword', {
            method: 'PUT',
            body: { currentPassword, newPassword }
        });
    }

    // Group methods
    async getGroups() {
        return await this.request('/groups');
    }

    async getGroup(groupId) {
        return await this.request(`/groups/${groupId}`);
    }

    async createGroup(groupData) {
        return await this.request('/groups', {
            method: 'POST',
            body: groupData
        });
    }

    async updateGroup(groupId, groupData) {
        return await this.request(`/groups/${groupId}`, {
            method: 'PUT',
            body: groupData
        });
    }

    async deleteGroup(groupId) {
        return await this.request(`/groups/${groupId}`, {
            method: 'DELETE'
        });
    }

    async joinGroup(groupId) {
        return await this.request(`/groups/${groupId}/join`, {
            method: 'POST'
        });
    }

    async leaveGroup(groupId) {
        return await this.request(`/groups/${groupId}/leave`, {
            method: 'POST'
        });
    }

    async getGroupMembers(groupId) {
        return await this.request(`/groups/${groupId}/members`);
    }

    async searchGroups(query) {
        return await this.request(`/groups/search?q=${encodeURIComponent(query)}`);
    }

    // Message methods
    async getGroupMessages(groupId, page = 1, limit = 50) {
        return await this.request(`/messages/groups/${groupId}?page=${page}&limit=${limit}`);
    }

    async sendMessage(groupId, content, type = 'text', replyTo = null) {
        return await this.request(`/messages/groups/${groupId}`, {
            method: 'POST',
            body: { content, type, replyTo }
        });
    }

    async sendFileMessage(groupId, file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/messages/groups/${groupId}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'File upload failed');
        }

        return data;
    }

    async editMessage(messageId, content) {
        return await this.request(`/messages/${messageId}`, {
            method: 'PUT',
            body: { content }
        });
    }

    async deleteMessage(messageId) {
        return await this.request(`/messages/${messageId}`, {
            method: 'DELETE'
        });
    }

    async markMessageAsRead(messageId) {
        return await this.request(`/messages/${messageId}/read`, {
            method: 'POST'
        });
    }

    async markAllAsRead(groupId) {
        return await this.request(`/messages/groups/${groupId}/read-all`, {
            method: 'POST'
        });
    }

    async getUnreadCount(groupId) {
        return await this.request(`/messages/groups/${groupId}/unread`);
    }

    async searchMessages(groupId, query) {
        return await this.request(`/messages/groups/${groupId}/search?q=${encodeURIComponent(query)}`);
    }

    // Quiz methods
    async getGroupQuizzes(groupId, status = 'active') {
        return await this.request(`/quizzes/groups/${groupId}?status=${status}`);
    }

    async getQuiz(quizId) {
        return await this.request(`/quizzes/${quizId}`);
    }

    async createQuiz(quizData) {
        return await this.request('/quizzes', {
            method: 'POST',
            body: quizData
        });
    }

    async updateQuiz(quizId, quizData) {
        return await this.request(`/quizzes/${quizId}`, {
            method: 'PUT',
            body: quizData
        });
    }

    async deleteQuiz(quizId) {
        return await this.request(`/quizzes/${quizId}`, {
            method: 'DELETE'
        });
    }

    async startQuiz(quizId) {
        return await this.request(`/quizzes/${quizId}/start`, {
            method: 'POST'
        });
    }

    async submitQuiz(quizId, answers, timeSpent, attemptId) {
        return await this.request(`/quizzes/${quizId}/submit`, {
            method: 'POST',
            body: { answers, timeSpent, attemptId }
        });
    }

    async getQuizResults(quizId) {
        return await this.request(`/quizzes/${quizId}/results`);
    }

    async getUserSubmissions() {
        return await this.request('/quizzes/user/submissions');
    }

    // Utility methods
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'File upload failed');
        }

        return data;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!localStorage.getItem(config.STORAGE_KEYS.USER);
    }

    // Get current user from localStorage
    getCurrentUserFromStorage() {
        const userStr = localStorage.getItem(config.STORAGE_KEYS.USER);
        return userStr ? JSON.parse(userStr) : null;
    }

    // Validate file before upload
    validateFile(file) {
        if (file.size > config.UPLOAD.MAX_FILE_SIZE) {
            throw new Error(`File size must be less than ${config.UPLOAD.MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }

        if (!config.UPLOAD.ALLOWED_TYPES.includes(file.type)) {
            throw new Error('File type not allowed');
        }

        return true;
    }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;