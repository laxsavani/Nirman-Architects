const SuperAdmin = require('../models/SuperAdmin');
const HR = require('../models/HR');
const ProjectManager = require('../models/ProjectManager');
const Architect = require('../models/Architect');
const SiteEngineer = require('../models/SiteEngineer');
const Employee = require('../models/Employee');
const Client = require('../models/Client');

/**
 * Reusable helper to map role name to Mongoose model (case-insensitive & handles aliases).
 * 
 * @param {string} roleName
 * @returns {mongoose.Model|null}
 */
const getRoleModel = (roleName) => {
  if (!roleName) return null;
  const normalized = roleName.toString().trim().toLowerCase().replace(/[\s_]+/g, '');
  switch (normalized) {
    case 'superadmin': return SuperAdmin;
    case 'hr': return HR;
    case 'projectmanager': return ProjectManager;
    case 'architect': return Architect;
    case 'siteengineer':
    case 'sitemanager': return SiteEngineer;
    case 'employee': return Employee;
    case 'client':
    case 'customer': return Client;
    default: return null;
  }
};

/**
 * Checks if a user's role has HR or Admin privileges.
 * 
 * @param {string} roleName
 * @returns {boolean}
 */
const isHR = (roleName) => {
  if (!roleName) return false;
  const normalized = roleName.toString().trim().toLowerCase().replace(/[\s_]+/g, '');
  return normalized === 'hr' || normalized === 'superadmin';
};

/**
 * Checks if a user's role has Project Manager, HR, or Admin privileges.
 * 
 * @param {string} roleName
 * @returns {boolean}
 */
const isPM = (roleName) => {
  if (!roleName) return false;
  const normalized = roleName.toString().trim().toLowerCase().replace(/[\s_]+/g, '');
  return normalized === 'projectmanager' || normalized === 'hr' || normalized === 'superadmin';
};

/**
 * Checks if a user's role has Super Admin privileges.
 * 
 * @param {string} roleName
 * @returns {boolean}
 */
const isSuperAdmin = (roleName) => {
  if (!roleName) return false;
  const normalized = roleName.toString().trim().toLowerCase().replace(/[\s_]+/g, '');
  return normalized === 'superadmin';
};

module.exports = {
  getRoleModel,
  isSuperAdmin,
  isHR,
  isPM
};
