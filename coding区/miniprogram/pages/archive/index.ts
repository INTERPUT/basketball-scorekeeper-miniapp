import type { ArchiveVersion, SignatureRecord, SignatureRole } from "../../domain/models";
import { generateArchive, getArchiveStatus, saveSignature } from "../../services/cloudMatchService";

type SignaturePoint = {
  x: number;
  y: number;
};

const ROLE_LABELS: Record<SignatureRole, string> = {
  home_captain: "主队队长",
  away_captain: "客队队长"
};

function roleFromEvent(event: WechatMiniprogram.BaseEvent): SignatureRole {
  return event.currentTarget.dataset.role as SignatureRole;
}

function canvasId(role: SignatureRole): string {
  return `${role}Canvas`;
}

function getTouchPoint(touch: WechatMiniprogram.TouchDetail): SignaturePoint {
  const runtimeTouch = touch as WechatMiniprogram.TouchDetail & {
    x?: number;
    y?: number;
  };

  return {
    x: runtimeTouch.x ?? runtimeTouch.clientX,
    y: runtimeTouch.y ?? runtimeTouch.clientY
  };
}

Page({
  data: {
    matchId: "",
    busy: false,
    error: "",
    homeSignature: null as SignatureRecord | null,
    awaySignature: null as SignatureRecord | null,
    archive: null as ArchiveVersion | null
  },
  lastPoints: {} as Partial<Record<SignatureRole, SignaturePoint>>,

  async onLoad(query: Record<string, string | undefined>) {
    const matchId = query.matchId ?? "";
    this.setData({
      matchId
    });
    if (matchId) {
      await this.refreshArchiveStatus();
    }
  },

  handleTouchStart(event: WechatMiniprogram.TouchEvent) {
    const role = roleFromEvent(event);
    this.lastPoints[role] = getTouchPoint(event.touches[0]);
  },

  handleTouchMove(event: WechatMiniprogram.TouchEvent) {
    const role = roleFromEvent(event);
    const touch = getTouchPoint(event.touches[0]);
    const lastPoint = this.lastPoints[role];
    if (!lastPoint) {
      return;
    }

    const context = wx.createCanvasContext(canvasId(role), this);
    context.setStrokeStyle("#111827");
    context.setLineWidth(3);
    context.setLineCap("round");
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(touch.x, touch.y);
    context.stroke();
    context.draw(true);

    this.lastPoints[role] = touch;
  },

  handleTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const role = roleFromEvent(event);
    delete this.lastPoints[role];
  },

  handleClear(event: WechatMiniprogram.BaseEvent) {
    const role = roleFromEvent(event);
    const context = wx.createCanvasContext(canvasId(role), this);
    context.clearRect(0, 0, 320, 140);
    context.draw();
    this.setData({
      error: ""
    });
  },

  async handleSave(event: WechatMiniprogram.BaseEvent) {
    const role = roleFromEvent(event);
    if (!this.data.matchId) {
      this.setData({
        error: "缺少比赛编号。"
      });
      return;
    }

    try {
      this.setData({
        busy: true,
        error: ""
      });
      const tempFilePath = await this.canvasToTempFilePath(role);
      const signature = await saveSignature(this.data.matchId, role, tempFilePath);
      this.setData({
        busy: false,
        [role === "home_captain" ? "homeSignature" : "awaySignature"]: signature
      });
    } catch (error) {
      this.setData({
        busy: false,
        error: error instanceof Error ? error.message : `${ROLE_LABELS[role]}签字保存失败。`
      });
    }
  },

  async handleGenerateArchive() {
    if (!this.data.homeSignature || !this.data.awaySignature) {
      this.setData({
        error: "双方队长签字完成前不能生成最终留档。"
      });
      return;
    }

    try {
      this.setData({
        busy: true,
        error: ""
      });
      const archive = await generateArchive(this.data.matchId);
      this.setData({
        busy: false,
        archive
      });
    } catch (error) {
      this.setData({
        busy: false,
        error: error instanceof Error ? error.message : "生成归档失败。"
      });
    }
  },

  async handleOpenFile(event: WechatMiniprogram.BaseEvent) {
    const dataset = event.currentTarget.dataset as {
      fileId?: string;
      tempFileUrl?: string;
      type?: string;
    };

    if (dataset.type === "pdf_report" && dataset.fileId) {
      try {
        this.setData({
          busy: true,
          error: ""
        });
        const result = await wx.cloud.downloadFile({
          fileID: dataset.fileId
        });
        await new Promise<void>((resolve, reject) => {
          wx.openDocument({
            filePath: result.tempFilePath,
            fileType: "pdf",
            success: () => resolve(),
            fail: (error) => reject(new Error(error.errMsg || "PDF 打开失败。"))
          });
        });
        this.setData({
          busy: false
        });
      } catch (error) {
        this.setData({
          busy: false,
          error: error instanceof Error ? error.message : "PDF 打开失败。"
        });
      }
      return;
    }

    if (!dataset.tempFileUrl) {
      this.setData({
        error: "导出文件临时链接不存在，请重新生成或刷新归档。"
      });
      return;
    }

    wx.setClipboardData({
      data: dataset.tempFileUrl
    });
  },

  async refreshArchiveStatus() {
    try {
      this.setData({
        busy: true,
        error: ""
      });
      const status = await getArchiveStatus(this.data.matchId);
      const homeSignature = status.signatures.find((signature) => signature.role === "home_captain") ?? null;
      const awaySignature = status.signatures.find((signature) => signature.role === "away_captain") ?? null;
      this.setData({
        busy: false,
        homeSignature,
        awaySignature,
        archive: status.archive
      });
    } catch (error) {
      this.setData({
        busy: false,
        error: error instanceof Error ? error.message : "读取归档状态失败。"
      });
    }
  },

  canvasToTempFilePath(role: SignatureRole): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvasId: canvasId(role),
          fileType: "png",
          success(result) {
            resolve(result.tempFilePath);
          },
          fail(error) {
            reject(new Error(error.errMsg || "签名图片生成失败。"));
          }
        },
        this
      );
    });
  }
});
