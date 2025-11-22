const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');

const connectDB = require('./config/database');
const configureSocket = require('./websocket/socket');

// Load env variables
dotenv.config();

// Connect MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// ======================
// ✅ Middleware
// ======================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS – production safe
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ======================
// ✅ Routes
// ======================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/quizzes', require('./routes/quizzes'));

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: '✅ ExamConnect API is running',
        time: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ======================
// ✅ 404 Handler
// ======================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '❌ API route not found'
    });
});

// ======================
// ✅ Global Error Handler
// ======================

app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ======================
// ✅ Start Server
// ======================

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
});

// ======================
// ✅ Socket.IO Setup
// ======================

const io = configureSocket(server);
console.log('🔌 WebSocket server initialized');

// ======================
// ✅ Handle Critical Errors
// ======================

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

module.exports = app;
