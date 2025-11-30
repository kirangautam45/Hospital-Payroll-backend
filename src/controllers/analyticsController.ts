import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import SalaryRecord from '../models/SalaryRecord';
import Person from '../models/Person';

// Dashboard overview stats
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalEmployees, totalRecords, salaryStats] = await Promise.all([
      Person.countDocuments(),
      SalaryRecord.countDocuments(),
      SalaryRecord.aggregate([
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$netSalary' },
            avgSalary: { $avg: '$netSalary' },
            minSalary: { $min: '$netSalary' },
            maxSalary: { $max: '$netSalary' }
          }
        }
      ])
    ]);

    const stats = salaryStats[0] || { totalPaid: 0, avgSalary: 0, minSalary: 0, maxSalary: 0 };

    res.json({
      totalEmployees,
      totalRecords,
      totalPaid: Math.round(stats.totalPaid * 100) / 100,
      averageSalary: Math.round(stats.avgSalary * 100) / 100,
      minSalary: stats.minSalary,
      maxSalary: stats.maxSalary
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Department-wise summary
export const getDepartmentSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const fromDate = req.query.from ? new Date(req.query.from as string) : null;
    const toDate = req.query.to ? new Date(req.query.to as string) : null;

    const matchStage: Record<string, unknown> = {};
    if (fromDate || toDate) {
      matchStage.uploadedAt = {};
      if (fromDate) (matchStage.uploadedAt as Record<string, Date>).$gte = fromDate;
      if (toDate) (matchStage.uploadedAt as Record<string, Date>).$lte = toDate;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: '$employer',
          employeeCount: { $addToSet: '$pan' },
          totalPaid: { $sum: '$netSalary' },
          avgSalary: { $avg: '$netSalary' },
          recordCount: { $sum: 1 }
        }
      },
      {
        $project: {
          department: { $ifNull: ['$_id', 'Unknown'] },
          employeeCount: { $size: '$employeeCount' },
          totalPaid: { $round: ['$totalPaid', 2] },
          avgSalary: { $round: ['$avgSalary', 2] },
          recordCount: 1
        }
      },
      { $sort: { totalPaid: -1 } }
    );

    const departments = await SalaryRecord.aggregate(pipeline);

    res.json({ departments });
  } catch (error) {
    console.error('Department summary error:', error);
    res.status(500).json({ error: 'Failed to fetch department summary' });
  }
};

