const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ClientProjectLink = require('../models/ClientProjectLink');

let io = null;

/**
 * Initializes Socket.io server attached to Express HTTP server.
 * @param {object} server - Node.js HTTP server instance
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join Project Room Handler
    socket.on('join_project_room', async (data) => {
      try {
        const { projectId, clientId, contactId } = data || {};

        if (!projectId) {
          return socket.emit('error_response', { message: 'projectId is required to join project room.' });
        }

        // If client portal params passed, verify security linkage
        if (clientId) {
          const link = await ClientProjectLink.findOne({
            clientId,
            projectId,
            isActive: true,
            visibleToClient: true
          });

          if (!link) {
            return socket.emit('error_response', { message: 'Access denied. Project is not linked or visible to client.' });
          }
        }

        const roomName = `project_${projectId}`;
        socket.join(roomName);
        console.log(`✅ Socket ${socket.id} joined room ${roomName}`);

        socket.emit('room_joined', {
          success: true,
          room: roomName,
          projectId,
          message: `Successfully joined chat room for project ${projectId}`
        });
      } catch (error) {
        console.error('Error in join_project_room socket event:', error);
        socket.emit('error_response', { message: 'Failed to join project room.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Gets active Socket.io instance
 */
function getIO() {
  return io;
}

/**
 * Broadcasts payload event to all sockets in a project room
 */
function emitToProjectRoom(projectId, event, data) {
  if (io) {
    const roomName = `project_${projectId}`;
    io.to(roomName).emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToProjectRoom
};
