import type { ConfirmedEvent, Match, MatchSnapshot, Room } from "../domain/models";
import { snapshotBus } from "./snapshotBus";

const MATCHES_KEY = "matches";
const ROOMS_KEY = "rooms";
const SNAPSHOTS_KEY = "snapshots";
const EVENTS_KEY = "events";

type KeyValueMap = Record<string, unknown>;

function readMap<T extends KeyValueMap>(key: string): T {
  return (wx.getStorageSync(key) as T) || ({} as T);
}

function writeMap<T extends KeyValueMap>(key: string, value: T): void {
  wx.setStorageSync(key, value);
}

export const localMatchRepository = {
  save(match: Match, room: Room, snapshot: MatchSnapshot): void {
    const matches = readMap<Record<string, Match>>(MATCHES_KEY);
    const rooms = readMap<Record<string, Room>>(ROOMS_KEY);
    const snapshots = readMap<Record<string, MatchSnapshot>>(SNAPSHOTS_KEY);

    matches[match.matchId] = match;
    rooms[room.roomCode] = room;
    snapshots[match.matchId] = snapshot;

    writeMap(MATCHES_KEY, matches);
    writeMap(ROOMS_KEY, rooms);
    writeMap(SNAPSHOTS_KEY, snapshots);
  },

  findRoom(roomCode: string): Room | undefined {
    const rooms = readMap<Record<string, Room>>(ROOMS_KEY);
    return rooms[roomCode];
  },

  findSnapshot(matchId: string): MatchSnapshot | undefined {
    const snapshots = readMap<Record<string, MatchSnapshot>>(SNAPSHOTS_KEY);
    return snapshots[matchId];
  },

  findMatch(matchId: string): Match | undefined {
    const matches = readMap<Record<string, Match>>(MATCHES_KEY);
    return matches[matchId];
  },

  findEvents(matchId: string): ConfirmedEvent[] {
    const events = readMap<Record<string, ConfirmedEvent[]>>(EVENTS_KEY);
    return events[matchId] ?? [];
  },

  saveEvents(matchId: string, events: ConfirmedEvent[]): void {
    const storedEvents = readMap<Record<string, ConfirmedEvent[]>>(EVENTS_KEY);
    storedEvents[matchId] = events;
    writeMap(EVENTS_KEY, storedEvents);
  },

  saveSnapshot(snapshot: MatchSnapshot): void {
    const snapshots = readMap<Record<string, MatchSnapshot>>(SNAPSHOTS_KEY);
    snapshots[snapshot.matchId] = snapshot;
    writeMap(SNAPSHOTS_KEY, snapshots);
    snapshotBus.publish(snapshot);
  }
};
