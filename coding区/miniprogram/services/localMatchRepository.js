"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localMatchRepository = void 0;
const snapshotBus_1 = require("./snapshotBus");
const MATCHES_KEY = "matches";
const ROOMS_KEY = "rooms";
const SNAPSHOTS_KEY = "snapshots";
const EVENTS_KEY = "events";
function readMap(key) {
    return wx.getStorageSync(key) || {};
}
function writeMap(key, value) {
    wx.setStorageSync(key, value);
}
exports.localMatchRepository = {
    save(match, room, snapshot) {
        const matches = readMap(MATCHES_KEY);
        const rooms = readMap(ROOMS_KEY);
        const snapshots = readMap(SNAPSHOTS_KEY);
        matches[match.matchId] = match;
        rooms[room.roomCode] = room;
        snapshots[match.matchId] = snapshot;
        writeMap(MATCHES_KEY, matches);
        writeMap(ROOMS_KEY, rooms);
        writeMap(SNAPSHOTS_KEY, snapshots);
    },
    findRoom(roomCode) {
        const rooms = readMap(ROOMS_KEY);
        return rooms[roomCode];
    },
    findSnapshot(matchId) {
        const snapshots = readMap(SNAPSHOTS_KEY);
        return snapshots[matchId];
    },
    findMatch(matchId) {
        const matches = readMap(MATCHES_KEY);
        return matches[matchId];
    },
    findEvents(matchId) {
        const events = readMap(EVENTS_KEY);
        return events[matchId] ?? [];
    },
    saveEvents(matchId, events) {
        const storedEvents = readMap(EVENTS_KEY);
        storedEvents[matchId] = events;
        writeMap(EVENTS_KEY, storedEvents);
    },
    saveSnapshot(snapshot) {
        const snapshots = readMap(SNAPSHOTS_KEY);
        snapshots[snapshot.matchId] = snapshot;
        writeMap(SNAPSHOTS_KEY, snapshots);
        snapshotBus_1.snapshotBus.publish(snapshot);
    }
};
