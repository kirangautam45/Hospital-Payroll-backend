import { Response } from 'express';
import ExcelJS from 'exceljs';
import { AuthRequest } from '../middleware/auth';
import PharmacyRecord from '../models/PharmacyRecord';
import { validatePANFlexible, normalizePAN } from '../middleware/validate';

interface ParsedPharmacyRow {
  pan: string;
  name?: string;
  position?: string;
  nightDutyCount?: number;
  rate?: number;
  grossAmount?: number;
  taxDeduction?: number;
  netPayable?: number;
  accountNumber?: string;
}

interface PharmacyUploadResult {
  filename: string;
  rowsRead: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  records: Partial<ParsedPharmacyRow>[];
}

interface ColumnMapping {
  panCol?: number;
  nameCol?: number;
  positionCol?: number;
  nightDutyCol?: number;
  rateCol?: number;
  grossCol?: number;
  taxCol?: number;
  netPayableCol?: number;
  accountCol?: number;
  headerRow: number;
}

// Column header patterns for pharmacy data
const COLUMN_PATTERNS = {
  pan: ['pan', 'पान', 'पान नं', 'पान नं.', 'kfg', 'kfg g+=', 'pan no', 'pan number'],
  name: ['name', 'gfdy', 'gfdy/', 'नाम', 'employee', 'कर्मचारी'],
  position: ['position', 'पद', 'pd', 'designation', 'post'],
  nightDuty: ['night', 'रात्रीकालिन', 'hDdf', 'duty', 'डिउटी', 'संख्या', 'night duty', 'रात्रीकालिन डिउटी'],
  rate: ['b/', 'दर', 'rate', 'per day', 'daily'],
  gross: ['kfpg]/sd', 'kfpg] /sd', '/sd', 'पाउने रकम', 'gross', 'amount', 'रकम'],
  tax: ['kfl/>lds', 'kfl/>lds s/', 'कर', 'tax', 'tds', 'deduction'],
  netPayable: ['s\'n kfpg]', 's\'n', 'कुल पाउने', 'net', 'net payable', 'कुल'],
  account: ['account', 'vftf', 'vftf g+=', 'खाता', 'a/c', 'bank', 'खाता नं']
};

export const uploadPharmacyFiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const results: PharmacyUploadResult[] = [];

    for (const file of files) {
      const result = await processPharmacyExcelFile(file);
      results.push(result);
    }

    const summary = {
      filesProcessed: results.length,
      totalRowsRead: results.reduce((sum, r) => sum + r.rowsRead, 0),
      totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
      totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      files: results
    };

    res.json(summary);
  } catch (error) {
    console.error('Pharmacy upload error:', error);
    res.status(500).json({ error: 'File processing failed' });
  }
};

export const getAllPharmacyRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      PharmacyRecord.find()
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PharmacyRecord.countDocuments()
    ]);

    // Calculate totals
    const totals = await PharmacyRecord.aggregate([
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossAmount' },
          totalNet: { $sum: '$netPayable' },
          totalTax: { $sum: '$taxDeduction' }
        }
      }
    ]);

    res.json({
      records,
      totals: totals[0] || { totalGross: 0, totalNet: 0, totalTax: 0 },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pharmacy records error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy records' });
  }
};

export const getPharmacyRecordByPan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pan } = req.params;
    const record = await PharmacyRecord.findOne({ pan }).lean();

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json(record);
  } catch (error) {
    console.error('Get pharmacy record error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy record' });
  }
};

export const deletePharmacyRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pan } = req.params;
    const result = await PharmacyRecord.findOneAndDelete({ pan });

    if (!result) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete pharmacy record error:', error);
    res.status(500).json({ error: 'Failed to delete pharmacy record' });
  }
};

