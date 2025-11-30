import { Response } from 'express';
import ExcelJS from 'exceljs';
import { AuthRequest } from '../middleware/auth';
import Person from '../models/Person';
import SalaryRecord from '../models/SalaryRecord';
import { validatePAN } from '../middleware/validate';
import { computeRowHash } from '../utils/hash';
import { autoConvertToNepali } from '../utils/preetiToUnicode';

interface ParsedRow {
  pan: string;
  name?: string;
  nameNepali?: string; // Name in Nepali/Devanagari script
  position?: string;
  positionNepali?: string; // Position in Nepali/Devanagari script
  department?: string;
  departmentNepali?: string; // Department in Nepali/Devanagari script
  accountNumber?: string;
  dutyDays?: {
    month1?: number;
    month2?: number;
    month3?: number;
    total?: number;
  };
  rate?: number;
  grossAmount?: number;
  taxDeduction?: number;
  netSalary: number;
  rowHash: string;
}

interface UploadResult {
  filename: string;
  rowsRead: number;
  inserted: number;
  skipped: number;
  errors: string[];
  records: Partial<ParsedRow>[];
}

interface ColumnMapping {
  panCol?: number;
  nameCol?: number;
  positionCol?: number;
  departmentCol?: number;
  accountCol?: number;
  duty1Col?: number;
  duty2Col?: number;
  duty3Col?: number;
  dutyTotalCol?: number;
  rateCol?: number;
  grossCol?: number;
  taxCol?: number;
  netSalaryCol?: number;
  headerRow: number;
}

// Column header patterns (English, Nepali Unicode, Preeti font)
// Includes various Nepali month names in Preeti encoding
const COLUMN_PATTERNS = {
  // PAN patterns - Note: 'kfg' in Preeti = 'पान' (PAN), 'g+=' or 'g+' = 'नं' (number)
  pan: ['pan', 'पान', 'kfg', 'kfg g', 'kfg g+', 'kfg g+=', 'kfgg', 'pan no', 'panno', 'pan number', 'पान नं'],
  name: ['name', 'gfdy', 'gfdy/', 'नाम', 'employee', 'sd{rf/L', 'कर्मचारी'],
  position: ['position', 'kb', 'पद', 'designation', 'post'],
  department: ['department', 'dept', 'ward', 'sfo', 'sfo/t', 'sfo{/t', 'ljefu', 'विभाग', 'sfo{/t ljefu', 's}lkmot'],
  // Account patterns - 'vftf' in Preeti = 'खाता' (account)
  account: ['account', 'vftf', 'vftf g', 'vftf g+', 'vftf g+=', 'खाता', 'a/c', 'bank', 'खाता नं'],
  // Nepali months in Preeti: >fj)f=Shrawan, efbl/efb|=Bhadra, cflZjg=Ashwin, sflt{s=Kartik, d+l;/=Mangsir, kf}if=Poush
  duty1: ['>fj)f', 'efbl', 'efb|', 'sflt{s', 'श्रावण', 'भाद्र', 'कार्तिक', 'shrawan', 'bhadra', 'kartik', 'month1'],
  duty2: ['efbl', 'efb|', 'efb}', 'cflZjg', 'd+l;/', 'भाद्र', 'आश्विन', 'मंसिर', 'bhadra', 'ashwin', 'mangsir', 'month2'],
  duty3: ['cflZjg', 'kf}if', 'df3', 'आश्विन', 'पौष', 'माघ', 'ashwin', 'poush', 'magh', 'month3'],
  dutyTotal: ['hDdf', 'hDdf lbg', 'जम्मा', 'total', 'total duty', 'total days', 'कुल दिन'],
  rate: ['b/', 'दर', 'rate', 'per day', 'daily'],
  gross: ['kfpg] /sd', '/sd', 'पाउने रकम', 'gross', 'amount', 'रकम'],
  tax: ['kfl/>lds', 'kfl/>lds s/', 'कर', 'tax', 'tds', 'deduction'],
  netSalary: ['s\'n kfpg]', 's\'n', 'कुल पाउने', 'net', 'net salary', 'कुल तलब']
};

