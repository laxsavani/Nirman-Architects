/**
 * Returns startOfDay and endOfDay Date objects for a given date string or Date instance.
 * 
 * @param {string|Date} dateInput
 * @returns {{ startOfDay: Date, endOfDay: Date }}
 */
const getDayDateRange = (dateInput) => {
  const startOfDay = new Date(dateInput);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(dateInput);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

/**
 * Returns startDate and endDate Date objects for a given month (1-12) and year.
 * 
 * @param {number} year
 * @param {number} month (1-12)
 * @returns {{ startDate: Date, endDate: Date }}
 */
const getMonthDateRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return { startDate, endDate };
};

module.exports = {
  getDayDateRange,
  getMonthDateRange
};
