import { describe, expect, it } from "vitest";
import type { CreateMatchInput } from "../miniprogram/domain/models";
import { parseEventText } from "../miniprogram/domain/eventParser";
import { createMatchBundle } from "../miniprogram/domain/matchFactory";

const input: CreateMatchInput = {
  roomCode: "8642",
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

describe("parseEventText", () => {
  const { match, snapshot } = createMatchBundle(input);

  it("parses core dictionary examples into drafts", () => {
    expect(parseEventText(match, snapshot, "白队 7 号两分命中")).toMatchObject({
      ok: true,
      draft: {
        eventType: "score_two_point"
      }
    });
    expect(parseEventText(match, snapshot, "蓝队 12 号犯规一次")).toMatchObject({
      ok: true,
      draft: {
        eventType: "personal_foul"
      }
    });
    expect(parseEventText(match, snapshot, "白队暂停")).toMatchObject({
      ok: true,
      draft: {
        eventType: "team_timeout"
      }
    });
    expect(parseEventText(match, snapshot, "白队 7 号 2 罚中 0")).toMatchObject({
      ok: true,
      draft: {
        eventType: "free_throw_series_result",
        attempts: 2,
        made: 0
      }
    });
  });

  it("parses clock commands", () => {
    expect(parseEventText(match, snapshot, "开始计时")).toMatchObject({
      ok: true,
      draft: {
        eventType: "clock_start"
      }
    });
    expect(parseEventText(match, snapshot, "把时间改成 03:12")).toMatchObject({
      ok: true,
      draft: {
        eventType: "clock_correct",
        targetRemainingSeconds: 192
      }
    });
  });

  it("returns the standardized rejection message for incomplete input", () => {
    expect(parseEventText(match, snapshot, "7 号得分")).toEqual({
      ok: false,
      reason: "缺少球队 / 球员 / 事件，请重新给出完整技术记录。"
    });
  });

  it("rejects unsupported advanced stats", () => {
    expect(parseEventText(match, snapshot, "白队 7 号抢断")).toEqual({
      ok: false,
      reason: "首版暂不记录该类扩展技术统计。"
    });
  });
});
