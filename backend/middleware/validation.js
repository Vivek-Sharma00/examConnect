const Joi = require('joi');

// User validation schemas
const userValidation = {
    register: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Name is required',
                'string.min': 'Name must be at least 2 characters long',
                'string.max': 'Name cannot exceed 50 characters'
            }),
        email: Joi.string()
            .email()
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Please provide a valid email',
                'string.empty': 'Email is required'
            }),
        password: Joi.string()
            .min(6)
            .required()
            .messages({
                'string.min': 'Password must be at least 6 characters long',
                'string.empty': 'Password is required'
            }),
        role: Joi.string()
            .valid('admin', 'student')
            .default('student')
            .messages({
                'any.only': 'Role must be either admin or student'
            })
    }),

    login: Joi.object({
        email: Joi.string()
            .email()
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Please provide a valid email',
                'string.empty': 'Email is required'
            }),
        password: Joi.string()
            .required()
            .messages({
                'string.empty': 'Password is required'
            })
    }),

    update: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .messages({
                'string.min': 'Name must be at least 2 characters long',
                'string.max': 'Name cannot exceed 50 characters'
            }),
        avatar: Joi.string()
            .uri()
            .allow('')
            .messages({
                'string.uri': 'Avatar must be a valid URL'
            })
    }).min(1) // At least one field required
};

// Group validation schemas
const groupValidation = {
    create: Joi.object({
        name: Joi.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Group name is required',
                'string.max': 'Group name cannot exceed 100 characters'
            }),
        description: Joi.string()
            .trim()
            .max(500)
            .allow('')
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),
        maxMembers: Joi.number()
            .integer()
            .min(1)
            .max(500)
            .default(500)
            .messages({
                'number.min': 'Max members must be at least 1',
                'number.max': 'Max members cannot exceed 500'
            }),
        settings: Joi.object({
            allowStudentMessages: Joi.boolean().default(true),
            allowFileUploads: Joi.boolean().default(true),
            allowQuizCreation: Joi.boolean().default(true)
        }).default()
    }),

    update: Joi.object({
        name: Joi.string()
            .trim()
            .min(1)
            .max(100)
            .messages({
                'string.empty': 'Group name cannot be empty',
                'string.max': 'Group name cannot exceed 100 characters'
            }),
        description: Joi.string()
            .trim()
            .max(500)
            .allow('')
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),
        maxMembers: Joi.number()
            .integer()
            .min(1)
            .max(500)
            .messages({
                'number.min': 'Max members must be at least 1',
                'number.max': 'Max members cannot exceed 500'
            }),
        settings: Joi.object({
            allowStudentMessages: Joi.boolean(),
            allowFileUploads: Joi.boolean(),
            allowQuizCreation: Joi.boolean()
        })
    }).min(1)
};

