const Quiz = require('../models/Quiz');
const Group = require('../models/Group');
const Message = require('../models/Message');

// @desc    Get all quizzes for a group
// @route   GET /api/quizzes/groups/:groupId
// @access  Private/Group Member
const getQuizzes = async (req, res) => {
    try {
        const { status = 'active', page = 1, limit = 10 } = req.query;
        const groupId = req.params.groupId;

        let query = { groupId };
        
        // Filter by status
        if (status === 'active') {
            query.isActive = true;
            query.deadline = { $gt: new Date() };
        } else if (status === 'expired') {
            query.deadline = { $lt: new Date() };
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        const quizzes = await Quiz.find(query)
            .populate('createdBy', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Quiz.countDocuments(query);

        res.status(200).json({
            success: true,
            count: quizzes.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: quizzes
        });
    } catch (error) {
        console.error('Get quizzes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quizzes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get single quiz
// @route   GET /api/quizzes/:quizId
// @access  Private/Group Member
const getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.quizId)
            .populate('createdBy', 'name avatar')
            .populate('submissions.userId', 'name avatar');

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check if user has access to this quiz's group
        const group = await Group.findById(quiz.groupId);
        if (!group || !group.isMember(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this quiz'
            });
        }

        res.status(200).json({
            success: true,
            data: quiz
        });
    } catch (error) {
        console.error('Get quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Create new quiz
// @route   POST /api/quizzes
// @access  Private/Group Member
const createQuiz = async (req, res) => {
    try {
        const { title, description, questions, settings, deadline, groupId } = req.body;

        // Check group settings
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Only admins can create quizzes if setting is disabled
        if (!group.settings.allowQuizCreation && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Quiz creation is not allowed in this group'
            });
        }

        const quiz = await Quiz.create({
            title: title.trim(),
            description: description?.trim(),
            questions,
            settings,
            deadline: new Date(deadline),
            groupId,
            createdBy: req.user.id
        });

        // Create system message for quiz creation
        await Message.create({
            groupId: groupId,
            senderId: req.user.id,
            type: 'system',
            systemAction: 'quiz_posted',
            content: {
                text: `${req.user.name} posted a new quiz: "${title}"`
            }
        });

        const populatedQuiz = await Quiz.findById(quiz._id)
            .populate('createdBy', 'name avatar');

        res.status(201).json({
            success: true,
            message: 'Quiz created successfully',
            data: populatedQuiz
        });
    } catch (error) {
        console.error('Create quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update quiz
// @route   PUT /api/quizzes/:quizId
// @access  Private/Quiz Creator or Group Admin
const updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, settings, deadline } = req.body;
        const quizId = req.params.quizId;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check if user is the creator or group admin
        const group = await Group.findById(quiz.groupId);
        const isCreator = quiz.createdBy.toString() === req.user.id;
        const isGroupAdmin = group.isAdmin(req.user.id);

        if (!isCreator && !isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this quiz'
            });
        }

        // Check if quiz has submissions (restrict certain changes)
        if (quiz.submissions.length > 0) {
            // Don't allow changing questions structure if there are submissions
            if (questions && JSON.stringify(questions) !== JSON.stringify(quiz.questions)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot change questions after submissions have been made'
                });
            }
        }

        const updateData = {};
        if (title) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (questions) updateData.questions = questions;
        if (settings) updateData.settings = settings;
        if (deadline) updateData.deadline = new Date(deadline);

        const updatedQuiz = await Quiz.findByIdAndUpdate(
            quizId,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name avatar');

        res.status(200).json({
            success: true,
            message: 'Quiz updated successfully',
            data: updatedQuiz
        });
    } catch (error) {
        console.error('Update quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:quizId
// @access  Private/Quiz Creator or Group Admin
const deleteQuiz = async (req, res) => {
    try {
        const quizId = req.params.quizId;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check if user is the creator or group admin
        const group = await Group.findById(quiz.groupId);
        const isCreator = quiz.createdBy.toString() === req.user.id;
        const isGroupAdmin = group.isAdmin(req.user.id);

        if (!isCreator && !isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this quiz'
            });
        }

        await Quiz.findByIdAndDelete(quizId);

        res.status(200).json({
            success: true,
            message: 'Quiz deleted successfully'
        });
    } catch (error) {
        console.error('Delete quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Start quiz attempt
// @route   POST /api/quizzes/:quizId/start
// @access  Private/Group Member
const startQuiz = async (req, res) => {
    try {
        const quizId = req.params.quizId;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Check if quiz is active and not expired
        if (!quiz.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Quiz is not active'
            });
        }

        if (quiz.deadline < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Quiz has expired'
            });
        }

        // Check if user has remaining attempts
        const userSubmissions = quiz.submissions.filter(
            sub => sub.userId.toString() === req.user.id
        );
        const submittedAttempts = userSubmissions.filter(
            sub => sub.status === 'submitted' || sub.status === 'graded'
        ).length;

        if (submittedAttempts >= quiz.settings.maxAttempts) {
            return res.status(400).json({
                success: false,
                message: 'No more attempts remaining for this quiz'
            });
        }

        // Check if user has an in-progress attempt
        const inProgressAttempt = userSubmissions.find(
            sub => sub.status === 'in-progress'
        );

        if (inProgressAttempt) {
            return res.status(200).json({
                success: true,
                message: 'Resuming existing attempt',
                data: {
                    attemptId: inProgressAttempt._id,
                    quiz: {
                        _id: quiz._id,
                        title: quiz.title,
                        description: quiz.description,
                        questions: quiz.questions.map(q => ({
                            question: q.question,
                            type: q.type,
                            options: q.options,
                            marks: q.marks,
                            timeLimit: q.timeLimit
                        })),
                        settings: quiz.settings,
                        timeLimit: quiz.settings.timeLimit,
                        startedAt: inProgressAttempt.startedAt
                    }
                }
            });
        }

        // Create new attempt
        const attemptNumber = submittedAttempts + 1;
        const newSubmission = {
            userId: req.user.id,
            answers: [],
            startedAt: new Date(),
            status: 'in-progress',
            attemptNumber
        };

        quiz.submissions.push(newSubmission);
        await quiz.save();

        // Get the newly created submission
        const submission = quiz.submissions[quiz.submissions.length - 1];

        res.status(200).json({
            success: true,
            message: 'Quiz attempt started',
            data: {
                attemptId: submission._id,
                quiz: {
                    _id: quiz._id,
                    title: quiz.title,
                    description: quiz.description,
                    questions: quiz.questions.map(q => ({
                        question: q.question,
                        type: q.type,
                        options: q.options,
                        marks: q.marks,
                        timeLimit: q.timeLimit
                    })),
                    settings: quiz.settings,
                    timeLimit: quiz.settings.timeLimit,
                    startedAt: submission.startedAt
                }
            }
        });
    } catch (error) {
        console.error('Start quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Submit quiz answers
// @route   POST /api/quizzes/:quizId/submit
// @access  Private/Group Member
const submitQuiz = async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const { answers, timeSpent, attemptId } = req.body;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Find the submission
        const submission = quiz.submissions.find(
            sub => sub._id.toString() === attemptId && sub.userId.toString() === req.user.id
        );

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Quiz attempt not found'
            });
        }

        if (submission.status !== 'in-progress') {
            return res.status(400).json({
                success: false,
                message: 'Quiz attempt already submitted'
            });
        }

        // Submit the quiz
        const submittedQuiz = quiz.submitQuiz(req.user.id, answers, timeSpent);
        await quiz.save();

        if (!submittedQuiz) {
            return res.status(400).json({
                success: false,
                message: 'Error submitting quiz'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Quiz submitted successfully',
            data: {
                score: submission.totalScore,
                percentage: submission.percentage,
                totalMarks: quiz.totalMarks,
                timeSpent: submission.timeSpent
            }
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting quiz',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get quiz results
// @route   GET /api/quizzes/:quizId/results
// @access  Private/Group Member
const getQuizResults = async (req, res) => {
    try {
        const quizId = req.params.quizId;

        const quiz = await Quiz.findById(quizId)
            .populate('submissions.userId', 'name avatar');

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Find user's submission
        const userSubmission = quiz.submissions.find(
            sub => sub.userId._id.toString() === req.user.id && sub.status === 'graded'
        );

        if (!userSubmission && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'No submission found or results not available yet'
            });
        }

        let responseData = {
            quiz: {
                _id: quiz._id,
                title: quiz.title,
                totalMarks: quiz.totalMarks,
                analytics: quiz.analytics
            }
        };

        if (userSubmission) {
            responseData.submission = {
                score: userSubmission.totalScore,
                percentage: userSubmission.percentage,
                answers: userSubmission.answers,
                submittedAt: userSubmission.submittedAt,
                timeSpent: userSubmission.timeSpent
            };
        }

        // Include all submissions for admin
        if (req.user.role === 'admin') {
            responseData.allSubmissions = quiz.submissions;
        }

        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Get quiz results error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quiz results',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get user's quiz submissions
// @route   GET /api/quizzes/user/submissions
// @access  Private
const getUserSubmissions = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const quizzes = await Quiz.find({
            'submissions.userId': req.user.id
        })
        .populate('groupId', 'name')
        .sort({ 'submissions.submittedAt': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        // Extract user's submissions from each quiz
        const submissions = [];
        quizzes.forEach(quiz => {
            const userSubmission = quiz.submissions.find(
                sub => sub.userId.toString() === req.user.id
            );
            if (userSubmission) {
                submissions.push({
                    quiz: {
                        _id: quiz._id,
                        title: quiz.title,
                        groupId: quiz.groupId,
                        totalMarks: quiz.totalMarks
                    },
                    submission: userSubmission
                });
            }
        });

        const total = await Quiz.countDocuments({
            'submissions.userId': req.user.id
        });

        res.status(200).json({
            success: true,
            count: submissions.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: submissions
        });
    } catch (error) {
        console.error('Get user submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user submissions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getQuizzes,
    getQuiz,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    startQuiz,
    submitQuiz,
    getQuizResults,
    getUserSubmissions
};