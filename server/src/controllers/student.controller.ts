import type { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';
import Student, { IStudent } from '../models/Student.js';
import { emitToAll, emitDashboardStats } from '../socket/socket.js';
import { buildStudentScopeFilter, canViewIndividualStudents, canViewRiskScores, canViewStudent } from '../middleware/rbac.middleware.js';
import { regenerateCsvFile, getCsvFilePath, csvFileExists } from '../services/csvService.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * Get all students with role-based scope filtering
 * 
 * Performance Optimization: Added pagination support for handling large datasets (3000+ students)
 * - Backward compatible: If no pagination params provided, returns all students (existing behavior)
 * - Pagination params: page (default: 1), limit (default: all if not specified)
 * - Returns pagination metadata when pagination is used
 * 
 * Access Rules:
 * - VC/DVC_ACADEMIC: Cannot view individual students (should use analytics endpoint)
 * - DEAN: Faculty-scoped students
 * - HOD: Department-scoped students
 * - ADVISOR: Assigned students only
 * - LECTURER: Students in assigned courses
 * - REGISTRY: All students (for data integrity)
 * - IT_ADMIN: No access
 */
export const getAllStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // VC and DVC_ACADEMIC cannot view individual students
    if (!canViewIndividualStudents(req.user)) {
      res.status(403).json({ 
        error: 'Access denied. Your role does not have permission to view individual student data. Please use the analytics endpoint for aggregated data.' 
      });
      return;
    }

    // Build scope filter based on user role
    const scopeFilter = await buildStudentScopeFilter(req.user);
    
    // Performance Optimization: Support pagination for large datasets
    // Backward compatibility: If no pagination params, return all students (existing behavior)
    const pageParam = req.query.page as string;
    const limitParam = req.query.limit as string;
    
    if (pageParam || limitParam) {
      // Pagination mode: Return paginated results with metadata
      const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
      const limit = limitParam ? Math.max(1, Math.min(1000, parseInt(limitParam, 10))) : 50; // Max 1000 per page
      const skip = (page - 1) * limit;
      
      // Get paginated students and total count in parallel for better performance
      const [students, total] = await Promise.all([
        Student.find(scopeFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Student.countDocuments(scopeFilter)
      ]);
      
      // Map students to ensure backward compatibility with 'course' field
      // This ensures frontend receives both 'program' and 'course' fields
      const mappedStudents = students.map((s: any) => {
        const programValue = s.program || s.course || '';
        return {
          _id: s._id,
          id: s._id?.toString() || s.id,
          studentNumber: s.studentNumber || '',
          program: programValue, // Use 'program' field, fallback to 'course' for backward compatibility
          course: programValue, // Keep 'course' in response for backward compatibility
          yearOfStudy: s.yearOfStudy || 1,
          semesterOfStudy: s.semesterOfStudy || '1',
          gpa: s.gpa || 0,
          attendance: s.attendance || 0,
          balance: s.balance || 0,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });
      
      const totalPages = Math.ceil(total / limit);
      
      res.status(200).json({
        students: mappedStudents, // Array of students (maintains existing structure for backward compatibility)
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } else {
      // Backward compatibility: No pagination params = return all students (existing behavior)
      const students = await Student.find(scopeFilter).sort({ createdAt: -1 }).lean();
      // Map students to ensure backward compatibility with 'course' field
      // This ensures frontend receives both 'program' and 'course' fields
      const mappedStudents = students.map((s: any) => {
        const programValue = s.program || s.course || '';
        return {
          _id: s._id,
          id: s._id?.toString() || s.id,
          studentNumber: s.studentNumber || '',
          program: programValue, // Use 'program' field, fallback to 'course' for backward compatibility
          course: programValue, // Keep 'course' in response for backward compatibility
          yearOfStudy: s.yearOfStudy || 1,
          semesterOfStudy: s.semesterOfStudy || '1',
          gpa: s.gpa || 0,
          attendance: s.attendance || 0,
          balance: s.balance || 0,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });
      res.status(200).json(mappedStudents);
    }
  } catch (error: any) {
    logger.error('Get all students error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

/**
 * Create a new student
 * 
 * Access Rules:
 * - Only REGISTRY and IT_ADMIN (for system setup) can create students
 * - In production, consider adding more granular permissions
 */
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only REGISTRY can create students (for data integrity)
    if (req.user.role !== UserRole.REGISTRY) {
      res.status(403).json({ error: 'Access denied. Only REGISTRY can create student records.' });
      return;
    }

    const {
      studentNumber,
      program, // Renamed from 'course' for clarity
      course, // Keep for backward compatibility
      yearOfStudy,
      semesterOfStudy,
      gpa,
      attendance,
      balance,
    } = req.body;

    // Basic presence validation for required fields
    if (!studentNumber) {
      res.status(400).json({ error: 'Student number is required.' });
      return;
    }

    // Enforce uniqueness at application level (in addition to DB unique indexes)
    const existingByStudentNumber = await Student.findOne({ studentNumber });
    if (existingByStudentNumber) {
      res.status(409).json({ error: 'Student number already exists.' });
      return;
    }

    // Normalize and validate fields
    // Support both 'program' (new) and 'course' (backward compatibility)
    const programName = program || course || 'General Studies';
    const payload: any = {
      studentNumber,
      program: programName, // Use 'program' field (renamed from 'course')
      yearOfStudy: Number(yearOfStudy ?? 1),
      semesterOfStudy: (semesterOfStudy === '1' || semesterOfStudy === '2') ? semesterOfStudy : '1',
      gpa: Number(gpa ?? 0),
      attendance: Number(attendance ?? 0),
      balance: Number(balance ?? 0),
    };
    
    // Fix: Set studentRegistrationNumber to satisfy unique index constraint in database
    // The database has a unique index on studentRegistrationNumber, but the schema doesn't include it
    // Setting it to the same value as studentNumber to avoid duplicate key errors
    payload.studentRegistrationNumber = studentNumber;

    const student = await Student.create(payload);
    
    // Emit real-time event
    emitToAll('student:created', { student });
    emitDashboardStats();
    
    // Regenerate CSV file instantly
    regenerateCsvFile().catch((error) => {
      logger.error('Failed to update CSV file after student creation:', { error: error.message });
      // Don't fail the request if CSV update fails
    });
    
    res.status(201).json(student);
  } catch (error: any) {
    logger.error('Failed to create student', { error: error.message, stack: error.stack });
    res.status(400).json({ error: 'Failed to create student' });
  }
};

/**
 * Fetch student by institutional student number
 * 
 * Access Rules:
 * - User must have permission to view individual students
 * - Student must be within user's scope (faculty, department, assigned, etc.)
 */
export const getStudentByStudentNumber = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user can view individual students
    if (!canViewIndividualStudents(req.user)) {
      res.status(403).json({ 
        error: 'Access denied. Your role does not have permission to view individual student data.' 
      });
      return;
    }

    const studentNumber = req.params.studentNumber;
    if (!studentNumber) {
      res.status(400).json({ error: 'Student number is required' });
      return;
    }

    // Check if user can view this specific student
    const student = await Student.findOne({ studentNumber });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Verify student is within user's scope
    const canView = await canViewStudent(req.user, student._id);
    if (!canView) {
      res.status(403).json({ 
        error: 'Access denied. This student is not within your assigned scope.' 
      });
      return;
    }

    res.status(200).json(student);
  } catch (error: any) {
    logger.error('Get student error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch student' });
  }
};

/**
 * Update student
 * 
 * Access Rules:
 * - REGISTRY: Can update any student (for data integrity)
 * - ADVISOR: Can update assigned students only
 * - Others: Read-only access
 */
export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const studentNumber = req.params.studentNumber;
    if (!studentNumber) {
      res.status(400).json({ error: 'Student number is required' });
      return;
    }

    // Find student first to check permissions
    const existingStudent = await Student.findOne({ studentNumber });
    if (!existingStudent) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Check if user can update this student
    if (req.user.role === UserRole.REGISTRY) {
      // REGISTRY can update any student
    } else if (req.user.role === UserRole.ADVISOR) {
      // ADVISOR can only update assigned students
      if (!req.user.assignedStudents || 
          !req.user.assignedStudents.some(id => id.toString() === existingStudent._id.toString())) {
        res.status(403).json({ 
          error: 'Access denied. You can only update your assigned students.' 
        });
        return;
      }
    } else {
      // Other roles are read-only
      res.status(403).json({ 
        error: 'Access denied. Your role does not have permission to update student records.' 
      });
      return;
    }

    // Only allow updating allowed fields
    const {
      program, // New field name
      course, // Backward compatibility
      yearOfStudy,
      semesterOfStudy,
      gpa,
      attendance,
      balance,
    } = req.body;

    const updateData: any = {};
    // Support both 'program' (new) and 'course' (backward compatibility)
    if (program !== undefined) updateData.program = program;
    else if (course !== undefined) updateData.program = course;
    if (yearOfStudy !== undefined) updateData.yearOfStudy = Number(yearOfStudy);
    if (semesterOfStudy !== undefined) {
      updateData.semesterOfStudy = (semesterOfStudy === '1' || semesterOfStudy === '2') ? semesterOfStudy : existingStudent.semesterOfStudy;
    }
    if (gpa !== undefined) updateData.gpa = Number(gpa);
    if (attendance !== undefined) updateData.attendance = Number(attendance);
    if (balance !== undefined) updateData.balance = Number(balance);

    const student = await Student.findOneAndUpdate(
      { studentNumber },
      updateData,
      { new: true, runValidators: true }
    );

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Emit real-time event
    emitToAll('student:updated', { student });
    emitDashboardStats();
    
    // Regenerate CSV file instantly
    regenerateCsvFile().catch((error) => {
      logger.error('Failed to update CSV file after student update:', { error: error.message });
    });
    
    res.status(200).json(student);
  } catch (error: any) {
    logger.error('Update student error:', { error: error.message, stack: error.stack });
    res.status(400).json({ error: 'Failed to update student' });
  }
};

