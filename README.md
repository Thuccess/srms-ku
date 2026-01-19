# srms

# Student Risk Prediction System

A full-stack MERN application for predicting and managing student dropout risk at Kampala University. This system uses rules-based risk scoring with AI-assisted explanations and recommendations.

## 🎯 Features

- **Rules-Based Risk Scoring**: Deterministic risk calculation based on GPA, attendance, financial status, and academic year
- **AI-Assisted Insights**: OpenAI-powered explanations and intervention recommendations (optional)
- **Real-time Dashboard**: Executive dashboard with risk analytics, charts, and live alerts
- **Student Management**: CRUD operations for student records with comprehensive profiles
- **Intervention Tracking**: Track counseling sessions, academic support, and outcomes
- **Risk Profiling**: Categorizes students into LOW, MEDIUM, and HIGH risk levels
- **Historical Trends**: View longitudinal data and retention metrics
- **Cost-Effective AI**: Cached AI responses and on-demand generation to minimize API costs

## 🛠 Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **Recharts** for data visualization
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **OpenAI API** (GPT-4o-mini) for AI explanations and recommendations
- **CORS** enabled for cross-origin requests
- **dotenv** for environment configuration
- **Socket.io** for real-time updates

### AI Integration
- **OpenAI GPT-4o-mini** for cost-efficient AI explanations
- **Rules-Based Scoring**: Risk scores calculated deterministically (no AI for numeric prediction)
- **AI Caching**: MongoDB-based caching to reduce API costs
- **Fallback Support**: System works without OpenAI API key (uses rule-based fallbacks)

## 📁 Project Structure

```
student-risk-system/
├── client/                 # React frontend
│   ├── components/         # React components
│   ├── services/          # API service layer
│   ├── types.ts           # TypeScript type definitions
│   └── constants.ts       # Mock data and constants
│
├── server/                # Express backend (Node.js + TypeScript)
│   ├── src/
│   │   ├── app.ts        # Express app configuration
│   │   ├── index.ts      # Server entry point
│   │   ├── config/       # Database configuration
│   │   ├── services/     # Business logic services
│   │   │   ├── riskScoring.service.ts  # Rules-based risk calculation
│   │   │   └── openai.service.ts       # OpenAI integration
│   │   ├── models/       # Mongoose schemas
│   │   │   └── AICache.ts # AI response caching
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, RBAC middleware
│   │   └── socket/       # Socket.io real-time handlers
│   └── env.example       # Environment variables template
```

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local or Atlas)
- **OpenAI API Key** (optional, for AI explanations)

### 1. Clone Repository

```bash
git clone <repository-url>
cd student-risk-system
```

### 2. Setup Backend (Server)

```bash
cd server
npm install
```

Create `.env` file in `server/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/student-risk-system
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here
```

