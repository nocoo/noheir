export const buildSavingsRate = (totalIncome: number, totalExpense: number) => {
  return totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
};
