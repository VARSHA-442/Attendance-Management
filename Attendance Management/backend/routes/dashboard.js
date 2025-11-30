const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { auth, isManager } = require('../middleware/auth');

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

// Helper function to get start and end of month
const getMonthBounds = (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return { startDate, endDate };
};

// @route   GET /api/dashboard/employee
// @desc    Get employee dashboard data
// @access  Private (Employee)
router.get('/employee', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const { start, end } = getDayBounds(today);
    const { startDate, endDate } = getMonthBounds(today.getMonth() + 1, today.getFullYear());

    // Today's status
    const todayAttendance = await Attendance.findOne({
      userId,
      date: { $gte: start, $lte: end }
    });

    // Monthly summary
    const monthlyAttendance = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });

    const present = monthlyAttendance.filter(a => a.status === 'present').length;
    const absent = monthlyAttendance.filter(a => a.status === 'absent').length;
    const late = monthlyAttendance.filter(a => a.status === 'late').length;
    const totalHours = monthlyAttendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    // Recent attendance (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAttendance = await Attendance.find({
      userId,
      date: { $gte: sevenDaysAgo, $lte: end }
    }).sort({ date: -1 }).limit(7);

    res.json({
      today: {
        checkedIn: !!todayAttendance?.checkInTime,
        checkedOut: !!todayAttendance?.checkOutTime,
        status: todayAttendance?.status || 'absent',
        checkInTime: todayAttendance?.checkInTime,
        checkOutTime: todayAttendance?.checkOutTime,
        totalHours: todayAttendance?.totalHours || 0
      },
      thisMonth: {
        present,
        absent,
        late,
        totalHours: Math.round(totalHours * 100) / 100
      },
      recentAttendance: recentAttendance.map(a => ({
        date: a.date,
        status: a.status,
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime,
        totalHours: a.totalHours
      }))
    });
  } catch (error) {
    console.error('Get employee dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/dashboard/manager
// @desc    Get manager dashboard data
// @access  Private (Manager)
router.get('/manager', auth, isManager, async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getDayBounds(today);

    // Total employees
    const totalEmployees = await User.countDocuments({ role: 'employee' });

    // Today's attendance
    const todayAttendance = await Attendance.find({
      date: { $gte: start, $lte: end }
    }).populate('userId', 'name employeeId department');

    const todayPresent = todayAttendance.filter(a => 
      a.status === 'present' || a.status === 'late'
    ).length;
    const todayAbsent = totalEmployees - todayPresent;
    const todayLate = todayAttendance.filter(a => a.status === 'late').length;

    // Absent employees today
    const allEmployees = await User.find({ role: 'employee' });
    const absentEmployees = allEmployees.filter(emp => {
      const empAttendance = todayAttendance.find(a => 
        a.userId._id.toString() === emp._id.toString()
      );
      return !empAttendance || empAttendance.status === 'absent';
    });

    // Weekly attendance trend (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const { start: dayStart, end: dayEnd } = getDayBounds(date);
      
      const dayAttendance = await Attendance.find({
        date: { $gte: dayStart, $lte: dayEnd }
      });
      
      weeklyData.push({
        date: date.toISOString().split('T')[0],
        present: dayAttendance.filter(a => a.status === 'present' || a.status === 'late').length,
        absent: totalEmployees - dayAttendance.filter(a => a.status === 'present' || a.status === 'late').length
      });
    }

    // Department-wise attendance
    const departmentStats = {};
    todayAttendance.forEach(record => {
      const dept = record.userId?.department || 'Unknown';
      if (!departmentStats[dept]) {
        departmentStats[dept] = { present: 0, absent: 0, total: 0 };
      }
      if (record.status === 'present' || record.status === 'late') {
        departmentStats[dept].present++;
      } else {
        departmentStats[dept].absent++;
      }
    });

    // Add departments with no attendance as absent
    allEmployees.forEach(emp => {
      const dept = emp.department;
      if (!departmentStats[dept]) {
        departmentStats[dept] = { present: 0, absent: 0, total: 0 };
      }
      departmentStats[dept].total++;
      const empAttendance = todayAttendance.find(a => 
        a.userId._id.toString() === emp._id.toString()
      );
      if (!empAttendance || empAttendance.status === 'absent') {
        departmentStats[dept].absent++;
      } else {
        departmentStats[dept].present++;
      }
    });

    res.json({
      totalEmployees,
      today: {
        present: todayPresent,
        absent: todayAbsent,
        late: todayLate
      },
      weeklyTrend: weeklyData,
      departmentStats: Object.entries(departmentStats).map(([dept, stats]) => ({
        department: dept,
        present: stats.present,
        absent: stats.absent,
        total: stats.total
      })),
      absentEmployees: absentEmployees.map(emp => ({
        id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        department: emp.department
      }))
    });
  } catch (error) {
    console.error('Get manager dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
