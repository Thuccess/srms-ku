/**
 * PDF Parser Service
 * Extracts student data from PDF class lists and converts to CSV format
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // Use unpkg CDN for worker (more reliable)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface ParsedStudent {
  studentNumber: string;
  course: string;
  yearOfStudy: number;
  semesterOfStudy: '1' | '2';
  gpa: number;
  attendance: number;
  balance: number;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF. The file may be corrupted or password-protected.');
  }
}

/**
 * Parse student data from extracted text
 * Handles various PDF formats and structures
 */
function parseStudentData(text: string): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return students;
  }
  
  // Common patterns for student data
  // Pattern 1: Table format with columns
  // Pattern 2: Line-by-line format
  // Pattern 3: Structured blocks
  
  // Look for header row to understand structure
  let headerIndex = -1;
  let studentNumberIndex = -1;
  let courseIndex = -1;
  let yearIndex = -1;
  let semesterIndex = -1;
  let gpaIndex = -1;
  let attendanceIndex = -1;
  let balanceIndex = -1;
  
  // Find header row - look for common header patterns
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i].toLowerCase();
    // Check for header indicators
    if ((line.includes('student') && (line.includes('number') || line.includes('id') || line.includes('no'))) ||
        (line.includes('reg') && line.includes('no')) ||
        (line.includes('s/n') || line.includes('sn'))) {
      headerIndex = i;
      // Try different splitting methods
      const headersBySpace = lines[i].split(/\s+/);
      const headersByTab = lines[i].split(/\t/);
      const headers = headersByTab.length > headersBySpace.length ? headersByTab : headersBySpace;
      
      headers.forEach((header, idx) => {
        const h = header.toLowerCase().trim();
        if ((h.includes('student') && (h.includes('number') || h.includes('id') || h.includes('no'))) ||
            h.includes('reg') && h.includes('no') ||
            h === 's/n' || h === 'sn') {
          studentNumberIndex = idx;
        } else if (h.includes('course') || h.includes('program') || h.includes('department')) {
          courseIndex = idx;
        } else if (h.includes('year') && !h.includes('semester')) {
          yearIndex = idx;
        } else if (h.includes('semester') || h === 'sem') {
          semesterIndex = idx;
        } else if (h.includes('gpa') || h.includes('grade') || h.includes('cgpa')) {
          gpaIndex = idx;
        } else if (h.includes('attendance') || h.includes('attend') || h.includes('att')) {
          attendanceIndex = idx;
        } else if (h.includes('balance') || h.includes('fee') || h.includes('tuition') || h.includes('amount')) {
          balanceIndex = idx;
        }
      });
      break;
    }
  }
  
  // If header found, parse as table
  if (headerIndex >= 0) {
    // Determine delimiter (tab or space)
    const headerLine = lines[headerIndex];
    const useTabDelimiter = headerLine.includes('\t') || headerLine.split('\t').length > headerLine.split(/\s+/).length;
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 5) continue;
      
      // Split by delimiter
      const parts = useTabDelimiter 
        ? line.split(/\t/).map(p => p.trim()).filter(p => p.length > 0)
        : line.split(/\s{2,}|\s+/).map(p => p.trim()).filter(p => p.length > 0);
      
      if (parts.length < 2) continue;
      
      // Try to extract student number (common patterns)
      let studentNumber = '';
      let course = '';
      let year = 1;
      let semester: '1' | '2' = '1';
      let gpa = 0;
      let attendance = 0;
      let balance = 0;
      
      // Extract student number from index or by pattern
      if (studentNumberIndex >= 0 && parts[studentNumberIndex]) {
        studentNumber = parts[studentNumberIndex].replace(/[^\w\d]/g, '');
      } else {
        // Try to find by pattern
        for (const part of parts) {
          // Pattern: YYYY/XXX/DDDD, YYYY-XXX-DDDD, or alphanumeric codes
          if (/\d{4,}[\/\-]\w+[\/\-]\d+/.test(part) || 
              /[A-Z]{2,}\d{4,}/i.test(part) || 
              /\d{6,}/.test(part) ||
              /\d{4,}[A-Z]+\d+/.test(part)) {
            studentNumber = part.replace(/[^\w\d]/g, '');
            break;
          }
        }
      }
      
      // If no student number found, skip
      if (!studentNumber || studentNumber.length < 4) continue;
      
      // Extract other fields based on indices or patterns
      if (courseIndex >= 0 && courseIndex < parts.length && parts[courseIndex]) {
        course = parts[courseIndex].trim();
      } else {
        // Try to find course name (usually text, not numbers, after student number)
        const studentNumIdx = parts.findIndex(p => p.replace(/[^\w\d]/g, '') === studentNumber);
        if (studentNumIdx >= 0 && studentNumIdx + 1 < parts.length) {
          // Course is usually right after student number
          for (let j = studentNumIdx + 1; j < parts.length; j++) {
            const part = parts[j].trim();
            if (part.length > 2 && !/^\d+\.?\d*$/.test(part) && 
                !part.match(/^[12]$/) && // Not semester
                !part.match(/^[1-5]$/)) { // Not year
              course = part;
              break;
            }
          }
        }
      }
      
      // Default course if not found
      if (!course || course.length < 2) {
        course = 'Unknown';
      }
      
      if (yearIndex >= 0 && yearIndex < parts.length && parts[yearIndex]) {
        const yearVal = parseInt(parts[yearIndex]);
        if (!isNaN(yearVal) && yearVal >= 1 && yearVal <= 5) {
          year = yearVal;
        }
      } else {
        // Try to find year in the line
        for (const part of parts) {
          const yearVal = parseInt(part);
          if (!isNaN(yearVal) && yearVal >= 1 && yearVal <= 5) {
            year = yearVal;
            break;
          }
        }
      }
      
      if (semesterIndex >= 0 && semesterIndex < parts.length && parts[semesterIndex]) {
        const sem = parts[semesterIndex].trim();
        semester = (sem === '2' || sem === 'II' || sem === 'Second' || sem === '2nd') ? '2' : '1';
      } else {
        // Try to find semester
        for (const part of parts) {
          if (part === '2' || part === 'II' || part === 'Second' || part === '2nd') {
            semester = '2';
            break;
          } else if (part === '1' || part === 'I' || part === 'First' || part === '1st') {
            semester = '1';
            break;
          }
        }
      }
      
      if (gpaIndex >= 0 && gpaIndex < parts.length && parts[gpaIndex]) {
        const gpaVal = parseFloat(parts[gpaIndex]);
        if (!isNaN(gpaVal) && gpaVal >= 0 && gpaVal <= 5) {
          gpa = gpaVal;
        }
      }
      
      if (attendanceIndex >= 0 && attendanceIndex < parts.length && parts[attendanceIndex]) {
        const attVal = parseFloat(parts[attendanceIndex]);
        if (!isNaN(attVal) && attVal >= 0 && attVal <= 100) {
          attendance = attVal;
        }
      }
      
      if (balanceIndex >= 0 && balanceIndex < parts.length && parts[balanceIndex]) {
        const balVal = parseFloat(parts[balanceIndex].replace(/[^\d.]/g, ''));
        if (!isNaN(balVal)) {
          balance = balVal;
        }
      }
      
      // Only add if we have minimum required data
      if (studentNumber && course) {
        students.push({
          studentNumber,
          course,
          yearOfStudy: year,
          semesterOfStudy: semester,
          gpa,
          attendance,
          balance,
        });
      }
    }
  } else {
    // No header found - try line-by-line parsing
    // Look for patterns like: "STUDENT_NUMBER Course Year Semester GPA Attendance Balance"
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 10) continue;
      
      // Try to find student number pattern
      const studentNumberMatch = trimmed.match(/\b(\d{4,}\/\w+\/\d+|[A-Z]{2,}\d{4,}|\d{6,})\b/i);
      if (!studentNumberMatch) continue;
      
      const studentNumber = studentNumberMatch[1].replace(/[^\w\d]/g, '');
      const parts = trimmed.split(/\s+/);
      
      // Try to extract other fields
      let course = '';
      let year = 1;
      let semester: '1' | '2' = '1';
      let gpa = 0;
      let attendance = 0;
      let balance = 0;
      
      // Find course (usually after student number)
      const studentNumIndex = parts.findIndex(p => p.includes(studentNumber));
      if (studentNumIndex >= 0 && parts[studentNumIndex + 1]) {
        course = parts[studentNumIndex + 1];
      }
      
      // Find numeric values
      for (const part of parts) {
        const num = parseFloat(part);
        if (isNaN(num)) continue;
        
        // Year (1-5)
        if (num >= 1 && num <= 5 && year === 1) {
          year = Math.floor(num);
        }
        // Semester (1 or 2)
        else if ((num === 1 || num === 2) && semester === '1') {
          semester = num === 2 ? '2' : '1';
        }
        // GPA (0-5)
        else if (num >= 0 && num <= 5 && gpa === 0) {
          gpa = num;
        }
        // Attendance (0-100)
        else if (num >= 0 && num <= 100 && attendance === 0) {
          attendance = num;
        }
        // Balance (large numbers)
        else if (num > 1000 && balance === 0) {
          balance = num;
        }
      }
      
      if (studentNumber && course) {
        students.push({
          studentNumber,
          course,
          yearOfStudy: year,
          semesterOfStudy: semester,
          gpa,
          attendance,
          balance,
        });
      }
    }
  }
  
  return students;
}

