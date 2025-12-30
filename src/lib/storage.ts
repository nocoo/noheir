/**
 * IndexedDB Storage Module for Finance Data
 * Stores transaction data by year with automatic versioning
 */

const DB_NAME = 'FinanceAnalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

export interface StoredYearData {
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

export interface Transaction {
  id: string;
  date: string;
  year: number;
  month: number;
  primaryCategory: string;
  secondaryCategory: string;
  tertiaryCategory: string;
  amount: number;
  account: string;
  description?: string;
  type: 'income' | 'expense' | 'transfer';
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store with 'year' as key path
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'year' });
        store.createIndex('importedAt', 'importedAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * Save transactions for a specific year (replaces existing data)
 */
export async function saveTransactionsForYear(
  year: number,
  transactions: Transaction[],
  metadata?: Partial<StoredYearData['metadata']>
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Calculate totals
    const incomeData = transactions.filter(t => t.type === 'income');
    const expenseData = transactions.filter(t => t.type === 'expense');
    const totalIncome = incomeData.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseData.reduce((sum, t) => sum + t.amount, 0);

    // Create stored data object
    const storedData: StoredYearData = {
      year,
      transactions,
      recordCount: transactions.length,
      importedAt: metadata?.fileName ? new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        fileName: metadata?.fileName,
        fileSize: metadata?.fileSize,
        totalIncome,
        totalExpense
      }
    };

    const request = store.put(storedData);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(new Error(`Failed to save data: ${request.error}`));
    };
  });
}

/**
 * Get all stored years data
 */
export async function getAllStoredYears(): Promise<StoredYearData[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };

    request.onerror = () => {
      db.close();
      reject(new Error(`Failed to load data: ${request.error}`));
    };
  });
}

/**
 * Get transactions for a specific year
 */
export async function getTransactionsForYear(year: number): Promise<Transaction[] | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(year);

    request.onsuccess = () => {
      db.close();
      const data = request.result as StoredYearData | undefined;
      resolve(data?.transactions || null);
    };

    request.onerror = () => {
      db.close();
      reject(new Error(`Failed to load year data: ${request.error}`));
    };
  });
}

/**
 * Delete transactions for a specific year
 */
export async function deleteYear(year: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(year);

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(new Error(`Failed to delete year data: ${request.error}`));
    };
  });
}

/**
 * Clear all stored data
 */
export async function clearAllData(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      reject(new Error(`Failed to clear data: ${request.error}`));
    };
  });
}

/**
 * Export all data as JSON
 */
export async function exportAllData(): Promise<string> {
  const allData = await getAllStoredYears();
  return JSON.stringify(allData, null, 2);
}

/**
 * Import data from JSON (replaces all existing data)
 */
export async function importData(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData) as StoredYearData[];
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing data
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      // Add all imported data
      let count = 0;
      const total = data.length;

      if (total === 0) {
        db.close();
        resolve();
        return;
      }

      data.forEach((yearData) => {
        const request = store.put(yearData);
        request.onsuccess = () => {
          count++;
          if (count === total) {
            db.close();
            resolve();
          }
        };
        request.onerror = () => {
          db.close();
          reject(new Error(`Failed to import data for year ${yearData.year}`));
        };
      });
    };

    clearRequest.onerror = () => {
      db.close();
      reject(new Error(`Failed to clear existing data: ${clearRequest.error}`));
    };
  });
}
