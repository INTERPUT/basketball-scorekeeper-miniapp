"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshotBus = void 0;
const listeners = new Map();
exports.snapshotBus = {
    publish(snapshot) {
        listeners.get(snapshot.matchId)?.forEach((listener) => listener(snapshot));
    },
    subscribe(matchId, listener) {
        const matchListeners = listeners.get(matchId) ?? new Set();
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
