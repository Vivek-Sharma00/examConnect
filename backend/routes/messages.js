const express = require('express');
const {
    getMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    searchMessages,
    getMessage,
    sendFileMessage
} = require('../controllers/messageController');

const { protect, groupAuth } = require('../middleware/auth');
const { validate, messageValidation, validateFile, validateObjectId } = require('../middleware/validation');
const { upload, handleUploadErrors } = require('../config/upload');

const router = express.Router();

// All routes are protected
router.use(protect);

// Group message routes
router.get('/groups/:groupId', validateObjectId('groupId'), groupAuth('member'), getMessages);
router.post('/groups/:groupId', validateObjectId('groupId'), validate(messageValidation.create), groupAuth('member'), sendMessage);
router.get('/groups/:groupId/search', validateObjectId('groupId'), groupAuth('member'), searchMessages);
router.get('/groups/:groupId/unread', validateObjectId('groupId'), groupAuth('member'), getUnreadCount);
router.post('/groups/:groupId/read-all', validateObjectId('groupId'), groupAuth('member'), markAllAsRead);

// File upload route
router.post('/groups/:groupId/files', 
    validateObjectId('groupId'), 
    groupAuth('member'),
    upload.single('file'),
    handleUploadErrors,
    validateFile(),
    sendFileMessage
);

// Individual message routes
router.get('/:messageId', validateObjectId('messageId'), getMessage);
router.put('/:messageId', validateObjectId('messageId'), validate(messageValidation.update), editMessage);
router.delete('/:messageId', validateObjectId('messageId'), deleteMessage);
router.post('/:messageId/read', validateObjectId('messageId'), markAsRead);

module.exports = router;