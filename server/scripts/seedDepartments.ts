import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Faculty from '../src/models/Faculty.js';
import Department from '../src/models/Department.js';

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

const departments = [
  // Faculty of Science and Technology
  { code: 'CS', name: 'Computer Science', facultyCode: 'FST' },
  { code: 'IT', name: 'Information Technology', facultyCode: 'FST' },
  { code: 'SE', name: 'Software Engineering', facultyCode: 'FST' },
  { code: 'NET', name: 'Networking and Systems', facultyCode: 'FST' },
  
  // Faculty of Business Administration
  { code: 'BA', name: 'Business Administration', facultyCode: 'FBA' },
  { code: 'ACC', name: 'Accounting', facultyCode: 'FBA' },
  { code: 'FIN', name: 'Finance', facultyCode: 'FBA' },
  { code: 'MGT', name: 'Management', facultyCode: 'FBA' },
  { code: 'MKT', name: 'Marketing', facultyCode: 'FBA' },
  
  // Faculty of Education
  { code: 'EDU', name: 'Education', facultyCode: 'FED' },
  { code: 'PED', name: 'Physical Education', facultyCode: 'FED' },
  
  // Faculty of Law
  { code: 'LAW', name: 'Law', facultyCode: 'FLAW' },
  
  // Faculty of Health Sciences
  { code: 'NUR', name: 'Nursing', facultyCode: 'FHS' },
  { code: 'PH', name: 'Public Health', facultyCode: 'FHS' },
  
  // Faculty of Social Sciences
  { code: 'SW', name: 'Social Work', facultyCode: 'FSS' },
  { code: 'PSY', name: 'Psychology', facultyCode: 'FSS' },
];

const seedDepartments = async (): Promise<void> => {
  try {
    await connectDB();

    console.log('🌱 Seeding Departments...');

    // First, get all faculties to map codes to IDs
    const faculties = await Faculty.find({ isActive: true });
    const facultyMap = new Map<string, mongoose.Types.ObjectId>();
    faculties.forEach(faculty => {
      facultyMap.set(faculty.code, faculty._id);
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const deptData of departments) {
      const facultyId = facultyMap.get(deptData.facultyCode);
      
      if (!facultyId) {
        console.log(`  ⚠️  Skipped: ${deptData.code} - Faculty ${deptData.facultyCode} not found`);
        skipped++;
        continue;
      }

      const result = await Department.findOneAndUpdate(
        { code: deptData.code },
        { 
          ...deptData,
          facultyId,
          isActive: true 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (result.isNew) {
        created++;
        console.log(`  ✅ Created: ${deptData.code} - ${deptData.name} (${deptData.facultyCode})`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${deptData.code} - ${deptData.name} (${deptData.facultyCode})`);
      }
    }

    console.log(`\n📊 Department Seeding Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${departments.length}`);

    await mongoose.connection.close();
    console.log('✅ Seeding completed. Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding departments:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDepartments();

