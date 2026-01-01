import { useMemo } from 'react';

export interface FilterConfig {
  [key: string]: any;
}

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface UseFilteredAndSortedOptions<T> {
  items: T[] | undefined;
  filters?: FilterConfig;
  sort?: SortConfig;
  customFilter?: (item: T, filters: FilterConfig) => boolean;
  customSort?: (a: T, b: T, field: string, order: 'asc' | 'desc') => number;
  getValueCallback?: (item: T, field: string) => any;
}

export function useFilteredAndSorted<T extends Record<string, any>>({
  items,
  filters = {},
  sort,
  customFilter,
  customSort,
  getValueCallback,
}: UseFilteredAndSortedOptions<T>): T[] {
  return useMemo(() => {
    if (!items) return [];

    let result = [...items];

    // Apply filters
    result = result.filter(item => {
      // If custom filter is provided, use it
      if (customFilter) {
        return customFilter(item, filters);
      }

      // Default filter behavior: check each filter key
      for (const [key, value] of Object.entries(filters)) {
        if (value !== 'all' && value !== undefined && item[key] !== value) {
          return false;
        }
      }
      return true;
    });

    // Apply sorting
    if (sort) {
      result.sort((a, b) => {
        // If custom sort is provided, use it
        if (customSort) {
          return customSort(a, b, sort.field, sort.order);
        }

        // Default sort behavior
        const aVal = getValueCallback ? getValueCallback(a, sort.field) : a[sort.field];
        const bVal = getValueCallback ? getValueCallback(b, sort.field) : b[sort.field];

        // String sorting with Chinese locale support
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.order === 'asc'
            ? aVal.localeCompare(bVal, 'zh-CN')
            : bVal.localeCompare(aVal, 'zh-CN');
        }

        // Number sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.order === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return result;
  }, [items, filters, sort, customFilter, customSort, getValueCallback]);
}
