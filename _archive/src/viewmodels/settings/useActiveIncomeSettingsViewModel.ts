import { useCallback, useMemo, useRef, useState } from 'react';
import { useSupabaseSettings } from '@/hooks/useSupabaseSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_INCOME_CATEGORIES } from '@/types/category';
import { countSelectedInGroup, toggleAllInGroup, toggleCategory } from '@/domain/settings/categories';

export function useActiveIncomeSettingsViewModel() {
  const { user } = useAuth();
  const { data, loading, updateSingleSetting } = useSupabaseSettings();
  const { settings, updateActiveIncomeCategories } = useSettings();
  const [showSelector, setShowSelector] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const categoriesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dbSettings = data?.settings;
  const grouped = DEFAULT_INCOME_CATEGORIES;
  const totalCategories = useMemo(
    () => Object.values(grouped).flat().length,
    [grouped]
  );

  const debouncedUpdateCategories = useCallback((categories: string[]) => {
    if (categoriesTimeoutRef.current) {
      clearTimeout(categoriesTimeoutRef.current);
    }
    categoriesTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSingleSetting('activeIncomeCategories', categories);
      } catch (err) {
        console.error('Failed to update active income categories:', err);
      }
    }, 1000);
  }, [updateSingleSetting]);

  const handleToggleCategory = (category: string) => {
    const next = toggleCategory(settings.activeIncomeCategories, category);
    updateActiveIncomeCategories(next);
    debouncedUpdateCategories(next);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const toggleAll = (groupName: string) => {
    const group = grouped[groupName] || [];
    const next = toggleAllInGroup(settings.activeIncomeCategories, group);
    updateActiveIncomeCategories(next);
    debouncedUpdateCategories(next);
  };

  const getGroupStats = (groupName: string) => {
    const group = grouped[groupName] || [];
    const selected = countSelectedInGroup(settings.activeIncomeCategories, group);
    return {
      total: group.length,
      selected,
      allSelected: selected === group.length && group.length > 0,
      someSelected: selected > 0 && selected < group.length,
    };
  };

  return {
    isVisible: Boolean(user && dbSettings),
    loading,
    grouped,
    totalCategories,
    activeIncomeCategories: settings.activeIncomeCategories,
    showSelector,
    expandedGroups,
    setShowSelector,
    toggleGroup,
    toggleAll,
    handleToggleCategory,
    getGroupStats,
  };
}
