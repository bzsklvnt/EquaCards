import { useCallback, useState } from 'react';

/**
 * Single trailing draft row for tables: edit in place, then `resetDraft` after a successful save.
 */
export function useDraftRows<T>(createEmpty: () => T) {
  const [draftRow, setDraftRow] = useState<T>(() => createEmpty());

  const resetDraft = useCallback(() => {
    setDraftRow(createEmpty());
  }, [createEmpty]);

  return { draftRow, setDraftRow, resetDraft };
}
