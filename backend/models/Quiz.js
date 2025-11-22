const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Quiz title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: [true, 'Group ID is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Creator ID is required']
    },
    questions: [{
        question: {
            type: String,
            required: [true, 'Question text is required'],
            trim: true
        },
        type: {
            type: String,
            enum: ['multiple-choice', 'short-answer', 'true-false', 'essay'],
            required: true
        },
        options: [{
            text: String,
            isCorrect: Boolean
        }],
        correctAnswer: mongoose.Schema.Types.Mixed, // Can be string, boolean, or index
        explanation: String,
        marks: {
            type: Number,
            default: 1,
            min: [0, 'Marks cannot be negative']
        },
        timeLimit: { // in seconds
            type: Number,
            default: null
        }
    }],
    settings: {
        shuffleQuestions: {
            type: Boolean,
            default: false
        },
        shuffleOptions: {
            type: Boolean,
            default: false
        },
        showResults: {
            type: Boolean,
            default: true
        },
        allowRetakes: {
            type: Boolean,
            default: false
        },
        timeLimit: { // Total quiz time in minutes
            type: Number,
            default: null
        },
        maxAttempts: {
            type: Number,
            default: 1,
            min: [1, 'Max attempts must be at least 1']
        }
    },
    deadline: {
        type: Date,
        required: [true, 'Deadline is required']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    totalMarks: {
        type: Number,
        default: 0
    },
    submissions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        answers: [{
            questionIndex: Number,
            answer: mongoose.Schema.Types.Mixed,
            timeSpent: Number, // in seconds
            isCorrect: Boolean,
            marksObtained: Number
        }],
        startedAt: {
            type: Date,
            default: Date.now
        },
        submittedAt: {
            type: Date,
            default: null
        },
        totalScore: Number,
        percentage: Number,
        timeSpent: Number, // Total time in seconds
        attemptNumber: {
            type: Number,
            default: 1
        },
        status: {
            type: String,
            enum: ['in-progress', 'submitted', 'graded'],
            default: 'in-progress'
        }
    }],
    analytics: {
        totalSubmissions: {
            type: Number,
            default: 0
        },
        averageScore: {
            type: Number,
            default: 0
        },
        highestScore: {
            type: Number,
            default: 0
        },
        lowestScore: {
            type: Number,
            default: 0
        },
        questionStats: [{
            questionIndex: Number,
            correctAnswers: Number,
            totalAttempts: Number,
            averageTime: Number
        }]
    }
}, {
    timestamps: true
});

// Indexes for better query performance
quizSchema.index({ groupId: 1, createdAt: -1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ deadline: 1 });
quizSchema.index({ isActive: 1 });
quizSchema.index({ 'submissions.userId': 1 });

// Virtual for quiz status
quizSchema.virtual('status').get(function() {
    const now = new Date();
    if (now > this.deadline) return 'expired';
    if (!this.isActive) return 'inactive';
    return 'active';
});

// Virtual for remaining time (in minutes)
quizSchema.virtual('timeRemaining').get(function() {
    const now = new Date();
    const diff = this.deadline - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60))); // Convert to minutes
});

// Virtual for submission count
quizSchema.virtual('submissionCount').get(function() {
    return this.submissions.filter(sub => sub.status === 'submitted').length;
});

// Pre-save middleware to calculate total marks
quizSchema.pre('save', function(next) {
    if (this.isModified('questions')) {
        this.totalMarks = this.questions.reduce((total, question) => {
            return total + (question.marks || 1);
        }, 0);
    }
    next();
});

// Instance method to add question
quizSchema.methods.addQuestion = function(questionData) {
    this.questions.push(questionData);
    this.totalMarks += (questionData.marks || 1);
};

// Instance method to remove question
quizSchema.methods.removeQuestion = function(questionIndex) {
    if (questionIndex >= 0 && questionIndex < this.questions.length) {
        const removedQuestion = this.questions.splice(questionIndex, 1)[0];
        this.totalMarks -= (removedQuestion.marks || 1);
        return true;
    }
    return false;
};

