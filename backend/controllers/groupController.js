const Group = require('../models/Group');
const Message = require('../models/Message');
const Quiz = require('../models/Quiz');

// @desc    Get all groups for current user
// @route   GET /api/groups
// @access  Private
const getGroups = async (req, res) => {
    try {
        const groups = await Group.findByUser(req.user.id);

        res.status(200).json({
            success: true,
            count: groups.length,
            data: groups
        });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching groups',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get single group
// @route   GET /api/groups/:groupId
// @access  Private/Group Member
const getGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('createdBy', 'name email avatar')
            .populate('members.user', 'name email avatar role');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        res.status(200).json({
            success: true,
            data: group
        });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Create new group
// @route   POST /api/groups
// @access  Private
const createGroup = async (req, res) => {
    try {
        const { name, description, maxMembers, settings } = req.body;

        // Check if group name already exists
        const existingGroup = await Group.findOne({ 
            name: new RegExp(`^${name}$`, 'i') 
        });
        
        if (existingGroup) {
            return res.status(400).json({
                success: false,
                message: 'Group name already exists'
            });
        }

        const group = await Group.create({
            name: name.trim(),
            description: description?.trim(),
            maxMembers,
            settings,
            createdBy: req.user.id
        });

        // Create system message for group creation
        const systemMessage = await Message.create({
            groupId: group._id,
            senderId: req.user.id,
            type: 'system',
            systemAction: 'group_created',
            content: {
                text: `${req.user.name} created the group`
            }
        });

        const populatedGroup = await Group.findById(group._id)
            .populate('createdBy', 'name email avatar')
            .populate('members.user', 'name email avatar role');

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: populatedGroup
        });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update group
// @route   PUT /api/groups/:groupId
// @access  Private/Group Admin
const updateGroup = async (req, res) => {
    try {
        const { name, description, maxMembers, settings } = req.body;

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (maxMembers) updateData.maxMembers = maxMembers;
        if (settings) updateData.settings = settings;

        const group = await Group.findByIdAndUpdate(
            req.params.groupId,
            updateData,
            { new: true, runValidators: true }
        )
        .populate('createdBy', 'name email avatar')
        .populate('members.user', 'name email avatar role');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Group updated successfully',
            data: group
        });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Delete group
// @route   DELETE /api/groups/:groupId
// @access  Private/Group Admin
const deleteGroup = async (req, res) => {
    try {
        const group = await Group.findByIdAndDelete(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Also delete all messages and quizzes in the group
        await Message.deleteMany({ groupId: req.params.groupId });
        await Quiz.deleteMany({ groupId: req.params.groupId });

        res.status(200).json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Join group
// @route   POST /api/groups/:groupId/join
// @access  Private
const joinGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is already a member
        if (group.isMember(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'You are already a member of this group'
            });
        }

        // Check if group is full
        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({
                success: false,
                message: 'Group is full'
            });
        }

        // Add user as member
        group.addMember(req.user.id, 'member');
        await group.save();

        // Create system message for user joining
        await Message.create({
            groupId: group._id,
            senderId: req.user.id,
            type: 'system',
            systemAction: 'user_joined',
            content: {
                text: `${req.user.name} joined the group`
            }
        });

        const populatedGroup = await Group.findById(group._id)
            .populate('createdBy', 'name email avatar')
            .populate('members.user', 'name email avatar role');

        res.status(200).json({
            success: true,
            message: 'Joined group successfully',
            data: populatedGroup
        });
    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error joining group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Leave group
// @route   POST /api/groups/:groupId/leave
// @access  Private/Group Member
const leaveGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is the creator (prevent creator from leaving)
        if (group.createdBy.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Group creator cannot leave the group. Transfer ownership or delete the group instead.'
            });
        }

        // Remove user from group
        const removed = group.removeMember(req.user.id);
        if (!removed) {
            return res.status(400).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        await group.save();

        // Create system message for user leaving
        await Message.create({
            groupId: group._id,
            senderId: req.user.id,
            type: 'system',
            systemAction: 'user_left',
            content: {
                text: `${req.user.name} left the group`
            }
        });

        res.status(200).json({
            success: true,
            message: 'Left group successfully'
        });
    } catch (error) {
        console.error('Leave group error:', error);
        res.status(500).json({
            success: false,
            message: 'Error leaving group',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Add member to group
// @route   POST /api/groups/:groupId/members
// @access  Private/Group Admin
const addMember = async (req, res) => {
    try {
        const { userId, role = 'member' } = req.body;

        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Check if user is already a member
        if (group.isMember(userId)) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member of this group'
            });
        }

        // Check if group is full
        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({
                success: false,
                message: 'Group is full'
            });
        }

        // Add user as member
        group.addMember(userId, role);
        await group.save();

        const populatedGroup = await Group.findById(group._id)
            .populate('members.user', 'name email avatar role');

        res.status(200).json({
            success: true,
            message: 'Member added successfully',
            data: populatedGroup
        });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding member',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Remove member from group
// @route   DELETE /api/groups/:groupId/members/:userId
// @access  Private/Group Admin
const removeMember = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Prevent removing group creator
        if (group.createdBy.toString() === req.params.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove group creator'
            });
        }

        // Remove user from group
        const removed = group.removeMember(req.params.userId);
        if (!removed) {
            return res.status(400).json({
                success: false,
                message: 'User is not a member of this group'
            });
        }

        await group.save();

        res.status(200).json({
            success: true,
            message: 'Member removed successfully'
        });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing member',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update member role
// @route   PUT /api/groups/:groupId/members/:userId/role
// @access  Private/Group Admin
const updateMemberRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!['admin', 'member'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either admin or member'
            });
        }

        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Prevent changing creator's role
        if (group.createdBy.toString() === req.params.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change group creator role'
            });
        }

        // Update member role
        const updated = group.changeMemberRole(req.params.userId, role);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'User is not a member of this group or role is the same'
            });
        }

        await group.save();

        res.status(200).json({
            success: true,
            message: 'Member role updated successfully'
        });
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating member role',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get group members
// @route   GET /api/groups/:groupId/members
// @access  Private/Group Member
const getGroupMembers = async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('members.user', 'name email avatar role lastLogin');

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        res.status(200).json({
            success: true,
            count: group.members.length,
            data: group.members
        });
    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group members',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get group messages
// @route   GET /api/groups/:groupId/messages
// @access  Private/Group Member
const getGroupMessages = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const messages = await Message.getGroupMessages(req.params.groupId, parseInt(page), parseInt(limit));

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages.reverse() // Return in chronological order
        });
    } catch (error) {
        console.error('Get group messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get group quizzes
// @route   GET /api/groups/:groupId/quizzes
// @access  Private/Group Member
const getGroupQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.findActiveInGroup(req.params.groupId);

        res.status(200).json({
            success: true,
            count: quizzes.length,
            data: quizzes
        });
    } catch (error) {
        console.error('Get group quizzes error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group quizzes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Search groups
// @route   GET /api/groups/search
// @access  Private
const searchGroups = async (req, res) => {
    try {
        const { q: searchTerm } = req.query;

        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                message: 'Search term is required'
            });
        }

        const groups = await Group.find({
            $and: [
                { isActive: true },
                {
                    $or: [
                        { name: { $regex: searchTerm, $options: 'i' } },
                        { description: { $regex: searchTerm, $options: 'i' } }
                    ]
                }
            ]
        })
        .populate('createdBy', 'name avatar')
        .populate('members.user', 'name avatar')
        .limit(20);

        res.status(200).json({
            success: true,
            count: groups.length,
            data: groups
        });
    } catch (error) {
        console.error('Search groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching groups',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
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
};