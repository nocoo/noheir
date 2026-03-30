import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ParsedTransaction } from '@/types/data';
import { Transaction } from '@/types/transaction';

// Supabase transactions table interface
interface SupabaseTransactionRow {
  id: string;
  user_id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primary_category: string;
  secondary_category: string | null;
  tertiary_category: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  account: string;
  currency: string;
  tags: string[];
  note: string | null;
  raw_index: number | null;
  has_secondary_mapping: boolean | null;
  created_at: string;
}

// Convert Supabase row to Transaction format
function toTransaction(row: SupabaseTransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    year: row.year,
    month: row.month,
    primaryCategory: row.primary_category,
    secondaryCategory: row.secondary_category || '',
    tertiaryCategory: row.tertiary_category,
    amount: row.amount,
    account: row.account,
    description: row.note || undefined,
    type: row.type
  };
}

// Convert Supabase row to ParsedTransaction format
function toParsedTransaction(row: SupabaseTransactionRow): ParsedTransaction {
  return {
    id: row.id,
    date: row.date,
    year: row.year,
    month: row.month,
    day: row.day,
    primaryCategory: row.primary_category,
    secondaryCategory: row.secondary_category || '',
    tertiaryCategory: row.tertiary_category,
    amount: row.amount,
    type: row.type,
    account: row.account,
    currency: row.currency,
    tags: row.tags || [],
    note: row.note || undefined,
    rawIndex: row.raw_index || 0,
    hasSecondaryMapping: row.has_secondary_mapping ?? true,
  };
}

interface StoredYearData {
  year: number;
  transactions: Transaction[];
  recordCount: number;
  importedAt: string;
  updatedAt: string;
  metadata: {
    fileName?: string;
    fileSize?: number;
    totalIncome: number;
    totalExpense: number;
  };
}

interface UseSupabaseTransactionsReturn {
  // Read operations
  loadAllYears: () => Promise<StoredYearData[]>;
  loadYear: (year: number) => Promise<Transaction[]>;
  loadLatestYearOnly: () => Promise<{ year: number; transactions: Transaction[] } | null>;
  loadRemainingYears: (excludeYear: number) => Promise<StoredYearData[]>;
  checkExistingData: (year: number) => Promise<number | null>;
  getAvailableYears: () => Promise<number[]>;

