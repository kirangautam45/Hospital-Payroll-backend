import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import Person from '../models/Person';
import SalaryRecord from '../models/SalaryRecord';

// Autocomplete search for PAN
export const searchPAN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!q || (q as string).length < 2) {
      res.json({ results: [] });
      return;
    }

    const query = (q as string).trim();

    // Search by PAN (starts with) or name (contains)
    const persons = await Person.find({
      $or: [
        { pan: { $regex: `^${query}`, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    })
      .limit(limit)
      .select('pan name');

    res.json({ results: persons });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// Get person with date range filter
export const getPersonByPAN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pan } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Date range filters
    const fromDate = req.query.from ? new Date(req.query.from as string) : null;
    const toDate = req.query.to ? new Date(req.query.to as string) : null;

    const person = await Person.findOne({ pan });
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    // Build query with date filters
    const query: Record<string, unknown> = { pan };
    if (fromDate || toDate) {
      query.uploadedAt = {};
      if (fromDate) (query.uploadedAt as Record<string, Date>).$gte = fromDate;
      if (toDate) (query.uploadedAt as Record<string, Date>).$lte = toDate;
    }

    const [salaryRecords, total] = await Promise.all([
      SalaryRecord.find(query)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryRecord.countDocuments(query)
    ]);

    res.json({
      person,
      salaryRecords,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get person error:', error);
    res.status(500).json({ error: 'Failed to fetch person data' });
  }
};

export const getPersonSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pan } = req.params;

    const person = await Person.findOne({ pan });
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    const records = await SalaryRecord.find({ pan }).sort({ uploadedAt: -1 });

    if (records.length === 0) {
      res.json({
        person,
        summary: {
          totalRecords: 0,
          totalEarnings: 0,
          averageSalary: 0,
          latestSalary: null,
          firstSalary: null,
          percentChange: null
        }
      });
      return;
    }

    const totalEarnings = records.reduce((sum, r) => sum + r.netSalary, 0);
    const averageSalary = totalEarnings / records.length;
    const latestSalary = records[0];
    const firstSalary = records[records.length - 1];
    const percentChange =
      firstSalary.netSalary > 0
        ? ((latestSalary.netSalary - firstSalary.netSalary) / firstSalary.netSalary) * 100
        : null;

    res.json({
      person,
      summary: {
        totalRecords: records.length,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        averageSalary: Math.round(averageSalary * 100) / 100,
        latestSalary: {
          amount: latestSalary.netSalary,
          grossAmount: latestSalary.grossAmount,
          taxDeduction: latestSalary.taxDeduction,
          currency: latestSalary.currency,
          department: latestSalary.department,
          position: latestSalary.position,
          uploadedAt: latestSalary.uploadedAt
        },
        firstSalary: {
          amount: firstSalary.netSalary,
          grossAmount: firstSalary.grossAmount,
          currency: firstSalary.currency,
          department: firstSalary.department,
          uploadedAt: firstSalary.uploadedAt
        },
        percentChange: percentChange !== null ? Math.round(percentChange * 100) / 100 : null
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
};

export const exportPersonData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pan } = req.params;
    const format = (req.query.format as string) || 'json';

    const person = await Person.findOne({ pan });
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    const records = await SalaryRecord.find({ pan }).sort({ uploadedAt: -1 });

    if (format === 'csv') {
      const csvHeader = 'PAN,Name,Position,Department,Account,DutyDays,Rate,GrossAmount,TaxDeduction,NetSalary,Currency,UploadedAt,Source\n';
      const csvRows = records.map((r) =>
        `${r.pan},"${r.name || ''}","${r.position || ''}","${r.department || ''}","${r.accountNumber || ''}",${r.dutyDays?.total || ''},${r.rate || ''},${r.grossAmount || ''},${r.taxDeduction || ''},${r.netSalary},${r.currency},${r.uploadedAt.toISOString()},"${r.source || ''}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${pan}_salary_history.csv`);
      res.send(csvHeader + csvRows);
      return;
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Salary History');

      // Add header row
      worksheet.columns = [
        { header: 'PAN', key: 'pan', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Position', key: 'position', width: 20 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Account No', key: 'accountNumber', width: 18 },
        { header: 'Duty Days', key: 'dutyDays', width: 12 },
        { header: 'Rate', key: 'rate', width: 12 },
        { header: 'Gross Amount', key: 'grossAmount', width: 15 },
        { header: 'Tax Deduction', key: 'taxDeduction', width: 15 },
        { header: 'Net Salary', key: 'netSalary', width: 15 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Source', key: 'source', width: 25 }
      ];

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data rows
      records.forEach((r) => {
        worksheet.addRow({
          pan: r.pan,
          name: r.name || '',
          position: r.position || '',
          department: r.department || '',
          accountNumber: r.accountNumber || '',
          dutyDays: r.dutyDays?.total || '',
          rate: r.rate || '',
          grossAmount: r.grossAmount || '',
          taxDeduction: r.taxDeduction || '',
          netSalary: r.netSalary,
          currency: r.currency,
          date: r.uploadedAt,
          source: r.source || ''
        });
      });

      // Add summary at bottom
      worksheet.addRow({});
      worksheet.addRow({ pan: 'Total Records:', name: records.length });
      worksheet.addRow({ pan: 'Total Earnings:', name: records.reduce((sum, r) => sum + r.netSalary, 0) });
      worksheet.addRow({ pan: 'Average Salary:', name: records.reduce((sum, r) => sum + r.netSalary, 0) / records.length });

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${pan}_salary_history.xlsx`);
      res.send(buffer);
      return;
    }

    res.json({ person, records });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

// Get all persons with pagination
export const getAllPersons = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { pan: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const [persons, total] = await Promise.all([
      Person.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Person.countDocuments(query)
    ]);

    res.json({
      persons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all persons error:', error);
    res.status(500).json({ error: 'Failed to fetch persons' });
  }
};