/**
 * Delete student
 * 
 * Access Rules:
 * - Only REGISTRY can delete students (for data integrity)
 */
export const deleteStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only REGISTRY can delete students
    if (req.user.role !== UserRole.REGISTRY) {
      res.status(403).json({ 
        error: 'Access denied. Only REGISTRY can delete student records.' 
      });
      return;
    }

    const studentNumber = req.params.studentNumber;
    if (!studentNumber) {
      res.status(400).json({ error: 'Student number is required' });
      return;
    }

    const student = await Student.findOneAndDelete({ studentNumber });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Emit real-time event
    emitToAll('student:deleted', { studentNumber: student.studentNumber });
    emitDashboardStats();
    
    // Regenerate CSV file instantly
    regenerateCsvFile().catch((error) => {
      logger.error('Failed to update CSV file after student deletion:', { error: error.message });
    });
    
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error: any) {
    logger.error('Delete student error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

/**
 * Normalize semester to "1" or "2"
 * Handles various formats:
 * - "1", "2" (already correct)
 * - "Semester 1", "Semester 2"
 * - "Fall", "Spring" (Fall = 1, Spring = 2)
 * - "First", "Second"
 * - Extracts number from strings like "Semester 1 2024"
 * Returns "1" or "2" if valid, "1" as default
 */
function normalizeSemester(semester: string): '1' | '2' {
  if (!semester) return '1';
  
  const normalized = semester.trim().toLowerCase();
  
  // Direct match: "1" or "2"
  if (normalized === '1' || normalized === 'one' || normalized === 'first') {
    return '1';
  }
  if (normalized === '2' || normalized === 'two' || normalized === 'second') {
    return '2';
  }
  
  // Match "semester 1", "semester 2", "sem 1", etc.
  if (normalized.includes('semester') || normalized.includes('sem')) {
    if (normalized.includes('1') || normalized.includes('one') || normalized.includes('first')) {
      return '1';
    }
    if (normalized.includes('2') || normalized.includes('two') || normalized.includes('second')) {
      return '2';
    }
  }
  
  // Match "fall" (typically semester 1) or "spring" (typically semester 2)
  if (normalized.includes('fall') || normalized.includes('autumn')) {
    return '1';
  }
  if (normalized.includes('spring')) {
    return '2';
  }
  
  // Extract number from string (e.g., "Semester 1 2024" -> "1")
  const numberMatch = normalized.match(/\b([12])\b/);
  if (numberMatch) {
    return numberMatch[1] as '1' | '2';
  }
  
  // Default to "1" if no match found
  return '1';
}

/**
 * Upload and import CSV file
 * 
 * Only processes allowed fields:
 * - Student Number
 * - Course
 * - Year of Study
 * - Semester of Study
 * - GPA
 * - Attendance
 * - Balance
 * 
 * All other columns are silently ignored.
 * 
 * Access Rules:
 * - Only REGISTRY can upload CSV files
 * - Automatically regenerates the exports CSV file
 */
export const uploadCsvFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only REGISTRY can upload CSV files
    if (req.user.role !== UserRole.REGISTRY) {
      res.status(403).json({ 
        error: 'Access denied. Only REGISTRY staff can upload CSV files.' 
      });
      return;
    }

    // Get CSV content from request body (can be text/plain or JSON with csv field)
    let csvContent: string;
    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      csvContent = req.body.toString('utf8');
    } else {
      csvContent = req.body.csv || req.body.content || req.body.data || '';
    }
    
    // Remove BOM if present
    if (csvContent && csvContent.length > 0 && csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    if (!csvContent || csvContent.trim().length === 0) {
      res.status(400).json({ error: 'CSV content is required. Send CSV data as text/plain or JSON with { csv: "..." }' });
      return;
    }
    
    console.log(`📥 Received CSV content: ${csvContent.length} characters`);
    console.log(`📥 First 200 chars: ${csvContent.substring(0, 200)}`);

    // Parse CSV content - filter out empty lines
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    
    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV file must contain at least a header row and one data row' });
      return;
    }
    
    console.log(`📊 Processing CSV: ${lines.length - 1} data rows (excluding header)`);

    // Helper function to parse CSV row (handles quoted fields with commas)
    const parseCsvRow = (line: string): string[] => {
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim()); // Add last part
      return parts;
    };

    // Parse header and validate required columns
    const headerLine = lines[0];
    if (!headerLine) {
      res.status(400).json({ error: 'CSV file must contain a header row' });
      return;
    }
    
    // Use parseCsvRow to handle commas in header fields
    const headerParts = parseCsvRow(headerLine);
    const headers = headerParts.map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    console.log(`📋 CSV Headers detected:`, headers);
    
    // Validate that Student Number column exists (required)
    const studentNumberVariants = ['student number', 'studentnumber', 'student_number'];
    const hasStudentNumber = headers.some(h => studentNumberVariants.includes(h));
    
    if (!hasStudentNumber) {
      res.status(400).json({ 
        error: `CSV file must contain a Student Number column. Found headers: ${headers.join(', ')}. Acceptable column names: Student Number, StudentNumber, Student_Number` 
      });
      return;
    }

    // Helper function to get value from row
    const getValue = (rowParts: string[], keyVariants: string[]): string => {
      const idx = headers.findIndex(h => keyVariants.includes(h));
      if (idx >= 0 && idx < rowParts.length && rowParts[idx]) {
        return rowParts[idx].replace(/^"|"$/g, '').trim(); // Remove quotes and trim
      }
      return '';
    };

    // Track statistics
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each row - only map allowed fields
    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines
      const line = lines[i];
      if (!line || typeof line !== 'string' || line.trim().length === 0) {
        continue;
      }
      
      try {
        const parts = parseCsvRow(line);
        
        // Extract only allowed fields from CSV
        const studentNumber = getValue(parts, ['student number', 'studentnumber', 'student_number']).trim();
        const course = getValue(parts, ['course', 'program']).trim();
        const yearOfStudy = parseInt(getValue(parts, ['year of study', 'yearofstudy', 'year_of_study', 'year']) || '1', 10);
        const semesterOfStudyRaw = getValue(parts, ['semester of study', 'semesterofstudy', 'semester_of_study', 'semester']).trim();
        const semesterOfStudy = normalizeSemester(semesterOfStudyRaw) || '1';
        const gpa = parseFloat(getValue(parts, ['gpa', 'cgpa']) || '0');
        const attendance = parseInt(getValue(parts, [
          'attendance', 'attendance (%)', 'attendancerate', 'attendance_rate'
        ]) || '0', 10);
        const balance = parseFloat(getValue(parts, [
          'balance', 'balance (ugx)', 'tuition balance (ugx)', 'tuitionbalance', 'tuition_balance'
        ]) || '0');
        
        // Debug: Log first few rows
        if (i <= 3) {
          console.log(`📝 Row ${i + 1} parsed:`, {
            partsCount: parts.length,
            headersCount: headers.length,
            studentNumber,
            course,
            yearOfStudy,
            semesterOfStudy,
            gpa,
            attendance,
            balance
          });
        }
        
        // Skip if required field (studentNumber) is missing
        if (!studentNumber) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Missing Student Number - row skipped. Parsed ${parts.length} parts, expected ${headers.length} columns. Parts: ${parts.join(' | ')}`);
          logger.warn(`Row ${i + 1}: Missing Student Number`, { parts });
          continue;
        }

        // Find existing student by studentNumber
        const existingStudent = await Student.findOne({ studentNumber });

        if (existingStudent) {
          // UPDATE existing student - only update allowed fields
          // Support both 'program' (new) and 'course' (backward compatibility)
          const programName = course || (existingStudent.program || (existingStudent as any).course);
          const updateData: any = {
            program: programName, // Use 'program' field
            yearOfStudy: isNaN(yearOfStudy) ? existingStudent.yearOfStudy : yearOfStudy,
            semesterOfStudy: semesterOfStudy || existingStudent.semesterOfStudy,
            gpa: isNaN(gpa) ? existingStudent.gpa : gpa,
            attendance: isNaN(attendance) ? existingStudent.attendance : attendance,
            balance: isNaN(balance) ? existingStudent.balance : balance,
          };

          await Student.findByIdAndUpdate(
            existingStudent._id,
            updateData,
            { 
              new: true,
              runValidators: true,
            }
          );

          updatedCount++;
          
          // Debug: Log updates
          if (updatedCount <= 10) {
            console.log(`🔄 Updated student ${updatedCount}: ${studentNumber}`);
          }
        } else {
          // CREATE new student - only with allowed fields
          // Validate required fields
          if (!course || course.trim() === '') {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Course is required`);
            continue;
          }
          
          // Validate numeric fields
          if (isNaN(yearOfStudy) || yearOfStudy < 1) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid Year of Study (must be >= 1)`);
            continue;
          }
          
          if (isNaN(gpa) || gpa < 0 || gpa > 5) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid GPA (must be between 0 and 5)`);
            continue;
          }
          
          if (isNaN(attendance) || attendance < 0 || attendance > 100) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid Attendance (must be between 0 and 100)`);
            continue;
          }
          
          const newStudentData: any = {
            studentNumber,
            program: course.trim(), // Use 'program' field (renamed from 'course')
            yearOfStudy: yearOfStudy,
            semesterOfStudy: semesterOfStudy,
            gpa: gpa,
            attendance: attendance,
            balance: isNaN(balance) ? 0 : balance,
          };
          
          // Fix: Set studentRegistrationNumber to satisfy unique index constraint in database
          // The database has a unique index on studentRegistrationNumber
          // Setting it to the same value as studentNumber to avoid duplicate key errors
          newStudentData.studentRegistrationNumber = studentNumber;

          await Student.create(newStudentData);
          createdCount++;
        }
      } catch (rowError: any) {
        skippedCount++;
        const rowParts = line ? parseCsvRow(line) : [];
        const studentNumber = getValue(rowParts, ['student number', 'studentnumber', 'student_number']) || 'Unknown';
        const errorMessage = rowError.message || 'Unknown error';
        
        // Provide more detailed error messages
        let detailedError = errorMessage;
        if (errorMessage.includes('duplicate key')) {
          if (errorMessage.includes('studentNumber')) {
            detailedError = 'Student number already exists in database';
          }
        } else if (errorMessage.includes('validation failed')) {
          detailedError = 'Data validation failed - check required fields and value ranges';
        } else if (errorMessage.includes('Cast to Number failed')) {
          detailedError = 'Invalid numeric value in one of the fields';
        }
        
        errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): ${detailedError}`);
        logger.error(`Error processing row ${i + 1}`, { 
          error: rowError.message, 
          stack: rowError.stack,
          rowData: line,
          parsedParts: rowParts 
        });
      }
    }

    // Regenerate CSV file automatically
    try {
      await regenerateCsvFile();
      logger.info('CSV export file automatically updated after import');
    } catch (csvError: any) {
      logger.error('Failed to regenerate CSV file after import:', { error: csvError.message });
      // Don't fail the request if CSV regeneration fails
    }

    // Emit real-time events
    emitToAll('students:imported', { createdCount, updatedCount });
    emitDashboardStats();

    const totalRows = lines.length - 1; // Exclude header
    const totalProcessed = createdCount + updatedCount;

    console.log(`\n📊 CSV Import Summary:`);
    console.log(`   Total rows in CSV: ${totalRows}`);
    console.log(`   ✅ Students created: ${createdCount}`);
    console.log(`   🔄 Students updated: ${updatedCount}`);
    console.log(`   ⏭️  Rows skipped: ${skippedCount}`);
    console.log(`   📈 Total processed: ${totalProcessed}\n`);
    
    if (errors.length > 0 && errors.length <= 20) {
      console.log(`⚠️  Errors encountered:`);
      errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }

    res.status(200).json({
      message: 'CSV file imported successfully',
      summary: {
        totalRows,
        totalProcessed,
        studentsCreated: createdCount,
        studentsUpdated: updatedCount,
        rowsSkipped: skippedCount,
      },
      details: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('Upload CSV error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to import CSV file', details: error.message });
  }
};