/**
 * Convert parsed students to CSV format
 */
function studentsToCsv(students: ParsedStudent[]): string {
  const headers = [
    'Student Number',
    'Course',
    'Year of Study',
    'Semester of Study',
    'GPA',
    'Attendance',
    'Balance',
  ];
  
  const rows = students.map(s => [
    s.studentNumber,
    s.course,
    s.yearOfStudy.toString(),
    s.semesterOfStudy,
    s.gpa.toString(),
    s.attendance.toString(),
    s.balance.toString(),
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.map(field => {
      // Escape fields containing commas or quotes
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    }).join(','))
  ].join('\n');
}

/**
 * Main function to process PDF and extract student data
 */
export async function processPdfFile(file: File): Promise<string> {
  try {
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('PDF file size exceeds 10MB limit');
    }
    
    // Extract text from PDF
    const text = await extractTextFromPdf(file);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF. The file may be image-based or corrupted.');
    }
    
    // Parse student data
    const students = parseStudentData(text);
    
    if (students.length === 0) {
      throw new Error('No student data could be extracted from the PDF. Please ensure the PDF contains a class list with student numbers and courses.');
    }
    
    // Convert to CSV
    const csvContent = studentsToCsv(students);
    
    return csvContent;
  } catch (error: any) {
    console.error('PDF processing error:', error);
    throw error;
  }
}

