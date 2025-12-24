const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  bulkUpdateTickets,
  getTicketStats
} = require('../controllers/ticketController');

const {
  getTicketComments,
  addTicketComment,
  updateTicketComment,
  deleteTicketComment
} = require('../controllers/ticketCommentController');

const {
  getTicketAttachments,
  uploadTicketAttachment,
  deleteTicketAttachment,
  downloadTicketAttachment,
  upload
} = require('../controllers/ticketAttachmentController');

const {
  getTicketWatchers,
  addTicketWatcher,
  removeTicketWatcher,
  toggleWatcher,
  checkWatcherStatus
} = require('../controllers/ticketWatcherController');

const {
  getWorkflows,
  getWorkflowById,
  getValidTransitions,
  performTransition,
  getTransitionHistory
} = require('../controllers/workflowController');

const {
  getPendingApprovals,
  getApprovalById,
  respondToApproval
} = require('../controllers/approvalController');

const {
  getSLADefinitions,
  getTicketSLA,
  pauseSLA,
  resumeSLA,
  getSLABreaches,
  getSLAMetrics,
  getTicketsAtRisk
} = require('../controllers/slaController');

const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Ticket CRUD routes
router.get('/', getTickets);
router.get('/stats', getTicketStats);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.delete('/:id', deleteTicket);
router.post('/bulk-update', bulkUpdateTickets);

// Workflow routes
router.get('/workflows', getWorkflows);
router.get('/workflows/:id', getWorkflowById);

// Transition routes
router.get('/:ticketId/transitions', getValidTransitions);
router.post('/:ticketId/transitions', performTransition);
router.get('/:ticketId/transitions/history', getTransitionHistory);

// Approval routes
router.get('/approvals/pending', getPendingApprovals);
router.get('/approvals/:id', getApprovalById);
router.post('/approvals/:id/respond', respondToApproval);

// SLA routes
router.get('/sla/definitions', getSLADefinitions);
router.get('/sla/breaches', getSLABreaches);
router.get('/sla/metrics', getSLAMetrics);
router.get('/sla/at-risk', getTicketsAtRisk);
router.get('/:ticketId/sla', getTicketSLA);
router.post('/:ticketId/sla/pause', pauseSLA);
router.post('/:ticketId/sla/resume', resumeSLA);

// Comment routes
router.get('/:ticketId/comments', getTicketComments);
router.post('/:ticketId/comments', addTicketComment);
router.put('/:ticketId/comments/:commentId', updateTicketComment);
router.delete('/:ticketId/comments/:commentId', deleteTicketComment);

// Attachment routes
router.get('/:ticketId/attachments', getTicketAttachments);
router.post('/:ticketId/attachments', upload.single('file'), uploadTicketAttachment);
router.delete('/:ticketId/attachments/:attachmentId', deleteTicketAttachment);
router.get('/:ticketId/attachments/:attachmentId/download', downloadTicketAttachment);

// Watcher routes
router.get('/:ticketId/watchers', getTicketWatchers);
router.post('/:ticketId/watchers', addTicketWatcher);
router.delete('/:ticketId/watchers/:watcherId', removeTicketWatcher);
router.post('/:ticketId/watchers/toggle', toggleWatcher);
router.get('/:ticketId/watchers/status', checkWatcherStatus);

module.exports = router;
