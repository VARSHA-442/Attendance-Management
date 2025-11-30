const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { auth, isManager } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Helper function to get start and end of day
const getDayBounds = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(d);
  d.setHours(23, 59, 59, 999);
  const end = new Date(d);
  return { start, end };
};

// Helper function to calculate hours
const calculateHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const diff = checkOut - checkIn;
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
};

// @route   POST /api/attendance/checkin
// @desc    Employee check in
// @access  Private (Employee)
router.post('/checkin', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const { start, end } = getDayBounds(today);

    // Check if already checked in today
    let attendance = await Attendance.findOne({
      userId,
      date: { $gte: start, $lte: end }
    });

    if (attendance && attendance.checkInTime) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const checkInTime = new Date();
    const hours = checkInTime.getHours();
    const minutes = checkInTime.getMinutes();
    
    // Determine status (late if after 9:30 AM)
    let status = 'present';
    if (hours > 9 || (hours === 9 && minutes > 30)) {
      status = 'late';
    }

    if (attendance) {
      attendance.checkInTime = checkInTime;
      attendance.status = status;
      await attendance.save();
    } else {
      attendance = new Attendance({
        userId,
        date: today,
        checkInTime,
        status
      });
      await attendance.save();
    }

    res.json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkInTime,
        status: attendance.status
      }
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/attendance/checkout
// @desc    Employee check out
// @access  Private (Employee)
router.post('/checkout', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: start, $lte: end }
    });

    if (!attendance || !attendance.checkInTime) {
      return res.status(400).json({ message: 'Please check in first' });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    const checkOutTime = new Date();
    attendance.checkOutTime = checkOutTime;
    attendance.totalHours = calculateHours(attendance.checkInTime, checkOutTime);
    
    // Update status if half day (less than 4 hours)
    if (attendance.totalHours < 4) {
      attendance.status = 'half-day';
    }

    await attendance.save();

    res.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        checkOutTime: attendance.checkOutTime,
        totalHours: attendance.totalHours,
        status: attendance.status
      }
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/my-history
// @desc    Get employee's attendance history
// @access  Private (Employee)
router.get('/my-history', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;

    let query = { userId };
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(100);

    res.json(attendance);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/my-summary
// @desc    Get employee's monthly summary
// @access  Private (Employee)
router.get('/my-summary', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const attendance = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });

    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const halfDay = attendance.filter(a => a.status === 'half-day').length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    res.json({
      month: targetMonth,
      year: targetYear,
      present,
      absent,
      late,
      halfDay,
      totalHours: Math.round(totalHours * 100) / 100
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance status
// @access  Private (Employee)
router.get('/today', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: start, $lte: end }
    });

    if (!attendance) {
      return res.json({
        checkedIn: false,
        checkedOut: false,
        status: 'absent'
      });
    }

    res.json({
      checkedIn: !!attendance.checkInTime,
      checkedOut: !!attendance.checkOutTime,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      status: attendance.status,
      totalHours: attendance.totalHours
    });
  } catch (error) {
    console.error('Get today error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/all
// @desc    Get all employees attendance (Manager)
// @access  Private (Manager)
router.get('/all', auth, isManager, async (req, res) => {
  try {
    const { employeeId, date, status, month, year } = req.query;
    
    let query = {};
    
    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) {
        query.userId = user._id;
      } else {
        return res.json([]);
      }
    }

    if (date) {
      const { start, end } = getDayBounds(new Date(date));
      query.date = { $gte: start, $lte: end };
    } else if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    if (status) {
      query.status = status;
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 })
      .limit(500);

    res.json(attendance);
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/employee/:id
// @desc    Get specific employee attendance (Manager)
// @access  Private (Manager)
router.get('/employee/:id', auth, isManager, async (req, res) => {
  try {
    const userId = req.params.id;
    const { month, year } = req.query;

    let query = { userId };
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 });

    res.json(attendance);
  } catch (error) {
    console.error('Get employee attendance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/summary
// @desc    Get team attendance summary (Manager)
// @access  Private (Manager)
router.get('/summary', auth, isManager, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const attendance = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    }).populate('userId', 'name employeeId department');

    const summary = {
      month: targetMonth,
      year: targetYear,
      totalRecords: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      late: attendance.filter(a => a.status === 'late').length,
      halfDay: attendance.filter(a => a.status === 'half-day').length,
      totalHours: attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0),
      byDepartment: {},
      byEmployee: {}
    };

    // Group by department
    attendance.forEach(record => {
      const dept = record.userId?.department || 'Unknown';
      if (!summary.byDepartment[dept]) {
        summary.byDepartment[dept] = { present: 0, absent: 0, late: 0, halfDay: 0 };
      }
      summary.byDepartment[dept][record.status] = 
        (summary.byDepartment[dept][record.status] || 0) + 1;
    });

    // Group by employee
    attendance.forEach(record => {
      const empId = record.userId?.employeeId || 'Unknown';
      if (!summary.byEmployee[empId]) {
        summary.byEmployee[empId] = {
          name: record.userId?.name || 'Unknown',
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0
        };
      }
      summary.byEmployee[empId][record.status] = 
        (summary.byEmployee[empId][record.status] || 0) + 1;
    });

    res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/export
// @desc    Export attendance to CSV (Manager)
// @access  Private (Manager)
router.get('/export', auth, isManager, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    
    let query = {};
    
    if (employeeId) {
      const user = await User.findOne({ employeeId });
      if (user) {
        query.userId = user._id;
      } else {
        return res.status(404).json({ message: 'Employee not found' });
      }
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ date: -1 });

    if (attendance.length === 0) {
      return res.status(404).json({ message: 'No attendance records found' });
    }

    // Prepare CSV data
    const csvData = attendance.map(record => ({
      date: new Date(record.date).toLocaleDateString(),
      employeeId: record.userId?.employeeId || 'N/A',
      name: record.userId?.name || 'N/A',
      department: record.userId?.department || 'N/A',
      checkInTime: record.checkInTime ? new Date(record.checkInTime).toLocaleString() : 'N/A',
      checkOutTime: record.checkOutTime ? new Date(record.checkOutTime).toLocaleString() : 'N/A',
      status: record.status,
      totalHours: record.totalHours || 0
    }));

    const csvWriter = createCsvWriter({
      path: 'attendance_export.csv',
      header: [
        { id: 'date', title: 'Date' },
        { id: 'employeeId', title: 'Employee ID' },
        { id: 'name', title: 'Name' },
        { id: 'department', title: 'Department' },
        { id: 'checkInTime', title: 'Check In Time' },
        { id: 'checkOutTime', title: 'Check Out Time' },
        { id: 'status', title: 'Status' },
        { id: 'totalHours', title: 'Total Hours' }
      ]
    });

    await csvWriter.writeRecords(csvData);

    res.download('attendance_export.csv', 'attendance_export.csv', (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      fs.unlink('attendance_export.csv', () => {});
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/attendance/today-status
// @desc    Get today's attendance status for all employees (Manager)
// @access  Private (Manager)
router.get('/today-status', auth, isManager, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    const attendance = await Attendance.find({
      date: { $gte: start, $lte: end }
    }).populate('userId', 'name email employeeId department');

    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const checkedIn = attendance.filter(a => a.checkInTime).length;
    const checkedOut = attendance.filter(a => a.checkOutTime).length;

    // Get all employees
    const allEmployees = await User.find({ role: 'employee' });
    const absentEmployees = allEmployees.filter(emp => {
      const empAttendance = attendance.find(a => a.userId._id.toString() === emp._id.toString());
      return !empAttendance || empAttendance.status === 'absent';
    });

    res.json({
      date: today.toISOString().split('T')[0],
      totalEmployees: allEmployees.length,
      present,
      absent,
      late,
      checkedIn,
      checkedOut,
      absentEmployees: absentEmployees.map(emp => ({
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department
      })),
      attendance: attendance.map(a => ({
        id: a._id,
        employee: {
          id: a.userId._id,
          name: a.userId.name,
          employeeId: a.userId.employeeId,
          department: a.userId.department
        },
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        status: a.status,
        totalHours: a.totalHours
      }))
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
