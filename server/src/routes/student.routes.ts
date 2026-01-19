import { Router } from 'express';
import {
  getAllStudents,
  createStudent,
  getStudentByStudentNumber,
  updateStudent,
  deleteStudent,
  downloadCsvFile,
  uploadCsvFile,
  importFromServerCsv,
  getDataIntegrityAlerts,
} from '../controllers/student.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { enforceStudentScope } from '../middleware/rbac.middleware.js';

const router = Router();

// All student routes require authentication
router.use(authenticate);

// Base path for this router will be `/api/students` (see `app.ts`).
// Define routes relative to that base so the final endpoints are:
// GET    /api/students
// POST   /api/students
// GET    /api/students/:studentNumber
// PUT    /api/students/:studentNumber
// DELETE /api/students/:studentNumber

// Get all students (with role-based scope filtering)
router.get('/', enforceStudentScope, getAllStudents);

// Get data integrity alerts (with role-based scope filtering)
router.get('/data-integrity-alerts', enforceStudentScope, getDataIntegrityAlerts);

// Download CSV file (available to all authenticated users)
router.get('/export/csv', downloadCsvFile);

// Upload CSV file (REGISTRY only) - automatically updates exports/students.csv
router.post('/import/csv', uploadCsvFile);

// Import from server CSV file (REGISTRY only) - reads server/exports/students.csv and imports it
router.post('/import/server-csv', importFromServerCsv);

// Create student (REGISTRY only)
router.post('/', createStudent);

// Get student by student number (with scope check)
router.get('/:studentNumber', getStudentByStudentNumber);

// Update student (REGISTRY or ADVISOR for assigned students)
router.put('/:studentNumber', updateStudent);

// Delete student (REGISTRY only)
router.delete('/:studentNumber', deleteStudent);

export default router;

