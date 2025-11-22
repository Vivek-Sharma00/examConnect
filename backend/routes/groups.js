const express = require('express');
const {
    getGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    leaveGroup,
    addMember,
    removeMember,
    updateMemberRole,
    getGroupMembers,
    getGroupMessages,
    getGroupQuizzes,
    searchGroups
} = require('../controllers/groupController');

const { protect, authorize, groupAuth } = require('../middleware/auth');
const { validate, groupValidation, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getGroups);
router.get('/search', searchGroups);
router.post('/', validate(groupValidation.create), createGroup);

router.get('/:groupId', validateObjectId('groupId'), groupAuth('member'), getGroup);
router.put('/:groupId', validateObjectId('groupId'), validate(groupValidation.update), groupAuth('admin'), updateGroup);
router.delete('/:groupId', validateObjectId('groupId'), groupAuth('admin'), deleteGroup);

// Membership routes
router.post('/:groupId/join', validateObjectId('groupId'), joinGroup);
router.post('/:groupId/leave', validateObjectId('groupId'), groupAuth('member'), leaveGroup);
router.get('/:groupId/members', validateObjectId('groupId'), groupAuth('member'), getGroupMembers);
router.post('/:groupId/members', validateObjectId('groupId'), groupAuth('admin'), addMember);
router.delete('/:groupId/members/:userId', validateObjectId('groupId'), validateObjectId('userId'), groupAuth('admin'), removeMember);
router.put('/:groupId/members/:userId/role', validateObjectId('groupId'), validateObjectId('userId'), groupAuth('admin'), updateMemberRole);

// Group content routes
router.get('/:groupId/messages', validateObjectId('groupId'), groupAuth('member'), getGroupMessages);
router.get('/:groupId/quizzes', validateObjectId('groupId'), groupAuth('member'), getGroupQuizzes);

module.exports = router;