const express = require('express');
const {
    getQuizzes,
    getQuiz,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    startQuiz,
    submitQuiz,
    getQuizResults,
    getUserSubmissions
} = require('../controllers/quizController');

const { protect, groupAuth } = require('../middleware/auth');
const { validate, quizValidation, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// User submission routes
router.get('/user/submissions', getUserSubmissions);

// Group quiz routes
router.get('/groups/:groupId', validateObjectId('groupId'), groupAuth('member'), getQuizzes);
router.post('/', validate(quizValidation.create), createQuiz);

// Individual quiz routes
router.get('/:quizId', validateObjectId('quizId'), getQuiz);
router.put('/:quizId', validateObjectId('quizId'), updateQuiz);
router.delete('/:quizId', validateObjectId('quizId'), deleteQuiz);

// Quiz attempt routes
router.post('/:quizId/start', validateObjectId('quizId'), startQuiz);
router.post('/:quizId/submit', validateObjectId('quizId'), validate(quizValidation.submit), submitQuiz);
router.get('/:quizId/results', validateObjectId('quizId'), getQuizResults);

module.exports = router;