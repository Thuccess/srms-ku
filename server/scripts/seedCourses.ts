import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Department from '../src/models/Department.js';
import Course from '../src/models/Course.js';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/student-risk-system';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const courses = [
  // Computer Science Department
  { code: 'CS101', name: 'Introduction to Computer Science', deptCode: 'CS', credits: 3 },
  { code: 'CS102', name: 'Programming Fundamentals', deptCode: 'CS', credits: 4 },
  { code: 'CS201', name: 'Data Structures and Algorithms', deptCode: 'CS', credits: 4 },
  { code: 'CS202', name: 'Database Systems', deptCode: 'CS', credits: 3 },
  { code: 'CS301', name: 'Software Engineering', deptCode: 'CS', credits: 4 },
  { code: 'CS302', name: 'Computer Networks', deptCode: 'CS', credits: 3 },
  
  // Information Technology Department
  { code: 'IT101', name: 'Introduction to Information Technology', deptCode: 'IT', credits: 3 },
  { code: 'IT102', name: 'Web Development', deptCode: 'IT', credits: 4 },
  { code: 'IT201', name: 'System Analysis and Design', deptCode: 'IT', credits: 3 },
  { code: 'IT202', name: 'Network Administration', deptCode: 'IT', credits: 4 },
  
  // Business Administration Department
  { code: 'BA101', name: 'Introduction to Business', deptCode: 'BA', credits: 3 },
  { code: 'BA102', name: 'Business Communication', deptCode: 'BA', credits: 2 },
  { code: 'BA201', name: 'Organizational Behavior', deptCode: 'BA', credits: 3 },
  { code: 'BA202', name: 'Business Ethics', deptCode: 'BA', credits: 2 },
  
  // Accounting Department
  { code: 'ACC101', name: 'Principles of Accounting', deptCode: 'ACC', credits: 4 },
  { code: 'ACC102', name: 'Financial Accounting', deptCode: 'ACC', credits: 4 },
  { code: 'ACC201', name: 'Managerial Accounting', deptCode: 'ACC', credits: 3 },
  { code: 'ACC202', name: 'Auditing', deptCode: 'ACC', credits: 3 },
  
  // Education Department
  { code: 'EDU101', name: 'Introduction to Education', deptCode: 'EDU', credits: 3 },
  { code: 'EDU102', name: 'Educational Psychology', deptCode: 'EDU', credits: 3 },
  { code: 'EDU201', name: 'Curriculum Development', deptCode: 'EDU', credits: 3 },
  
  // Law Department
  { code: 'LAW101', name: 'Introduction to Law', deptCode: 'LAW', credits: 4 },
  { code: 'LAW102', name: 'Constitutional Law', deptCode: 'LAW', credits: 4 },
  { code: 'LAW201', name: 'Contract Law', deptCode: 'LAW', credits: 3 },
  
  // Nursing Department
  { code: 'NUR101', name: 'Introduction to Nursing', deptCode: 'NUR', credits: 4 },
  { code: 'NUR102', name: 'Anatomy and Physiology', deptCode: 'NUR', credits: 4 },
  { code: 'NUR201', name: 'Medical-Surgical Nursing', deptCode: 'NUR', credits: 5 },
];

const seedCourses = async (): Promise<void> => {
  try {
    await connectDB();

    console.log('🌱 Seeding Courses...');

    // First, get all departments to map codes to IDs
    const departments = await Department.find({ isActive: true });
    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    departments.forEach(dept => {
      deptMap.set(dept.code, dept._id);
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const courseData of courses) {
      const departmentId = deptMap.get(courseData.deptCode);
      
      if (!departmentId) {
        console.log(`  ⚠️  Skipped: ${courseData.code} - Department ${courseData.deptCode} not found`);
        skipped++;
        continue;
      }

      const { deptCode, ...courseFields } = courseData;
      const result = await Course.findOneAndUpdate(
        { code: courseData.code },
        { 
          ...courseFields,
          departmentId,
          isActive: true 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (result.isNew) {
        created++;
        console.log(`  ✅ Created: ${courseData.code} - ${courseData.name} (${courseData.deptCode})`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${courseData.code} - ${courseData.name} (${courseData.deptCode})`);
      }
    }

    console.log(`\n📊 Course Seeding Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${courses.length}`);

    await mongoose.connection.close();
    console.log('✅ Seeding completed. Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding courses:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedCourses();

