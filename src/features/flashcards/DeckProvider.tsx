import React, { createContext, useContext } from 'react';

const DeckContext = createContext<unknown>(undefined);

/** Deck / study state; expanded when flashcards feature lands. */
export function DeckProvider({ children }: { children: React.ReactNode }) {
  return <DeckContext.Provider value={null}>{children}</DeckContext.Provider>;
}

export function useDeck(): unknown {
  const v = useContext(DeckContext);
  if (v === undefined) {
    throw new Error('useDeck must be used within DeckProvider');
  }
  return v;
}
