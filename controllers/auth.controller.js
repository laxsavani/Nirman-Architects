const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { getRoleModel } = require('../utils/roles');
const { hashPassword, comparePassword, validatePasswordComplexity } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Register / Create a user (Public or Admin registration)
 */
exports.register = async (req, res, next) => {
  try {
    const { 
      name, firstName, lastName, email, password, phone, mobileNumber, 
      roleId, role, department, designation, joiningDate, baseSalary, deviceId 
    } = req.body;

    const userName = name || (firstName ? `${firstName} ${lastName || ''}`.trim() : null);
    const userEmail = email ? email.toLowerCase().trim() : null;
    const userPhone = phone || mobileNumber;

    if (!userName || !userEmail || !password) {
      return sendError(res, 400, 'name, email, and password are required.');
    }

    const pwdValidation = validatePasswordComplexity(password);
    if (!pwdValidation.valid) {
      return sendError(res, 400, pwdValidation.message);
    }

    const existingUser = await User.findOne({ email: userEmail });
    if (existingUser) {
      return sendError(res, 400, 'Email is already registered.');
    }

    // Resolve RoleMaster
    let roleDoc = null;
    if (roleId) {
      roleDoc = await RoleMaster.findById(roleId);
    } else if (role) {
      roleDoc = await RoleMaster.findOne({ 
        $or: [{ roleCode: role.toUpperCase() }, { roleName: role }] 
      });
    }

    if (!roleDoc) {
      // Default to EMPLOYEE if not specified
      roleDoc = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    }

    if (!roleDoc) {
      return sendError(res, 400, 'Invalid role specified and default EMPLOYEE role not found.');
    }

    const hashedPassword = await hashPassword(password);
    const assignedDeviceId = deviceId ? deviceId.trim() : null;

    const newUser = new User({
      name: userName,
      email: userEmail,
      password: hashedPassword,
      phone: userPhone,
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

    // Auto-create matching role profile document
    const RoleModel = getRoleModel(roleDoc.roleCode || roleDoc.roleName);
    if (RoleModel) {
      await RoleModel.findOneAndUpdate(
        { userId: newUser._id },
        { $setOnInsert: { userId: newUser._id } },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const roleCode = roleDoc.roleCode || roleDoc.roleName;
    const token = generateToken({
      userId: newUser._id,
      id: newUser._id,
      email: newUser.email,
      roleCode: roleCode,
      role: roleCode
    });

    return sendSuccess(res, 201, 'User registered successfully.', {
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        roleId: newUser.roleId,
        roleCode: roleCode,
        department: newUser.department,
        designation: newUser.designation,
        baseSalary: newUser.baseSalary,
        deviceId: newUser.deviceId,
        deviceStatus: newUser.deviceStatus
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('roleId');
    if (!user) {
      return sendError(res, 400, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account is deactivated. Please contact administrator.');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return sendError(res, 400, 'Invalid email or password.');
    }

    const roleCode = (user.roleId && (user.roleId.roleCode || user.roleId.roleName)) || 'EMPLOYEE';

    const payload = {
      userId: user._id,
      id: user._id,
      email: user.email,
      roleCode: roleCode,
      role: roleCode
    };

    const token = generateToken(payload);

    return sendSuccess(res, 200, 'Login successful.', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId ? user.roleId._id : null,
        roleCode: roleCode,
        department: user.department,
        designation: user.designation,
        baseSalary: user.baseSalary,
        deviceId: user.deviceId,
        deviceStatus: user.deviceStatus
      }
    });

  } catch (error) {
    next(error);
  }
};
