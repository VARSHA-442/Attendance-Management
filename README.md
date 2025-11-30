# Employee Attendance Management System

A full-stack Attendance Management System where:

- **Employees** can register, log in, check in, check out, and view attendance history.
- **Managers** can view and manage team attendance.


---

## 🛠 Tech Stack

**Frontend:** React (Vite) + Zustand / Redux Toolkit  
**Backend:** Node.js + Express  
**Database:** MongoDB / PostgreSQL (depending on your setup)

---

## 🔧 Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/VARSHA-442/Attendance-Management.git
cd Attendance-Management/Attendance\ Management
2️⃣ Install Dependencies
Backend
bash
Copy code
cd server
npm install
Frontend
bash
Copy code
cd ../client
npm install
⚙️ Environment Variables
🔹 Backend → server/.env
env
Copy code
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/attendance_db
# or PostgreSQL
# DATABASE_URL=postgres://user:password@localhost:5432/attendance_db

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# CORS
CLIENT_URL=http://localhost:5173
🔹 Frontend → client/.env
env
Copy code
VITE_API_BASE_URL=http://localhost:5000/api
▶️ How to Run the Project
🖥️ Start Backend
bash
Copy code
cd server
npm run dev
# or
npm start
Runs on: http://localhost:5000

🖼️ Start Frontend
bash
Copy code
cd client
npm run dev
Runs on: http://localhost:5173

🎥 Screen Recording Demo
I have a screen-recorded video of the full project.

After uploading your video to GitHub / Drive / YouTube, replace this link:

css
Copy code
📽️ Demo Video: https://drive.google.com/file/d/1l9vHqxmKP9EN3vORMpyt8KXlpnJNjxlp/view?usp=sharing
🚀 Features
Employee
Register/Login

Check-In & Check-Out

View attendance history (table/calendar)

Manager
View team attendance

Filter by date & employee

Manage attendance records

📌 Future Enhancements
Export attendance to Excel/CSV

Manager dashboard analytics

Auto-detect late arrivals

Email notifications

🤝 Contributing
Pull requests and suggestions are welcome!
