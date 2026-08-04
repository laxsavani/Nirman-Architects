const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const OfferLetter = require('../models/OfferLetter');
const Notification = require('../models/Notification');
const { getRoleModel } = require('../utils/roles');
const { hashPassword, validatePasswordComplexity } = require('../utils/password');
const { getOfferLetterPath } = require('../utils/storagePathResolver');
const { generateOfferLetterPDF } = require('../utils/offerLetterPdfGenerator');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create a new User (SuperAdmin / HR)
 * Automatically triggers Offer Letter generation and saves under /storage/offer_letters/<userId>/
 */
exports.createUser = async (req, res, next) => {
  try {
    const adminUserId = req.user ? (req.user.userId || req.user.id) : null;
    const { 
      name, email, password, phone, roleId, department, designation, 
      joiningDate, baseSalary, deviceId 
    } = req.body;

    if (!name || !email || !password || !roleId) {
      return sendError(res, 400, 'name, email, password, and roleId are required.');
    }

    const pwdValidation = validatePasswordComplexity(password);
    if (!pwdValidation.valid) {
      return sendError(res, 400, pwdValidation.message);
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return sendError(res, 400, 'User with this email already exists.');
    }

    const roleDoc = await RoleMaster.findById(roleId);
    if (!roleDoc) {
      return sendError(res, 400, 'Invalid roleId specified.');
    }

    const hashedPassword = await hashPassword(password);
    const assignedDeviceId = deviceId ? deviceId.trim() : null;

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone || '',
      roleId: roleDoc._id,
      department: department || 'General',
      designation: designation || 'Staff',
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      baseSalary: baseSalary !== undefined ? Number(baseSalary) : 0,
      deviceId: assignedDeviceId,
      deviceStatus: assignedDeviceId ? 'APPROVED' : 'PENDING',
      isActive: true
    });

    await newUser.save();

    // Auto-create matching role profile doc
    const roleCode = roleDoc.roleCode || roleDoc.roleName;
    const RoleModel = getRoleModel(roleCode);
    if (RoleModel) {
      await RoleModel.findOneAndUpdate(
        { userId: newUser._id },
        { $setOnInsert: { userId: newUser._id } },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // Auto-generate Offer Letter
    let offerLetterDoc = null;
    try {
      const snapshotData = {
        designationSnapshot: newUser.designation,
        departmentSnapshot: newUser.department,
        baseSalarySnapshot: newUser.baseSalary,
        joiningDateSnapshot: newUser.joiningDate
      };

      const pathInfo = getOfferLetterPath(newUser._id, Date.now());
      await generateOfferLetterPDF(newUser, snapshotData, null, pathInfo.fullPath);

      offerLetterDoc = new OfferLetter({
        userId: newUser._id,
        generatedBy: adminUserId || newUser._id,
        filePath: pathInfo.relativePath,
        ...snapshotData,
        status: 'GENERATED',
        generatedAt: new Date()
      });
      await offerLetterDoc.save();

      await Notification.create({
        userId: newUser._id,
        type: 'OFFER_LETTER_READY',
        message: 'Welcome to Nirman Architects! Your offer letter is ready for view.'
      });
    } catch (pdfErr) {
      console.error('Offer letter PDF generation failed during user creation:', pdfErr);
    }

    const returnedUser = await User.findById(newUser._id).select('-password').populate('roleId');

    return sendSuccess(res, 201, 'User created successfully.', {
      user: returnedUser,
      offerLetter: offerLetterDoc ? {
        id: offerLetterDoc._id,
        filePath: offerLetterDoc.filePath
      } : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { includePassword, showPassword } = req.query;
    const shouldShowPassword = includePassword === 'true' || showPassword === 'true';

    let query = User.findById(req.params.id).populate('roleId');
    if (shouldShowPassword) {
      query = query.select('+password');
    } else {
      query = query.select('-password');
    }

    const user = await query;
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const roleCode = user.roleId ? (user.roleId.roleCode || user.roleId.roleName) : '';
    const RoleModel = getRoleModel(roleCode);
    let roleProfile = null;
    if (RoleModel) {
      roleProfile = await RoleModel.findOne({ userId: user._id });
    }

    return sendSuccess(res, 200, 'User retrieved successfully.', {
      ...user.toObject(),
      roleProfile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user by ID (supports updating password/newPassword)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { 
      name, phone, department, designation, joiningDate, baseSalary, 
      deviceId, deviceStatus, isActive, roleId, password, newPassword 
    } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (department !== undefined) updateData.department = department;
    if (designation !== undefined) updateData.designation = designation;
    if (joiningDate !== undefined) updateData.joiningDate = new Date(joiningDate);
    if (baseSalary !== undefined) updateData.baseSalary = Number(baseSalary);
    if (deviceId !== undefined) updateData.deviceId = deviceId;
    if (deviceStatus !== undefined) updateData.deviceStatus = deviceStatus;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const rawPassword = newPassword || password;
    if (rawPassword) {
      const pwdValidation = validatePasswordComplexity(rawPassword);
      if (!pwdValidation.valid) {
        return sendError(res, 400, pwdValidation.message);
      }
      updateData.password = await hashPassword(rawPassword.trim());
    }

    if (roleId) {
      const roleDoc = await RoleMaster.findById(roleId);
      if (roleDoc) {
        updateData.roleId = roleDoc._id;
        const roleCode = roleDoc.roleCode || roleDoc.roleName;
        const RoleModel = getRoleModel(roleCode);
        if (RoleModel) {
          await RoleModel.findOneAndUpdate(
            { userId: req.params.id },
            { $setOnInsert: { userId: req.params.id } },
            { upsert: true, returnDocument: 'after' }
          );
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' })
      .select('-password')
      .populate('roleId');

    if (!updatedUser) {
      return sendError(res, 404, 'User not found.');
    }

    return sendSuccess(res, 200, 'User updated successfully.', updatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users with optional filtering
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, department, search, includePassword, showPassword } = req.query;
    const filter = {};

    if (department) {
      filter.department = new RegExp(department, 'i');
    }

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    if (role) {
      const roleDoc = await RoleMaster.findOne({ 
        $or: [{ roleCode: role.toUpperCase() }, { roleName: new RegExp(role, 'i') }] 
      });
      if (roleDoc) {
        filter.roleId = roleDoc._id;
      }
    }

    const shouldShowPassword = includePassword === 'true' || showPassword === 'true';

    let query = User.find(filter).populate('roleId').sort({ createdAt: -1 });
    if (shouldShowPassword) {
      query = query.select('+password');
    } else {
      query = query.select('-password');
    }

    const users = await query;

    return sendSuccess(res, 200, 'Users retrieved successfully.', users);
  } catch (error) {
    next(error);
  }
};

/**
 * Change user password by Admin (Super Admin / HR)
 */
exports.changeUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword, password } = req.body;
    const rawPassword = newPassword || password;
    const pwdValidation = validatePasswordComplexity(rawPassword);
    if (!pwdValidation.valid) {
      return sendError(res, 400, pwdValidation.message);
    }

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const hashedPassword = await hashPassword(rawPassword.trim());
    user.password = hashedPassword;
    await user.save();

    return sendSuccess(res, 200, `Password for user '${user.name}' (${user.email}) updated successfully.`, {
      userId: user._id,
      name: user.name,
      email: user.email,
      updatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available roles
 */
exports.getAllRoles = async (req, res, next) => {
  try {
    const roles = await RoleMaster.find().select('roleName roleCode description isActive');
    return sendSuccess(res, 200, 'Roles retrieved successfully.', roles);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a user and ALL associated data (Cascade Delete)
 * Deletes user document, role profiles, attendance logs, screenshots, app usage,
 * leave balances/requests, payrolls, offer letters, notifications, and device requests.
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const userId = user._id;

    // 1. Delete matching role profile documents
    const roleModels = [
      require('../models/Employee'),
      require('../models/Architect'),
      require('../models/HR'),
      require('../models/ProjectManager'),
      require('../models/SiteEngineer'),
      require('../models/Client'),
      require('../models/SuperAdmin')
    ];
    for (const Model of roleModels) {
      await Model.deleteMany({ $or: [{ userId }, { user: userId }] });
    }

    // 2. Delete attendance, tracking & activity logs
    await require('../models/Attendance').deleteMany({ userId });
    await require('../models/Screenshot').deleteMany({ userId });
    await require('../models/AppUsageLog').deleteMany({ userId });
    await require('../models/AppUsageDailySummary').deleteMany({ userId });
    await require('../models/HeartbeatLog').deleteMany({ userId });

    // 3. Delete leave requests, balances & correction requests
    await require('../models/LeaveRequest').deleteMany({ userId });
    await require('../models/LeaveBalance').deleteMany({ userId });
    await require('../models/LeaveBalanceAdjustment').deleteMany({ userId });
    await require('../models/AttendanceCorrectionRequest').deleteMany({ userId });

    // 4. Delete administrative & financial records
    await require('../models/Payroll').deleteMany({ userId });
    await require('../models/OfferLetter').deleteMany({ userId });
    await require('../models/Notification').deleteMany({ userId });
    await require('../models/DeviceChangeRequest').deleteMany({ userId });
    await require('../models/UnauthorizedAttempt').deleteMany({ userId });

    // 5. Clean up local storage folders for offer letters, salary, and screenshots if present
    try {
      const fs = require('fs');
      const path = require('path');
      const { safeResolvePath, sanitizeNameForPath } = require('../utils/storagePathResolver');

      const safeOfferDir = safeResolvePath(path.join('storage', 'offer_letters', String(userId)));
      if (safeOfferDir && fs.existsSync(safeOfferDir)) fs.rmSync(safeOfferDir, { recursive: true, force: true });

      const safeSalaryDir = safeResolvePath(path.join('storage', 'salary', String(userId)));
      if (safeSalaryDir && fs.existsSync(safeSalaryDir)) fs.rmSync(safeSalaryDir, { recursive: true, force: true });

      const folderName = sanitizeNameForPath(user.name || user.email, userId);
      const safeScreenshotDir = safeResolvePath(path.join('storage', 'screenshots', folderName));
      if (safeScreenshotDir && fs.existsSync(safeScreenshotDir)) fs.rmSync(safeScreenshotDir, { recursive: true, force: true });
    } catch (fsErr) {
      console.warn('Physical storage cleanup warning during user delete:', fsErr.message);
    }

    // 6. Delete the primary User document
    await User.findByIdAndDelete(userId);

    return sendSuccess(res, 200, `User '${user.name}' (${user.email}) and all associated data deleted successfully.`);
  } catch (error) {
    next(error);
  }
};

