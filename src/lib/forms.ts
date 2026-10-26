export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formOptional(formData: FormData, key: string): string | null {
  const value = formString(formData, key);
  return value || null;
}

export function formCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formNumber(formData: FormData, key: string): number {
  const value = Number(formString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

export type ActionState = {
  error: string | null;
  success: string | null;
  fieldErrors?: Record<string, string[]>;
};

export const EMPTY_ACTION_STATE: ActionState = { error: null, success: null };

export function zodFieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flat).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0),
  );
}

export function firstZodMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