function findColumnByPatterns(headers: Map<number, string>, patterns: string[]): number | undefined {
  for (const [col, value] of headers) {
    const lower = value.toLowerCase();
    if (patterns.some(p => lower.includes(p.toLowerCase()))) {
      return col;
    }
  }
  return undefined;
}

function findColumns(worksheet: ExcelJS.Worksheet): ColumnMapping | null {
  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const headers = new Map<number, string>();

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = getCellValue(row, colNumber);
      if (value) {
        headers.set(colNumber, value);
      }
    });

    const panCol = findColumnByPatterns(headers, COLUMN_PATTERNS.pan);
    const netPayableCol = findColumnByPatterns(headers, COLUMN_PATTERNS.netPayable);
    const grossCol = findColumnByPatterns(headers, COLUMN_PATTERNS.gross);

    const hasIdentifier = panCol;
    const hasSalary = netPayableCol || grossCol;

    if (hasIdentifier && hasSalary) {
      console.log(`\nPharmacy Header row ${rowNum} values:`);
      headers.forEach((value, col) => {
        console.log(`  Col ${col}: "${value}"`);
      });

      return {
        panCol,
        nameCol: findColumnByPatterns(headers, COLUMN_PATTERNS.name),
        positionCol: findColumnByPatterns(headers, COLUMN_PATTERNS.position),
        nightDutyCol: findColumnByPatterns(headers, COLUMN_PATTERNS.nightDuty),
        rateCol: findColumnByPatterns(headers, COLUMN_PATTERNS.rate),
        grossCol,
        taxCol: findColumnByPatterns(headers, COLUMN_PATTERNS.tax),
        netPayableCol,
        accountCol: findColumnByPatterns(headers, COLUMN_PATTERNS.account),
        headerRow: rowNum
      };
    }
  }
  return null;
}

async function processPharmacyExcelFile(file: Express.Multer.File): Promise<PharmacyUploadResult> {
  const result: PharmacyUploadResult = {
    filename: file.originalname,
    rowsRead: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    records: []
  };

  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(file.buffer as any);

  if (workbook.worksheets.length === 0) {
    result.errors.push('No worksheet found');
    return result;
  }

  console.log(`\n=== PHARMACY FILE: ${file.originalname} ===`);

  const allRows: ParsedPharmacyRow[] = [];

  for (const worksheet of workbook.worksheets) {
    console.log(`\n--- Processing pharmacy worksheet: "${worksheet.name}" ---`);
    const sheetRows = await processPharmacyWorksheet(worksheet, result);
    allRows.push(...sheetRows);
  }

  await insertPharmacyRows(allRows, file.originalname, result);

  return result;
}

