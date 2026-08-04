const SiteLocation = require('../models/SiteLocation');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * PM/HR Endpoint: Setup or update a Project Site Location for Geo-Fencing.
 */
exports.createSiteLocation = async (req, res, next) => {
  try {
    const { role } = req.user;
    if (role !== 'Super Admin' && role !== 'HR' && role !== 'Project Manager') {
      return sendError(res, 403, 'Access denied. HR or Project Manager privileges required.');
    }

    const { projectId, projectName, lat, lng, radiusMeters } = req.body;

    if (!projectName || lat === undefined || lng === undefined) {
      return sendError(res, 400, 'projectName, lat, and lng are required.');
    }

    let siteLocation;
    if (projectId && (typeof projectId === 'string' || typeof projectId === 'number')) {
      siteLocation = await SiteLocation.findOne({ project: String(projectId) });
    }

    if (siteLocation) {
      siteLocation.projectName = projectName;
      siteLocation.lat = Number(lat);
      siteLocation.lng = Number(lng);
      if (radiusMeters) siteLocation.radiusMeters = Number(radiusMeters);
      await siteLocation.save();
    } else {
      siteLocation = new SiteLocation({
        project: projectId || null,
        projectName,
        lat: Number(lat),
        lng: Number(lng),
        radiusMeters: radiusMeters ? Number(radiusMeters) : 100
      });
      await siteLocation.save();
    }

    if (projectId) {
      await Project.findByIdAndUpdate(projectId, { siteLocation: siteLocation._id });
    }

    return sendSuccess(res, 201, 'Project site location configured successfully.', { siteLocation });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all site locations.
 */
exports.getSiteLocations = async (req, res, next) => {
  try {
    const locations = await SiteLocation.find().populate('project', 'name');
    return sendSuccess(res, 200, 'Site locations retrieved successfully.', { locations });
  } catch (error) {
    next(error);
  }
};
