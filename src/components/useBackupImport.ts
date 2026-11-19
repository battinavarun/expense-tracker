import { sanitizeState } from '../lib/storage';
import { useStore } from '../store/store';
import { useToast } from './Toast';

/**
 * Returns a handler that validates a JSON backup file and, after confirmation, replaces all app data.
 * Resolves to true if the import happened.
 */
export function useBackupImport() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  return async (file: File | undefined): Promise<boolean> => {
    if (!file) return false;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('That file is too large to be a backup.');
      const parsed: unknown = JSON.parse(await file.text());
      const looksRight = typeof parsed === 'object' && parsed !== null && ('expenses' in parsed || 'categories' in parsed);
      if (!looksRight) throw new Error('This does not look like a Rupee Vault backup.');
      const next = sanitizeState(parsed);
      const hasData = state.expenses.length > 0 || state.categories.length > 0 || state.income.length > 0;
      const ok =
        !hasData ||
        window.confirm(
          `Import ${next.expenses.length} expenses and ${next.categories.length} categories?\n\nThis REPLACES everything currently in the app. Export a backup first if you are unsure.`,
        );
      if (!ok) return false;
      dispatch({ type: 'REPLACE_ALL', state: next });
      toast(`Imported ${next.expenses.length} expenses`);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that file.', { tone: 'error' });
      return false;
    }
  };
}
