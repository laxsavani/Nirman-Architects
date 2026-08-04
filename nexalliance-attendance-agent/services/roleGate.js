/**
 * Shared Role Gate Helper
 * Determines whether monitoring/tracking modules apply to the given user.
 * Returns false for SUPER_ADMIN (zero tracking), true for HR, PM, Architect, Employee.
 */
function isMonitoringApplicable(currentUser) {
  if (!currentUser) return false;
  const roleCode = String(currentUser.roleCode || currentUser.role || '').toUpperCase();
  return roleCode !== 'SUPER_ADMIN';
}

module.exports = {
  isMonitoringApplicable
};
