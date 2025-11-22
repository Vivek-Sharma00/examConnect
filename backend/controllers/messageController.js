const Message = require('../models/Message');
const Group = require('../models/Group');

// @desc    Get messages for a group
// @route   GET /api/messages/groups/:groupId
// @access  Private/Group Member
const getMessages = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const messages = await Message.getGroupMessages(req.params.groupId, parseInt(page), parseInt(limit));

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages.reverse() // Return in chronological order
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get single message
// @route   GET /api/messages/:messageId
// @access  Private
const getMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId)
            .populate('senderId', 'name email avatar role')
            .populate('replyTo', 'content.text senderId')
            .populate('replyTo.senderId', 'name avatar');

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user has access to this message's group
        const group = await Group.findById(message.groupId);
        if (!group || !group.isMember(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this message'
            });
        }

        res.status(200).json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Send message to group
// @route   POST /api/messages/groups/:groupId
// @access  Private/Group Member
const sendMessage = async (req, res) => {
    try {
        const { content, type = 'text', replyTo } = req.body;
        const groupId = req.params.groupId;

        // Check group settings
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if students are allowed to send messages
        if (req.user.role === 'student' && !group.settings.allowStudentMessages) {
            return res.status(403).json({
                success: false,
                message: 'Students are not allowed to send messages in this group'
            });
        }

        // Validate replyTo message exists and belongs to same group
        if (replyTo) {
            const repliedMessage = await Message.findOne({
                _id: replyTo,
                groupId: groupId
            });
            
            if (!repliedMessage) {
                return res.status(400).json({
                    success: false,
                    message: 'Replied message not found in this group'
                });
            }
        }

        // Create message
        const messageData = {
            groupId,
            senderId: req.user.id,
            type,
            content,
            replyTo: replyTo || null
        };

        const message = await Message.create(messageData);

        // Populate the message with user data
        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'name email avatar role')
            .populate('replyTo', 'content.text senderId')
            .populate('replyTo.senderId', 'name avatar');

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: populatedMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Edit message
// @route   PUT /api/messages/:messageId
// @access  Private
const editMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const messageId = req.params.messageId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to edit this message'
            });
        }

        // Check if message is not a system message
        if (message.type === 'system') {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit system messages'
            });
        }

        // Check if message is not deleted
        if (message.isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit deleted message'
            });
        }

        // Edit the message
        message.edit(content.text);
        await message.save();

        // Populate the updated message
        const updatedMessage = await Message.findById(message._id)
            .populate('senderId', 'name email avatar role')
            .populate('replyTo', 'content.text senderId')
            .populate('replyTo.senderId', 'name avatar');

        res.status(200).json({
            success: true,
            message: 'Message updated successfully',
            data: updatedMessage
        });
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error editing message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Delete message (soft delete)
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.messageId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is the sender or group admin
        const group = await Group.findById(message.groupId);
        const isSender = message.senderId.toString() === req.user.id;
        const isGroupAdmin = group.isAdmin(req.user.id);

        if (!isSender && !isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this message'
            });
        }

        // Check if message is not a system message
        if (message.type === 'system') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete system messages'
            });
        }

        // Soft delete the message
        message.softDelete();
        await message.save();

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Mark message as read
// @route   POST /api/messages/:messageId/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const messageId = req.params.messageId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user has access to this message's group
        const group = await Group.findById(message.groupId);
        if (!group || !group.isMember(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this message'
            });
        }

        // Don't mark own messages as read
        if (message.senderId.toString() === req.user.id) {
            return res.status(200).json({
                success: true,
                message: 'Message already read (own message)'
            });
        }

        // Mark as read
        const marked = message.markAsRead(req.user.id);
        if (marked) {
            await message.save();
        }

        res.status(200).json({
            success: true,
            message: marked ? 'Message marked as read' : 'Message already read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Mark all messages as read in a group
// @route   POST /api/messages/groups/:groupId/read-all
// @access  Private/Group Member
const markAllAsRead = async (req, res) => {
    try {
        const groupId = req.params.groupId;

        await Message.markAllAsRead(groupId, req.user.id);

        res.status(200).json({
            success: true,
            message: 'All messages marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking messages as read',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get unread messages count for a group
// @route   GET /api/messages/groups/:groupId/unread
// @access  Private/Group Member
const getUnreadCount = async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const count = await Message.getUnreadCount(groupId, req.user.id);

        res.status(200).json({
            success: true,
            data: { unreadCount: count }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Search messages in a group
// @route   GET /api/messages/groups/:groupId/search
// @access  Private/Group Member
const searchMessages = async (req, res) => {
    try {
        const { q: searchTerm } = req.query;
        const groupId = req.params.groupId;

        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                message: 'Search term is required'
            });
        }

        const messages = await Message.searchInGroup(groupId, searchTerm);

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error('Search messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Send file message
// @route   POST /api/messages/groups/:groupId/files
// @access  Private/Group Member
const sendFileMessage = async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        // Check group settings
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (!group.settings.allowFileUploads) {
            return res.status(403).json({
                success: false,
                message: 'File uploads are not allowed in this group'
            });
        }

        // Create file message
        const messageData = {
            groupId,
            senderId: req.user.id,
            type: 'file',
            content: {
                file: {
                    filename: file.filename,
                    originalName: file.originalname,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    url: `/uploads/${file.filename}`,
                    thumbnail: file.mimetype.startsWith('image/') ? `/uploads/thumbnails/${file.filename}` : null
                }
            }
        };

        const message = await Message.create(messageData);

        // Populate the message
        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'name email avatar role');

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            data: populatedMessage
        });
    } catch (error) {
        console.error('Send file message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Send quiz message
// @route   POST /api/messages/groups/:groupId/quizzes
// @access  Private/Group Member
const sendQuizMessage = async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { quiz } = req.body;

        // Check group settings
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Only admins can send quizzes if setting is disabled
        if (!group.settings.allowQuizCreation && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Quiz creation is not allowed in this group'
            });
        }

        // Create quiz message
        const messageData = {
            groupId,
            senderId: req.user.id,
            type: 'quiz',
            content: {
                quiz: {
                    question: quiz.question,
                    type: quiz.type,
                    options: quiz.options || [],
                    correctAnswer: quiz.correctAnswer,
                    deadline: new Date(quiz.deadline),
                    maxMarks: quiz.maxMarks || 1
                }
            }
        };

        const message = await Message.create(messageData);

        // Populate the message
        const populatedMessage = await Message.findById(message._id)
            .populate('senderId', 'name email avatar role');

        res.status(201).json({
            success: true,
            message: 'Quiz posted successfully',
            data: populatedMessage
        });
    } catch (error) {
        console.error('Send quiz message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error posting quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getMessages,
    getMessage,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    searchMessages,
    sendFileMessage,
    sendQuizMessage
};