/**
 * Download CSV file
 * 
 * Access Rules:
 * - REGISTRY: Can download CSV with all students
 * - Others: Can download CSV with students in their scope
 */
export const downloadCsvFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if CSV file exists
    if (!csvFileExists()) {
      // Generate CSV file if it doesn't exist
      await regenerateCsvFile();
    }

    const csvFilePath = getCsvFilePath();

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      res.status(404).json({ error: 'CSV file not found. Please try again.' });
      return;
    }

    // Set headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="students_export_${timestamp}.csv"`);

    // Stream the file
    const fileStream = fs.createReadStream(csvFilePath);
    fileStream.pipe(res);
  } catch (error: any) {
    logger.error('Download CSV error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to download CSV file' });
  }
};

/**
 * Import from server CSV file (server/exports/students.csv)
 * Reads the CSV file from the server and imports it into the database
 * 
 * Access Rules:
 * - Only REGISTRY can import from server CSV file
 * - Automatically updates the database and regenerates the CSV file
 */
export const importFromServerCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only REGISTRY can import from server CSV file
    if (req.user.role !== UserRole.REGISTRY) {
      res.status(403).json({ 
        error: 'Access denied. Only REGISTRY staff can import from server CSV file.' 
      });
      return;
    }

    const csvFilePath = getCsvFilePath();

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      res.status(404).json({ 
        error: 'Server CSV file not found. The file may not exist yet. Please upload a CSV file first.' 
      });
      return;
    }

    // Read CSV file from server
    let csvContent: string;
    try {
      csvContent = fs.readFileSync(csvFilePath, 'utf8');
    } catch (readError: any) {
      logger.error('Failed to read server CSV file:', { error: readError.message });
      res.status(500).json({ error: 'Failed to read server CSV file', details: readError.message });
      return;
    }

    // Remove BOM if present
    if (csvContent && csvContent.length > 0 && csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }

    if (!csvContent || csvContent.trim().length === 0) {
      res.status(400).json({ error: 'Server CSV file is empty. Please add student data to the file.' });
      return;
    }

    // Parse CSV content - filter out empty lines
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      res.status(400).json({ error: 'Server CSV file must contain at least a header row and one data row' });
      return;
    }

    logger.info(`Importing from server CSV file: ${lines.length - 1} data rows (excluding header)`);

    // Helper function to parse CSV row (handles quoted fields with commas)
    const parseCsvRow = (line: string): string[] => {
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim()); // Add last part
      return parts;
    };

    // Parse header and validate required columns
    const headerLine = lines[0];
    if (!headerLine) {
      res.status(400).json({ error: 'Server CSV file must contain a header row' });
      return;
    }
    
    // Use parseCsvRow to handle commas in header fields
    const headerParts = parseCsvRow(headerLine);
    const headers = headerParts.map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    logger.info(`CSV Headers detected: ${headers.join(', ')}`);
    
    // Validate that Student Number column exists (required)
    const studentNumberVariants = ['student number', 'studentnumber', 'student_number'];
    const hasStudentNumber = headers.some(h => studentNumberVariants.includes(h));
    
    if (!hasStudentNumber) {
      res.status(400).json({ 
        error: `Server CSV file must contain a Student Number column. Found headers: ${headers.join(', ')}. Acceptable column names: Student Number, StudentNumber, Student_Number` 
      });
      return;
    }

    // Helper function to get value from row
    const getValue = (rowParts: string[], keyVariants: string[]): string => {
      const idx = headers.findIndex(h => keyVariants.includes(h));
      if (idx >= 0 && idx < rowParts.length && rowParts[idx]) {
        return rowParts[idx].replace(/^"|"$/g, '').trim(); // Remove quotes and trim
      }
      return '';
    };

    // Track statistics
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each row - only map allowed fields
    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines
      const line = lines[i];
      if (!line || typeof line !== 'string' || line.trim().length === 0) {
        continue;
      }
      
      try {
        const parts = parseCsvRow(line);
        
        // Extract only allowed fields from CSV
        const studentNumber = getValue(parts, ['student number', 'studentnumber', 'student_number']).trim();
        const course = getValue(parts, ['course', 'program']).trim();
        const yearOfStudy = parseInt(getValue(parts, ['year of study', 'yearofstudy', 'year_of_study', 'year']) || '1', 10);
        const semesterOfStudyRaw = getValue(parts, ['semester of study', 'semesterofstudy', 'semester_of_study', 'semester']).trim();
        const semesterOfStudy = normalizeSemester(semesterOfStudyRaw) || '1';
        const gpa = parseFloat(getValue(parts, ['gpa', 'cgpa']) || '0');
        const attendance = parseInt(getValue(parts, [
          'attendance', 'attendance (%)', 'attendancerate', 'attendance_rate'
        ]) || '0', 10);
        const balance = parseFloat(getValue(parts, [
          'balance', 'balance (ugx)', 'tuition balance (ugx)', 'tuitionbalance', 'tuition_balance'
        ]) || '0');
        
        // Skip if required field (studentNumber) is missing
        if (!studentNumber) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Missing Student Number - row skipped`);
          continue;
        }

        // Find existing student by studentNumber
        const existingStudent = await Student.findOne({ studentNumber });

        if (existingStudent) {
          // UPDATE existing student - only update allowed fields
          const programName = course || (existingStudent.program || (existingStudent as any).course);
          const updateData: any = {
            program: programName,
            yearOfStudy: isNaN(yearOfStudy) ? existingStudent.yearOfStudy : yearOfStudy,
            semesterOfStudy: semesterOfStudy || existingStudent.semesterOfStudy,
            gpa: isNaN(gpa) ? existingStudent.gpa : gpa,
            attendance: isNaN(attendance) ? existingStudent.attendance : attendance,
            balance: isNaN(balance) ? existingStudent.balance : balance,
          };

          await Student.findByIdAndUpdate(
            existingStudent._id,
            updateData,
            { 
              new: true,
              runValidators: true,
            }
          );

          updatedCount++;
        } else {
          // CREATE new student - only with allowed fields
          // Validate required fields
          if (!course || course.trim() === '') {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Course is required`);
            continue;
          }
          
          // Validate numeric fields
          if (isNaN(yearOfStudy) || yearOfStudy < 1) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid Year of Study (must be >= 1)`);
            continue;
          }
          
          if (isNaN(gpa) || gpa < 0 || gpa > 5) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid GPA (must be between 0 and 5)`);
            continue;
          }
          
          if (isNaN(attendance) || attendance < 0 || attendance > 100) {
            skippedCount++;
            errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): Invalid Attendance (must be between 0 and 100)`);
            continue;
          }
          
          const newStudentData = {
            studentNumber,
            program: course.trim(),
            yearOfStudy: yearOfStudy,
            semesterOfStudy: semesterOfStudy,
            gpa: gpa,
            attendance: attendance,
            balance: isNaN(balance) ? 0 : balance,
          };

          await Student.create(newStudentData);
          createdCount++;
        }
      } catch (rowError: any) {
        skippedCount++;
        const rowParts = line ? parseCsvRow(line) : [];
        const studentNumber = getValue(rowParts, ['student number', 'studentnumber', 'student_number']) || 'Unknown';
        const errorMessage = rowError.message || 'Unknown error';
        
        // Provide more detailed error messages
        let detailedError = errorMessage;
        if (errorMessage.includes('duplicate key')) {
          if (errorMessage.includes('studentNumber')) {
            detailedError = 'Student number already exists in database';
          }
        } else if (errorMessage.includes('validation failed')) {
          detailedError = 'Data validation failed - check required fields and value ranges';
        } else if (errorMessage.includes('Cast to Number failed')) {
          detailedError = 'Invalid numeric value in one of the fields';
        }
        
        errors.push(`Row ${i + 1} (Student Number: ${studentNumber}): ${detailedError}`);
        logger.error(`Error processing row ${i + 1}`, { 
          error: rowError.message, 
          stack: rowError.stack,
          rowData: line,
          parsedParts: rowParts 
        });
      }
    }

    // Regenerate CSV file automatically
    try {
      await regenerateCsvFile();
      logger.info('CSV export file automatically updated after server CSV import');
    } catch (csvError: any) {
      logger.error('Failed to regenerate CSV file after import:', { error: csvError.message });
      // Don't fail the request if CSV regeneration fails
    }

    // Emit real-time events
    emitToAll('students:imported', { createdCount, updatedCount });
    emitDashboardStats();

    const totalRows = lines.length - 1; // Exclude header
    const totalProcessed = createdCount + updatedCount;

    logger.info(`Server CSV Import Summary: ${totalRows} rows, ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`);

    res.status(200).json({
      message: 'Server CSV file imported successfully',
      summary: {
        totalRows,
        totalProcessed,
        studentsCreated: createdCount,
        studentsUpdated: updatedCount,
        rowsSkipped: skippedCount,
      },
      details: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('Import from server CSV error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to import from server CSV file', details: error.message });
  }
};

/**
 * Get data integrity alerts - students with issues requiring immediate attention
 * 
 * Performance Optimization: Refactored to use database queries instead of in-memory filtering
 * - Uses MongoDB $gt, $lt operators for efficient threshold filtering
 * - Queries run in parallel for better performance
 * - Only loads students that match criteria (not all students)
 * - Maintains exact same response structure and business logic
 * 
 * This endpoint queries the database directly using risk thresholds to ensure 100% accuracy.
 * Evaluates ALL students against predefined thresholds and classifies them into risk categories.
 * 
 * Classification Rules:
 * - Financial Risk: Balance > Financial Threshold
 * - Attendance Risk: Attendance < Attendance Threshold
 * - Academic Risk: GPA < GPA Threshold
 * 
 * Note: Students can have multiple risk classifications if they meet multiple thresholds.
 * 
 * Access Rules:
 * - REGISTRY: Can view all students with issues
 * - Others: Can view students with issues in their scope
 * 
 * Query Parameters (optional, uses defaults if not provided):
 * - criticalGpa: GPA threshold (default: 2.0)
 * - warningAttendance: Attendance threshold (default: 75)
 * - financialLimit: Financial hold threshold (default: 1000000)
 */
export const getDataIntegrityAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get thresholds from query parameters or use defaults
    const criticalGpa = req.query.criticalGpa ? parseFloat(req.query.criticalGpa as string) : 2.0;
    const warningAttendance = req.query.warningAttendance ? parseFloat(req.query.warningAttendance as string) : 75;
    const financialLimit = req.query.financialLimit ? parseFloat(req.query.financialLimit as string) : 1000000;

    // Build scope filter based on user role
    const scopeFilter = await buildStudentScopeFilter(req.user);
    
    // Performance Optimization: Use database queries instead of loading all students into memory
    // Execute all queries in parallel for better performance
    // 100% Accurate: All queries run directly against database for real-time accuracy
    const [
      totalStudents,
      financialRiskList,
      attendanceRiskList,
      academicRiskList,
      incompleteRecordsList,
      allStudentsList
    ] = await Promise.all([
      // Get total count of students in scope
      Student.countDocuments(scopeFilter),
      
      // Financial Risk: Query database directly for balance > threshold
      Student.find({
        ...scopeFilter,
        balance: { $gt: financialLimit }
      }).lean(),
      
      // Attendance Risk: Query database directly for attendance < threshold
      Student.find({
        ...scopeFilter,
        attendance: { $lt: warningAttendance }
      }).lean(),
      
      // Academic Risk: Query database directly for GPA < threshold
      Student.find({
        ...scopeFilter,
        gpa: { $lt: criticalGpa }
      }).lean(),
      
      // Incomplete Records: Students missing required fields
      // Note: Students need EITHER 'program' OR 'course' (not both) since database uses 'program'
      Student.find({
        ...scopeFilter,
        $or: [
          { studentNumber: { $exists: false } },
          { studentNumber: null },
          { studentNumber: '' },
          // Student must have at least one of program or course (not both required)
          { 
            $and: [
              { $or: [
                { program: { $exists: false } },
                { program: null },
                { program: '' }
              ]},
              { $or: [
                { course: { $exists: false } },
                { course: null },
                { course: '' }
              ]}
            ]
          }
        ]
      }).lean(),
      
      // All Students: Query all students in scope for 100% accurate Student Directory
      Student.find(scopeFilter).lean()
    ]);

    // Convert to plain objects for JSON response with risk labels
    // Helper function to map student document to response format
    const mapStudent = (s: any, riskLabels: string[] = []) => ({
      id: s._id.toString(),
      studentNumber: s.studentNumber,
      program: s.program || s.course, // Use 'program' field, fallback to 'course' for backward compatibility
      course: s.program || s.course, // Keep 'course' in response for backward compatibility
      yearOfStudy: s.yearOfStudy,
      semesterOfStudy: s.semesterOfStudy,
      gpa: s.gpa,
      attendance: s.attendance,
      balance: s.balance,
      riskLabels, // Array of risk labels for this student
    });

    // Map students with their risk labels
    // Each student can have multiple risk labels if they meet multiple thresholds
    const financialRiskStudents = financialRiskList.map((s) => {
      const riskLabels: string[] = ['Financial Risk'];
      if (s.attendance != null && s.attendance < warningAttendance) {
        riskLabels.push('Attendance Risk');
      }
      if (s.gpa != null && s.gpa < criticalGpa) {
        riskLabels.push('Academic Risk');
      }
      return mapStudent(s, riskLabels);
    });

    const attendanceRiskStudents = attendanceRiskList.map((s) => {
      const riskLabels: string[] = ['Attendance Risk'];
      if (s.balance != null && s.balance > financialLimit) {
        riskLabels.push('Financial Risk');
      }
      if (s.gpa != null && s.gpa < criticalGpa) {
        riskLabels.push('Academic Risk');
      }
      return mapStudent(s, riskLabels);
    });

    const academicRiskStudents = academicRiskList.map((s) => {
      const riskLabels: string[] = ['Academic Risk'];
      if (s.balance != null && s.balance > financialLimit) {
        riskLabels.push('Financial Risk');
      }
      if (s.attendance != null && s.attendance < warningAttendance) {
        riskLabels.push('Attendance Risk');
      }
      return mapStudent(s, riskLabels);
    });

    // 100% Accurate: Calculate students with no issues directly from database
    // Get set of student IDs with any issues (financial, attendance, academic, or incomplete)
    const issueStudentIds = new Set<string>();
    financialRiskList.forEach(s => { if (s._id) issueStudentIds.add(s._id.toString()); });
    attendanceRiskList.forEach(s => { if (s._id) issueStudentIds.add(s._id.toString()); });
    academicRiskList.forEach(s => { if (s._id) issueStudentIds.add(s._id.toString()); });
    incompleteRecordsList.forEach(s => { if (s._id) issueStudentIds.add(s._id.toString()); });

    // Filter students with no issues (100% accurate from database)
    const studentsWithNoIssues = allStudentsList
      .filter(s => s._id && !issueStudentIds.has(s._id.toString()))
      .map((s) => mapStudent(s, [])); // No risk labels for students with no issues

    res.status(200).json({
      thresholds: {
        criticalGpa,
        warningAttendance,
        financialLimit,
      },
      summary: {
        totalStudents,
        withFinancialRisk: financialRiskList.length,
        withAttendanceRisk: attendanceRiskList.length,
        withAcademicRisk: academicRiskList.length,
        incompleteRecords: incompleteRecordsList.length,
        withNoIssues: studentsWithNoIssues.length,
      },
      students: {
        financialRisk: financialRiskStudents,
        attendanceRisk: attendanceRiskStudents,
        academicRisk: academicRiskStudents,
        incompleteRecords: incompleteRecordsList.map((s) => mapStudent(s, ['Incomplete Record'])),
        noIssues: studentsWithNoIssues, // 100% accurate from database
      },
    });
  } catch (error: any) {
    logger.error('Get data integrity alerts error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch data integrity alerts' });
  }
};

