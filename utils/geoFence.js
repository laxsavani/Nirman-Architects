/**
 * Calculates the distance in meters between two geographical coordinates
 * using the Haversine formula.
 * 
 * @param {number} lat1 Latitude of point 1 (in degrees)
 * @param {number} lon1 Longitude of point 1 (in degrees)
 * @param {number} lat2 Latitude of point 2 (in degrees)
 * @param {number} lon2 Longitude of point 2 (in degrees)
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const rad = Math.PI / 180;
  
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Rounded to 2 decimal places
}

/**
 * Checks if a user coordinate is within a project site's allowed radius.
 * 
 * @param {number} userLat User's GPS latitude
 * @param {number} userLng User's GPS longitude
 * @param {number} siteLat Site's GPS latitude
 * @param {number} siteLng Site's GPS longitude
 * @param {number} radiusMeters Allowed geo-fence radius in meters (default: 100m)
 * @returns {{ isInside: boolean, distanceMeters: number }}
 */
function isWithinGeoFence(userLat, userLng, siteLat, siteLng, radiusMeters = 100) {
  const distanceMeters = calculateDistance(userLat, userLng, siteLat, siteLng);
  return {
    isInside: distanceMeters <= radiusMeters,
    distanceMeters
  };
}

module.exports = {
  calculateDistance,
  isWithinGeoFence
};
