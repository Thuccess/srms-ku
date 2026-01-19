import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Student from '../models/Student.js';
import { UserRole } from '../models/User.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory to store CSV exports
const EXPORTS_DIR = path.join(__dirname, '../../exports');
const CSV_FILE_PATH = path.join(EXPORTS_DIR, 'students.csv');

/**
 * Ensure exports directory exists
 */
const ensureExportsDir = (): void => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
};

/**
 * Escape CSV field to handle commas, quotes, and newlines
 */
const escapeCsvField = (field: string | number | undefined | null): string => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generate CSV content from students array
 * Only includes allowed fields: Student Number, Course, Year of Study, Semester of Study, GPA, Attendance, Balance
 */
const generateCsvContent = (students: any[]): string => {
  // Define headers - Only allowed fields in exact order
  const headers = [
    'Student Number',
    'Course', // Keep 'Course' header for backward compatibility
    'Year of Study',
    'Semester of Study',
    'GPA',
    'Attendance',
    'Balance',
  ];

  // Generate rows - Only allowed fields
  const rows = students.map((student) => {
    return [
      escapeCsvField(student.studentNumber || ''),
      escapeCsvField(student.program || student.course || ''), // Use 'program' field, fallback to 'course'
      escapeCsvField(student.yearOfStudy || ''),
      escapeCsvField(student.semesterOfStudy || ''),
      escapeCsvField(student.gpa || 0),
      escapeCsvField(student.attendance || 0),
      escapeCsvField(student.balance || 0),
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  return BOM + csvContent;
};

/**
 * Regenerate CSV file with all students
 * This is called automatically when students are created/updated/deleted
 */
export const regenerateCsvFile = async (): Promise<void> => {
  try {
    ensureExportsDir();

    // Fetch all students from database
    const students = await Student.find({}).sort({ createdAt: -1 }).lean();

    // Generate CSV content (only allowed fields)
    const csvContent = generateCsvContent(students);

    // Write to file
    fs.writeFileSync(CSV_FILE_PATH, csvContent, 'utf8');

    logger.info(`CSV file updated: ${CSV_FILE_PATH} (${students.length} students)`);
  } catch (error: any) {
    logger.error('Failed to regenerate CSV file:', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Get the path to the CSV file
 */
export const getCsvFilePath = (): string => {
  ensureExportsDir();
  return CSV_FILE_PATH;
};

/**
 * Check if CSV file exists
 */
export const csvFileExists = (): boolean => {
  return fs.existsSync(CSV_FILE_PATH);
};

/**
 * Initialize CSV file on server startup
 */
export const initializeCsvFile = async (): Promise<void> => {
  try {
    await regenerateCsvFile();
    logger.info('CSV file initialized');
  } catch (error: any) {
    logger.error('Failed to initialize CSV file:', { error: error.message, stack: error.stack });
  }
};

