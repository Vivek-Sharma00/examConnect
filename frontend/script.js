// --- Authentication Helpers ---
function login() {
    // Generate dummy token
    localStorage.setItem("token", "demo-" + Date.now());
    alert("Logged in! Token created.");
}

function isLoggedIn() {
    return localStorage.getItem("token") !== null;
}

function logout() {
    localStorage.removeItem("token");
    alert("Logged out! Token removed.");
}

// --- Navigation Functions ---
function navigateToAuth() {
    window.location.href = "authentication/index.html";
}

function checkAuth() {
    if (isLoggedIn()) {
        window.location.href = "chat/index.html";
    } else {
        window.location.href = "authentication/index.html";
    }
}

function demoLogin() {
    // Generate dummy token for demo
    localStorage.setItem("token", "demo-" + Date.now());
    alert("Demo: You are now logged in. Click 'Get Started' to access the chat page.");
}

function demoLogout() {
    localStorage.removeItem("token");
    alert("Demo: You are now logged out.");
}

// --- Initialize Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    // Check if elements exist before adding event listeners
    const authBtn = document.getElementById('authBtn');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const demoLoginBtn = document.getElementById('demoLogin');
    const demoLogoutBtn = document.getElementById('demoLogout');
    
    // Add event listeners only if elements exist
    if (authBtn) {
        authBtn.addEventListener('click', navigateToAuth);
    }
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', checkAuth);
    }
    
    if (demoLoginBtn) {
        demoLoginBtn.addEventListener('click', demoLogin);
    }
    
    if (demoLogoutBtn) {
        demoLogoutBtn.addEventListener('click', demoLogout);
    }
    
    // Make functions globally available for onclick attributes
    window.navigateToAuth = navigateToAuth;
    window.checkAuth = checkAuth;
    window.demoLogin = demoLogin;
    window.demoLogout = demoLogout;
    
    console.log('ExamConnect script loaded successfully');
    
    // Check initial auth status
    if (isLoggedIn()) {
        console.log('User is currently logged in');
    } else {
        console.log('User is not logged in');
    }
});

// --- Utility Functions ---
function getAuthToken() {
    return localStorage.getItem("token");
}

function setAuthToken(token) {
    localStorage.setItem("token", token);
}

function clearAuth() {
    localStorage.removeItem("token");
}

function redirectToChat() {
    window.location.href = "chat/index.html";
}

function redirectToAuth() {
    window.location.href = "authentication/index.html";
}

// --- Export functions for global use ---
window.login = login;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuth = clearAuth;
window.redirectToChat = redirectToChat;
window.redirectToAuth = redirectToAuth;