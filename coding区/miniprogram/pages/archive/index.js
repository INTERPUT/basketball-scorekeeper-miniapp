"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudMatchService_1 = require("../../services/cloudMatchService");
const ROLE_LABELS = {
    home_captain: "主队队长",
    away_captain: "客队队长"
};
function roleFromEvent(event) {
    return event.currentTarget.dataset.role;
}
function canvasId(role) {
    return `${role}Canvas`;
}
function getTouchPoint(touch) {
    const runtimeTouch = touch;
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
        homeSignature: null,
        awaySignature: null,
        archive: null
    },
    lastPoints: {},
    async onLoad(query) {
        const matchId = query.matchId ?? "";
        this.setData({
            matchId
        });
        if (matchId) {
            await this.refreshArchiveStatus();
        }
    },
    handleTouchStart(event) {
        const role = roleFromEvent(event);
        this.lastPoints[role] = getTouchPoint(event.touches[0]);
    },
    handleTouchMove(event) {
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
    handleTouchEnd(event) {
        const role = roleFromEvent(event);
        delete this.lastPoints[role];
    },
    handleClear(event) {
        const role = roleFromEvent(event);
        const context = wx.createCanvasContext(canvasId(role), this);
        context.clearRect(0, 0, 320, 140);
        context.draw();
        this.setData({
            error: ""
        });
    },
    async handleSave(event) {
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
            const signature = await (0, cloudMatchService_1.saveSignature)(this.data.matchId, role, tempFilePath);
            this.setData({
                busy: false,
                [role === "home_captain" ? "homeSignature" : "awaySignature"]: signature
            });
        }
        catch (error) {
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
            const archive = await (0, cloudMatchService_1.generateArchive)(this.data.matchId);
            this.setData({
                busy: false,
                archive
            });
        }
        catch (error) {
            this.setData({
                busy: false,
                error: error instanceof Error ? error.message : "生成归档失败。"
            });
        }
    },
    async handleOpenFile(event) {
        const dataset = event.currentTarget.dataset;
        if (dataset.type === "pdf_report" && dataset.fileId) {
            try {
                this.setData({
                    busy: true,
                    error: ""
                });
                const result = await wx.cloud.downloadFile({
                    fileID: dataset.fileId
                });
                await new Promise((resolve, reject) => {
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
            }
            catch (error) {
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
            const status = await (0, cloudMatchService_1.getArchiveStatus)(this.data.matchId);
            const homeSignature = status.signatures.find((signature) => signature.role === "home_captain") ?? null;
            const awaySignature = status.signatures.find((signature) => signature.role === "away_captain") ?? null;
            this.setData({
                busy: false,
                homeSignature,
                awaySignature,
                archive: status.archive
            });
        }
        catch (error) {
            this.setData({
                busy: false,
                error: error instanceof Error ? error.message : "读取归档状态失败。"
            });
        }
    },
    canvasToTempFilePath(role) {
        return new Promise((resolve, reject) => {
            wx.canvasToTempFilePath({
                canvasId: canvasId(role),
                fileType: "png",
                success(result) {
                    resolve(result.tempFilePath);
                },
                fail(error) {
                    reject(new Error(error.errMsg || "签名图片生成失败。"));
                }
            }, this);
        });
    }
});