// Instance method to submit quiz
quizSchema.methods.submitQuiz = function(userId, answers, timeSpent) {
    const existingSubmission = this.submissions.find(sub => 
        sub.userId.toString() === userId.toString() && sub.status === 'in-progress'
    );

    if (existingSubmission) {
        existingSubmission.answers = answers;
        existingSubmission.submittedAt = new Date();
        existingSubmission.status = 'submitted';
        existingSubmission.timeSpent = timeSpent;
        
        // Calculate score
        this.calculateScore(existingSubmission);
        return existingSubmission;
    }
    return null;
};

// Instance method to calculate score
quizSchema.methods.calculateScore = function(submission) {
    let totalScore = 0;
    
    submission.answers.forEach(answer => {
        const question = this.questions[answer.questionIndex];
        if (question) {
            let isCorrect = false;
            let marksObtained = 0;

            switch (question.type) {
                case 'multiple-choice':
                    isCorrect = question.correctAnswer === answer.answer;
                    break;
                case 'true-false':
                    isCorrect = question.correctAnswer === answer.answer;
                    break;
                case 'short-answer':
                    // Simple exact match for now - could be enhanced with fuzzy matching
                    isCorrect = question.correctAnswer?.toLowerCase().trim() === 
                               answer.answer?.toLowerCase().trim();
                    break;
                case 'essay':
                    // Essay questions need manual grading
                    isCorrect = false; // Default to false until graded
                    marksObtained = 0;
                    break;
            }

            if (isCorrect) {
                marksObtained = question.marks || 1;
                totalScore += marksObtained;
            }

            answer.isCorrect = isCorrect;
            answer.marksObtained = marksObtained;
        }
    });

    submission.totalScore = totalScore;
    submission.percentage = this.totalMarks > 0 ? (totalScore / this.totalMarks) * 100 : 0;
    submission.status = 'graded';

    // Update analytics
    this.updateAnalytics();
};

// Instance method to update analytics
quizSchema.methods.updateAnalytics = function() {
    const submittedQuizzes = this.submissions.filter(sub => sub.status === 'graded');
    
    if (submittedQuizzes.length > 0) {
        this.analytics.totalSubmissions = submittedQuizzes.length;
        this.analytics.averageScore = submittedQuizzes.reduce((sum, sub) => 
            sum + sub.percentage, 0) / submittedQuizzes.length;
        this.analytics.highestScore = Math.max(...submittedQuizzes.map(sub => sub.percentage));
        this.analytics.lowestScore = Math.min(...submittedQuizzes.map(sub => sub.percentage));
        
        // Update question statistics
        this.questions.forEach((question, index) => {
            const questionSubmissions = submittedQuizzes.filter(sub => 
                sub.answers.some(ans => ans.questionIndex === index)
            );
            
            if (questionSubmissions.length > 0) {
                const correctCount = questionSubmissions.filter(sub => 
                    sub.answers.find(ans => ans.questionIndex === index)?.isCorrect
                ).length;
                
                this.analytics.questionStats[index] = {
                    questionIndex: index,
                    correctAnswers: correctCount,
                    totalAttempts: questionSubmissions.length,
                    averageTime: questionSubmissions.reduce((sum, sub) => {
                        const answer = sub.answers.find(ans => ans.questionIndex === index);
                        return sum + (answer?.timeSpent || 0);
                    }, 0) / questionSubmissions.length
                };
            }
        });
    }
};

// Static method to find active quizzes in group
quizSchema.statics.findActiveInGroup = function(groupId) {
    return this.find({
        groupId: groupId,
        isActive: true,
        deadline: { $gt: new Date() }
    }).populate('createdBy', 'name avatar');
};

// Static method to find quizzes created by user
quizSchema.statics.findByCreator = function(userId) {
    return this.find({
        createdBy: userId
    }).populate('groupId', 'name');
};

// Static method to get quiz with user submission
quizSchema.statics.getWithUserSubmission = function(quizId, userId) {
    return this.findOne({
        _id: quizId
    }).populate('createdBy', 'name avatar')
      .populate('submissions.userId', 'name avatar');
};

module.exports = mongoose.model('Quiz', quizSchema);