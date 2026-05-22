import { describe, expect, it } from "vitest";
import {
  isValidRoomCode,
  normalizePlayerNumber,
  normalizeRoomCode,
  parseRosterText,
  validateRoster
} from "../miniprogram/domain/validation";

describe("room code validation", () => {
  it("keeps only four digits while editing", () => {
    expect(normalizeRoomCode("12a34b56")).toBe("1234");
  });

  it("accepts only four digits as a valid room code", () => {
    expect(isValidRoomCode("1234")).toBe(true);
    expect(isValidRoomCode("123")).toBe(false);
    expect(isValidRoomCode("12a4")).toBe(false);
  });
});

describe("roster parsing", () => {
  it("keeps only three jersey-number digits while editing", () => {
    expect(normalizePlayerNumber("a12b34")).toBe("123");
  });

  it("parses pasted roster lines", () => {
    expect(parseRosterText("7 张三\n11 李四")).toEqual([
      { number: "7", name: "张三" },
      { number: "11", name: "李四" }
    ]);
  });

  it("reports incomplete and duplicate rows", () => {
    expect(
      validateRoster([
        { number: "7", name: "张三" },
        { number: "7", name: "李四" },
        { number: "11", name: "" }
      ])
    ).toEqual(["号码 7 重复。", "第 3 名球员信息不完整，请补全号码和姓名。"]);
  });
});
