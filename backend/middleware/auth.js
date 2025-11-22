const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token (excluding password)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if user is active
            if (!req.user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Account is deactivated'
                });
            }

            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed'
            });
        }
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token'
        });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

// Optional authentication - doesn't fail if no token, but adds user if available
const optionalAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            // Don't throw error, just continue without user
            console.warn('Optional auth token verification failed:', error.message);
        }
    }

    next();
};

// Check if user is group admin or has specific permissions
const groupAuth = (permission = 'member') => {
    return async (req, res, next) => {
        try {
            const Group = require('../models/Group');
            const groupId = req.params.groupId || req.body.groupId;
            
            if (!groupId) {
                return res.status(400).json({
                    success: false,
                    message: 'Group ID is required'
                });
            }

            const group = await Group.findById(groupId);
            
            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            // Check if user is member of the group
            const isMember = group.isMember(req.user._id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: 'Not a member of this group'
                });
            }

            // Check permissions based on requirement
            if (permission === 'admin') {
                const isAdmin = group.isAdmin(req.user._id);
                if (!isAdmin) {
                    return res.status(403).json({
                        success: false,
                        message: 'Admin access required for this action'
                    });
                }
            }

            // Attach group to request for later use
            req.group = group;
            next();
        } catch (error) {
            console.error('Group auth error:', error);
            return res.status(500).json({
                success: false,
                message: 'Server error in group authentication'
            });
        }
    };
};

// Rate limiting helper (simple in-memory version)
const rateLimit = (options = {}) => {
    const requests = new Map();
    const { windowMs = 15 * 60 * 1000, max = 100 } = options; // 15 minutes window

    return (req, res, next) => {
        const key = req.ip; // Use IP address as key
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries
        for (const [ip, timestamps] of requests) {
            const validTimestamps = timestamps.filter(time => time > windowStart);
            if (validTimestamps.length === 0) {
                requests.delete(ip);
            } else {
                requests.set(ip, validTimestamps);
            }
        }

        // Check current IP
        if (!requests.has(key)) {
            requests.set(key, []);
        }

        const ipRequests = requests.get(key);
        const recentRequests = ipRequests.filter(time => time > windowStart);

        if (recentRequests.length >= max) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later'
            });
        }

        ipRequests.push(now);
        requests.set(key, ipRequests);

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': max - recentRequests.length - 1,
            'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });

        next();
    };
};

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = generateToken(user._id);

    // Cookie options
    const options = {
        expires: new Date(
            Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    };

    // Send response with token
    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: user.getProfile ? user.getProfile() : {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar: user.avatar
            }
        });
};

// Extract user from token (for WebSocket connections)
const getUserFromToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        return user;
    } catch (error) {
        return null;
    }
};

module.exports = {
    protect,
    authorize,
    optionalAuth,
    groupAuth,
    rateLimit,
    generateToken,
    sendTokenResponse,
    getUserFromToken
};