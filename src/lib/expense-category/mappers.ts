// Re-exports the category mapper from the recurring-expense module so
// the import site stays close to consumers (categories live in their
// own folder per the spec § Project Structure).

export { type CategoryRow, type ExpenseCategory, toCategory } from "../recurring-expense/mappers";
