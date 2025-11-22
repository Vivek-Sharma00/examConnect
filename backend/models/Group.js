const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Group name is required'],
        trim: true,
        maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    maxMembers: {
        type: Number,
        default: 500,
        min: [1, 'Max members must be at least 1'],
        max: [500, 'Max members cannot exceed 500']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    settings: {
        allowStudentMessages: {
            type: Boolean,
            default: true
        },
        allowFileUploads: {
            type: Boolean,
            default: true
        },
        allowQuizCreation: {
            type: Boolean,
            default: true
        }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ isActive: 1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
    return this.members.length;
});

// Virtual for admin members
groupSchema.virtual('adminMembers').get(function() {
    return this.members.filter(member => member.role === 'admin');
});

// Instance method to check if user is member
groupSchema.methods.isMember = function(userId) {
    return this.members.some(member => 
        member.user.toString() === userId.toString()
    );
};

// Instance method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
    return this.members.some(member => 
        member.user.toString() === userId.toString() && member.role === 'admin'
    );
};

// Instance method to add member
groupSchema.methods.addMember = function(userId, role = 'member') {
    if (!this.isMember(userId)) {
        this.members.push({
            user: userId,
            role: role,
            joinedAt: new Date()
        });
        return true;
    }
    return false;
};

// Instance method to remove member
groupSchema.methods.removeMember = function(userId) {
    const initialLength = this.members.length;
    this.members = this.members.filter(member => 
        member.user.toString() !== userId.toString()
    );
    return this.members.length < initialLength;
};

// Instance method to change member role
groupSchema.methods.changeMemberRole = function(userId, newRole) {
    const member = this.members.find(member => 
        member.user.toString() === userId.toString()
    );
    if (member && member.role !== newRole) {
        member.role = newRole;
        return true;
    }
    return false;
};

// Static method to find groups by user
groupSchema.statics.findByUser = function(userId) {
    return this.find({
        'members.user': userId,
        isActive: true
    }).populate('createdBy', 'name email avatar')
      .populate('members.user', 'name email avatar role');
};

// Static method to find admin groups
groupSchema.statics.findAdminGroups = function(userId) {
    return this.find({
        'members.user': userId,
        'members.role': 'admin',
        isActive: true
    });
};

// Pre-save middleware to ensure creator is admin
groupSchema.pre('save', function(next) {
    // If this is a new group, ensure the creator is an admin member
    if (this.isNew) {
        const creatorIsMember = this.members.some(member => 
            member.user.toString() === this.createdBy.toString()
        );
        
        if (!creatorIsMember) {
            this.members.push({
                user: this.createdBy,
                role: 'admin',
                joinedAt: new Date()
            });
        }
    }
    next();
});

module.exports = mongoose.model('Group', groupSchema);