export const uploadFiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await processExcelFile(file);
      results.push(result);
    }

    const summary = {
      filesProcessed: results.length,
      totalRowsRead: results.reduce((sum, r) => sum + r.rowsRead, 0),
      totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
      totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      files: results
    };

    res.json(summary);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File processing failed' });
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
  // Search first 20 rows for header row
  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const headers = new Map<number, string>();

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = getCellValue(row, colNumber);
      if (value) {
        headers.set(colNumber, value);
      }
    });

    // Check if this row has identifiable columns (need at least PAN or account + some salary column)
    const panCol = findColumnByPatterns(headers, COLUMN_PATTERNS.pan);
    const accountCol = findColumnByPatterns(headers, COLUMN_PATTERNS.account);
    const netSalaryCol = findColumnByPatterns(headers, COLUMN_PATTERNS.netSalary);
    const grossCol = findColumnByPatterns(headers, COLUMN_PATTERNS.gross);

    const hasIdentifier = panCol || accountCol;
    const hasSalary = netSalaryCol || grossCol;

    if (hasIdentifier && hasSalary) {
      return {
        panCol,
        nameCol: findColumnByPatterns(headers, COLUMN_PATTERNS.name),
        positionCol: findColumnByPatterns(headers, COLUMN_PATTERNS.position),
        departmentCol: findColumnByPatterns(headers, COLUMN_PATTERNS.department),
        accountCol,
        duty1Col: findColumnByPatterns(headers, COLUMN_PATTERNS.duty1),
        duty2Col: findColumnByPatterns(headers, COLUMN_PATTERNS.duty2),
        duty3Col: findColumnByPatterns(headers, COLUMN_PATTERNS.duty3),
        dutyTotalCol: findColumnByPatterns(headers, COLUMN_PATTERNS.dutyTotal),
        rateCol: findColumnByPatterns(headers, COLUMN_PATTERNS.rate),
        grossCol,
        taxCol: findColumnByPatterns(headers, COLUMN_PATTERNS.tax),
        netSalaryCol,
        headerRow: rowNum
      };
    }
  }
  return null;
}

