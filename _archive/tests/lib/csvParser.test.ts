import { describe, it, expect } from 'bun:test';
import { parseCSV, transactionsToCSV } from '../../src/lib/csvParser';

describe('csvParser', () => {
  it('returns error when CSV has only header', () => {
    const result = parseCSV('日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注');
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('CSV 文件为空或只有表头');
  });

  it('validates header and reports missing columns', () => {
    const csv = '日期,交易分类,交易类型\n2024-01-01,收入,工资';
    const result = parseCSV(csv);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain('CSV 表头格式错误');
  });

  it('parses rows and maps categories with amount direction', () => {
    const csv = [
      '日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注',
      '2024-01-01,薪资收入,工资,100,0,人民币,工资卡,标签1,备注1',
      '2024-01-02,日常吃喝,吃饭,0,50,人民币,信用卡,,',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.errors.length).toBe(0);
    expect(result.transactions.length).toBe(2);
    expect(result.transactions[0].type).toBe('income');
    expect(result.transactions[0].secondaryCategory).toBe('薪资收入');
    expect(result.transactions[1].type).toBe('expense');
    expect(result.transactions[1].secondaryCategory).toBe('日常吃喝');
  });

  it('skips zero amount rows and warns', () => {
    const csv = [
      '日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注',
      '2024-01-01,薪资收入,工资,0,0,人民币,工资卡,,',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.transactions.length).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain('流入和流出金额均为 0');
  });

  it('normalizes tertiary category containing slashes', () => {
    const csv = [
      '日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注',
      '2024-01-01,投资收入,理财收入 / JY040205,100,0,人民币,投资账户,,',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.transactions[0].tertiaryCategory).toBe('理财收入');
  });

  it('maps balance adjustment categories', () => {
    const csv = [
      '日期,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注',
      '2024-01-01,系统支出,余额调整,0,20,人民币,账户A,,',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.transactions[0].tertiaryCategory).toBe('对账支出');
  });

  it('exports transactions to CSV', () => {
    const csv = transactionsToCSV([
      {
        id: 't-1',
        date: '2024-01-01',
        year: 2024,
        month: 1,
        day: 1,
        primaryCategory: '薪资收入',
        secondaryCategory: '薪资收入',
        tertiaryCategory: '工资',
        amount: 100,
        type: 'income',
        account: '工资卡',
        currency: '人民币',
        tags: ['标签1'],
        note: '备注',
        rawIndex: 1,
        hasSecondaryMapping: true,
      },
    ]);

    expect(csv.split('\n')[0]).toContain('日期,交易分类,交易类型');
    expect(csv).toContain('工资');
  });
});