// Monthly report
export const getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const monthlyData = await SalaryRecord.aggregate([
      {
        $match: {
          uploadedAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${year + 1}-01-01`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$uploadedAt' },
          employeeCount: { $addToSet: '$pan' },
          totalPaid: { $sum: '$netSalary' },
          avgSalary: { $avg: '$netSalary' },
          recordCount: { $sum: 1 }
        }
      },
      {
        $project: {
          month: '$_id',
          employeeCount: { $size: '$employeeCount' },
          totalPaid: { $round: ['$totalPaid', 2] },
          avgSalary: { $round: ['$avgSalary', 2] },
          recordCount: 1
        }
      },
      { $sort: { month: 1 } }
    ]);

    // Fill in missing months with zeros
    const months = Array.from({ length: 12 }, (_, i) => {
      const existing = monthlyData.find((m) => m.month === i + 1);
      return existing || {
        month: i + 1,
        employeeCount: 0,
        totalPaid: 0,
        avgSalary: 0,
        recordCount: 0
      };
    });

    const yearTotal = months.reduce((sum, m) => sum + m.totalPaid, 0);

    res.json({
      year,
      months,
      yearTotal: Math.round(yearTotal * 100) / 100
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
};

// Yearly comparison
export const getYearlyComparison = async (_req: Request, res: Response): Promise<void> => {
  try {
    const yearlyData = await SalaryRecord.aggregate([
      {
        $group: {
          _id: { $year: '$uploadedAt' },
          employeeCount: { $addToSet: '$pan' },
          totalPaid: { $sum: '$netSalary' },
          avgSalary: { $avg: '$netSalary' },
          recordCount: { $sum: 1 }
        }
      },
      {
        $project: {
          year: '$_id',
          employeeCount: { $size: '$employeeCount' },
          totalPaid: { $round: ['$totalPaid', 2] },
          avgSalary: { $round: ['$avgSalary', 2] },
          recordCount: 1
        }
      },
      { $sort: { year: -1 } }
    ]);

    res.json({ years: yearlyData });
  } catch (error) {
    console.error('Yearly comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch yearly comparison' });
  }
};

// Top earners
export const getTopEarners = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const department = req.query.department as string;

    const matchStage: Record<string, unknown> = {};
    if (department) {
      matchStage.employer = department;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: '$pan',
          totalEarnings: { $sum: '$netSalary' },
          avgSalary: { $avg: '$netSalary' },
          recordCount: { $sum: 1 },
          latestDepartment: { $last: '$employer' }
        }
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'people',
          localField: '_id',
          foreignField: 'pan',
          as: 'person'
        }
      },
      {
        $project: {
          pan: '$_id',
          name: { $arrayElemAt: ['$person.name', 0] },
          totalEarnings: { $round: ['$totalEarnings', 2] },
          avgSalary: { $round: ['$avgSalary', 2] },
          recordCount: 1,
          department: '$latestDepartment'
        }
      }
    );

    const topEarners = await SalaryRecord.aggregate(pipeline);

    res.json({ topEarners });
  } catch (error) {
    console.error('Top earners error:', error);
    res.status(500).json({ error: 'Failed to fetch top earners' });
  }
};

// Export report to Excel
export const exportReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportType = req.query.type as string || 'department';
    const format = req.query.format as string || 'excel';

    const workbook = new ExcelJS.Workbook();

    if (reportType === 'department') {
      const departments = await SalaryRecord.aggregate([
        {
          $group: {
            _id: '$employer',
            employeeCount: { $addToSet: '$pan' },
            totalPaid: { $sum: '$netSalary' },
            avgSalary: { $avg: '$netSalary' }
          }
        },
        {
          $project: {
            department: { $ifNull: ['$_id', 'Unknown'] },
            employeeCount: { $size: '$employeeCount' },
            totalPaid: { $round: ['$totalPaid', 2] },
            avgSalary: { $round: ['$avgSalary', 2] }
          }
        },
        { $sort: { totalPaid: -1 } }
      ]);

      const worksheet = workbook.addWorksheet('Department Summary');
      worksheet.columns = [
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Employees', key: 'employeeCount', width: 15 },
        { header: 'Total Paid', key: 'totalPaid', width: 20 },
        { header: 'Avg Salary', key: 'avgSalary', width: 20 }
      ];

      worksheet.getRow(1).font = { bold: true };
      departments.forEach((d) => worksheet.addRow(d));

      // Add totals
      worksheet.addRow({});
      worksheet.addRow({
        department: 'TOTAL',
        employeeCount: departments.reduce((sum, d) => sum + d.employeeCount, 0),
        totalPaid: departments.reduce((sum, d) => sum + d.totalPaid, 0),
        avgSalary: ''
      });
    }

    if (reportType === 'monthly') {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      const monthlyData = await SalaryRecord.aggregate([
        {
          $match: {
            uploadedAt: {
              $gte: new Date(`${year}-01-01`),
              $lt: new Date(`${year + 1}-01-01`)
            }
          }
        },
        {
          $group: {
            _id: { $month: '$uploadedAt' },
            employeeCount: { $addToSet: '$pan' },
            totalPaid: { $sum: '$netSalary' }
          }
        },
        {
          $project: {
            month: '$_id',
            employeeCount: { $size: '$employeeCount' },
            totalPaid: { $round: ['$totalPaid', 2] }
          }
        },
        { $sort: { month: 1 } }
      ]);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const worksheet = workbook.addWorksheet(`Monthly Report ${year}`);
      worksheet.columns = [
        { header: 'Month', key: 'month', width: 15 },
        { header: 'Employees', key: 'employeeCount', width: 15 },
        { header: 'Total Paid', key: 'totalPaid', width: 20 }
      ];

      worksheet.getRow(1).font = { bold: true };
      monthNames.forEach((name, i) => {
        const data = monthlyData.find((m) => m.month === i + 1);
        worksheet.addRow({
          month: name,
          employeeCount: data?.employeeCount || 0,
          totalPaid: data?.totalPaid || 0
        });
      });
    }

    if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}_report.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Add basic text summary
      const stats = await SalaryRecord.aggregate([
        {
          $group: {
            _id: null,
            totalPaid: { $sum: '$netSalary' },
            avgSalary: { $avg: '$netSalary' },
            count: { $sum: 1 }
          }
        }
      ]);

      const s = stats[0] || { totalPaid: 0, avgSalary: 0, count: 0 };
      doc.text(`Total Records: ${s.count}`);
      doc.text(`Total Amount Paid: NPR ${s.totalPaid.toLocaleString()}`);
      doc.text(`Average Salary: NPR ${Math.round(s.avgSalary).toLocaleString()}`);

      doc.end();
      return;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}_report.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

// Get all unique departments
export const getDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const departments = await SalaryRecord.distinct('employer');
    res.json({ departments: departments.filter(Boolean).sort() });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};
