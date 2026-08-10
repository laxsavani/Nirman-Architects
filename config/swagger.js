const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const port = process.env.PORT || 5000;
const renderUrl = process.env.RENDER_EXTERNAL_URL || 'https://nirman-architects-api.onrender.com';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Nirman Architects - HRM Module API Documentation',
    version: '1.0.0',
    description: 'Production-grade OpenAPI 3.0 specification covering all endpoints for Identity & Role Management, Device Binding, Attendance, Dynamic Leave Management, Payroll with PDF Generation, Offer Letters, Site Locations (Geo-Fencing), and Notifications.',
    contact: {
      name: 'Nexalliance IT Partner',
      email: 'support@nexalliance.in'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Current Active Server (Auto-detected Host & Protocol)'
    },
    {
      url: `http://localhost:${port}/api`,
      description: 'Local Development Server'
    },
    {
      url: renderUrl.endsWith('/api') ? renderUrl : `${renderUrl}/api`,
      description: 'Render Cloud Deployment Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT authorization token (obtainable from /api/auth/login or /api/login)'
      },
      clientBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Client Portal JWT authorization token (obtainable from /api/client-auth/login)'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error description message' }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          name: { type: 'string', example: 'Rohan Sharma' },
          email: { type: 'string', example: 'rohan.sharma@nirman.com' },
          phone: { type: 'string', example: '9876543210' },
          roleId: { type: 'string', example: '64bd9f0296e625a5857e4e01' },
          department: { type: 'string', example: 'Architecture' },
          designation: { type: 'string', example: 'Senior Architect' },
          baseSalary: { type: 'number', example: 25000 },
          joiningDate: { type: 'string', format: 'date-time' },
          deviceId: { type: 'string', example: 'DESKTOP-GUID-12345' },
          deviceStatus: { type: 'string', enum: ['APPROVED', 'PENDING', 'BLOCKED'] },
          isActive: { type: 'boolean', example: true }
        }
      },
      RoleMaster: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          roleName: { type: 'string', example: 'Senior Architect' },
          roleCode: { type: 'string', example: 'SENIOR_ARCHITECT' },
          description: { type: 'string', example: 'Senior architectural team lead' },
          isActive: { type: 'boolean', example: true }
        }
      },
      Attendance: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          clockInTime: { type: 'string', format: 'date-time' },
          clockOutTime: { type: 'string', format: 'date-time', nullable: true },
          clientClockIn: { type: 'string', format: 'date-time' },
          clientClockOut: { type: 'string', format: 'date-time' },
          deviceId: { type: 'string' },
          isOfflineEntry: { type: 'boolean', example: false },
          autoClosed: { type: 'boolean', example: false },
          lastHeartbeat: { type: 'string', format: 'date-time' }
        }
      },
      AttendanceConfig: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          heartbeatIntervalSeconds: { type: 'number', example: 120 },
          heartbeatTimeoutMinutes: { type: 'number', example: 10 },
          shiftStartTime: { type: 'string', example: '09:00' },
          shiftEndTime: { type: 'string', example: '18:00' },
          updatedBy: { type: 'string' }
        }
      },
      SiteLocation: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          projectId: { type: 'string', example: 'PROJ-101' },
          projectName: { type: 'string', example: 'Nirman Commercial Tower' },
          lat: { type: 'number', example: 23.0225 },
          lng: { type: 'number', example: 72.5714 },
          radiusMeters: { type: 'number', example: 100 }
        }
      },
      LeaveType: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Casual Leave' },
          code: { type: 'string', example: 'CL' },
          isPaid: { type: 'boolean', example: true },
          defaultQuotaPerYear: { type: 'number', example: 12 },
          isActive: { type: 'boolean', example: true }
        }
      },
      LeaveBalance: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          leaveTypeId: { type: 'string' },
          year: { type: 'number', example: 2026 },
          allocatedDays: { type: 'number', example: 12 },
          usedDays: { type: 'number', example: 2 }
        }
      },
      LeaveRequest: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          leaveTypeId: { type: 'string' },
          fromDate: { type: 'string', format: 'date' },
          toDate: { type: 'string', format: 'date' },
          totalDays: { type: 'number', example: 2 },
          reason: { type: 'string', example: 'Personal work' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
          isPaidSnapshot: { type: 'boolean', example: true }
        }
      },
      Payroll: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          month: { type: 'number', example: 7 },
          year: { type: 'number', example: 2026 },
          baseSalary: { type: 'number', example: 25000 },
          daysInMonth: { type: 'number', example: 30 },
          presentDays: { type: 'number', example: 29 },
          paidLeaveDays: { type: 'number', example: 0 },
          unpaidLeaveDays: { type: 'number', example: 1 },
          absentDays: { type: 'number', example: 0 },
          perDaySalary: { type: 'number', example: 833.33 },
          totalDeduction: { type: 'number', example: 833.33 },
          netSalary: { type: 'number', example: 24166.67 },
          pdfPath: { type: 'string', example: 'storage/salary/64bd9f.../2026/payslip_64bd9f..._7_2026.pdf' }
        }
      },
      OfferLetter: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          generatedBy: { type: 'string' },
          filePath: { type: 'string', example: 'storage/offer_letters/64bd9f.../offer_letter_64bd9f..._178488765.pdf' },
          designationSnapshot: { type: 'string', example: 'Senior Architect' },
          departmentSnapshot: { type: 'string', example: 'Architecture' },
          baseSalarySnapshot: { type: 'number', example: 25000 },
          joiningDateSnapshot: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['GENERATED', 'SENT', 'ACKNOWLEDGED'] }
        }
      },
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          type: { type: 'string', example: 'OFFER_LETTER_READY' },
          message: { type: 'string', example: 'Your offer letter is ready for view.' },
          isRead: { type: 'boolean', example: false }
        }
      },
      ScreenshotConfig: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          intervalMinutes: { type: 'number', example: 10 },
          activeHoursStart: { type: 'string', example: '09:00' },
          activeHoursEnd: { type: 'string', example: '18:00' },
          imageQuality: { type: 'number', example: 70 },
          blurSensitivity: { type: 'boolean', example: false },
          updatedBy: { type: 'string' }
        }
      },
      ScreenshotRecord: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          attendanceId: { type: 'string' },
          filePath: { type: 'string', example: 'storage/screenshots/64bd9f.../2026-07-28/att_123.jpg' },
          capturedAt: { type: 'string', format: 'date-time' },
          fileSize: { type: 'number', example: 145200 },
          isOfflineSync: { type: 'boolean', example: false }
        }
      },
      AppUsageConfig: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4e88' },
          pollIntervalSeconds: { type: 'number', example: 5 },
          syncIntervalMinutes: { type: 'number', example: 5 },
          captureWindowTitle: { type: 'boolean', example: false },
          isEnabled: { type: 'boolean', example: true },
          updatedBy: { type: 'string' }
        }
      },
      AppUsageLog: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          attendanceId: { type: 'string' },
          batchReceivedAt: { type: 'string', format: 'date-time' },
          appUsage: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                appName: { type: 'string', example: 'Visual Studio Code' },
                secondsActive: { type: 'number', example: 300 },
                windowTitle: { type: 'string', example: 'server.js - Nirman-Architects' }
              }
            }
          },
          isOfflineSync: { type: 'boolean', example: false }
        }
      },
      AppUsageDailySummary: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userId: { type: 'string' },
          date: { type: 'string', example: '2026-07-28' },
          appTotals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                appName: { type: 'string', example: 'Visual Studio Code' },
                totalSeconds: { type: 'number', example: 14400 }
              }
            }
          },
          idleSeconds: { type: 'number', example: 600 },
          totalTrackedSeconds: { type: 'number', example: 28800 }
        }
      },
      Client: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
          name: { type: 'string', example: 'Patel Residence' },
          companyName: { type: 'string', nullable: true, example: 'Patel Enterprises' },
          phone: { type: 'string', example: '9876543210' },
          email: { type: 'string', nullable: true, example: 'hirak@patel.com' },
          billingAddress: { type: 'string', nullable: true, example: '101 Satellite Road, Ahmedabad' },
          siteAddresses: {
            type: 'array',
            items: { type: 'string' },
            example: ['Plot 45, SG Highway, Ahmedabad']
          },
          sourceLeadId: { type: 'string', nullable: true, example: '64bd9f0296e625a5857e4f20' },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ClientContact: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f50' },
          clientId: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
          name: { type: 'string', example: 'Hirak Patel' },
          email: { type: 'string', example: 'hirak@patel.com' },
          phone: { type: 'string', example: '9876543210' },
          permissionLevel: { type: 'string', enum: ['OWNER', 'MEMBER', 'VIEW_ONLY'], example: 'OWNER' },
          isPrimaryContact: { type: 'boolean', example: true },
          mustChangePassword: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
          createdBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          createdByModel: { type: 'string', enum: ['User', 'ClientContact'], example: 'User' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ClientContactActionLog: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f60' },
          clientId: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
          contactId: { type: 'string', example: '64bd9f0296e625a5857e4f50' },
          action: { type: 'string', example: 'CONTACT_ADDED' },
          targetContactId: { type: 'string', nullable: true, example: '64bd9f0296e625a5857e4f51' },
          performedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ClientProjectLink: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f70' },
          clientId: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
          projectId: { type: 'string', example: '64bd9f0296e625a5857e4f80' },
          visibleToClient: { type: 'boolean', example: true },
          linkedBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          linkedAt: { type: 'string', format: 'date-time' },
          unlinkedBy: { type: 'string', nullable: true },
          unlinkedAt: { type: 'string', format: 'date-time', nullable: true },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ClientProjectLinkHistory: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f75' },
          clientId: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
          projectId: { type: 'string', example: '64bd9f0296e625a5857e4f80' },
          action: { type: 'string', enum: ['LINKED', 'UNLINKED', 'VISIBILITY_CHANGED'], example: 'LINKED' },
          performedBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          notes: { type: 'string', nullable: true, example: 'Project linked after contract signing' },
          performedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ClientPortalSession: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f90' },
          contactId: { type: 'string', example: '64bd9f0296e625a5857e4f50' },
          platform: { type: 'string', enum: ['WEB', 'ANDROID', 'IOS'], example: 'WEB' },
          loginAt: { type: 'string', format: 'date-time' },
          lastActiveAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Lead: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f20' },
          name: { type: 'string', example: 'Mr. Hirak Patel' },
          phone: { type: 'string', example: '9876543210' },
          email: { type: 'string', example: 'hirak@patel.com' },
          source: { type: 'string', enum: ['Referral', 'Website', 'WalkIn', 'SocialMedia', 'Other'], example: 'Referral' },
          requirementNotes: { type: 'string', example: '3BHK bungalow interior design' },
          assignedTo: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          status: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'], example: 'NEW' },
          lostReason: { type: 'string', nullable: true, example: null },
          nextFollowUpDate: { type: 'string', format: 'date-time', nullable: true },
          convertedToClientId: { type: 'string', nullable: true },
          createdBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      LeadInteraction: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f30' },
          leadId: { type: 'string', example: '64bd9f0296e625a5857e4f20' },
          type: { type: 'string', enum: ['Call', 'Meeting', 'Email', 'Note'], example: 'Call' },
          notes: { type: 'string', example: 'Discussed project scope and budget requirements' },
          loggedBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          loggedAt: { type: 'string', format: 'date-time' }
        }
      },
      LeadStatusHistory: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64bd9f0296e625a5857e4f40' },
          leadId: { type: 'string', example: '64bd9f0296e625a5857e4f20' },
          fromStatus: { type: 'string', nullable: true, example: 'NEW' },
          toStatus: { type: 'string', example: 'CONTACTED' },
          changedBy: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
          changedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health & System'],
        summary: 'Check API service health status',
        responses: {
          200: { description: 'API Service operates normally' }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Authentication & Identity'],
        summary: 'Public or Admin user registration',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Rohan Sharma' },
                  email: { type: 'string', example: 'rohan.sharma@nirman.com' },
                  password: { type: 'string', example: 'Secret123!' },
                  phone: { type: 'string', example: '9876543210' },
                  roleId: { type: 'string', example: '64bd9f0296e625a5857e4e01' },
                  role: { type: 'string', example: 'EMPLOYEE' },
                  department: { type: 'string', example: 'Architecture' },
                  designation: { type: 'string', example: 'Junior Architect' },
                  baseSalary: { type: 'number', example: 25000 },
                  deviceId: { type: 'string', example: 'GUID-MACHINE-123' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'User registered successfully' },
          400: { description: 'Validation error or email already registered' }
        }
      }
    },
    '/register': {
      post: {
        tags: ['Authentication & Identity'],
        summary: 'Public registration alias for /auth/register',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Rohan Sharma' },
                  email: { type: 'string', example: 'rohan.sharma@nirman.com' },
                  password: { type: 'string', example: 'Secret123!' },
                  phone: { type: 'string', example: '9876543210' },
                  roleId: { type: 'string' },
                  department: { type: 'string' },
                  designation: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'User registered successfully' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication & Identity'],
        summary: 'User login with credentials (rate limited)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@nirman.com' },
                  password: { type: 'string', example: 'Admin123!' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful, returns JWT bearer token' },
          400: { description: 'Invalid email or password' },
          403: { description: 'Account is deactivated' },
          429: { description: 'Too many login attempts. Please try again after 15 minutes.' }
        }
      }
    },
    '/login': {
      post: {
        tags: ['Authentication & Identity'],
        summary: 'User login alias for /auth/login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@nirman.com' },
                  password: { type: 'string', example: 'Admin123!' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful, returns JWT bearer token' }
        }
      }
    },
    '/roles': {
      get: {
        tags: ['User Management'],
        summary: 'Get list of available roles for user creation dropdowns',
        responses: {
          200: { description: 'List of roles' }
        }
      }
    },
    '/users/create': {
      post: {
        tags: ['User Management'],
        summary: 'Register new employee and auto-generate Offer Letter (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'roleId'],
                properties: {
                  name: { type: 'string', example: 'Rohan Sharma' },
                  email: { type: 'string', example: 'rohan.sharma@nirman.com' },
                  password: { type: 'string', example: 'Secret123!' },
                  phone: { type: 'string', example: '9876543210' },
                  roleId: { type: 'string', example: '64bd9f0296e625a5857e4e01' },
                  department: { type: 'string', example: 'Architecture' },
                  designation: { type: 'string', example: 'Senior Architect' },
                  baseSalary: { type: 'number', example: 25000 },
                  joiningDate: { type: 'string', format: 'date', example: '2026-08-01' },
                  deviceId: { type: 'string', example: 'GUID-MACHINE-123' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'User created & Offer Letter generated successfully' },
          400: { description: 'Validation error or duplicate email' }
        }
      }
    },
    '/users': {
      get: {
        tags: ['User Management'],
        summary: 'Get all users with optional filtering (Super Admin / HR)',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'department', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of users retrieved' }
        }
      }
    },
    '/users/{id}': {
      get: {
        tags: ['User Management'],
        summary: 'Get user profile details by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'User profile retrieved' },
          404: { description: 'User not found' }
        }
      },
      put: {
        tags: ['User Management'],
        summary: 'Update user profile fields (Super Admin / HR)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  department: { type: 'string' },
                  designation: { type: 'string' },
                  baseSalary: { type: 'number' },
                  joiningDate: { type: 'string', format: 'date' },
                  deviceId: { type: 'string' },
                  deviceStatus: { type: 'string', enum: ['APPROVED', 'PENDING', 'BLOCKED'] },
                  isActive: { type: 'boolean' },
                  roleId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'User updated successfully' },
          404: { description: 'User not found' }
        }
      },
      delete: {
        tags: ['User Management'],
        summary: 'Delete user and ALL associated data (Cascade Delete - Super Admin / HR)',
        description: 'Permanently deletes user, role profiles, attendance, screenshots, app usage, leaves, payrolls, offer letters, notifications, and physical storage files.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Target User MongoDB _id' }
        ],
        responses: {
          200: { 
            description: 'User and all associated data deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: "User 'Rohan Sharma' (rohan@nirman.com) and all associated data deleted successfully." }
                  }
                }
              }
            }
          },
          404: { description: 'User not found' },
          403: { description: 'Access denied - SuperAdmin or HR required' }
        }
      }
    },
    '/users/{id}/change-password': {
      put: {
        tags: ['User Management'],
        summary: 'Admin change user password (Super Admin / HR)',
        description: 'Allows Super Admin or HR to directly change any user password.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Target User ID' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPassword'],
                properties: {
                  newPassword: { type: 'string', example: 'NewSecretPassword123!', description: 'New password for the user' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password updated successfully' },
          400: { description: 'Validation error (missing or short password)' },
          404: { description: 'User not found' }
        }
      }
    },
    '/role-master/all': {
      get: {
        tags: ['Role Master'],
        summary: 'Get all dynamic roles',
        responses: {
          200: { description: 'List of roles' }
        }
      }
    },
    '/role-master/create': {
      post: {
        tags: ['Role Master'],
        summary: 'Create a new dynamic role (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roleName', 'roleCode'],
                properties: {
                  roleName: { type: 'string', example: 'Senior Architect' },
                  roleCode: { type: 'string', example: 'SENIOR_ARCHITECT' },
                  description: { type: 'string', example: 'Design lead' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Role created successfully' }
        }
      }
    },
    '/device/register': {
      post: {
        tags: ['Device Binding'],
        summary: 'Register or request machine GUID device binding',
        description: 'Binds a machine GUID/Device ID to a user account. Automatically approves first device; creates a PENDING change request for secondary devices.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId'],
                properties: {
                  userId: { type: 'string', description: 'Required if calling unauthenticated', example: '64bd9f0296e625a5857e4e10' },
                  deviceId: { type: 'string', example: 'E3D9C5BE-3D2C-4C2E-ACF8-A108FF8A3EC5' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Device status response (APPROVED or PENDING)' },
          400: { description: 'Missing fields or invalid request' }
        }
      }
    },
    '/device/status': {
      get: {
        tags: ['Device Binding'],
        summary: 'Get logged-in user device status & pending requests',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Optional target user ID for Admin lookup' }
        ],
        responses: {
          200: { description: 'Device status object' }
        }
      }
    },
    '/device/pending': {
      get: {
        tags: ['Device Binding'],
        summary: 'List all pending device change requests (Super Admin / HR)',
        responses: {
          200: { description: 'List of pending device change requests' },
          403: { description: 'Admin/HR access required' }
        }
      }
    },
    '/device/approve': {
      post: {
        tags: ['Device Binding'],
        summary: 'Approve or reject a device change request (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requestId', 'action'],
                properties: {
                  requestId: { type: 'string', example: '64bd9f0296e625a5857e4e99' },
                  action: { type: 'string', enum: ['APPROVE', 'REJECT'], example: 'APPROVE' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Device change request processed successfully' },
          403: { description: 'Admin/HR access required' }
        }
      }
    },
    '/device/assign': {
      post: {
        tags: ['Device Binding'],
        summary: 'Directly assign a Device ID to a user (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetUserId', 'deviceId'],
                properties: {
                  targetUserId: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
                  deviceId: { type: 'string', example: 'E3D9C5BE-3D2C-4C2E-ACF8-A108FF8A3EC5' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Device assigned successfully' },
          403: { description: 'Admin/HR access required' }
        }
      }
    },
    '/device/heartbeat': {
      post: {
        tags: ['Device Binding'],
        summary: '30-Second Desktop Agent heartbeat ping endpoint',
        description: 'Updates lastHeartbeat timestamp on active attendance session to maintain ONLINE status.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId'],
                properties: {
                  deviceId: { type: 'string', example: 'E3D9C5BE-3D2C-4C2E-ACF8-A108FF8A3EC5' },
                  currentTime: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Heartbeat recorded successfully' }
        }
      }
    },
    '/attendance/clock-in': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Clock in employee attendance session',
        description: 'Records official clock-in time for logged-in user from Desktop Agent or Mobile/Web App.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  clientTime: { type: 'string', format: 'date-time' },
                  deviceId: { type: 'string', example: 'E3D9C5BE-3D2C-4C2E-ACF8-A108FF8A3EC5' },
                  macAddress: { type: 'string', example: '00:1B:44:11:3A:B7' },
                  ip: { type: 'string', example: '192.168.1.100' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Clock-in session recorded successfully' },
          403: { description: 'Unauthorized or unassigned device' }
        }
      }
    },
    '/attendance/clock-out': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Clock out employee attendance session',
        description: 'Closes active attendance session and calculates total shift working hours.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  clientTime: { type: 'string', format: 'date-time' },
                  logoutTime: { type: 'string', format: 'date-time' },
                  reason: { type: 'string', example: 'Normal Shutdown' },
                  deviceId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Clock-out recorded and shift working hours calculated' }
        }
      }
    },
    '/attendance/today': {
      get: {
        tags: ['Attendance Module'],
        summary: 'Get active attendance session for logged-in user today',
        responses: {
          200: { description: 'Today active attendance record or null if not clocked in' }
        }
      }
    },
    '/attendance/event': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Post clock-in, clock-out, or heartbeat event (Server Time Authority)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type'],
                properties: {
                  userId: { type: 'string', description: 'Optional if using JWT Bearer' },
                  deviceId: { type: 'string' },
                  type: { type: 'string', enum: ['clock_in', 'clock_out', 'heartbeat'] },
                  clientTime: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Attendance event recorded successfully' },
          201: { description: 'Clock-in session created' },
          403: { description: 'Unauthorized device attempt rejected' }
        }
      }
    },
    '/attendance/sync': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Flush client offline_queue.json buffer into server Attendance collection',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type'],
                properties: {
                  userId: { type: 'string' },
                  type: { type: 'string', example: 'clock_in' },
                  localTime: { type: 'string', format: 'date-time' },
                  clientTime: { type: 'string', format: 'date-time' },
                  deviceId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Offline queue synced' }
        }
      }
    },
    '/attendance/heartbeat': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Desktop agent heartbeat ping alias for /attendance/event',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  deviceId: { type: 'string' },
                  clientTime: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Heartbeat recorded' }
        }
      }
    },
    '/attendance/clock': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Desktop agent clock-in/out event alias for /attendance/event',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type'],
                properties: {
                  userId: { type: 'string' },
                  deviceId: { type: 'string' },
                  type: { type: 'string', enum: ['clock_in', 'clock_out'] },
                  clientTime: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Attendance event recorded' }
        }
      }
    },
    '/attendance/my': {
      get: {
        tags: ['Attendance Module'],
        summary: 'Get own attendance history (Self-service)',
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'integer' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Own attendance records' }
        }
      }
    },
    '/attendance/all': {
      get: {
        tags: ['Attendance Module'],
        summary: 'Get attendance records for all employees (Super Admin / HR)',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'month', in: 'query', schema: { type: 'integer' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'All attendance records' }
        }
      }
    },
    '/attendance/correction/request': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Request attendance record manual correction',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['attendanceId', 'reason'],
                properties: {
                  attendanceId: { type: 'string' },
                  requestedClockIn: { type: 'string', format: 'date-time' },
                  requestedClockOut: { type: 'string', format: 'date-time' },
                  reason: { type: 'string', example: 'Forgot to clock in due to network issue' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Correction request submitted' }
        }
      }
    },
    '/attendance/correction/approve': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Approve attendance correction request (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requestId'],
                properties: {
                  requestId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Correction approved and attendance record updated' }
        }
      }
    },
    '/attendance/correction/reject': {
      post: {
        tags: ['Attendance Module'],
        summary: 'Reject attendance correction request (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requestId'],
                properties: {
                  requestId: { type: 'string' },
                  reason: { type: 'string', example: 'Insufficient justification' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Correction request rejected' }
        }
      }
    },
    '/attendance/config': {
      get: {
        tags: ['Attendance Module'],
        summary: 'Get attendance & heartbeat configuration settings',
        responses: {
          200: { description: 'Configuration retrieved' }
        }
      },
      put: {
        tags: ['Attendance Module'],
        summary: 'Update attendance & heartbeat configuration (Super Admin)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  heartbeatIntervalSeconds: { type: 'number', example: 120 },
                  heartbeatTimeoutMinutes: { type: 'number', example: 10 },
                  shiftStartTime: { type: 'string', example: '09:00' },
                  shiftEndTime: { type: 'string', example: '18:00' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Attendance config updated' }
        }
      }
    },
    '/site-locations': {
      post: {
        tags: ['Site Locations'],
        summary: 'Configure Project Site Geo-Fence Location (PM / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectName', 'lat', 'lng'],
                properties: {
                  projectId: { type: 'string', example: 'PROJ-101' },
                  projectName: { type: 'string', example: 'Nirman Commercial Tower' },
                  lat: { type: 'number', example: 23.0225 },
                  lng: { type: 'number', example: 72.5714 },
                  radiusMeters: { type: 'number', example: 100 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Site location configured successfully' }
        }
      },
      get: {
        tags: ['Site Locations'],
        summary: 'Get all project site locations',
        responses: {
          200: { description: 'List of configured project site locations' }
        }
      }
    },
    '/leave-type/active': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get list of active leave types for dropdowns',
        responses: {
          200: { description: 'Active leave types' }
        }
      }
    },
    '/leave-master/active': {
      get: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-type/active',
        responses: {
          200: { description: 'Active leave types' }
        }
      }
    },
    '/leave-type/all': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get all leave types including inactive (Super Admin)',
        responses: {
          200: { description: 'All leave types' }
        }
      }
    },
    '/leave-master/all': {
      get: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-type/all (Super Admin)',
        responses: {
          200: { description: 'All leave types' }
        }
      }
    },
    '/leave-type/create': {
      post: {
        tags: ['Leave Management'],
        summary: 'Create dynamic LeaveType and auto-seed balances for all active users (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string', example: 'Maternity Leave' },
                  code: { type: 'string', example: 'ML' },
                  isPaid: { type: 'boolean', example: true },
                  defaultQuotaPerYear: { type: 'number', example: 84 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'LeaveType created & user balances auto-seeded' }
        }
      }
    },
    '/leave-master/create': {
      post: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-type/create (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string', example: 'Maternity Leave' },
                  code: { type: 'string', example: 'ML' },
                  isPaid: { type: 'boolean', example: true },
                  defaultQuotaPerYear: { type: 'number', example: 84 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'LeaveType created' }
        }
      }
    },
    '/leave-type/{id}/update': {
      put: {
        tags: ['Leave Management'],
        summary: 'Update leave type definition (Super Admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  code: { type: 'string' },
                  isPaid: { type: 'boolean' },
                  defaultQuotaPerYear: { type: 'number' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Leave type updated' }
        }
      }
    },
    '/leave-type/{id}/deactivate': {
      put: {
        tags: ['Leave Management'],
        summary: 'Deactivate leave type (Super Admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Leave type deactivated' }
        }
      }
    },
    '/leave-master/{id}/update': {
      put: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-type/{id}/update (Super Admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  code: { type: 'string' },
                  isPaid: { type: 'boolean' },
                  defaultQuotaPerYear: { type: 'number' },
                  isActive: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Leave type updated' }
        }
      }
    },
    '/leave-master/{id}/deactivate': {
      put: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-type/{id}/deactivate (Super Admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Leave type deactivated' }
        }
      }
    },
    '/leave/apply': {
      post: {
        tags: ['Leave Management'],
        summary: 'Apply for leave (creates PENDING leave request)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leaveTypeId', 'fromDate', 'toDate'],
                properties: {
                  leaveTypeId: { type: 'string' },
                  fromDate: { type: 'string', format: 'date', example: '2026-08-10' },
                  toDate: { type: 'string', format: 'date', example: '2026-08-12' },
                  reason: { type: 'string', example: 'Family function' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Leave request submitted' }
        }
      }
    },
    '/leave/my': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get logged-in user leave request history',
        responses: {
          200: { description: 'User leave requests' }
        }
      }
    },
    '/leave/cancel': {
      post: {
        tags: ['Leave Management'],
        summary: 'Cancel pending leave request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leaveRequestId'],
                properties: {
                  leaveRequestId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Leave request cancelled' }
        }
      }
    },
    '/leave/pending': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get all pending leave requests for approval (Super Admin)',
        responses: {
          200: { description: 'Pending leave requests' }
        }
      }
    },
    '/leave/approve': {
      post: {
        tags: ['Leave Management'],
        summary: 'Approve leave request and freeze isPaidSnapshot (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leaveRequestId'],
                properties: {
                  leaveRequestId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Leave approved and balance updated' }
        }
      }
    },
    '/leave/reject': {
      post: {
        tags: ['Leave Management'],
        summary: 'Reject leave request (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leaveRequestId'],
                properties: {
                  leaveRequestId: { type: 'string' },
                  reason: { type: 'string', example: 'Overlap with major project milestone' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Leave request rejected' }
        }
      }
    },
    '/leave/all': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get company-wide leave requests (Super Admin / HR)',
        responses: {
          200: { description: 'All leave requests' }
        }
      }
    },
    '/leave-balance/my': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get own leave balances for current year',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Leave balances' }
        }
      }
    },
    '/leave/balance/my': {
      get: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-balance/my',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Leave balances' }
        }
      }
    },
    '/leave-balance/{userId}': {
      get: {
        tags: ['Leave Management'],
        summary: 'Get leave balances for a specific user (Super Admin / HR)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'User leave balances' }
        }
      }
    },
    '/leave/balance/{userId}': {
      get: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-balance/{userId}',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'User leave balances' }
        }
      }
    },
    '/leave-balance/adjust': {
      post: {
        tags: ['Leave Management'],
        summary: 'Audited manual leave balance adjustment (Super Admin / HR)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'leaveTypeId', 'newValue', 'reason'],
                properties: {
                  userId: { type: 'string' },
                  leaveTypeId: { type: 'string' },
                  newValue: { type: 'number', example: 10 },
                  reason: { type: 'string', example: 'Manual adjustment per HR policy' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Balance adjusted and audit trail logged' }
        }
      }
    },
    '/leave/balance/adjust': {
      post: {
        tags: ['Leave Management'],
        summary: 'Alias for /leave-balance/adjust',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'leaveTypeId', 'newValue', 'reason'],
                properties: {
                  userId: { type: 'string' },
                  leaveTypeId: { type: 'string' },
                  newValue: { type: 'number' },
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Balance adjusted' }
        }
      }
    },
    '/payroll/my': {
      get: {
        tags: ['Payroll Module'],
        summary: 'Get logged-in user payroll history',
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'integer' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'User payroll records' }
        }
      }
    },
    '/payroll/my/download': {
      get: {
        tags: ['Payroll Module'],
        summary: 'Self-download own PDF payslip (Strictly scoped to JWT user)',
        parameters: [
          { name: 'month', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'year', in: 'query', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Streams PDF payslip file' }
        }
      }
    },
    '/payroll/all': {
      get: {
        tags: ['Payroll Module'],
        summary: 'Get all employee payroll records (Super Admin / HR)',
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'integer' } },
          { name: 'year', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'All payroll records' }
        }
      }
    },
    '/payroll/generate': {
      post: {
        tags: ['Payroll Module'],
        summary: 'Generate monthly payroll for all active employees (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['month', 'year'],
                properties: {
                  month: { type: 'number', example: 7 },
                  year: { type: 'number', example: 2026 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Payroll calculated and saved to MongoDB & storage/salary/' }
        }
      }
    },
    '/payroll/generate/{userId}': {
      post: {
        tags: ['Payroll Module'],
        summary: 'Generate monthly payroll for a specific user (Super Admin)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['month', 'year'],
                properties: {
                  month: { type: 'number', example: 7 },
                  year: { type: 'number', example: 2026 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Payroll calculated and PDF payslip generated for user' }
        }
      }
    },
    '/payroll/download-all': {
      get: {
        tags: ['Payroll Module'],
        summary: 'Bulk download all employee payslips for a given month as a ZIP file (Super Admin)',
        parameters: [
          { name: 'month', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'year', in: 'query', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Streams Payslips_<month>_<year>.zip file' }
        }
      }
    },
    '/payroll/download/{userId}': {
      get: {
        tags: ['Payroll Module'],
        summary: 'Download specific employee PDF payslip (Super Admin / HR)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'month', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'year', in: 'query', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Streams PDF payslip file' }
        }
      }
    },
    '/offer-letter/{userId}': {
      get: {
        tags: ['Offer Letter Module'],
        summary: 'Get Offer Letter metadata for a user',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Offer letter metadata' }
        }
      }
    },
    '/offer-letter/{userId}/download': {
      get: {
        tags: ['Offer Letter Module'],
        summary: 'Download Offer Letter PDF (Self-service for employee, unrestricted for Admin/HR)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Streams Offer Letter PDF file' }
        }
      }
    },
    '/offer-letter/{userId}/regenerate': {
      post: {
        tags: ['Offer Letter Module'],
        summary: 'Regenerate a new Offer Letter version without overwriting past versions (Super Admin / HR)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  designation: { type: 'string' },
                  department: { type: 'string' },
                  baseSalary: { type: 'number' },
                  joiningDate: { type: 'string', format: 'date' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'New Offer Letter version generated' }
        }
      }
    },
    '/notifications/my': {
      get: {
        tags: ['Notifications'],
        summary: 'Get notifications for logged-in user',
        responses: {
          200: { description: 'List of notifications' }
        }
      }
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Alias for /notifications/my',
        responses: {
          200: { description: 'List of notifications' }
        }
      }
    },
    '/notifications/{id}/read': {
      put: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Notification marked as read' }
        }
      }
    },
    '/screenshot/config': {
      get: {
        tags: ['Screenshot Monitoring'],
        summary: 'Get screenshot capture configuration settings',
        description: 'Retrieved by Desktop Agent to determine random screenshot capture intervals and active hours.',
        responses: {
          200: { description: 'Screenshot configuration object' }
        }
      },
      put: {
        tags: ['Screenshot Monitoring'],
        summary: 'Update screenshot capture configuration settings (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  intervalMinutes: { type: 'number', example: 10 },
                  activeHoursStart: { type: 'string', example: '09:00' },
                  activeHoursEnd: { type: 'string', example: '18:00' },
                  imageQuality: { type: 'number', example: 70 },
                  blurSensitivity: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Screenshot configuration updated successfully' },
          403: { description: 'Super Admin access required' }
        }
      }
    },
    '/screenshot/upload': {
      post: {
        tags: ['Screenshot Monitoring'],
        summary: 'Upload workstation desktop screenshot (Desktop Agent)',
        description: 'Receives multipart image upload and links screenshot to active attendance session.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image', 'attendanceId'],
                properties: {
                  image: { type: 'string', format: 'binary', description: 'JPG/PNG screenshot image file' },
                  attendanceId: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
                  capturedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Screenshot saved to storage and DB record created' },
          400: { description: 'Missing image file or attendanceId' }
        }
      }
    },
    '/screenshot/sync': {
      post: {
        tags: ['Screenshot Monitoring'],
        summary: 'Sync offline queued workstation screenshot (Desktop Agent)',
        description: 'Uploads screenshots taken during internet disconnection once connection is restored.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image', 'attendanceId'],
                properties: {
                  image: { type: 'string', format: 'binary' },
                  attendanceId: { type: 'string' },
                  capturedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Offline screenshot synced' },
          404: { description: 'Attendance session not found' }
        }
      }
    },
    '/screenshot/employee/{userId}': {
      get: {
        tags: ['Screenshot Monitoring'],
        summary: 'Get employee screenshot history list (Super Admin)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Target date (YYYY-MM-DD)' }
        ],
        responses: {
          200: { description: 'Employee screenshot records' }
        }
      }
    },
    '/screenshot/employee/{userId}/download-all': {
      get: {
        tags: ['Screenshot Monitoring'],
        summary: 'Download all employee screenshots as a ZIP file (Super Admin)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          200: { description: 'Streams Screenshots_<userId>_<date>.zip file' }
        }
      }
    },
    '/app-usage/sync': {
      post: {
        tags: ['App Usage Tracking'],
        summary: 'Sync workstation app usage 5-minute batch (Desktop Agent)',
        description: 'Flushes desktop application usage tracking metrics from agent to server.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['attendanceId', 'appUsage'],
                properties: {
                  userId: { type: 'string', description: 'Optional if Bearer JWT token is supplied' },
                  attendanceId: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
                  appUsage: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['appName', 'secondsActive'],
                      properties: {
                        appName: { type: 'string', example: 'Visual Studio Code' },
                        secondsActive: { type: 'number', example: 300 },
                        windowTitle: { type: 'string', example: 'server.js' }
                      }
                    }
                  },
                  isOfflineSync: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'App usage batch synced successfully' },
          400: { description: 'Missing required fields or empty appUsage array' },
          404: { description: 'User or attendance session not found' }
        }
      }
    },
    '/app-usage/config': {
      get: {
        tags: ['App Usage Tracking'],
        summary: 'Get application tracking configuration settings',
        description: 'Retrieved by Desktop Agent to determine polling and sync intervals.',
        responses: {
          200: { description: 'App usage configuration retrieved successfully' }
        }
      },
      put: {
        tags: ['App Usage Tracking'],
        summary: 'Update application tracking configuration settings (Super Admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pollIntervalSeconds: { type: 'number', example: 5 },
                  syncIntervalMinutes: { type: 'number', example: 5 },
                  captureWindowTitle: { type: 'boolean', example: false },
                  isEnabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'App usage config updated successfully' },
          403: { description: 'Super Admin access required' }
        }
      }
    },
    '/app-usage/employee/{userId}': {
      get: {
        tags: ['App Usage Tracking'],
        summary: 'Get employee app usage breakdown (Super Admin Only)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Target date (YYYY-MM-DD)' },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date filter' },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date filter' }
        ],
        responses: {
          200: { description: 'Employee app usage breakdown retrieved successfully' },
          403: { description: 'Super Admin access required' },
          404: { description: 'Employee not found' }
        }
      }
    },
    '/app-usage/employee/{userId}/export': {
      get: {
        tags: ['App Usage Tracking'],
        summary: 'Export employee app usage data as CSV or JSON (Super Admin Only)',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'json'], default: 'json' }, description: 'Export format (csv or json)' },
          { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date filter' },
          { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date filter' }
        ],
        responses: {
          200: { description: 'Streams CSV file or returns JSON export data' },
          403: { description: 'Super Admin access required' },
          404: { description: 'User not found' }
        }
      }
    },
    '/leads/create': {
      post: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Create a new prospective lead',
        description: 'Creates a Lead with status=NEW and logs initial LeadStatusHistory. Automatically performs phone duplicate check.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'source'],
                properties: {
                  name: { type: 'string', example: 'Mr. Hirak Patel' },
                  phone: { type: 'string', example: '9876543210' },
                  email: { type: 'string', example: 'hirak@patel.com' },
                  source: { type: 'string', enum: ['Referral', 'Website', 'WalkIn', 'SocialMedia', 'Other'], example: 'Referral' },
                  requirementNotes: { type: 'string', example: '3BHK bungalow interior design' },
                  assignedTo: { type: 'string', example: '64bd9f0296e625a5857e4e10', description: 'Assigned User ID (defaults to creator)' },
                  nextFollowUpDate: { type: 'string', format: 'date', example: '2026-08-05' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Lead created successfully' },
          400: { description: 'Missing required fields' }
        }
      }
    },
    '/leads': {
      get: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Get paginated & filtered list of leads (or pipeline view)',
        description: 'Supports search, filtering by status/assignedTo, and role-based scoping (PM sees only own assigned leads). Pass pipelineView=true for Kanban pipeline columns.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'] } },
          { name: 'assignedTo', in: 'query', schema: { type: 'string' }, description: 'Filter by assigned user ID (Admins only)' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search regex on name, phone, or email' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'pipelineView', in: 'query', schema: { type: 'boolean', default: false }, description: 'Return Kanban-grouped pipeline columns' }
        ],
        responses: {
          200: { description: 'Leads list or pipeline data retrieved' }
        }
      },
      post: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Create a new prospective lead (Alias)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'source'],
                properties: {
                  name: { type: 'string', example: 'Mr. Hirak Patel' },
                  phone: { type: 'string', example: '9876543210' },
                  email: { type: 'string', example: 'hirak@patel.com' },
                  source: { type: 'string', enum: ['Referral', 'Website', 'WalkIn', 'SocialMedia', 'Other'] },
                  requirementNotes: { type: 'string' },
                  assignedTo: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Lead created successfully' }
        }
      }
    },
    '/leads/followups/due': {
      get: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Get active leads with follow-up due on or before specified date',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Target date (defaults to today)' }
        ],
        responses: {
          200: { description: 'Due follow-up leads retrieved' }
        }
      }
    },
    '/leads/{id}': {
      get: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Get full lead details and calculated metrics',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Lead detail retrieved' },
          404: { description: 'Lead not found' }
        }
      },
      put: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Update lead general fields (excluding status)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  requirementNotes: { type: 'string' },
                  source: { type: 'string' },
                  assignedTo: { type: 'string', description: 'Restricted to Admins' },
                  nextFollowUpDate: { type: 'string', format: 'date' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Lead updated successfully' }
        }
      }
    },
    '/leads/{id}/update': {
      put: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Update lead general fields (Alias)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  requirementNotes: { type: 'string' },
                  assignedTo: { type: 'string' },
                  nextFollowUpDate: { type: 'string', format: 'date' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Lead updated successfully' }
        }
      }
    },
    '/leads/{id}/update-status': {
      put: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Update lead lifecycle status (Writes audit log)',
        description: 'Updates lead lifecycle status. Mandatory lostReason required if newStatus === LOST.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newStatus'],
                properties: {
                  newStatus: { type: 'string', enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'] },
                  lostReason: { type: 'string', example: 'Pricing exceeded client budget', description: 'Mandatory if newStatus is LOST' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Status updated and audit log written' },
          400: { description: 'Validation error (e.g. missing lostReason)' }
        }
      }
    },
    '/leads/{id}/log-interaction': {
      post: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Log interaction touchpoint for lead',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'notes'],
                properties: {
                  type: { type: 'string', enum: ['Call', 'Meeting', 'Email', 'Note'] },
                  notes: { type: 'string', example: 'Client requested updated quotation by Friday' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Interaction logged successfully' }
        }
      }
    },
    '/leads/{id}/interactions': {
      get: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Get chronological interaction history timeline for a lead',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Interactions list retrieved' }
        }
      }
    },
    '/leads/{id}/status-history': {
      get: {
        tags: ['CRM Module 1 - Lead Management'],
        summary: 'Get chronological status-change audit trail for a lead',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Status audit trail retrieved' }
        }
      }
    },
    '/leads/{id}/convert-to-client': {
      post: {
        tags: ['CRM Module 1 - Lead Management', 'CRM Module 2 - Client Master'],
        summary: 'Convert WON Lead to Client account & Primary OWNER ClientContact',
        description: 'Converts Lead to WON status, creates Client entity and primary ClientContact with OWNER permission level, issues temporary password, and links convertedToClientId.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Target Lead MongoDB _id' }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  primaryContactEmail: { type: 'string', example: 'hirak.contact@patel.com', description: 'Mandatory if Lead has no email captured' },
                  companyName: { type: 'string', example: 'Patel Group' },
                  billingAddress: { type: 'string', example: '101 Satellite Road, Ahmedabad' },
                  siteAddresses: { type: 'array', items: { type: 'string' }, example: ['Plot 45, SG Highway'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Lead converted successfully; Client + Primary OWNER Contact created with temp password' },
          400: { description: 'Lead already converted, status is LOST, or lead email is missing without primaryContactEmail' },
          403: { description: 'Access denied' },
          404: { description: 'Lead not found' }
        }
      }
    },
    '/clients/create': {
      post: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Directly create Client account & Primary OWNER Contact (no prior lead)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'primaryContactName', 'primaryContactEmail'],
                properties: {
                  name: { type: 'string', example: 'Shah Enterprises' },
                  companyName: { type: 'string', example: 'Shah Group' },
                  phone: { type: 'string', example: '9876543210' },
                  email: { type: 'string', example: 'info@shah.com' },
                  billingAddress: { type: 'string', example: '202 Corporate Park, SG Highway' },
                  siteAddresses: { type: 'array', items: { type: 'string' }, example: ['Site A, Bopal', 'Site B, Satellite'] },
                  primaryContactName: { type: 'string', example: 'Anand Shah' },
                  primaryContactEmail: { type: 'string', example: 'anand@shah.com' },
                  primaryContactPhone: { type: 'string', example: '9876543210' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Client & Primary OWNER Contact created successfully' },
          400: { description: 'Validation error or duplicate contact email' }
        }
      }
    },
    '/clients': {
      get: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Get paginated and searchable list of Client accounts (Internal Team)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term for name, company, phone, or email' },
          { name: 'isActive', in: 'query', schema: { type: 'boolean', default: true } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: { description: 'Paginated list of clients with primary contact & active project count' }
        }
      },
      post: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Directly create Client account alias for /clients/create',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'primaryContactName', 'primaryContactEmail'],
                properties: {
                  name: { type: 'string', example: 'Shah Enterprises' },
                  phone: { type: 'string', example: '9876543210' },
                  primaryContactName: { type: 'string', example: 'Anand Shah' },
                  primaryContactEmail: { type: 'string', example: 'anand@shah.com' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Client created successfully' }
        }
      }
    },
    '/clients/{id}': {
      get: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Get Client details by ID with associated ClientContacts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Client account details retrieved with contacts list' },
          404: { description: 'Client not found' }
        }
      },
      put: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Update Client account-level fields',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  companyName: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  billingAddress: { type: 'string' },
                  siteAddresses: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Client account updated successfully' },
          404: { description: 'Client not found' }
        }
      }
    },
    '/clients/{id}/deactivate': {
      put: {
        tags: ['CRM Module 2 - Client Master'],
        summary: 'Soft-deactivate Client account (Active project safeguard)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'force', in: 'query', schema: { type: 'boolean' }, description: 'Bypass active project block' }
        ],
        responses: {
          200: { description: 'Client account deactivated successfully' },
          400: { description: 'Active projects exist on account' }
        }
      }
    },
    '/clients/{clientId}/contacts/add': {
      post: {
        tags: ['CRM Module 2 - Client Contacts'],
        summary: 'Add additional ClientContact to a Client account',
        description: 'Callable by Internal PM/Admin OR Client Contact with OWNER permission level.',
        security: [{ bearerAuth: [] }, { clientBearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string', example: 'Vikram Site Engineer' },
                  email: { type: 'string', example: 'vikram.site@enterprises.com' },
                  phone: { type: 'string', example: '9876500001' },
                  permissionLevel: { type: 'string', enum: ['OWNER', 'MEMBER', 'VIEW_ONLY'], default: 'MEMBER' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Additional ClientContact added with temporary password' },
          400: { description: 'Duplicate email or validation error' },
          403: { description: 'Access denied (Requires Admin or OWNER contact level)' }
        }
      }
    },
    '/clients/{clientId}/contacts': {
      get: {
        tags: ['CRM Module 2 - Client Contacts'],
        summary: 'List all ClientContacts for a Client account',
        security: [{ bearerAuth: [] }, { clientBearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of client contacts' },
          403: { description: 'Access denied (Can only view contacts for own client account)' }
        }
      }
    },
    '/clients/{clientId}/contacts/{contactId}/permission': {
      put: {
        tags: ['CRM Module 2 - Client Contacts'],
        summary: 'Update permission level of a ClientContact',
        description: 'Callable by Internal PM/Admin OR Client Contact with OWNER permission. Enforces minimum 1 active OWNER constraint.',
        security: [{ bearerAuth: [] }, { clientBearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'contactId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPermissionLevel'],
                properties: {
                  newPermissionLevel: { type: 'string', enum: ['OWNER', 'MEMBER', 'VIEW_ONLY'], example: 'MEMBER' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Permission level updated' },
          400: { description: 'Cannot demote the last remaining active OWNER' }
        }
      }
    },
    '/clients/{clientId}/contacts/{contactId}/deactivate': {
      put: {
        tags: ['CRM Module 2 - Client Contacts'],
        summary: 'Soft-deactivate a ClientContact account',
        description: 'Callable by Internal PM/Admin OR Client Contact with OWNER permission. Safeguard blocks deactivating the last active OWNER.',
        security: [{ bearerAuth: [] }, { clientBearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'contactId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Contact deactivated successfully' },
          400: { description: 'Cannot deactivate the last active OWNER contact' }
        }
      }
    },
    '/clients/{clientId}/contacts/{contactId}/reset-temp-password': {
      post: {
        tags: ['CRM Module 2 - Client Contacts'],
        summary: 'Regenerate temporary password for ClientContact (Admin Helper)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'contactId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Temporary password regenerated and mustChangePassword set to true' }
        }
      }
    },
    '/client-auth/login': {
      post: {
        tags: ['CRM Module 2 - Client Portal Auth'],
        summary: 'Client Portal Login',
        description: 'Authenticates ClientContact credentials and returns a Client-scoped JWT token payload.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'shah.owner@enterprises.com' },
                  password: { type: 'string', example: 'TempPass@123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful, returns Client Portal JWT and mustChangePassword flag' },
          401: { description: 'Invalid email or password' },
          403: { description: 'Account or parent Client is deactivated' }
        }
      }
    },
    '/client-auth/change-password': {
      post: {
        tags: ['CRM Module 2 - Client Portal Auth'],
        summary: 'Change password for logged-in ClientContact',
        description: 'Validates current password and updates password, flipping mustChangePassword to false.',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', example: 'TempPass@123' },
                  newPassword: { type: 'string', example: 'NewPass@1234' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password updated successfully and mustChangePassword set to false' },
          400: { description: 'Incorrect current password or complexity failure' }
        }
      }
    },
    '/client-auth/forgot-password': {
      post: {
        tags: ['CRM Module 2 - Client Portal Auth'],
        summary: 'Request password reset token for ClientContact',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'shah.owner@enterprises.com' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password reset token generated' }
        }
      }
    },
    '/client-auth/reset-password': {
      post: {
        tags: ['CRM Module 2 - Client Portal Auth'],
        summary: 'Reset password using reset token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['resetToken', 'newPassword'],
                properties: {
                  resetToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
                  newPassword: { type: 'string', example: 'ResetPass@999' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Password reset completed successfully' },
          400: { description: 'Invalid or expired token or complexity failure' }
        }
      }
    },
    '/client-auth/me': {
      get: {
        tags: ['CRM Module 2 - Client Portal Auth'],
        summary: 'Get current logged-in ClientContact profile & parent Client details',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Client contact profile and parent account info' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/client-project-links/create': {
      post: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Link a Project to a Client account (Internal PM / Admin)',
        description: 'Creates an active link between a Client and Project. Validates active status of Client and prevents duplicate active links.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['clientId', 'projectId'],
                properties: {
                  clientId: { type: 'string', example: '64bd9f0296e625a5857e4f10' },
                  projectId: { type: 'string', example: '64bd9f0296e625a5857e4f80' },
                  visibleToClient: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Project successfully linked to Client account' },
          400: { description: 'Active link already exists or target Client is deactivated' },
          404: { description: 'Client or Project not found' }
        }
      }
    },
    '/client-project-links/by-client/{clientId}': {
      get: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Get active project links for a specific Client account',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of active project links for the specified client' }
        }
      }
    },
    '/client-project-links/by-project/{projectId}': {
      get: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Get active client links for a specific Project',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of active client links for the specified project' }
        }
      }
    },
    '/client-project-links/{id}/visibility': {
      put: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Toggle project visibility to client portal',
        description: 'Toggles visibleToClient boolean without unlinking the project.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ClientProjectLink MongoDB _id' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['visibleToClient'],
                properties: {
                  visibleToClient: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Visibility updated successfully' },
          404: { description: 'Active link not found' }
        }
      }
    },
    '/client-project-links/{id}': {
      delete: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Soft-delete (unlink) a project from a client (Admin / Super Admin ONLY)',
        description: 'Soft-deletes the link (isActive: false, unlinkedBy, unlinkedAt set). Restricted to Admin and Super Admin roles.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'ClientProjectLink MongoDB _id' }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: { type: 'string', example: 'Ownership transferred to another party' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Project unlinked from Client account successfully' },
          403: { description: 'Access denied (Admin / Super Admin role required)' },
          404: { description: 'Active link not found' }
        }
      }
    },
    '/client/projects/my': {
      get: {
        tags: ['CRM Module 3 - Client-Project Linkage'],
        summary: 'Get visible linked projects for authenticated ClientContact',
        description: 'Returns all active linked projects where visibleToClient === true for the calling ClientContact\'s own clientId.',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'List of visible linked projects for the calling client account' },
          401: { description: 'Unauthorized Client Portal token' }
        }
      }
    },
    '/client/dashboard': {
      get: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Aggregated Dashboard View for Client Portal (Web & Mobile)',
        description: 'Returns active and past/completed visible linked projects in a single optimized payload for landing screen cards.',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Dashboard aggregated view retrieved successfully' },
          401: { description: 'Unauthorized Client Portal token' }
        }
      }
    },
    '/client/projects/{projectId}': {
      get: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Get full project detail for client (verifies linkage security)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project details retrieved successfully' },
          403: { description: 'Access denied (project is not linked or visible to your Client account)' },
          404: { description: 'Project not found' }
        }
      }
    },
    '/client/projects/{projectId}/milestones': {
      get: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Get project milestones for client',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Milestones list retrieved successfully' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client/projects/{projectId}/timeline': {
      get: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Get formatted project timeline events for client',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Formatted timeline retrieved successfully' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client-auth/profile': {
      put: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Update logged-in ClientContact profile (name & phone only)',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Anand Shah Updated' },
                  phone: { type: 'string', example: '9876543211' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Profile updated successfully' },
          400: { description: 'No editable fields supplied' }
        }
      }
    },
    '/client/session/log-login': {
      post: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Log Client Portal session login (WEB, ANDROID, IOS)',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['platform'],
                properties: {
                  platform: { type: 'string', enum: ['WEB', 'ANDROID', 'IOS'], example: 'WEB' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Session logged successfully' }
        }
      }
    },
    '/client/session/heartbeat': {
      post: {
        tags: ['CRM Module 4 - Client Portal Core'],
        summary: 'Update Client Portal session active timestamp (Heartbeat)',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string', example: '64bd9f0296e625a5857e4f90' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Heartbeat timestamp updated successfully' }
        }
      }
    },
    '/client/projects/{projectId}/drawings': {
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'List project drawings for client portal (Grouped by pendingApproval, approved, changesRequested)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawings retrieved successfully' },
          403: { description: 'Access denied - project not linked or visible' }
        }
      }
    },
    '/client/drawings/{drawingId}': {
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Get drawing details and version history',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawing details retrieved successfully' },
          403: { description: 'Access denied' },
          404: { description: 'Drawing not found' }
        }
      }
    },
    '/client/drawings/{drawingId}/versions': {
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Get all versions of a drawing',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawing versions retrieved' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client/drawings/{drawingId}/compare': {
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Compare two drawing versions side-by-side',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionA', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'versionB', in: 'query', schema: { type: 'integer', example: 2 } }
        ],
        responses: {
          200: { description: 'Version comparison payload retrieved' }
        }
      }
    },
    '/client/drawings/{drawingId}/approve': {
      post: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Client approves drawing (OWNER / MEMBER permission required)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  comments: { type: 'string', example: 'Looks great, approved for construction' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Drawing approved successfully' },
          403: { description: 'Access denied (VIEW_ONLY contact blocked)' },
          409: { description: 'Conflict - Already approved by another contact' }
        }
      }
    },
    '/client/drawings/{drawingId}/request-changes': {
      post: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Client requests changes on drawing (OWNER / MEMBER permission required, mandatory comments)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['comments'],
                properties: {
                  comments: { type: 'string', example: 'Please adjust column C3 axis by 150mm towards west wall.' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Changes requested successfully' },
          400: { description: 'Bad Request - missing comments or approved drawing locked' },
          403: { description: 'Access denied (VIEW_ONLY contact blocked)' }
        }
      }
    },
    '/client/drawings/{drawingId}/comments': {
      post: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Post drawing annotation or comment (Draft or Shared)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['commentText'],
                properties: {
                  commentText: { type: 'string', example: 'Verify beam joinery clearance' },
                  annotationCoords: { type: 'object', example: { x: 100, y: 250, width: 40, height: 40 } },
                  isDraft: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Comment created successfully' }
        }
      },
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow'],
        summary: 'Get drawing comments (Shared comments + calling contact own draft notes)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Comments retrieved successfully' }
        }
      }
    },
    '/drawings/{drawingId}/client-approval-log': {
      get: {
        tags: ['CRM Module 5 - Drawing Approval Workflow (Internal)'],
        summary: 'Internal team view: Full client approval audit trail for a drawing',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Client approval log retrieved' }
        }
      }
    },
    '/client/projects/{projectId}/documents': {
      get: {
        tags: ['CRM Module 6 - Client Document Access'],
        summary: 'List project documents (visibleToClient: true) grouped by category/folder',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'folder', in: 'query', schema: { type: 'string', example: 'Contracts' } },
          { name: 'search', in: 'query', schema: { type: 'string', example: 'Agreement' } }
        ],
        responses: {
          200: { description: 'Documents retrieved successfully' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client/documents/{documentId}/preview': {
      get: {
        tags: ['CRM Module 6 - Client Document Access'],
        summary: 'Preview document with dual-cascade security check & VIEW log',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Preview data retrieved' },
          403: { description: 'Access denied' },
          404: { description: 'Document not found' }
        }
      }
    },
    '/client/documents/{documentId}/download': {
      get: {
        tags: ['CRM Module 6 - Client Document Access'],
        summary: 'Download document with dual-cascade security check & DOWNLOAD log',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Document download stream ready' },
          403: { description: 'Access denied' },
          410: { description: 'Document no longer available (soft-deleted)' }
        }
      }
    },
    '/documents/{documentId}/client-access-log': {
      get: {
        tags: ['CRM Module 6 - Client Document Access (Internal)'],
        summary: 'Internal team view: Document view and download access logs',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Document access log retrieved' }
        }
      }
    },
    '/documents/client-engagement/{clientId}': {
      get: {
        tags: ['CRM Module 6 - Client Document Access (Internal)'],
        summary: 'Internal team view: Client document engagement summary (Engaged vs Unopened shared documents)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Engagement summary retrieved' }
        }
      }
    },
    '/drawings/upload': {
      post: {
        tags: ['CRM Module 5 - Internal Drawing Upload (Designer / Architect)'],
        summary: 'Upload new drawing file (PDF, PNG, JPG, DWG) to Cloudinary & save DB record',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'projectId', 'title', 'category'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Drawing File (PDF, PNG, JPG, DWG)' },
                  projectId: { type: 'string', example: '66b1c2f304918e24ab567890' },
                  title: { type: 'string', example: 'Ground Floor Working Layout' },
                  category: { type: 'string', enum: ['Concept', 'Working', 'Process DWG', 'GFC', 'Site', 'Interior'], example: 'Working' },
                  drawingNumber: { type: 'string', example: 'DWG-001' },
                  notes: { type: 'string', example: 'Initial architectural working drawing upload' },
                  visibleToClient: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Drawing uploaded successfully to Cloudinary' },
          400: { description: 'Validation error' },
          500: { description: 'Upload error' }
        }
      }
    },
    '/drawings/{drawingId}/upload-version': {
      post: {
        tags: ['CRM Module 5 - Internal Drawing Upload (Designer / Architect)'],
        summary: 'Upload new revision version (V2, V3...) of an existing drawing to Cloudinary',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Revised Drawing File (PDF, PNG, JPG, DWG)' },
                  notes: { type: 'string', example: 'Revised column layout per client review' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'New drawing version uploaded successfully' },
          404: { description: 'Drawing not found' }
        }
      }
    },
    '/drawings/{drawingId}/client-approval-log': {
      get: {
        tags: ['CRM Module 5 - Internal Drawing Upload (Designer / Architect)'],
        summary: 'Get full client approval history for a drawing',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Client approval log retrieved' }
        }
      }
    },
    '/client/chat/unread-counts': {
      get: {
        tags: ['CRM Module 7 - Client Chat System'],
        summary: 'Get unread message counts per linked project for calling contact',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Unread counts retrieved successfully' }
        }
      }
    },
    '/client/chat/{projectId}': {
      get: {
        tags: ['CRM Module 7 - Client Chat System'],
        summary: 'Get project chat history (interleaved chronological messages)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: {
          200: { description: 'Chat history retrieved successfully' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client/chat/{projectId}/message': {
      post: {
        tags: ['CRM Module 7 - Client Chat System'],
        summary: 'Send chat message (OWNER / MEMBER permission required, Socket.io broadcast)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messageText'],
                properties: {
                  messageText: { type: 'string', example: 'Hello team, verified structural pillar offsets.' },
                  mentionedIds: { type: 'array', items: { type: 'string' } },
                  replyToMessageId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Message sent successfully' },
          403: { description: 'Access denied (VIEW_ONLY contact blocked)' }
        }
      }
    },
    '/client/chat/{projectId}/sync': {
      post: {
        tags: ['CRM Module 7 - Client Chat System'],
        summary: 'Batch sync messages composed while offline',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['messageText'],
                      properties: {
                        messageText: { type: 'string' },
                        localComposedAt: { type: 'string', format: 'date-time' },
                        replyToMessageId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Offline messages synced successfully' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/client/chat/{projectId}/mark-read': {
      put: {
        tags: ['CRM Module 7 - Client Chat System'],
        summary: 'Mark project chat as read for calling contact',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Chat marked as read' },
          403: { description: 'Access denied' }
        }
      }
    },
    '/chat/{projectId}': {
      get: {
        tags: ['CRM Module 7 - Client Chat System (Internal)'],
        summary: 'Internal team view: Unified project chat history',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } }
        ],
        responses: {
          200: { description: 'Project chat history retrieved' }
        }
      }
    },
    '/chat/{projectId}/message': {
      post: {
        tags: ['CRM Module 7 - Client Chat System (Internal)'],
        summary: 'Internal team post message into project chat workspace',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messageText'],
                properties: {
                  messageText: { type: 'string', example: 'Site inspection scheduled for tomorrow at 10 AM.' },
                  mentionedIds: { type: 'array', items: { type: 'string' } },
                  replyToMessageId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Message sent successfully' }
        }
      }
    },
    /* ============================================================
       CRM MODULE 8 — CLIENT TICKETING (QUERY / SUPPORT)
       ============================================================ */
    '/client/tickets/create': {
      post: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'Raise a new support ticket (OWNER/MEMBER only)',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'subject', 'description'],
                properties: {
                  projectId: { type: 'string', example: '64bd9f0296e625a5857e4e10' },
                  subject: { type: 'string', example: 'Drawing dimension discrepancy' },
                  description: { type: 'string', example: 'Column grid 3 dimensions on page 2 do not match site measurements.' },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High'], example: 'High' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Ticket created successfully' },
          403: { description: 'Access denied or VIEW_ONLY contact blocked' }
        }
      }
    },
    '/client/tickets/my': {
      get: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'List all tickets for client account (Shared visibility across contacts)',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Client tickets retrieved' }
        }
      }
    },
    '/client/tickets/{id}': {
      get: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'Get ticket detail with threaded response history',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Ticket detail and thread retrieved' },
          403: { description: 'Access denied cross-client boundary' }
        }
      }
    },
    '/client/tickets/{id}/respond': {
      post: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'Add client response to ticket thread (OWNER/MEMBER only)',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'Attaching photo of column layout.' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Response added to ticket thread' }
        }
      }
    },
    '/client/tickets/{id}/reopen': {
      post: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'Reopen CLOSED ticket within 14-day grace period',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', example: 'Issue re-appeared after site inspection.' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Ticket reopened' },
          400: { description: 'Grace period expired or invalid status' }
        }
      }
    },
    '/client/tickets/{id}/cancel': {
      post: {
        tags: ['CRM Module 8 - Client Ticketing (Portal)'],
        summary: 'Cancel OPEN or IN_PROGRESS ticket',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Ticket cancelled' }
        }
      }
    },
    '/tickets/all': {
      get: {
        tags: ['CRM Module 8 - Client Ticketing (Internal)'],
        summary: 'Internal team: List all client tickets across projects',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'assignedTo', in: 'query', schema: { type: 'string' } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'All tickets retrieved' }
        }
      }
    },
    '/tickets/{id}/respond': {
      post: {
        tags: ['CRM Module 8 - Client Ticketing (Internal)'],
        summary: 'Internal staff response to client ticket',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'Our design team has updated drawing Rev-3 to resolve the issue.' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Staff response added' }
        }
      }
    },
    '/tickets/{id}/status': {
      put: {
        tags: ['CRM Module 8 - Client Ticketing (Internal)'],
        summary: 'Update ticket lifecycle status (IN_PROGRESS, RESOLVED, CLOSED)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newStatus'],
                properties: {
                  newStatus: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Ticket status updated' }
        }
      }
    },
    '/tickets/{id}/reassign': {
      put: {
        tags: ['CRM Module 8 - Client Ticketing (Internal)'],
        summary: 'Reassign ticket to another employee with audit logging',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newAssignedTo'],
                properties: {
                  newAssignedTo: { type: 'string', example: '64bd9f0296e625a5857e4e10' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Ticket reassigned successfully' }
        }
      }
    },

    /* ============================================================
       CRM MODULE 9 — CLIENT FEEDBACK & SATISFACTION
       ============================================================ */
    '/feedback-category/active': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Master)'],
        summary: 'Get active feedback categories for rendering forms',
        responses: {
          200: { description: 'Active feedback categories retrieved' }
        }
      }
    },
    '/feedback-category/create': {
      post: {
        tags: ['CRM Module 9 - Client Feedback (Master)'],
        summary: 'Admin: Create new feedback rating category',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Value for Money' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Category created' }
        }
      }
    },
    '/feedback-category/{id}/deactivate': {
      put: {
        tags: ['CRM Module 9 - Client Feedback (Master)'],
        summary: 'Admin: Toggle feedback category active status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isActive: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Category state updated' }
        }
      }
    },
    '/client/feedback/pending-prompts': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Portal)'],
        summary: 'Get pending feedback prompts for calling contact',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Pending prompts list retrieved' }
        }
      }
    },
    '/client/feedback/{promptId}/submit': {
      post: {
        tags: ['CRM Module 9 - Client Feedback (Portal)'],
        summary: 'Submit feedback for a prompt (OWNER, MEMBER, VIEW_ONLY permitted)',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'promptId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['overallRating'],
                properties: {
                  overallRating: { type: 'number', minimum: 1, maximum: 5, example: 5 },
                  categoryRatings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        categoryId: { type: 'string' },
                        rating: { type: 'number', minimum: 1, maximum: 5 }
                      }
                    }
                  },
                  comments: { type: 'string', example: 'Excellent architectural design and timely execution.' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Feedback submitted successfully' }
        }
      }
    },
    '/client/feedback/{promptId}/skip': {
      post: {
        tags: ['CRM Module 9 - Client Feedback (Portal)'],
        summary: 'Skip pending feedback prompt permanently for event',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'promptId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Prompt skipped' }
        }
      }
    },
    '/client/feedback/my': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Portal)'],
        summary: 'Get calling contact personal feedback history',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Personal feedback history retrieved' }
        }
      }
    },
    '/client/feedback/project/{projectId}': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Portal)'],
        summary: 'Get all feedback submitted for project under client account',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Project client feedback retrieved' }
        }
      }
    },
    '/feedback/all': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Internal)'],
        summary: 'Internal team: List all feedback submissions with filters',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: { type: 'string' } },
          { name: 'minRating', in: 'query', schema: { type: 'number' } },
          { name: 'maxRating', in: 'query', schema: { type: 'number' } }
        ],
        responses: {
          200: { description: 'All feedback submissions retrieved' }
        }
      }
    },
    '/feedback/aggregate-summary': {
      get: {
        tags: ['CRM Module 9 - Client Feedback (Internal)'],
        summary: 'Internal team: Compute satisfaction metrics & category averages',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Aggregate summary computed' }
        }
      }
    },

    /* ============================================================
       CRM MODULE 10 — CLIENT NOTIFICATIONS (FINAL CRM MODULE)
       ============================================================ */
    '/client/notifications/my': {
      get: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Get paginated notifications for calling contact',
        security: [{ clientBearerAuth: [] }],
        parameters: [
          { name: 'isRead', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          200: { description: 'Notifications list retrieved' }
        }
      }
    },
    '/client/notifications/unread-count': {
      get: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Get unread notification count for bell icon badge',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Unread count retrieved' }
        }
      }
    },
    '/client/notifications/{id}/read': {
      put: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Mark single notification as read',
        security: [{ clientBearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Notification marked read' }
        }
      }
    },
    '/client/notifications/mark-all-read': {
      put: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Bulk mark all notifications as read',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'All notifications marked read' }
        }
      }
    },
    '/client/notifications/preferences': {
      get: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Get notification delivery preferences',
        security: [{ clientBearerAuth: [] }],
        responses: {
          200: { description: 'Preferences retrieved' }
        }
      },
      put: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Update notification delivery preferences',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pushEnabled: { type: 'boolean', example: true },
                  emailEnabled: { type: 'boolean', example: true },
                  whatsappEnabled: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Preferences updated successfully' }
        }
      }
    },
    '/client/notifications/register-device': {
      post: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Register push device token for mobile client',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['platform', 'deviceToken'],
                properties: {
                  platform: { type: 'string', enum: ['ANDROID', 'IOS'], example: 'ANDROID' },
                  deviceToken: { type: 'string', example: 'fcm_token_123456' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Device token registered' }
        }
      }
    },
    '/client/notifications/unregister-device': {
      delete: {
        tags: ['CRM Module 10 - Client Notifications (Portal)'],
        summary: 'Unregister device token on logout',
        security: [{ clientBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceToken'],
                properties: {
                  deviceToken: { type: 'string', example: 'fcm_token_123456' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Device token unregistered' }
        }
      }
    },
    '/notifications/{notificationId}/delivery-log': {
      get: {
        tags: ['CRM Module 10 - Client Notifications (Internal)'],
        summary: 'Internal team: Audit delivery log for notification',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'notificationId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Delivery audit logs retrieved' }
        }
      }
    },
    '/notifications/whatsapp-config': {
      post: {
        tags: ['CRM Module 10 - Client Notifications (Internal)'],
        summary: 'Super Admin: Configure WhatsApp Business API credentials',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['apiKey'],
                properties: {
                  apiKey: { type: 'string', example: 'WA_API_KEY_SECRET' },
                  businessAccountId: { type: 'string', example: 'WA_BUS_ACC_123' },
                  phoneNumberId: { type: 'string', example: 'WA_PHONE_ID_456' },
                  isActive: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'WhatsApp configured' }
        }
      }
    },
    '/notifications/whatsapp-config/status': {
      get: {
        tags: ['CRM Module 10 - Client Notifications (Internal)'],
        summary: 'Get WhatsApp integration configuration status',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'WhatsApp status retrieved' }
        }
      }
    },
    '/projects/create': {
      post: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Create a new project (PM, Admin, Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectName'],
                properties: {
                  projectName: { type: 'string', example: 'Horizon Residency Villa' },
                  clientInformation: { type: 'string', example: 'Patel Family' },
                  address: { type: 'string', example: 'Plot 42, Green Park, Ahmedabad' },
                  budget: { type: 'number', example: 7500000 },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High'], example: 'High' },
                  projectCategoryId: { type: 'string' },
                  startDate: { type: 'string', format: 'date-time' },
                  estimatedCompletion: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Project created successfully' }
        }
      }
    },
    '/projects': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get list of projects (Paginated, Filterable, Role-Scoped)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: { description: 'Projects list retrieved successfully' }
        }
      }
    },
    '/projects/{id}': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get project detail by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project details retrieved' },
          403: { description: 'Access denied - not assigned to project' },
          404: { description: 'Project not found' }
        }
      },
      put: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Update project general details (PM, Admin, Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectName: { type: 'string' },
                  clientInformation: { type: 'string' },
                  address: { type: 'string' },
                  budget: { type: 'number' },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                  projectCategoryId: { type: 'string' },
                  startDate: { type: 'string', format: 'date-time' },
                  estimatedCompletion: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Project updated successfully' }
        }
      }
    },
    '/projects/{id}/update-status': {
      put: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Update project status and record audit log',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newStatus'],
                properties: {
                  newStatus: { type: 'string', enum: ['New', 'Planning', 'In Progress', 'On Hold', 'Approval Pending', 'Site Work', 'Completed', 'Archived'] },
                  notes: { type: 'string', example: 'Transitioning to Site Work stage' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Project status updated successfully' }
        }
      }
    },
    '/projects/{id}/status-history': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get project status change history log',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Status history retrieved' }
        }
      }
    },
    '/projects/{id}/milestones/add': {
      post: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Add milestone to project',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'targetDate'],
                properties: {
                  name: { type: 'string', example: 'Foundation Inspection' },
                  targetDate: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Milestone added successfully' }
        }
      }
    },
    '/projects/{id}/milestones/{milestoneId}/complete': {
      put: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Complete a milestone (triggers auto-progress calculation)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'milestoneId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Milestone marked complete' }
        }
      }
    },
    '/projects/{id}/progress': {
      put: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'PM manual progress override',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['progressPercentage'],
                properties: {
                  progressPercentage: { type: 'number', example: 75 },
                  isManualOverride: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Progress updated' }
        }
      }
    },
    '/projects/{id}/team/assign': {
      post: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Assign employee to project team',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'projectRole'],
                properties: {
                  userId: { type: 'string' },
                  projectRole: { type: 'string', example: 'Lead Architectural Designer' },
                  departmentId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Team member assigned successfully' }
        }
      }
    },
    '/projects/{id}/responsibility-matrix/add': {
      post: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Add responsibility matrix entry (RACI)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['area'],
                properties: {
                  area: { type: 'string', example: 'Structural Design & Layout' },
                  responsible: { type: 'string' },
                  accountable: { type: 'string' },
                  consulted: { type: 'array', items: { type: 'string' } },
                  informed: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Responsibility matrix entry added' }
        }
      }
    },
    '/projects/{id}/progress-breakdown': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get progress breakdown (Overall + placeholder module breakdowns)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Progress breakdown retrieved' }
        }
      }
    },
    '/project-category/create': {
      post: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Create dynamic project category (Admin / Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Residential Bungalow' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Category created' }
        }
      }
    },
    '/project-category/active': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get active project categories list',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Active project categories list' }
        }
      }
    },
    '/department/active': {
      get: {
        tags: ['ERP Module 1 - Project Management'],
        summary: 'Get active internal departments list',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Active departments list' }
        }
      }
    },
    '/tasks/create': {
      post: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Create a new task (PM, Admin, Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'taskName', 'assignedEmployee'],
                properties: {
                  projectId: { type: 'string', example: '66b1c2f304918e24ab567890' },
                  taskName: { type: 'string', example: 'Foundation Structural Load Analysis' },
                  description: { type: 'string', example: 'Perform load bearing analysis for columns C1-C8' },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High'], example: 'High' },
                  departmentId: { type: 'string' },
                  assignedEmployee: { type: 'string', example: '66b1c2f304918e24ab567899' },
                  estimatedTime: { type: 'number', example: 12 },
                  deadline: { type: 'string', format: 'date-time' },
                  dependsOn: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Task created successfully' }
        }
      }
    },
    '/tasks': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get list of tasks (Paginated, Filterable, Role-Scoped)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'assignedEmployee', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: { description: 'Tasks list retrieved successfully' }
        }
      }
    },
    '/tasks/{id}': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get task detail by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task detail retrieved' },
          404: { description: 'Task not found' }
        }
      },
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Update task general details (PM, Admin, Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  taskName: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                  departmentId: { type: 'string' },
                  estimatedTime: { type: 'number' },
                  deadline: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Task updated successfully' }
        }
      }
    },
    '/tasks/{id}/accept': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Assigned employee accepts task (Pending -> Accepted)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task accepted successfully' }
        }
      }
    },
    '/tasks/{id}/reject': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Assigned employee rejects task (Pending -> Rejected)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', example: 'Conflict with ongoing structural review' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Task rejected successfully' }
        }
      }
    },
    '/tasks/{id}/start': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Start task work (stamps actualStartTime, hard-blocked by incomplete dependencies)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task started successfully' },
          400: { description: 'Blocked: Dependent task not completed' }
        }
      }
    },
    '/tasks/{id}/submit-for-review': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Submit task for review (In Progress -> Review)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task submitted for review' }
        }
      }
    },
    '/tasks/{id}/approve': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Reviewer approves task (Review -> Approved)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task approved by reviewer' }
        }
      }
    },
    '/tasks/{id}/complete': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Complete task (stamps completionTime, calculates totalWorkingTime, queries HRM App-Usage for idle/productivity)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Task completed successfully with HRM time analysis metrics' }
        }
      }
    },
    '/tasks/{id}/status-history': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get task workflow status transition audit history',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Status history log retrieved' }
        }
      }
    },
    '/tasks/{id}/reassign': {
      put: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Reassign task to another employee (PM, Admin, Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newAssignedEmployee'],
                properties: {
                  newAssignedEmployee: { type: 'string', example: '66b1c2f304918e24ab567888' },
                  reason: { type: 'string', example: 'Workload rebalancing' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Task reassigned successfully' }
        }
      }
    },
    '/tasks/{id}/checklist/add': {
      post: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Add checklist sub-item to task',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', example: 'Survey data reviewed' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Checklist item added' }
        }
      }
    },
    '/tasks/{id}/comments/add': {
      post: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Post discussion comment on task',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['commentText'],
                properties: {
                  commentText: { type: 'string', example: 'Column C4 calculation verified against revised setbacks.' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Comment added' }
        }
      }
    },
    '/tasks/{id}/comments': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get task discussion comments',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Comments list retrieved' }
        }
      }
    },
    '/tasks/{id}/time-analysis': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get task time analysis (Live/Final HRM App-Usage Correlation)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Time analysis metrics retrieved' }
        }
      }
    },
    '/tasks/overdue': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get list of overdue tasks',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'assignedEmployee', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Overdue tasks list retrieved' }
        }
      }
    },
    '/projects/{projectId}/tasks/breakdown': {
      get: {
        tags: ['ERP Module 2 - Task Management System'],
        summary: 'Get project tasks breakdown statistics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project tasks breakdown retrieved' }
        }
      }
    },
    '/drawings/create': {
      post: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Create parent drawing record',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'drawingName', 'categoryId'],
                properties: {
                  projectId: { type: 'string', example: '66b1c2f304918e24ab567890' },
                  drawingName: { type: 'string', example: 'Master Structural Elevation Sketch' },
                  categoryId: { type: 'string', example: '66b1c2f304918e24ab567888' },
                  drawingNumber: { type: 'string', example: 'DWG-SK-001' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Parent drawing record created successfully' }
        }
      }
    },
    '/drawings/{drawingId}/versions/upload': {
      post: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Upload new drawing version ("Never Permanently Replaced" Rule)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'drawingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filePath'],
                properties: {
                  filePath: { type: 'string', example: '/uploads/drawings/skyline_v2.dwg' },
                  fileType: { type: 'string', example: 'DWG' },
                  changeLog: { type: 'string', example: 'Revised column setbacks per client feedback' },
                  thumbnailUrl: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Drawing version uploaded successfully' },
          400: { description: 'Blocked if drawing is GFC locked' }
        }
      }
    },
    '/drawings': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get paginated list of drawings',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          200: { description: 'Drawings list retrieved' }
        }
      }
    },
    '/drawings/{id}': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get drawing details + full version history list',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawing details and version history retrieved' }
        }
      }
    },
    '/drawings/{id}/versions': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get all historical versions for a drawing',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawing versions list retrieved' }
        }
      }
    },
    '/drawing-versions/{versionId}/pm-review': {
      put: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'PM review gate (DESIGNER_UPLOADED -> PM_APPROVED or PM_REJECTED)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['decision'],
                properties: {
                  decision: { type: 'string', enum: ['APPROVE', 'REJECT'] },
                  comments: { type: 'string', example: 'Column C2 load specs verified' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'PM review completed' }
        }
      }
    },
    '/drawing-versions/{versionId}/admin-review': {
      put: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Admin review gate (PM_APPROVED -> PENDING_CLIENT_APPROVAL, visibleToClient: true — CRM 5 Handoff)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['decision'],
                properties: {
                  decision: { type: 'string', enum: ['APPROVE', 'REJECT'] },
                  comments: { type: 'string', example: 'Approved for client review handoff' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Admin review completed, visibleToClient set to true' }
        }
      }
    },
    '/drawings/{id}/compare': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get side-by-side version comparison data',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'versionA', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'versionB', in: 'query', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Side-by-side comparison data retrieved' }
        }
      }
    },
    '/drawings/{id}/promote-to-gfc': {
      put: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Promote drawing to GFC locked version (isGFCLocked: true)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Drawing promoted to GFC locked state' }
        }
      }
    },
    '/drawings/{id}/unlock-gfc': {
      put: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Unlock GFC locked drawing (Super Admin only with logged reason)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: {
                  reason: { type: 'string', example: 'Client requested major structural revision' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'GFC drawing unlocked successfully' }
        }
      }
    },
    '/drawing-versions/{versionId}/edit-in-place': {
      put: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'In-place edit file for Process DWG category only (Admin only, no version increment)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['updatedFilePath'],
                properties: {
                  updatedFilePath: { type: 'string', example: '/uploads/dwg/process_v1_edited.dwg' },
                  changeLog: { type: 'string', example: 'In-place CAD layer correction' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Process DWG file edited in place' }
        }
      }
    },
    '/drawing-versions/{versionId}/client-approval-log': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get internal view of CRM Module 5 client approval audit log',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Client approval log retrieved' }
        }
      }
    },
    '/drawing-category/create': {
      post: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Create dynamic drawing category master',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Landscape Drawings' },
                  requiresClientApproval: { type: 'boolean', default: true },
                  restrictedEditing: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Category created' }
        }
      }
    },
    '/drawing-category/active': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get active drawing categories list',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Active categories list retrieved' }
        }
      }
    },
    '/projects/{projectId}/drawings/breakdown': {
      get: {
        tags: ['ERP Module 3 - Drawing Management System'],
        summary: 'Get project drawings breakdown statistics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project drawings breakdown retrieved' }
        }
      }
    },
    '/drawing-versions/{versionId}/review-data': {
      get: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Get aggregated review data payload for interactive viewer (drawingVersion, drawing, comments, markings)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Aggregated review data retrieved' }
        }
      }
    },
    '/drawing-versions/{versionId}/comments': {
      post: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Post general comment or image-pinned note',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['commentText'],
                properties: {
                  commentText: { type: 'string', example: 'Verify railing height against safety building codes.' },
                  annotationCoords: { type: 'object', example: { x: 450, y: 320 } },
                  isDraft: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Comment or note created' }
        }
      },
      get: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Get version comments and notes list (shared ERP + CRM layer)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Version comments and notes list retrieved' }
        }
      }
    },
    '/drawing-versions/{versionId}/markings': {
      post: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Create freehand or shape marking tool annotation',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['markingType', 'geometry'],
                properties: {
                  markingType: { type: 'string', enum: ['FREEHAND', 'RECTANGLE', 'CIRCLE', 'ARROW', 'HIGHLIGHT_AREA'] },
                  geometry: { type: 'object', example: { x: 400, y: 300, width: 120, height: 80 } },
                  color: { type: 'string', example: '#FFFF00' },
                  linkedCommentId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Marking annotation created' }
        }
      },
      get: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Get version freehand and shape markings list',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Version markings list retrieved' }
        }
      }
    },
    '/drawing-versions/{versionId}/markings/{markingId}': {
      delete: {
        tags: ['ERP Module 4 - JPEG/3D Drawing Review'],
        summary: 'Delete marking annotation (Author or Admin override)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'markingId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Marking annotation deleted' }
        }
      }
    },
    '/projects/{projectId}/chat': {
      get: {
        tags: ['ERP Module 5 - Internal Project Chat'],
        summary: 'Get internal project chat history (team-scoped / admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'since', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Project chat history retrieved with resolved Task & Drawing references' },
          403: { description: 'Access denied if calling employee is not assigned to project team' }
        }
      }
    },
    '/projects/{projectId}/chat/message': {
      post: {
        tags: ['ERP Module 5 - Internal Project Chat'],
        summary: 'Send internal chat message with optional Task & Drawing references',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messageText'],
                properties: {
                  messageText: { type: 'string', example: 'Check Task #42 alongside drawing v1 layout.' },
                  mentionedIds: { type: 'array', items: { type: 'string' } },
                  replyToMessageId: { type: 'string' },
                  linkedTaskId: { type: 'string', example: '66b1c2f304918e24ab567891' },
                  linkedDrawingVersionId: { type: 'string', example: '66b1c2f304918e24ab567892' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Message sent and broadcasted via Socket.io' },
          400: { description: 'Cross-project task or drawing link rejected' }
        }
      }
    },
    '/projects/{projectId}/chat/sync': {
      post: {
        tags: ['ERP Module 5 - Internal Project Chat'],
        summary: 'Batch sync offline composed messages',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['messageText'],
                      properties: {
                        messageText: { type: 'string' },
                        localComposedAt: { type: 'string' },
                        linkedTaskId: { type: 'string' },
                        linkedDrawingVersionId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Offline messages batch synced successfully' }
        }
      }
    },
    '/projects/{projectId}/chat/mark-read': {
      put: {
        tags: ['ERP Module 5 - Internal Project Chat'],
        summary: 'Mark project chat read timestamp for employee',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Chat marked as read' }
        }
      }
    },
    '/chat/unread-counts': {
      get: {
        tags: ['ERP Module 5 - Internal Project Chat'],
        summary: 'Get unread message counts across accessible projects',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Unread message counts retrieved' }
        }
      }
    }
  }
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../routes/*.js')]
};

const swaggerSpec = swaggerJsDoc(options);

function setupSwagger(app) {
  const customOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true
    }
  };
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, customOptions));
  app.get('/docs', (req, res) => res.redirect('/api-docs'));
}

module.exports = { setupSwagger, swaggerSpec };
