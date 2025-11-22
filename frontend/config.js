// Frontend Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    SOCKET_URL: 'http://localhost:3000',
    UPLOAD_URL: 'http://localhost:3000/uploads',
    
    // LocalStorage keys
    STORAGE_KEYS: {
        TOKEN: 'examConnectToken',
        USER: 'examConnectUser',
        THEME: 'examConnectTheme'
    },
    
    // Default settings
    DEFAULTS: {
        THEME: 'dark',
        MESSAGES_PER_PAGE: 50,
        GROUPS_PER_PAGE: 20
    },
    
    // File upload settings
    UPLOAD: {
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        ALLOWED_TYPES: [
            'image/jpeg',
            'image/png', 
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ]
    }
};

// Environment-specific configuration
const getConfig = () => {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return CONFIG; // Development
    } else {
        // Production - update these URLs for your production server
        return {
            ...CONFIG,
            API_BASE_URL: 'https://examconnect-backend.onrender.com/api',
            SOCKET_URL: 'https://examconnect-backend.onrender.com',
            UPLOAD_URL: 'https://examconnect-backend.onrender.com/uploads'
        };
    }
};

export default getConfig();