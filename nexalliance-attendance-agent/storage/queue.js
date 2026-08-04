const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure directory exists
function ensureStorageDir() {
  if (!fs.existsSync(config.STORAGE_DIR)) {
    fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
  }
}

/**
 * Reads offline queue from queue.json
 */
function getQueue() {
  try {
    ensureStorageDir();
    if (!fs.existsSync(config.QUEUE_FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(config.QUEUE_FILE_PATH, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('[Queue] Error reading queue file:', error.message);
    return [];
  }
}

/**
 * Saves items array to queue.json
 */
function saveQueue(items) {
  try {
    ensureStorageDir();
    fs.writeFileSync(config.QUEUE_FILE_PATH, JSON.stringify(items, null, 2), 'utf8');
  } catch (error) {
    console.error('[Queue] Error saving queue file:', error.message);
  }
}

/**
 * Add failed API payload event to offline queue
 */
function enqueue(eventPayload) {
  const queue = getQueue();
  const item = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    payload: eventPayload,
    queuedAt: new Date().toISOString()
  };
  queue.push(item);
  saveQueue(queue);
  console.log(`[Queue] Cached event offline. Total queued: ${queue.length}`);
  return item;
}

/**
 * Remove processed items from queue
 */
function removeFromQueue(itemIds) {
  let queue = getQueue();
  queue = queue.filter(item => !itemIds.includes(item.id));
  saveQueue(queue);
  console.log(`[Queue] Cleared ${itemIds.length} synced items. Remaining: ${queue.length}`);
}

/**
 * Clear queue completely
 */
function clearQueue() {
  saveQueue([]);
}

module.exports = {
  getQueue,
  saveQueue,
  enqueue,
  removeFromQueue,
  clearQueue
};
