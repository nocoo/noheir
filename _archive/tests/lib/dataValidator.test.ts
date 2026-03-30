import { describe, it, expect } from 'bun:test';
import {
  validateDate,
  validateCategory,
  validateAmount,
  validateAccount,
  validateCurrency,
  validateTransaction,
  calculateQualityMetrics,
  cleanTransactions,
  getValidationSummary,
} from '../../src/lib/dataValidator';
import type { ParsedTransaction, TransactionValidation } from '../../src/types/data';

const baseTransaction: ParsedTransaction = {
  id: 't-1',
  date: '2024-01-01',
  year: 2024,
  month: 1,
  day: 1,
  primaryCategory: '收入',
  secondaryCategory: '工资',
  tertiaryCategory: '月薪',
  amount: 100,
  type: 'income',
  account: '账户A',
  currency: 'CNY',
  tags: [],
  note: undefined,
  rawIndex: 1,
  hasSecondaryMapping: true,
};

describe('dataValidator', () => {
  it('validates dates with errors and warnings', () => {
    const empty = validateDate('');
    expect(empty.isValid).toBe(false);
    expect(empty.errors).toContain('日期为空');

    const invalid = validateDate('not-a-date');
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toContain('日期格式无效');

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const future = validateDate(futureDate);
    expect(future.warnings).toContain('日期为未来时间');

    const old = validateDate('1999-01-01');
    expect(old.warnings).toContain('日期过于久远');
  });

  it('validates category fields and mapping warnings', () => {
    const result = validateCategory('', '', '', false);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('一级分类为空');
    expect(result.warnings).toContain('三级分类为空');
    expect(result.warnings).toContain('二级分类为空或未映射');
  });

  it('validates amount with errors and warnings', () => {
    const invalid = validateAmount(Number.NaN, 'income');
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toContain('金额不是有效数字');

    const zero = validateAmount(0, 'expense');
    expect(zero.isValid).toBe(false);
    expect(zero.errors).toContain('金额必须大于零');

    const huge = validateAmount(1000001, 'income');
    expect(huge.warnings).toContain('金额异常巨大，请确认');

    const precise = validateAmount(1.234, 'income');
    expect(precise.warnings).toContain('金额小数位过多');
  });

  it('validates account and currency', () => {
    const account = validateAccount('');
    expect(account.isValid).toBe(false);
    expect(account.errors).toContain('账户为空');

    const currency = validateCurrency('ABC');
    expect(currency.warnings).toContain('未知币种: ABC');
  });

  it('calculates transaction severity', () => {
    const critical = validateTransaction({
      ...baseTransaction,
      date: '',
      amount: 0,
    });
    expect(critical.severity).toBe('critical');

    const warning = validateTransaction({
      ...baseTransaction,
      date: '2024-01-01',
      tertiaryCategory: '',
      secondaryCategory: '未分类',
      currency: 'ABC',
      hasSecondaryMapping: false,
    });
    expect(warning.severity).toBe('warning');
  });

  it('calculates quality metrics and summary', () => {
    const validations = [
      validateTransaction(baseTransaction),
      validateTransaction({
        ...baseTransaction,
        id: 't-2',
        date: '2999-01-01',
        amount: 0,
        hasSecondaryMapping: false,
      }),
    ];

    const metrics = calculateQualityMetrics(validations);
    expect(metrics.totalRecords).toBe(2);
    expect(metrics.zeroAmounts).toBe(1);
    expect(metrics.futureDates).toBe(1);
    expect(metrics.missingSecondaryMappings).toBe(1);

    const summary = getValidationSummary(validations);
    expect(summary.total).toBe(2);
    expect(summary.errors).toBeGreaterThan(0);
  });

  it('cleans transactions with default options', () => {
    const validations: TransactionValidation[] = [
      {
        transaction: baseTransaction,
        isValid: true,
        fields: {
          date: { field: 'date', isValid: true, errors: [], warnings: [] },
          category: { field: 'category', isValid: true, errors: [], warnings: [] },
          amount: { field: 'amount', isValid: true, errors: [], warnings: [] },
          account: { field: 'account', isValid: true, errors: [], warnings: [] },
          currency: { field: 'currency', isValid: true, errors: [], warnings: [] },
        },
        errors: [],
        warnings: [],
        severity: 'valid',
      },
      {
        transaction: { ...baseTransaction, id: 't-3' },
        isValid: false,
        fields: {
          date: { field: 'date', isValid: false, errors: ['日期为空'], warnings: [] },
          category: { field: 'category', isValid: true, errors: [], warnings: [] },
          amount: { field: 'amount', isValid: false, errors: ['金额必须大于零'], warnings: [] },
          account: { field: 'account', isValid: true, errors: [], warnings: [] },
          currency: { field: 'currency', isValid: true, errors: [], warnings: [] },
        },
        errors: ['日期为空', '金额必须大于零'],
        warnings: [],
        severity: 'critical',
      },
      {
        transaction: { ...baseTransaction, id: 't-4' },
        isValid: true,
        fields: {
          date: { field: 'date', isValid: true, errors: [], warnings: ['日期为未来时间'] },
          category: { field: 'category', isValid: true, errors: [], warnings: ['三级分类为空'] },
          amount: { field: 'amount', isValid: true, errors: [], warnings: [] },
          account: { field: 'account', isValid: true, errors: [], warnings: [] },
          currency: { field: 'currency', isValid: true, errors: [], warnings: ['未知币种'] },
        },
        errors: [],
        warnings: ['日期为未来时间', '三级分类为空', '未知币种'],
        severity: 'warning',
      },
    ];

    const cleaned = cleanTransactions(validations);
    expect(cleaned.length).toBe(2);
    expect(cleaned.every(t => t.validationSeverity !== 'critical')).toBe(true);
  });
});
