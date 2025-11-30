const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_db';

const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'];

const seedUsers = [
  {
    name: 'John Manager',
    email: 'manager@company.com',
    password: 'manager123',
    role: 'manager',
    employeeId: 'MGR001',
    department: 'Management'
  },
  {
    name: 'Alice Johnson',
    email: 'alice@company.com',
    password: 'employee123',
    role: 'employee',
    employeeId: 'EMP001',
    department: 'Engineering'
  },
  {
    name: 'Bob Smith',
    email: 'bob@company.com',
    password: 'employee123',
    role: 'employee',
    employeeId: 'EMP002',
    department: 'Engineering'
  },
  {
    name: 'Carol White',
    email: 'carol@company.com',
    password: 'employee123',
    role: 'employee',
    employeeId: 'EMP003',
    department: 'Sales'
  },
  {
    name: 'David Brown',
    email: 'david@company.com',
    password: 'employee123',
    role: 'employee',
    employeeId: 'EMP004',
    department: 'Marketing'
  },
  {
    name: 'Eva Davis',
    email: 'eva@company.com',
    password: 'employee123',
    role: 'employee',
    employeeId: 'EMP005',
    department: 'HR'
  }
];

const seedAttendance = async (users) => {
  const today = new Date();
  const employeeUsers = users.filter(u => u.role === 'employee');
  
  // Generate attendance for last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    for (const user of employeeUsers) {
      // Skip weekends randomly (70% chance of working)
      if (date.getDay() === 0 || date.getDay() === 6) {
        if (Math.random() > 0.3) continue;
      }
      
      // 85% chance of present, 10% absent, 5% late
      const rand = Math.random();
      let status = 'present';
      if (rand < 0.1) {
        status = 'absent';
      } else if (rand < 0.15) {
        status = 'late';
      }
      
      if (status === 'absent') {
        // Create absent record
        await Attendance.create({
          userId: user._id,
          date: new Date(date),
          status: 'absent'
        });
      } else {
        // Create present/late record with check in/out
        const checkInHour = status === 'late' ? 10 : 9;
        const checkInMin = status === 'late' ? Math.floor(Math.random() * 30) : Math.floor(Math.random() * 30);
        const checkInTime = new Date(date);
        checkInTime.setHours(checkInHour, checkInMin, 0, 0);
        
        // Check out between 5 PM and 6 PM
        const checkOutHour = 17;
        const checkOutMin = Math.floor(Math.random() * 60);
        const checkOutTime = new Date(date);
        checkOutTime.setHours(checkOutHour, checkOutMin, 0, 0);
        
        const totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        
        await Attendance.create({
          userId: user._id,
          date: new Date(date),
          checkInTime,
          checkOutTime,
          status,
          totalHours: Math.round(totalHours * 100) / 100
        });
      }
    }
  }
};

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Attendance.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of seedUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`Created user: ${user.name} (${user.employeeId})`);
    }

    // Create attendance records
    console.log('Creating attendance records...');
    await seedAttendance(createdUsers);
    console.log('Attendance records created');

    console.log('Seed data created successfully!');
    console.log('\nLogin credentials:');
    console.log('Manager: manager@company.com / manager123');
    console.log('Employee: alice@company.com / employee123');
    
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