async function processExcelFile(file: Express.Multer.File): Promise<UploadResult> {
  const result: UploadResult = {
    filename: file.originalname,
    rowsRead: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    records: []
  };

  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(file.buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    result.errors.push('No worksheet found');
    return result;
  }

  // Find columns
  const mapping = findColumns(worksheet);

  if (!mapping) {
    result.errors.push('Could not detect required columns (PAN/Account and Salary). Please check your file format.');
    return result;
  }

  console.log('Column mapping found:', {
    ...mapping,
    panCol: mapping.panCol,
    accountCol: mapping.accountCol,
  });

  const rows: ParsedRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // Skip header and rows before it
    if (rowNumber <= mapping.headerRow) return;

    // Get PAN and Account Number separately
    const panRaw = mapping.panCol ? getCellValue(row, mapping.panCol) : '';
    const accountRaw = mapping.accountCol ? getCellValue(row, mapping.accountCol) : '';

    // Clean numeric values
    const panClean = panRaw.replace(/[^0-9]/g, '');
    const accountClean = accountRaw.replace(/[^0-9]/g, '');

    // PAN in Nepal is typically 9 digits, account numbers are 13-16 digits
    // If detected PAN looks like account number (too long), swap them
    let pan = panClean;
    let accountNumber = accountClean;

    // If PAN is longer than 13 digits, it's likely an account number
    if (panClean.length > 13 && accountClean.length <= 13 && accountClean.length > 0) {
      pan = accountClean;
      accountNumber = panClean;
    }
    // If PAN is empty but we have account, use account as identifier
    else if (!panClean && accountClean) {
      pan = accountClean;
    }

    // Use PAN as primary identifier
    const identifier = pan;
    if (!identifier) return;

    result.rowsRead++;

    try {
      // Validate identifier
      if (!validatePAN(identifier)) {
        result.skipped++;
        return;
      }

      // Get salary (prefer net salary, fall back to gross)
      const netSalaryStr = mapping.netSalaryCol ? getCellValue(row, mapping.netSalaryCol) : '';
      const grossStr = mapping.grossCol ? getCellValue(row, mapping.grossCol) : '';
      const salaryStr = netSalaryStr || grossStr;

      const netSalary = parseFloat(salaryStr?.replace(/[^0-9.-]/g, '') || '0');
      if (isNaN(netSalary) || netSalary <= 0) {
        result.skipped++;
        return;
      }

      // Parse all other fields and convert Preeti to Unicode Nepali
      const rawName = mapping.nameCol ? getCellValue(row, mapping.nameCol) : undefined;
      const rawPosition = mapping.positionCol ? getCellValue(row, mapping.positionCol) : undefined;
      const rawDepartment = mapping.departmentCol ? getCellValue(row, mapping.departmentCol) : undefined;

      // Convert Preeti-encoded text to Unicode Nepali (keeps both original and converted)
      const nameResult = rawName ? autoConvertToNepali(rawName) : null;
      const positionResult = rawPosition ? autoConvertToNepali(rawPosition) : null;
      const departmentResult = rawDepartment ? autoConvertToNepali(rawDepartment) : null;

      // Store original in base field, converted Nepali in *Nepali field
      const name = nameResult?.original;
      const nameNepali = nameResult?.nepali;
      const position = positionResult?.original;
      const positionNepali = positionResult?.nepali;
      const department = departmentResult?.original;
      const departmentNepali = departmentResult?.nepali;
      // Use the corrected accountNumber (might have been swapped with PAN if columns were misdetected)
      const finalAccountNumber = accountNumber || undefined;

      // Duty days
      const duty1 = mapping.duty1Col ? parseFloat(getCellValue(row, mapping.duty1Col) || '0') : undefined;
      const duty2 = mapping.duty2Col ? parseFloat(getCellValue(row, mapping.duty2Col) || '0') : undefined;
      const duty3 = mapping.duty3Col ? parseFloat(getCellValue(row, mapping.duty3Col) || '0') : undefined;
      const dutyTotal = mapping.dutyTotalCol ? parseFloat(getCellValue(row, mapping.dutyTotalCol) || '0') : undefined;

      // Rate and amounts
      const rate = mapping.rateCol ? parseFloat(getCellValue(row, mapping.rateCol)?.replace(/[^0-9.-]/g, '') || '0') : undefined;
      const grossAmount = mapping.grossCol ? parseFloat(grossStr?.replace(/[^0-9.-]/g, '') || '0') : undefined;
      const taxDeduction = mapping.taxCol ? parseFloat(getCellValue(row, mapping.taxCol)?.replace(/[^0-9.-]/g, '') || '0') : undefined;

      const rowHash = computeRowHash(identifier, department || '', null, netSalary);

      rows.push({
        pan: identifier,
        name,
        nameNepali,
        position,
        positionNepali,
        department,
        departmentNepali,
        accountNumber: finalAccountNumber,
        dutyDays: (duty1 || duty2 || duty3 || dutyTotal) ? {
          month1: duty1 || undefined,
          month2: duty2 || undefined,
          month3: duty3 || undefined,
          total: dutyTotal || undefined
        } : undefined,
        rate: rate || undefined,
        grossAmount: grossAmount || undefined,
        taxDeduction: taxDeduction || undefined,
        netSalary,
        rowHash
      });
    } catch {
      result.errors.push(`Row ${rowNumber}: Parse error`);
      result.skipped++;
    }
  });

  // Batch insert with deduplication
  if (rows.length > 0) {
    const bulkOps = rows.map((row) => ({
      insertOne: {
        document: {
          pan: row.pan,
          name: row.name,
          nameNepali: row.nameNepali,
          position: row.position,
          positionNepali: row.positionNepali,
          department: row.department,
          departmentNepali: row.departmentNepali,
          accountNumber: row.accountNumber,
          dutyDays: row.dutyDays,
          rate: row.rate,
          grossAmount: row.grossAmount,
          taxDeduction: row.taxDeduction,
          netSalary: row.netSalary,
          rowHash: row.rowHash,
          source: file.originalname,
          uploadedAt: new Date()
        }
      }
    }));

    try {
      const bulkResult = await SalaryRecord.bulkWrite(bulkOps, { ordered: false });
      result.inserted = bulkResult.insertedCount;
      result.skipped += rows.length - bulkResult.insertedCount;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'insertedCount' in err) {
        result.inserted = (err as { insertedCount: number }).insertedCount;
      }
      result.skipped += rows.length - result.inserted;
    }

    // Upsert Person records
    const uniquePans = [...new Set(rows.map((r) => r.pan))];
    for (const pan of uniquePans) {
      const rowData = rows.find((r) => r.pan === pan);
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };

      // Only set fields if they have values
      if (rowData?.name) updateFields.name = rowData.name;
      if (rowData?.nameNepali) updateFields.nameNepali = rowData.nameNepali;
      if (rowData?.position) updateFields.position = rowData.position;
      if (rowData?.positionNepali) updateFields.positionNepali = rowData.positionNepali;
      if (rowData?.department) updateFields.department = rowData.department;
      if (rowData?.departmentNepali) updateFields.departmentNepali = rowData.departmentNepali;

      await Person.findOneAndUpdate(
        { pan },
        {
          $setOnInsert: { pan, createdAt: new Date() },
          $set: updateFields
        },
        { upsert: true }
      );
    }

    // Include parsed records in response
    result.records = rows.slice(0, 100).map((r) => ({
      pan: r.pan,
      name: r.name,
      nameNepali: r.nameNepali,
      position: r.position,
      positionNepali: r.positionNepali,
      department: r.department,
      departmentNepali: r.departmentNepali,
      accountNumber: r.accountNumber,
      dutyDays: r.dutyDays,
      rate: r.rate,
      grossAmount: r.grossAmount,
      taxDeduction: r.taxDeduction,
      netSalary: r.netSalary
    }));
  }

  return result;
}

function getCellValue(row: ExcelJS.Row, colIndex: number | undefined): string {
  if (!colIndex) return '';
  const cell = row.getCell(colIndex);
  if (!cell.value) return '';
  if (cell.value instanceof Date) return cell.value.toISOString();

  // Handle formula cells
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
