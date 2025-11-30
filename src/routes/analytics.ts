import { Router } from 'express';
import {
  getDashboardStats,
  getDepartmentSummary,
  getMonthlyReport,
  getYearlyComparison,
  getTopEarners,
  exportReport,
  getDepartments
} from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Dashboard
router.get('/dashboard', authenticate, getDashboardStats);

// Department analytics
router.get('/departments', authenticate, getDepartments);
router.get('/departments/summary', authenticate, getDepartmentSummary);

// Reports
router.get('/reports/monthly', authenticate, getMonthlyReport);
router.get('/reports/yearly', authenticate, getYearlyComparison);
router.get('/reports/top-earners', authenticate, getTopEarners);
router.get('/reports/export', authenticate, exportReport);

export default router;
