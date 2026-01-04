import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Faculty from '../src/models/Faculty.js';

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

const faculties = [
  {
    code: 'FST',
    name: 'Faculty of Science and Technology',
    description: 'Offers programs in Computer Science, Information Technology, and related fields',
  },
  {
    code: 'FBA',
    name: 'Faculty of Business Administration',
    description: 'Offers programs in Business Administration, Accounting, Finance, and Management',
  },
  {
    code: 'FED',
    name: 'Faculty of Education',
    description: 'Offers programs in Education, Teaching, and Educational Administration',
  },
  {
    code: 'FLAW',
    name: 'Faculty of Law',
    description: 'Offers programs in Law and Legal Studies',
  },
  {
    code: 'FHS',
    name: 'Faculty of Health Sciences',
    description: 'Offers programs in Nursing, Public Health, and Health Administration',
  },
  {
    code: 'FSS',
    name: 'Faculty of Social Sciences',
    description: 'Offers programs in Social Work, Psychology, and Sociology',
  },
];

const seedFaculties = async (): Promise<void> => {
  try {
    await connectDB();

    console.log('🌱 Seeding Faculties...');

    let created = 0;
    let updated = 0;

    for (const facultyData of faculties) {
      const result = await Faculty.findOneAndUpdate(
        { code: facultyData.code },
        { ...facultyData, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (result.isNew) {
        created++;
        console.log(`  ✅ Created: ${facultyData.code} - ${facultyData.name}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${facultyData.code} - ${facultyData.name}`);
      }
    }

    console.log(`\n📊 Faculty Seeding Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total: ${faculties.length}`);

    await mongoose.connection.close();
    console.log('✅ Seeding completed. Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding faculties:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedFaculties();

