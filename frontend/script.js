// --- Helpers ---
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

// --- Buttons ---
document.getElementById("authBtn").addEventListener("click", () => {
    window.location.href = "authentication/index.html";
});

document.getElementById("getStartedBtn").addEventListener("click", () => {
    if (isLoggedIn()) {
        window.location.href = "chat/index.html";
    } else {
        window.location.href = "authentication/index.html";
    }
});

document.getElementById("demoLogin").addEventListener("click", login);
document.getElementById("demoLogout").addEventListener("click", logout);
