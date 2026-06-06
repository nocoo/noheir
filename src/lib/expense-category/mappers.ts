// Re-exports the category mapper from the recurring-expense module so
// the import site stays close to consumers (categories live in their
// own folder per the spec § Project Structure).

export { toCategory, type CategoryRow, type ExpenseCategory } from "../recurring-expense/mappers";
