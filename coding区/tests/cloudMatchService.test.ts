import { describe, expect, it } from "vitest";
import { normalizeCloudError } from "../miniprogram/services/cloudMatchService";

describe("cloud match service errors", () => {
  it("hides raw cloud document lookup failures", () => {
    const error = normalizeCloudError(
      new Error(
        "document.get:fail cannot find document with _id 2425, please make sure that the document exists and you have the corresponding access permission"
      ),
      "未找到比赛房间。"
    );

    expect(error.message).toBe("未找到比赛房间。");
  });

  it("preserves intentional business validation messages", () => {
    const error = normalizeCloudError(new Error("房间码必须是 4 位数字。"), "未找到比赛房间。");

    expect(error.message).toBe("房间码必须是 4 位数字。");
  });
});
