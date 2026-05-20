import { describe, expect, it } from "vitest";
import type { CreateMatchInput } from "../miniprogram/domain/models";
import { createMatchBundle, validateCreateMatchInput } from "../miniprogram/domain/matchFactory";

const validInput: CreateMatchInput = {
  roomCode: "1234",
  periodLengthMinutes: 10,
  operatorId: "operator_1",
  teams: [
    {
      name: "白队",
      color: "白色",
      players: [
        { number: "7", name: "张三" },
        { number: "11", name: "李四" }
      ]
    },
    {
      name: "蓝队",
      color: "蓝色",
      players: [
        { number: "8", name: "王五" },
        { number: "12", name: "赵六" }
      ]
    }
  ]
};

describe("createMatchBundle", () => {
  it("creates draft match, active room, and initial snapshot", () => {
    const { match, room, snapshot } = createMatchBundle(validInput, new Date("2026-05-18T00:00:00.000Z"));

    expect(match.status).toBe("draft");
    expect(match.currentPeriod).toBe(1);
    expect(match.clock).toEqual({
      period: 1,
      status: "ready",
      remainingSeconds: 600
    });
    expect(room).toMatchObject({
      roomCode: "1234",
      matchId: match.matchId,
      status: "active"
    });
    expect(snapshot.teams.map((team) => team.score)).toEqual([0, 0]);
    expect(snapshot.teams.map((team) => team.playerCount)).toEqual([2, 2]);
  });

  it("rejects duplicate jersey numbers within the same team", () => {
    const errors = validateCreateMatchInput({
      ...validInput,
      teams: [
        {
          ...validInput.teams[0],
          players: [
            { number: "7", name: "张三" },
            { number: "7", name: "李四" }
          ]
        },
        validInput.teams[1]
      ]
    });

    expect(errors).toContain("主队号码 7 重复。");
  });
});
