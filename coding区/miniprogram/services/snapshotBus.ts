import type { MatchSnapshot } from "../domain/models";

type SnapshotListener = (snapshot: MatchSnapshot) => void;

const listeners = new Map<string, Set<SnapshotListener>>();

export const snapshotBus = {
  publish(snapshot: MatchSnapshot): void {
    listeners.get(snapshot.matchId)?.forEach((listener) => listener(snapshot));
  },

  subscribe(matchId: string, listener: SnapshotListener): () => void {
    const matchListeners = listeners.get(matchId) ?? new Set<SnapshotListener>();
    matchListeners.add(listener);
    listeners.set(matchId, matchListeners);

    return () => {
      const currentListeners = listeners.get(matchId);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        listeners.delete(matchId);
      }
    };
  }
};
