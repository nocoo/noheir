import { describe, it, expect } from 'bun:test';
import { renderHook } from '@testing-library/react';

interface TestItem extends Record<string, unknown> {
  id: string;
  name: string;
  age: number;
  status: 'active' | 'inactive';
}

const testItems: TestItem[] = [
  { id: '1', name: 'Alice', age: 30, status: 'active' },
  { id: '2', name: 'Bob', age: 25, status: 'inactive' },
  { id: '3', name: 'Charlie', age: 35, status: 'active' },
];

describe('useFilteredAndSorted', () => {
  describe('basic behavior', () => {
    it('returns empty array for undefined items', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({ items: undefined })
      );

      expect(result.current).toEqual([]);
    });

    it('returns empty array for empty items', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({ items: [] })
      );

      expect(result.current).toEqual([]);
    });

    it('returns original array when no filters or sort provided', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({ items: testItems })
      );

      expect(result.current).toEqual(testItems);
    });
  });

  describe('filtering', () => {
    it('filters by single field', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'active' },
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current.every(item => item.status === 'active')).toBe(true);
    });

    it('filters by multiple fields', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'active', name: 'Alice' },
        })
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ id: '1', name: 'Alice', age: 30, status: 'active' });
    });

    it('ignores "all" filter value', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'all' },
        })
      );

      expect(result.current).toHaveLength(3);
    });

    it('ignores undefined filter value', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: undefined },
        })
      );

      expect(result.current).toHaveLength(3);
    });

    it('uses custom filter function', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { minAge: 30 },
          customFilter: (item, filters) => item.age >= (filters.minAge as number),
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current.every(item => item.age >= 30)).toBe(true);
    });

    it('returns no items when filter does not match', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'pending' },
        })
      );

      expect(result.current).toHaveLength(0);
    });
  });

  describe('sorting', () => {
    it('sorts strings in ascending order', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'name', order: 'asc' },
        })
      );

      expect(result.current[0].name).toBe('Alice');
      expect(result.current[1].name).toBe('Bob');
      expect(result.current[2].name).toBe('Charlie');
    });

    it('sorts strings in descending order', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'name', order: 'desc' },
        })
      );

      expect(result.current[0].name).toBe('Charlie');
      expect(result.current[1].name).toBe('Bob');
      expect(result.current[2].name).toBe('Alice');
    });

    it('sorts numbers in ascending order', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'age', order: 'asc' },
        })
      );

      expect(result.current[0].age).toBe(25);
      expect(result.current[1].age).toBe(30);
      expect(result.current[2].age).toBe(35);
    });

    it('sorts numbers in descending order', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'age', order: 'desc' },
        })
      );

      expect(result.current[0].age).toBe(35);
      expect(result.current[1].age).toBe(30);
      expect(result.current[2].age).toBe(25);
    });

    it('sorts Chinese strings with locale support', async () => {
      const chineseItems: TestItem[] = [
        { id: '1', name: '张三', age: 30, status: 'active' },
        { id: '2', name: '李四', age: 25, status: 'inactive' },
        { id: '3', name: '王五', age: 35, status: 'active' },
      ];

      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: chineseItems,
          sort: { field: 'name', order: 'asc' },
        })
      );

      expect(result.current).toHaveLength(3);
      const names = result.current.map(item => item.name);
      expect(names).toEqual(names.slice().sort((a, b) => a.localeCompare(b, 'zh-CN')));
    });

    it('uses custom sort function', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'age', order: 'desc' },
          customSort: (a, b) => a.age - b.age,
        })
      );

      expect(result.current[0].age).toBe(25);
      expect(result.current[1].age).toBe(30);
      expect(result.current[2].age).toBe(35);
    });

    it('uses getValueCallback for sorting', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          sort: { field: 'age', order: 'asc' },
          getValueCallback: (item, field) => item[field as keyof TestItem] as number * -1,
        })
      );

      expect(result.current[0].age).toBe(35);
      expect(result.current[1].age).toBe(30);
      expect(result.current[2].age).toBe(25);
    });
  });

  describe('combined filtering and sorting', () => {
    it('filters and sorts together', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'active' },
          sort: { field: 'age', order: 'asc' },
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].age).toBe(30);
      expect(result.current[1].age).toBe(35);
    });

    it('uses custom filter and sort together', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { minAge: 28 },
          sort: { field: 'age', order: 'desc' },
          customFilter: (item, filters) => item.age >= (filters.minAge as number),
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].age).toBe(35);
      expect(result.current[1].age).toBe(30);
    });
  });

  describe('memoization', () => {
    it('returns consistent result when dependencies do not change', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result, rerender } = renderHook(() =>
        useFilteredAndSorted<TestItem>({
          items: testItems,
          filters: { status: 'active' },
          sort: { field: 'name', order: 'asc' },
        })
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toEqual(secondResult);
    });

    it('recalculates when items change', async () => {
      const { useFilteredAndSorted } = await import(`../../src/hooks/useFilteredAndSorted?test=${Date.now()}`);
      const { result, rerender } = renderHook(
        ({ items }) =>
          useFilteredAndSorted<TestItem>({
            items,
            sort: { field: 'name', order: 'asc' },
          }),
        { initialProps: { items: testItems } }
      );

      const firstResult = result.current;
      rerender({ items: [...testItems, { id: '4', name: 'David', age: 40, status: 'active' }] });
      const secondResult = result.current;

      expect(firstResult).not.toEqual(secondResult);
      expect(secondResult).toHaveLength(4);
    });
  });
});
