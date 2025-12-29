import { ParsedTransaction, RawCSVRow } from '@/types/data';
import { findSecondaryCategory, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/types/category';

/**
 * Parse a CSV line, handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}

/**
 * Parse currency string to number
 */
function parseCurrency(value: string): number {
  if (!value || value.trim() === '' || value === '0.00') {
    return 0;
  }
  // Remove any non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

/**
 * Parse tags string to array
 */
function parseTags(tagsStr: string): string[] {
  if (!tagsStr || tagsStr.trim() === '') {
    return [];
  }
  return tagsStr.split(',').map(t => t.trim()).filter(t => t !== '');
}

/**
 * Parse date string and extract year, month, day
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number; valid: boolean } {
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return { year: 0, month: 0, day: 0, valid: false };
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    valid: true
  };
}

/**
 * Determine transaction type from inflow and outflow amounts
 */
function determineTransactionType(inflow: number, outflow: number): 'income' | 'expense' {
  // If both are zero or positive, prioritize inflow
  if (inflow > 0 && outflow === 0) return 'income';
  if (outflow > 0 && inflow === 0) return 'expense';

  // If both are positive (shouldn't happen in normal data), use the larger one
  return inflow >= outflow ? 'income' : 'expense';
}

/**
 * Check if a tertiary category is a transfer type
 */
function isTransferType(tertiaryCategory: string): boolean {
  return tertiaryCategory === '转账' || tertiaryCategory === '信用卡还款';
}

/**
 * Parse CSV content and return array of parsed transactions
 *
 * Expected CSV format:
 * 日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注
 */
export function parseCSV(content: string): {
  transactions: ParsedTransaction[];
  errors: Array<{ row: number; message: string; data: string[] }>;
  warnings: Array<{ row: number; message: string }>;
} {
  const lines = content.trim().split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];
  const errors: Array<{ row: number; message: string; data: string[] }> = [];
  const warnings: Array<{ row: number; message: string }> = [];

  if (lines.length < 2) {
    return { transactions, errors: [{ row: 0, message: 'CSV 文件为空或只有表头', data: [] }], warnings };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Validate header
  const expectedHeaders = ['日期', '交易分类', '交易类型', '流入金额', '流出金额', '币种', '资金账户', '标签', '备注'];
  if (headers.length < 9) {
    warnings.push({
      row: 0,
      message: `CSV 表头列数不足 (期望 9 列，实际 ${headers.length} 列)`
    });
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    if (values.length < 5) {
      errors.push({
        row: i + 1,
        message: `列数不足 (至少需要 5 列，实际 ${values.length} 列)`,
        data: values
      });
      continue;
    }

    try {
      const dateStr = values[0] || '';
      const primaryCategory = values[1] || '未分类';
      let tertiaryCategory = values[2] || '未分类'; // Column 交易类型 is actually tertiary

      // Auto-extract tertiary category if it contains "/" (e.g., "理财收入 / JY040205...")
      if (tertiaryCategory.includes('/')) {
        const extracted = tertiaryCategory.split('/')[0].trim();
        if (extracted) {
          tertiaryCategory = extracted;
        }
      }

      // Check if this is a transfer type (转账, 信用卡还款)
      const isTransfer = isTransferType(tertiaryCategory);

      const inflowStr = values[3] || '0.00';
      const outflowStr = values[4] || '0.00';
      const currency = values[5] || '人民币';
      const account = values[6] || '未知账户';
      const tagsStr = values[7] || '';
      const note = values[8] || '';

      // Parse amounts
      const inflow = parseCurrency(inflowStr);
      const outflow = parseCurrency(outflowStr);
      const amount = inflow > 0 ? inflow : outflow;

      // Skip if both amounts are zero
      if (amount === 0) {
        warnings.push({
          row: i + 1,
          message: '流入和流出金额均为 0，跳过此记录'
        });
        continue;
      }

      // Parse date
      const dateParts = parseDateParts(dateStr);
      if (!dateParts.valid) {
        errors.push({
          row: i + 1,
          message: `日期格式无效: ${dateStr}`,
          data: values
        });
        continue;
      }

      // Determine transaction type
      let type: 'income' | 'expense' | 'transfer' = isTransfer ? 'transfer' : determineTransactionType(inflow, outflow);

      // Special handling for "余额调整" - map to 对账收入/对账支出 based on type
      if (tertiaryCategory === '余额调整' && type !== 'transfer') {
        tertiaryCategory = type === 'income' ? '对账收入' : '对账支出';
      }

      // Map tertiary category to secondary category (skip mapping for transfers)
      let hasMapping = true;
      let secondaryCategory = '转账';
      if (type !== 'transfer') {
        const secondary = findSecondaryCategory(primaryCategory, tertiaryCategory, type);
        hasMapping = secondary !== null;
        secondaryCategory = secondary || '未分类';
      }

      // If the tertiary category is actually a secondary category name (not in tertiary list),
      // use the first tertiary category from that secondary category (skip for transfers)
      if (type !== 'transfer' && !hasMapping) {
        const mappings = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
        if (mappings[tertiaryCategory]) {
          // tertiaryCategory is actually a secondary category name
          secondaryCategory = tertiaryCategory;
          // Use the first tertiary category from this secondary
          const firstTertiary = mappings[tertiaryCategory][0];
          if (firstTertiary) {
            tertiaryCategory = firstTertiary;
          }
          // Update hasMapping since we successfully mapped it
          hasMapping = true;
        }
      }

      // Parse tags
      const tags = parseTags(tagsStr);

      // Create transaction
      const transaction: ParsedTransaction = {
        id: `csv-${Date.now()}-${i}`,
        date: dateStr,
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        primaryCategory,
        secondaryCategory,
        tertiaryCategory,
        amount,
        type,
        account,
        currency,
        tags,
        note: note || undefined,
        rawIndex: i + 1,
        hasSecondaryMapping: hasMapping
      };

      transactions.push(transaction);
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : '未知解析错误',
        data: values
      });
    }
  }

  return { transactions, errors, warnings };
}

/**
 * Parse CSV file asynchronously
 */
export async function parseCSVFile(file: File): Promise<{
  transactions: ParsedTransaction[];
  errors: Array<{ row: number; message: string; data: string[] }>;
  warnings: Array<{ row: number; message: string }>;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseCSV(content);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Convert parsed transactions back to CSV format
 */
export function transactionsToCSV(transactions: ParsedTransaction[]): string {
  const headers = ['日期', '交易分类', '交易类型', '流入金额', '流出金额', '币种', '资金账户', '标签', '备注'];

  const rows = transactions.map(t => {
    let inflow = '0.00';
    let outflow = '0.00';

    if (t.type === 'income') {
      inflow = t.amount.toFixed(2);
    } else if (t.type === 'expense') {
      outflow = t.amount.toFixed(2);
    }
    // For transfer type, both remain 0.00 (could be enhanced to store original amounts)

    const tags = t.tags.join(',');
    const note = t.note || '';

    // Escape quotes and wrap in quotes if contains comma
    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    return [
      escape(t.date),
      escape(t.primaryCategory),
      escape(t.tertiaryCategory), // Column 交易类型 stores tertiary category
      inflow,
      outflow,
      escape(t.currency),
      escape(t.account),
      escape(tags),
      escape(note)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