// Message validation schemas
const messageValidation = {
    create: Joi.object({
        content: Joi.object({
            text: Joi.string()
                .trim()
                .max(5000)
                .when('type', {
                    is: 'text',
                    then: Joi.required(),
                    otherwise: Joi.optional()
                })
                .messages({
                    'string.max': 'Message cannot exceed 5000 characters',
                    'any.required': 'Text content is required for text messages'
                }),
            file: Joi.object({
                filename: Joi.string().required(),
                originalName: Joi.string().required(),
                fileType: Joi.string().required(),
                fileSize: Joi.number().max(50 * 1024 * 1024), // 50MB limit
                url: Joi.string().uri().required()
            }).when('type', {
                is: 'file',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            quiz: Joi.object({
                question: Joi.string().trim().required(),
                type: Joi.string().valid('multiple-choice', 'short-answer', 'true-false').required(),
                options: Joi.array().items(Joi.string()).when('type', {
                    is: 'multiple-choice',
                    then: Joi.array().min(2).max(6).required(),
                    otherwise: Joi.optional()
                }),
                correctAnswer: Joi.alternatives().try(
                    Joi.string(),
                    Joi.number(),
                    Joi.boolean()
                ).required(),
                deadline: Joi.date().greater('now').required(),
                maxMarks: Joi.number().min(1).default(1)
            }).when('type', {
                is: 'quiz',
                then: Joi.required(),
                otherwise: Joi.optional()
            })
        }).required(),
        type: Joi.string()
            .valid('text', 'file', 'quiz', 'system')
            .default('text')
            .required(),
        replyTo: Joi.string()
            .hex()
            .length(24)
            .allow(null)
            .messages({
                'string.hex': 'Reply ID must be a valid MongoDB ID',
                'string.length': 'Reply ID must be 24 characters long'
            })
    }),

    update: Joi.object({
        content: Joi.object({
            text: Joi.string()
                .trim()
                .max(5000)
                .required()
                .messages({
                    'string.max': 'Message cannot exceed 5000 characters',
                    'any.required': 'Text content is required'
                })
        }).required()
    })
};

// Quiz validation schemas
const quizValidation = {
    create: Joi.object({
        title: Joi.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Quiz title is required',
                'string.max': 'Title cannot exceed 200 characters'
            }),
        description: Joi.string()
            .trim()
            .max(1000)
            .allow('')
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
            }),
        questions: Joi.array()
            .items(
                Joi.object({
                    question: Joi.string().trim().required(),
                    type: Joi.string().valid('multiple-choice', 'short-answer', 'true-false', 'essay').required(),
                    options: Joi.array().items(
                        Joi.object({
                            text: Joi.string().required(),
                            isCorrect: Joi.boolean().default(false)
                        })
                    ).when('type', {
                        is: 'multiple-choice',
                        then: Joi.array().min(2).max(6).required(),
                        otherwise: Joi.optional()
                    }),
                    correctAnswer: Joi.alternatives().try(
                        Joi.string(),
                        Joi.number(),
                        Joi.boolean()
                    ).when('type', {
                        is: Joi.valid('multiple-choice', 'short-answer', 'true-false'),
                        then: Joi.required(),
                        otherwise: Joi.optional()
                    }),
                    explanation: Joi.string().trim().allow(''),
                    marks: Joi.number().min(0).default(1),
                    timeLimit: Joi.number().min(0).allow(null)
                })
            )
            .min(1)
            .required()
            .messages({
                'array.min': 'Quiz must have at least one question',
                'any.required': 'Questions are required'
            }),
        settings: Joi.object({
            shuffleQuestions: Joi.boolean().default(false),
            shuffleOptions: Joi.boolean().default(false),
            showResults: Joi.boolean().default(true),
            allowRetakes: Joi.boolean().default(false),
            timeLimit: Joi.number().min(1).allow(null),
            maxAttempts: Joi.number().min(1).default(1)
        }).default(),
        deadline: Joi.date()
            .greater('now')
            .required()
            .messages({
                'date.greater': 'Deadline must be in the future'
            })
    }),

    submit: Joi.object({
        answers: Joi.array()
            .items(
                Joi.object({
                    questionIndex: Joi.number().integer().min(0).required(),
                    answer: Joi.alternatives().try(
                        Joi.string(),
                        Joi.number(),
                        Joi.boolean()
                    ).required(),
                    timeSpent: Joi.number().min(0).default(0)
                })
            )
            .required(),
        timeSpent: Joi.number().min(0).required()
    })
};

// Generic validation middleware
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    };
};

// ObjectId validation middleware
const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} format`
            });
        }
        
        next();
    };
};

// File validation middleware (for multer)
const validateFile = (options = {}) => {
    const { 
        maxSize = 50 * 1024 * 1024, // 50MB default
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    } = options;

    return (req, res, next) => {
        if (!req.file) {
            return next();
        }

        // Check file size
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: `File size must be less than ${maxSize / (1024 * 1024)}MB`
            });
        }

        // Check file type
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'File type not allowed'
            });
        }

        next();
    };
};

module.exports = {
    userValidation,
    groupValidation,
    messageValidation,
    quizValidation,
    validate,
    validateObjectId,
    validateFile
};