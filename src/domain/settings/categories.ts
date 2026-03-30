export const toggleCategory = (
  categories: string[],
  category: string,
): string[] => {
  if (categories.includes(category)) {
    return categories.filter((item) => item !== category);
  }
  return [...categories, category];
};

export const toggleAllInGroup = (
  categories: string[],
  group: string[],
): string[] => {
  const allSelected = group.every((item) => categories.includes(item));
  if (allSelected) {
    return categories.filter((item) => !group.includes(item));
  }
  return Array.from(new Set([...categories, ...group]));
};

export const countSelectedInGroup = (
  categories: string[],
  group: string[],
): number => {
  return group.filter((item) => categories.includes(item)).length;
};