  // Write operations
  uploadTransactions: (
    transactions: ParsedTransaction[],
    year: number
  ) => Promise<{ success: boolean; error?: string; uploaded?: number }>;
  deleteYearData: (year: number) => Promise<{ success: boolean; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
}

export function useSupabaseTransactions(): UseSupabaseTransactionsReturn {
  const { user } = useAuth();

  // Get all available years for the user
  const getAvailableYears = useCallback(async (): Promise<number[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch in batches to handle more than 1000 records
    const years: number[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('transactions')
        .select('year')
        .eq('user_id', user.id)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching years:', error);
        throw error;
      }

      if (data && data.length > 0) {
        data.forEach(d => {
          if (!years.includes(d.year)) {
            years.push(d.year);
          }
        });
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return years.sort((a, b) => b - a);
  }, [user]);

  // Load all years data
  const loadAllYears = useCallback(async (): Promise<StoredYearData[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Supabase has a default limit of 1000 rows, need to fetch in batches
    let allRows: SupabaseTransactionRow[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error loading transactions:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Group by year
    const yearMap = new Map<number, SupabaseTransactionRow[]>();
    allRows.forEach(row => {
      if (!yearMap.has(row.year)) {
        yearMap.set(row.year, []);
      }
      yearMap.get(row.year)!.push(row);
    });

    // Convert to StoredYearData format
    const result: StoredYearData[] = Array.from(yearMap.entries()).map(([year, rows]) => {
      const transactions = rows.map(toTransaction);
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        year,
        transactions,
        recordCount: transactions.length,
        importedAt: rows[0]?.created_at || new Date().toISOString(),
        updatedAt: rows[rows.length - 1]?.created_at || new Date().toISOString(),
        metadata: {
          totalIncome: income,
          totalExpense: expense,
        },
      };
    });

    return result.sort((a, b) => b.year - a.year);
  }, [user]);

  // Load specific year data
  const loadYear = useCallback(async (year: number): Promise<Transaction[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch in batches to handle more than 1000 records
    let allRows: SupabaseTransactionRow[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .order('date', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error loading year data:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return allRows.map(toTransaction);
  }, [user]);

  // Check if data exists for a specific year
  const checkExistingData = useCallback(async (year: number): Promise<number | null> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('year', year);

    if (error) {
      console.error('Error checking existing data:', error);
      return null;
    }

    return count ?? 0;
  }, [user]);

  // Upload transactions to Supabase
  const uploadTransactions = useCallback(async (
    transactions: ParsedTransaction[],
    year: number
  ): Promise<{ success: boolean; error?: string; uploaded?: number }> => {
    if (!user) {
      return { success: false, error: '用户未登录' };
    }

    if (transactions.length === 0) {
      return { success: false, error: '没有数据需要上传' };
    }

    try {
      // Convert ParsedTransaction to Supabase format
      const records: Omit<SupabaseTransactionRow, 'id' | 'user_id' | 'created_at'>[] = transactions.map(t => ({
        date: t.date,
        year: t.year,
        month: t.month,
        day: t.day,
        primary_category: t.primaryCategory,
        secondary_category: t.secondaryCategory,
        tertiary_category: t.tertiaryCategory,
        amount: t.amount,
        type: t.type,
        account: t.account,
        currency: t.currency,
        tags: t.tags,
        note: t.note || null,
        raw_index: t.rawIndex,
        has_secondary_mapping: t.hasSecondaryMapping,
      }));

      // Upload in batches (Supabase limit is 1000 rows per insert)
      const batchSize = 1000;
      let uploadedCount = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('transactions')
          .insert(batch)
          .select();

        if (error) {
          console.error('Error uploading batch:', error);
          return { success: false, error: `上传失败: ${error.message}` };
        }

        // Count actual inserted rows
        uploadedCount += data?.length ?? batch.length;
      }

      return { success: true, uploaded: uploadedCount };
    } catch (error) {
      console.error('Error uploading transactions:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }, [user]);

  // Delete all transactions for a specific year
  const deleteYearData = useCallback(async (year: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: '用户未登录' };
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('year', year);

    if (error) {
      console.error('Error deleting year data:', error);
      return { success: false, error: `删除失败: ${error.message}` };
    }

    return { success: true };
  }, [user]);

  // Clear all user data
  const clearAllData = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: '用户未登录' };
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing all data:', error);
      return { success: false, error: `清空失败: ${error.message}` };
    }

    return { success: true };
  }, [user]);

  // Load only the latest year (for fast initial render)
  const loadLatestYearOnly = useCallback(async (): Promise<{ year: number; transactions: Transaction[] } | null> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // First get the latest year
    const { data: yearData, error: yearError } = await supabase
      .from('transactions')
      .select('year')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .limit(1);

    if (yearError) {
      console.error('Error fetching latest year:', yearError);
      throw yearError;
    }

    if (!yearData || yearData.length === 0) {
      return null;
    }

    const latestYear = yearData[0].year;

    // Load only this year's transactions
    const transactions = await loadYear(latestYear);
    return { year: latestYear, transactions };
  }, [user, loadYear]);

  // Load all years except the excluded one (for background loading)
  const loadRemainingYears = useCallback(async (excludeYear: number): Promise<StoredYearData[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use a more efficient query to get distinct years
    // Supabase supports RPC calls or we can use the range approach
    const years: number[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    // Fetch year data in batches to get all years
    while (hasMore) {
      const { data, error } = await supabase
        .from('transactions')
        .select('year')
        .eq('user_id', user.id)
        .neq('year', excludeYear)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching remaining years:', error);
        throw error;
      }

      if (data && data.length > 0) {
        data.forEach(d => {
          if (!years.includes(d.year)) {
            years.push(d.year);
          }
        });
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    if (years.length === 0) {
      return [];
    }

    // Sort years descending
    years.sort((a, b) => b - a);

    // Load each year's data in parallel
    const results = await Promise.all(
      years.map(async (year) => {
        const transactions = await loadYear(year);
        const income = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          year,
          transactions,
          recordCount: transactions.length,
          importedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            totalIncome: income,
            totalExpense: expense,
          },
        };
      })
    );

    return results;
  }, [user, loadYear]);

  return {
    loadAllYears,
    loadYear,
    loadLatestYearOnly,
    loadRemainingYears,
    checkExistingData,
    getAvailableYears,
    uploadTransactions,
    deleteYearData,
    clearAllData,
  };
}