For MongoDB Atlas, use:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/student-risk-system
```

**Note**: `OPENAI_API_KEY` is optional. If not provided, the system will use fallback explanations. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys).

### 3. Setup Frontend (Client)

```bash
cd client
npm install
```

Create `.env.local` file in `client/` directory (optional):

```env
VITE_API_URL=http://localhost:5000/api
```

## ▶️ Running the Application

You need to run the backend and frontend services (MongoDB must be running).

### Terminal 1: Start MongoDB

If using local MongoDB:

```bash
mongod
```

Or ensure MongoDB Atlas connection is configured.

### Terminal 2: Start Backend Server

```bash
cd server
npm run dev
```

Server will run on **http://localhost:5000**

### Terminal 3: Start Frontend Client

```bash
cd client
npm run dev
```

Client will run on **http://localhost:3000**

## 🔑 API Endpoints

### Student Routes
- `GET /api/students` - Get all students
- `POST /api/students` - Create new student
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Risk Prediction
- `POST /api/risk/predict-risk` - Calculate risk score and optionally generate AI explanations
  - Body: `{ studentId, gpa, attendanceRate, year, tuitionBalance?, financialStatus?, includeAI?: boolean }`
  - Returns: `{ riskScore, riskLevel, riskFactors, explanation?, recommendedActions?, aiGenerated? }`

## 📊 Sample Student Data

The system includes mock data for testing. Sample students with various risk profiles are available in `client/constants.ts`.

## 🧪 Testing the System

1. Navigate to **http://localhost:3000**
2. Login with any credentials (mock authentication)
3. View the dashboard with risk analytics
4. Navigate to Students page to manage records
5. Test risk prediction by updating student data

## 🔧 Development

### Backend Development
```bash
cd server
npm run dev  # Uses ts-node-dev for hot reload
```

### Frontend Development
```bash
cd client
npm run dev  # Vite hot reload
```

### Build for Production

**Backend:**
```bash
cd server
npm run build
npm start
```

**Frontend:**
```bash
cd client
npm run build
npm run preview
```

## 📝 Environment Variables

### Server (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGO_URI | MongoDB connection string | - |
| JWT_SECRET | JWT signing secret | - |
| OPENAI_API_KEY | OpenAI API key (optional) | - |

### Client (.env.local)
| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000/api |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 🔐 Role-Based Access Control (RBAC)

The system implements comprehensive role-based access control to ensure data privacy and appropriate access levels for different university stakeholders.

### User Roles and Access Levels

#### 1. Executive Leadership (Aggregated Data Only)
- **VC (Vice Chancellor)**: University-wide aggregated analytics only; **NO individual student data access**
- **DVC_ACADEMIC (Deputy Vice Chancellor - Academic)**: University-wide + faculty-level summaries; **NO individual student identities**

#### 2. Academic Leadership (Scoped Access)
- **DEAN**: Faculty-scoped access; can view aggregated and program-level risk data; **CAN view individual students within their faculty**
- **HOD (Head of Department)**: Department-scoped access; **CAN view individual students in their department**

#### 3. Student Support Staff
- **ADVISOR**: Assigned students ONLY; full access to assigned students

#### 4. Teaching Staff
- **LECTURER**: Course-scoped access ONLY; risk indicators for enrolled students in their assigned courses

#### 5. Administrative Staff
- **REGISTRY**: Academic data integrity dashboards; can view all students; **NO AI risk scores unless explicitly enabled in system settings**

#### 6. Technical Staff
- **IT_ADMIN**: System-level access ONLY; **NO academic or student data**

### Access Control Principles

1. **Role-Based Scoping**: Users see data based on their role and organizational scope (faculty, department, courses, or assigned students)
2. **Privacy Protection**: VC and DVC see only aggregated analytics, not individual student identities
3. **Least Privilege**: Each role has access only to what is needed for their responsibilities
4. **Backend Enforcement**: Access control is enforced at the API level; frontend checks are for UX only
5. **Fail Closed**: Unknown roles get no access by default

### Data Scoping Mechanisms

Users must have appropriate scoping fields configured:
- `facultyId` for DEAN, HOD, LECTURER
- `departmentId` for HOD, LECTURER
- `assignedCourses[]` for LECTURER
- `assignedStudents[]` for ADVISOR

### System Settings

The system includes configurable settings:
- **Risk Assessment Thresholds**: GPA, attendance, and financial limits
- **Registry AI Risk Score Visibility**: Control whether REGISTRY users can view AI risk scores (default: disabled)
- **Notification Preferences**: Email, SMS, and daily digest settings

### Creating Users with Scoping

When creating users, ensure appropriate scoping fields are assigned:

```javascript
// Example: Create a DEAN user
{
  email: "dean@university.edu",
  password: "securepassword",
  fullName: "Dr. John Doe",
  role: "DEAN",
  facultyId: "faculty-object-id" // Required for DEAN
}

// Example: Create an ADVISOR user
{
  email: "advisor@university.edu",
  password: "securepassword",
  fullName: "Jane Smith",
  role: "ADVISOR",
  assignedStudents: ["student-id-1", "student-id-2"] // Required for ADVISOR
}
```

## 📄 License

This project is licensed under the ISC License.

## 👥 Authors

Kampala University - AI Risk Assessment Team

## 🆘 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network access if using MongoDB Atlas

### OpenAI API Issues
- Verify `OPENAI_API_KEY` is set in server `.env`
- Check API key validity and account credits
- System will use fallback explanations if API is unavailable
- Review rate limits if experiencing errors

### CORS Issues
- Verify CORS is enabled in `server/src/app.ts`
- Check API_URL in client environment variables

### Port Already in Use
- Change PORT in server `.env` file
- Kill existing process: `lsof -ti:5000 | xargs kill -9` (Unix)

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.

