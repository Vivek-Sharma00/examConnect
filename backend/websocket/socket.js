const socketIO = require('socket.io');
const { getUserFromToken } = require('../middleware/auth');
const Message = require('../models/Message');
const Group = require('../models/Group');

const configureSocket = (server) => {
    const io = socketIO(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5500",
            methods: ["GET", "POST"]
        }
    });

    // Middleware for socket authentication
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const user = await getUserFromToken(token);
            if (!user) {
                return next(new Error('Authentication error: Invalid token'));
            }

            socket.userId = user._id;
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User ${socket.user.name} (${socket.userId}) connected`);

        // Join user to their personal room for notifications
        socket.join(`user_${socket.userId}`);

        // Handle joining group rooms
        socket.on('join-groups', async (groupIds) => {
            try {
                groupIds.forEach(groupId => {
                    socket.join(`group_${groupId}`);
                    console.log(`User ${socket.user.name} joined group ${groupId}`);
                });
            } catch (error) {
                console.error('Error joining groups:', error);
            }
        });

        // Handle leaving group rooms
        socket.on('leave-group', (groupId) => {
            socket.leave(`group_${groupId}`);
            console.log(`User ${socket.user.name} left group ${groupId}`);
        });

        // Handle new message
        socket.on('send-message', async (data) => {
            try {
                const { groupId, content, type, replyTo } = data;

                // Verify user is member of the group
                const group = await Group.findById(groupId);
                if (!group || !group.isMember(socket.userId)) {
                    socket.emit('error', { message: 'Not authorized to send messages in this group' });
                    return;
                }

                // Check group settings for student messages
                if (socket.user.role === 'student' && !group.settings.allowStudentMessages) {
                    socket.emit('error', { message: 'Students are not allowed to send messages in this group' });
                    return;
                }

                // Create message in database
                const message = await Message.create({
                    groupId,
                    senderId: socket.userId,
                    type: type || 'text',
                    content,
                    replyTo: replyTo || null
                });

                // Populate message with user data
                const populatedMessage = await Message.findById(message._id)
                    .populate('senderId', 'name email avatar role')
                    .populate('replyTo', 'content.text senderId')
                    .populate('replyTo.senderId', 'name avatar');

                // Broadcast to all users in the group
                io.to(`group_${groupId}`).emit('new-message', {
                    success: true,
                    data: populatedMessage
                });

            } catch (error) {
                console.error('Error sending message via socket:', error);
                socket.emit('error', { message: 'Error sending message' });
            }
        });

        // Handle typing indicators
        socket.on('typing-start', (data) => {
            const { groupId } = data;
            socket.to(`group_${groupId}`).emit('user-typing', {
                userId: socket.userId,
                userName: socket.user.name,
                groupId
            });
        });

        socket.on('typing-stop', (data) => {
            const { groupId } = data;
            socket.to(`group_${groupId}`).emit('user-stop-typing', {
                userId: socket.userId,
                groupId
            });
        });

        // Handle message read receipts
        socket.on('mark-message-read', async (data) => {
            try {
                const { messageId } = data;
                const message = await Message.findById(messageId);
                
                if (message && message.senderId.toString() !== socket.userId) {
                    message.markAsRead(socket.userId);
                    await message.save();

                    // Notify sender that message was read
                    io.to(`user_${message.senderId}`).emit('message-read', {
                        messageId,
                        readBy: socket.userId,
                        readAt: new Date()
                    });
                }
            } catch (error) {
                console.error('Error marking message as read:', error);
            }
        });

        // Handle quiz events
        socket.on('quiz-submitted', (data) => {
            const { groupId, quizId, userId } = data;
            socket.to(`group_${groupId}`).emit('quiz-submission-update', {
                quizId,
                userId,
                submittedAt: new Date()
            });
        });

        // Handle user presence
        socket.on('user-online', () => {
            // Broadcast to all groups user is in that they're online
            socket.broadcast.emit('user-status-change', {
                userId: socket.userId,
                status: 'online',
                lastSeen: new Date()
            });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`User ${socket.user.name} disconnected: ${reason}`);
            
            // Broadcast user offline status
            socket.broadcast.emit('user-status-change', {
                userId: socket.userId,
                status: 'offline',
                lastSeen: new Date()
            });
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    return io;
};

module.exports = configureSocket;