async function processPharmacyWorksheet(
  worksheet: ExcelJS.Worksheet,
  result: PharmacyUploadResult
): Promise<ParsedPharmacyRow[]> {
  const mapping = findColumns(worksheet);

  if (!mapping) {
    console.log('WARNING: No column mapping detected for pharmacy');
    return [];
  }

  console.log('Pharmacy columns detected:', mapping);

  const rows: ParsedPharmacyRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= mapping.headerRow) return;

    // Skip header-like rows
    const rowText = row.values?.toString().toLowerCase() || '';
    const headerKeywords = ['s.n', 'sn', 'क्र.सं', 'नाम', 'name', 'pan', 'पान', 'total', 'grand total', 'जम्मा'];
    const isLikelyHeader = headerKeywords.filter(k => rowText.includes(k)).length >= 3;
    if (isLikelyHeader) return;

    const panRaw = mapping.panCol ? getCellValue(row, mapping.panCol) : '';
    const panClean = panRaw.replace(/[^0-9]/g, '');
    const pan = normalizePAN(panClean);

    if (!pan || !validatePANFlexible(pan)) {
      return;
    }

    result.rowsRead++;

    try {
      const name = mapping.nameCol ? getCellValue(row, mapping.nameCol) : undefined;
      const position = mapping.positionCol ? getCellValue(row, mapping.positionCol) : undefined;
      const nightDutyCount = mapping.nightDutyCol
        ? parseFloat(getCellValue(row, mapping.nightDutyCol)?.replace(/[^0-9.-]/g, '') || '0')
        : undefined;
      const rate = mapping.rateCol
        ? parseFloat(getCellValue(row, mapping.rateCol)?.replace(/[^0-9.-]/g, '') || '0')
        : undefined;
      const grossAmount = mapping.grossCol
        ? parseFloat(getCellValue(row, mapping.grossCol)?.replace(/[^0-9.-]/g, '') || '0')
        : undefined;
      const taxDeduction = mapping.taxCol
        ? parseFloat(getCellValue(row, mapping.taxCol)?.replace(/[^0-9.-]/g, '') || '0')
        : undefined;
      const netPayable = mapping.netPayableCol
        ? parseFloat(getCellValue(row, mapping.netPayableCol)?.replace(/[^0-9.-]/g, '') || '0')
        : undefined;
      const accountNumber = mapping.accountCol ? getCellValue(row, mapping.accountCol) : undefined;

      rows.push({
        pan,
        name: name || undefined,
        position: position || undefined,
        nightDutyCount: nightDutyCount || undefined,
        rate: rate || undefined,
        grossAmount: grossAmount || undefined,
        taxDeduction: taxDeduction || undefined,
        netPayable: netPayable || undefined,
        accountNumber: accountNumber || undefined
      });
    } catch {
      result.errors.push(`Row ${rowNumber}: Parse error`);
      result.skipped++;
    }
  });

  console.log(`Pharmacy worksheet processed: ${rows.length} valid rows`);
  return rows;
}

async function insertPharmacyRows(
  rows: ParsedPharmacyRow[],
  filename: string,
  result: PharmacyUploadResult
): Promise<void> {
  if (rows.length === 0) return;

  console.log(`\n=== UPSERTING ${rows.length} PHARMACY ROWS ===`);

  const bulkOps = rows.map((row) => ({
    updateOne: {
      filter: { pan: row.pan },
      update: {
        $set: {
          nightDutyCount: row.nightDutyCount,
          rate: row.rate,
          grossAmount: row.grossAmount,
          taxDeduction: row.taxDeduction,
          netPayable: row.netPayable,
          source: filename,
          uploadedAt: new Date()
        },
        $setOnInsert: {
          pan: row.pan,
          name: row.name,
          position: row.position,
          accountNumber: row.accountNumber
        }
      },
      upsert: true
    }
  }));

  try {
    const bulkResult = await PharmacyRecord.bulkWrite(bulkOps, { ordered: false });
    result.inserted = bulkResult.upsertedCount;
    result.updated = bulkResult.modifiedCount;
    result.skipped = rows.length - result.inserted - result.updated;
    console.log(`Pharmacy - New: ${result.inserted}, Updated: ${result.updated}`);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'upsertedCount' in err) {
      result.inserted = (err as { upsertedCount: number }).upsertedCount;
    }
    result.skipped += rows.length - result.inserted;
  }

  result.records = rows.slice(0, 100);
}

function getCellValue(row: ExcelJS.Row, colIndex: number | undefined): string {
  if (!colIndex) return '';
  const cell = row.getCell(colIndex);
  if (!cell.value) return '';
  if (cell.value instanceof Date) return cell.value.toISOString();

  if (typeof cell.value === 'object' && cell.value !== null) {
    const cellObj = cell.value as { result?: unknown; text?: string; richText?: Array<{ text: string }> };
    if ('result' in cellObj && cellObj.result !== undefined) {
      return String(cellObj.result);
    }
    if ('richText' in cellObj && Array.isArray(cellObj.richText)) {
      return cellObj.richText.map(rt => rt.text).join('');
    }
    if ('text' in cellObj && cellObj.text) {
      return cellObj.text;
    }
  }

  return cell.value.toString().trim();
}
