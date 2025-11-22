const express = require('express');
const {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
    getUserGroups
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');
const { validate, userValidation, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// All routes are protected and admin-only (except getUserGroups which has special permissions)
router.use(protect);
router.use(authorize('admin'));

router.get('/', getUsers);

router.get('/:id', validateObjectId(), getUser);
router.put('/:id', validateObjectId(), validate(userValidation.update), updateUser);
router.delete('/:id', validateObjectId(), deleteUser);
router.put('/:id/deactivate', validateObjectId(), deactivateUser);
router.put('/:id/activate', validateObjectId(), activateUser);
router.get('/:id/groups', validateObjectId(), getUserGroups);

module.exports = router;