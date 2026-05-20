"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudMatchService_1 = require("../../services/cloudMatchService");
function authorizeRecord() {
    return new Promise((resolve, reject) => {
        wx.getSetting({
            success(result) {
                if (result.authSetting["scope.record"]) {
                    resolve();
                    return;
                }
                wx.authorize({
                    scope: "scope.record",
                    success: () => resolve(),
                    fail: () => reject(new Error("请在微信设置中允许录音权限，或改用文本输入。"))
                });
            },
            fail: () => reject(new Error("无法确认录音权限，请改用文本输入。"))
        });
    });
}
Page({
    data: {
        roomCode: "",
        snapshot: null,
        inputText: "",
        draft: null,
        recording: false,
        voiceBusy: false,
        error: ""
    },
    recorderManager: null,
    async onLoad(query) {
        const roomCode = query.roomCode ?? "";
        this.recorderManager = wx.getRecorderManager();
        this.recorderManager.onStop(async (result) => {
            try {
                if (!result.tempFilePath) {
                    throw new Error("录音文件生成失败，请改用文本输入。");
                }
                this.setData({
                    recording: false,
                    voiceBusy: true,
                    error: ""
                });
                const text = await (0, cloudMatchService_1.transcribeAudio)(result.tempFilePath);
                this.setData({
                    inputText: text,
                    voiceBusy: false
                });
            }
            catch (error) {
                this.setData({
                    recording: false,
                    voiceBusy: false,
                    error: error instanceof Error ? error.message : "语音转写失败。"
                });
            }
        });
        this.recorderManager.onError((error) => {
            this.setData({
                recording: false,
                voiceBusy: false,
                error: error.errMsg || "录音失败，请改用文本输入。"
            });
        });
        try {
            this.setData({
                roomCode,
                snapshot: await (0, cloudMatchService_1.joinRoom)(roomCode)
            });
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "无法加载比赛。"
            });
        }
    },
    handlePreviewReadonly() {
        wx.navigateTo({
            url: `/pages/match-info/index?roomCode=${this.data.roomCode}`
        });
    },
    handleOpenArchive() {
        const matchId = this.data.snapshot?.matchId;
        if (!matchId) {
            return;
        }
        wx.navigateTo({
            url: `/pages/archive/index?matchId=${matchId}`
        });
    },
    onInputText(event) {
        this.setData({
            inputText: String(event.detail.value),
            error: ""
        });
    },
    async handleParse() {
        let result;
        try {
            result = await (0, cloudMatchService_1.parseTextEvent)(this.data.roomCode, this.data.inputText);
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "解析事件失败。",
                draft: null
            });
            return;
        }
        if (!result.ok) {
            this.setData({
                error: result.reason,
                draft: null
            });
            return;
        }
        this.setData({
            draft: result.draft,
            error: ""
        });
    },
    async handleConfirmDraft() {
        if (!this.data.draft) {
            return;
        }
        try {
            const snapshot = await (0, cloudMatchService_1.confirmDraftEvent)(this.data.roomCode, this.data.draft);
            this.setData({
                snapshot,
                draft: null,
                inputText: "",
                error: ""
            });
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "确认事件失败。"
            });
        }
    },
    async handleStartRecord() {
        if (!this.recorderManager) {
            return;
        }
        try {
            await authorizeRecord();
            this.recorderManager.start({
                duration: 60000,
                sampleRate: 16000,
                numberOfChannels: 1,
                encodeBitRate: 64000,
                format: "wav"
            });
            this.setData({
                recording: true,
                error: ""
            });
        }
        catch (error) {
            this.setData({
                recording: false,
                error: error instanceof Error ? error.message : "录音启动失败，请改用文本输入。"
            });
        }
    },
    handleStopRecord() {
        this.recorderManager?.stop();
        this.setData({
            recording: false
        });
    }
});
