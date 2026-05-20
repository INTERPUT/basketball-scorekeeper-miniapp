import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateMatchInput } from "../miniprogram/domain/models";
import {
  confirmDraftEvent,
  createMatch,
  joinRoom,
  parseTextEvent,
  watchRoomSnapshot
} from "../miniprogram/services/matchService";

const input: CreateMatchInput = {
  roomCode: "2468",
  periodLengthMinutes: 10,
  operatorId: "operator_1",
  teams: [
    {
      name: "白队",
      color: "白色",
      players: [{ number: "7", name: "张三" }]
    },
    {
      name: "蓝队",
      color: "蓝色",
      players: [{ number: "12", name: "李四" }]
    }
  ]
};

describe("matchService", () => {
  beforeEach(() => {
    const storage = new Map<string, unknown>();

    vi.stubGlobal("wx", {
      getStorageSync(key: string) {
        return storage.get(key);
      },
      setStorageSync(key: string, value: unknown) {
        storage.set(key, value);
      }
    });
  });

  it("creates a match and lets spectators join by room code", () => {
    const created = createMatch(input);
    const joined = joinRoom("2468");

    expect(joined.matchId).toBe(created.matchId);
    expect(joined.roomCode).toBe("2468");
    expect(joined.teams.map((team) => team.name)).toEqual(["白队", "蓝队"]);
  });

  it("rejects inactive or missing rooms", () => {
    expect(() => joinRoom("9999")).toThrow("房间不存在或已失效。");
  });

  it("parses and confirms a text event into the stored snapshot", () => {
    createMatch(input);
    const parsed = parseTextEvent("2468", "白队 7 号两分命中");

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser to succeed");
    }

    const snapshot = confirmDraftEvent("2468", parsed.draft);
    expect(snapshot.teams.map((team) => team.score)).toEqual([2, 0]);
    expect(joinRoom("2468").recentEvents).toHaveLength(1);
  });

  it("notifies room subscribers when a snapshot changes", () => {
    createMatch(input);
    const scores: number[][] = [];
    const unsubscribe = watchRoomSnapshot("2468", (snapshot) => {
      scores.push(snapshot.teams.map((team) => team.score));
    });
    const parsed = parseTextEvent("2468", "白队 7 号两分命中");

    if (!parsed.ok) {
      throw new Error("expected parser to succeed");
    }

    confirmDraftEvent("2468", parsed.draft);
    unsubscribe();

    expect(scores).toEqual([
      [0, 0],
      [2, 0]
    ]);
  });
});
