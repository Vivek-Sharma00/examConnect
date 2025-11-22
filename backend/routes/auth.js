const express = require('express');
const {
    register,
    login,
    logout,
    getMe,
    updateDetails,
    updatePassword,
    forgotPassword,
    resetPassword,
    verifyToken,
    getUserStats
} = require('../controllers/authController');

const { protect, authorize } = require('../middleware/auth');
const { validate, userValidation } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validate(userValidation.register), register);
router.post('/login', validate(userValidation.login), login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// Protected routes
router.use(protect); // All routes below this middleware are protected

router.post('/logout', logout);
router.get('/me', getMe);
router.get('/verify', verifyToken);
router.put('/updatedetails', validate(userValidation.update), updateDetails);
router.put('/updatepassword', updatePassword);

// Admin only routes
router.get('/stats', authorize('admin'), getUserStats);

module.exports = router;