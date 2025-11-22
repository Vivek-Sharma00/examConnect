const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: [true, 'Group ID is required']
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender ID is required']
    },
    type: {
        type: String,
        enum: ['text', 'quiz', 'file', 'system'],
        default: 'text',
        required: true
    },
    content: {
        // For text messages
        text: {
            type: String,
            trim: true,
            maxlength: [5000, 'Message cannot exceed 5000 characters']
        },
        // For file messages
        file: {
            filename: String,
            originalName: String,
            fileType: String,
            fileSize: Number,
            url: String,
            thumbnail: String // For image/video previews
        },
        // For quiz messages
        quiz: {
            question: String,
            type: {
                type: String,
                enum: ['multiple-choice', 'short-answer', 'true-false']
            },
            options: [String], // For multiple choice
            correctAnswer: String, // Or index for multiple choice
            deadline: Date,
            maxMarks: Number
        }
    },
    // For tracking message reads
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    // For replies
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    // For message editing
    edited: {
        isEdited: {
            type: Boolean,
            default: false
        },
        editedAt: Date,
        previousContent: mongoose.Schema.Types.Mixed
    },
    // For message deletion (soft delete)
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    // For system messages (user joined, left, etc.)
    systemAction: {
        type: String,
        enum: ['user_joined', 'user_left', 'group_created', 'quiz_posted', 'file_shared'],
        default: null
    }
}, {
    timestamps: true
});

// Indexes for better query performance
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ 'content.quiz.deadline': 1 });
messageSchema.index({ isDeleted: 1 });

// Virtual for message preview (first 100 chars)
messageSchema.virtual('preview').get(function() {
    if (this.type === 'text' && this.content.text) {
        return this.content.text.substring(0, 100) + (this.content.text.length > 100 ? '...' : '');
    } else if (this.type === 'file') {
        return `File: ${this.content.file.originalName}`;
    } else if (this.type === 'quiz') {
        return `Quiz: ${this.content.quiz.question.substring(0, 100)}...`;
    } else if (this.type === 'system') {
        return `System: ${this.systemAction}`;
    }
    return 'Message';
});

// Virtual for checking if message is a quiz
messageSchema.virtual('isQuiz').get(function() {
    return this.type === 'quiz';
});

// Virtual for checking if message is a file
messageSchema.virtual('isFile').get(function() {
    return this.type === 'file';
});

// Instance method to mark message as read by user
messageSchema.methods.markAsRead = function(userId) {
    const alreadyRead = this.readBy.some(read => 
        read.userId.toString() === userId.toString()
    );
    
    if (!alreadyRead) {
        this.readBy.push({
            userId: userId,
            readAt: new Date()
        });
        return true;
    }
    return false;
};

// Instance method to check if user has read the message
messageSchema.methods.hasRead = function(userId) {
    return this.readBy.some(read => 
        read.userId.toString() === userId.toString()
    );
};

// Instance method to edit message
messageSchema.methods.edit = function(newContent) {
    if (!this.edited.isEdited) {
        this.edited.previousContent = {
            text: this.content.text,
            editedAt: new Date()
        };
    }
    
    this.content.text = newContent;
    this.edited.isEdited = true;
    this.edited.editedAt = new Date();
};

// Instance method to soft delete message
messageSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
};

// Instance method to restore message
messageSchema.methods.restore = function() {
    this.isDeleted = false;
    this.deletedAt = null;
};

// Static method to get messages by group with pagination
messageSchema.statics.getGroupMessages = function(groupId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    
    return this.find({
        groupId: groupId,
        isDeleted: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'name email avatar role')
    .populate('replyTo', 'content.text senderId')
    .populate('replyTo.senderId', 'name avatar');
};

// Static method to get unread messages count for user in group
messageSchema.statics.getUnreadCount = function(groupId, userId) {
    return this.countDocuments({
        groupId: groupId,
        senderId: { $ne: userId }, // Not sent by the user
        isDeleted: false,
        'readBy.userId': { $ne: userId } // Not read by the user
    });
};

// Static method to mark all messages as read for user in group
messageSchema.statics.markAllAsRead = async function(groupId, userId) {
    const unreadMessages = await this.find({
        groupId: groupId,
        senderId: { $ne: userId },
        isDeleted: false,
        'readBy.userId': { $ne: userId }
    });

    const updatePromises = unreadMessages.map(message => {
        message.markAsRead(userId);
        return message.save();
    });

    return Promise.all(updatePromises);
};

// Static method to get quiz messages in a group
messageSchema.statics.getGroupQuizzes = function(groupId) {
    return this.find({
        groupId: groupId,
        type: 'quiz',
        isDeleted: false
    })
    .populate('senderId', 'name avatar role')
    .sort({ createdAt: -1 });
};

// Static method to search messages in group
messageSchema.statics.searchInGroup = function(groupId, searchTerm) {
    return this.find({
        groupId: groupId,
        isDeleted: false,
        $or: [
            { 'content.text': { $regex: searchTerm, $options: 'i' } },
            { 'content.quiz.question': { $regex: searchTerm, $options: 'i' } },
            { 'content.file.originalName': { $regex: searchTerm, $options: 'i' } }
        ]
    })
    .populate('senderId', 'name avatar role')
    .sort({ createdAt: -1 });
};

// Pre-save middleware to handle system messages
messageSchema.pre('save', function(next) {
    if (this.type === 'system' && !this.systemAction) {
        this.systemAction = 'system_message';
    }
    next();
});

// Transform output when converting to JSON
messageSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        // Remove deleted message content
        if (ret.isDeleted) {
            ret.content = { text: 'This message was deleted' };
            ret.senderId = null;
        }
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Message', messageSchema);