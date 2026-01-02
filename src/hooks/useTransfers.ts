import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Transfer, ParsedTransfer, RawTransferCSVRow } from '@/types/data';

export interface StoredTransferYearData {
  year: number;
  recordCount: number;
  importedAt: string;
  metadata: {
    totalInflow: number;
    totalOutflow: number;
  };
}

export function useTransfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [storedYearsData, setStoredYearsData] = useState<StoredTransferYearData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load transfers data from Supabase
  useEffect(() => {
    if (user) {
      loadTransfers();
    }
  }, [user]);

  const loadTransfers = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
      updateStoredYearsData(data || []);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStoredYearsData = (data: Transfer[]) => {
    // Group by year
    const yearMap = new Map<number, Transfer[]>();
    data.forEach(t => {
      if (!yearMap.has(t.year)) {
        yearMap.set(t.year, []);
      }
      yearMap.get(t.year)!.push(t);
    });

    // Calculate metadata for each year
    const yearsData: StoredTransferYearData[] = Array.from(yearMap.entries()).map(([year, yearTransfers]) => {
      const totalInflow = yearTransfers.reduce((sum, t) => sum + (t.inflow_amount || 0), 0);
      const totalOutflow = yearTransfers.reduce((sum, t) => sum + (t.outflow_amount || 0), 0);
      const earliestImport = yearTransfers.reduce((min, t) =>
        t.created_at < min ? t.created_at : min, yearTransfers[0].created_at);

      return {
        year,
        recordCount: yearTransfers.length,
        importedAt: earliestImport,
        metadata: {
          totalInflow,
          totalOutflow,
        },
      };
    });

    setStoredYearsData(yearsData.sort((a, b) => b.year - a.year));
  };

  // Parse transfer CSV
  const parseTransferCSV = (csvText: string): ParsedTransfer[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());

    // Validate headers
    const expectedHeaders = ['日期', '收支大类', '交易分类', '交易类型', '流入金额', '流出金额', '币种', '资金账户', '标签', '备注'];
    const missingHeaders = expectedHeaders.filter(expected => !headers.includes(expected));

    if (missingHeaders.length > 0) {
      throw new Error(`CSV 表头格式错误。缺少以下列: ${missingHeaders.join(', ')}`);
    }

    const transfers: ParsedTransfer[] = [];
    let filteredCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;

      const row: RawTransferCSVRow = {
        date: values[0]?.trim() || '',
        primaryCategory: values[1]?.trim() || '',
        secondaryCategory: values[2]?.trim() || '转账',
        transactionType: values[3]?.trim() || '',
        inflow: values[4]?.trim() || '0',
        outflow: values[5]?.trim() || '0',
        currency: values[6]?.trim() || '人民币',
        account: values[7]?.trim() || '',
        tags: values[8]?.trim() || '',
        note: values[9]?.trim() || '',
      };

      // Filter out "转账 / 优惠抵扣" - these are already recorded as income in transactions
      if (row.transactionType === '转账 / 优惠抵扣') {
        filteredCount++;
        continue;
      }

      // Parse date
      const dateMatch = row.date.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!dateMatch) continue;

      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);

      // Parse amounts
      const inflowAmount = parseFloat(row.inflow) || 0;
      const outflowAmount = parseFloat(row.outflow) || 0;

      // Parse tags
      const tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

      transfers.push({
        date: row.date,
        year,
        month,
        day,
        primaryCategory: row.primaryCategory || null,
        secondaryCategory: row.secondaryCategory,
        transactionType: row.transactionType,
        inflowAmount,
        outflowAmount,
        currency: row.currency,
        account: row.account,
        tags,
        note: row.note || undefined,
        rawIndex: i,
      });
    }

    if (filteredCount > 0) {
      console.log(`Filtered out ${filteredCount} "转账 / 优惠抵扣" records`);
    }

    return transfers;
  };

  // Upload transfers to Supabase
  const uploadTransfers = async (parsedTransfers: ParsedTransfer[], year: number): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    // First, delete existing transfers for this year
    await supabase
      .from('transfers')
      .delete()
      .eq('user_id', user.id)
      .eq('year', year);

    // Prepare data for insertion
    const transfersToInsert = parsedTransfers.map(t => ({
      user_id: user.id,
      date: t.date,
      year: t.year,
      month: t.month,
      day: t.day,
      primary_category: t.primaryCategory,
      secondary_category: t.secondaryCategory,
      transaction_type: t.transactionType,
      inflow_amount: t.inflowAmount,
      outflow_amount: t.outflowAmount,
      currency: t.currency,
      account: t.account,
      tags: t.tags,
      note: t.note || null,
      raw_index: t.rawIndex,
    }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < transfersToInsert.length; i += batchSize) {
      const batch = transfersToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('transfers')
        .insert(batch);

      if (error) throw error;
    }

    // Reload data
    await loadTransfers();
  };

  // Delete all transfers for a year with optimistic update
  const deleteYearTransfers = async (year: number): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    // Optimistic update: remove from local state immediately
    const previousTransfers = transfers;
    const previousYearsData = storedYearsData;

    setTransfers(prev => prev.filter(t => t.year !== year));
    updateStoredYearsData(transfers.filter(t => t.year !== year));

    try {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('user_id', user.id)
        .eq('year', year);

      if (error) throw error;
    } catch (error) {
      // Rollback on error
      console.error('Failed to delete year transfers:', error);
      setTransfers(previousTransfers);
      setStoredYearsData(previousYearsData);
      await loadTransfers();
      throw error;
    }
  };

  // Clear all transfers with optimistic update
  const clearAllTransfers = async (): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    // Optimistic update: clear local state immediately
    const previousTransfers = transfers;
    const previousYearsData = storedYearsData;

    setTransfers([]);
    setStoredYearsData([]);

    try {
      const { error } = await supabase
        .from('transfers')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      // Rollback on error
      console.error('Failed to clear all transfers:', error);
      setTransfers(previousTransfers);
      setStoredYearsData(previousYearsData);
      await loadTransfers();
      throw error;
    }
  };

  // Export transfers as CSV
  const exportTransfers = (year?: number): string => {
    let dataToExport = transfers;
    if (year !== undefined) {
      dataToExport = transfers.filter(t => t.year === year);
    }

    const headers = ['日期,收支大类,交易分类,交易类型,流入金额,流出金额,币种,资金账户,标签,备注'];
    const rows = dataToExport.map(t =>
      `${t.date},${t.primary_category || ''},${t.secondary_category},${t.transaction_type},${t.inflow_amount},${t.outflow_amount},${t.currency},${t.account},${t.tags.join(',')},${t.note || ''}`
    );

    return [...headers, ...rows].join('\n');
  };

  // Get transfers for a specific year
  const getTransfersForYear = (year: number): Transfer[] => {
    return transfers.filter(t => t.year === year);
  };

  return {
    transfers,
    storedYearsData,
    isLoading,
    loadTransfers,
    parseTransferCSV,
    uploadTransfers,
    deleteYearTransfers,
    clearAllTransfers,
    exportTransfers,
    getTransfersForYear,
  };
}
