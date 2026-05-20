import type { DraftEvent, MatchSnapshot, ParseEventResult } from "../../domain/models";
import {
  confirmDraftEvent,
  joinRoom,
  parseTextEvent,
  transcribeAudio
} from "../../services/cloudMatchService";

function authorizeRecord(): Promise<void> {
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
    snapshot: null as MatchSnapshot | null,
    inputText: "",
    draft: null as DraftEvent | null,
    recording: false,
    voiceBusy: false,
    error: ""
  },
  recorderManager: null as WechatMiniprogram.RecorderManager | null,

  async onLoad(query: Record<string, string | undefined>) {
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
        const text = await transcribeAudio(result.tempFilePath);
        this.setData({
          inputText: text,
          voiceBusy: false
        });
      } catch (error) {
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
        snapshot: await joinRoom(roomCode)
      });
    } catch (error) {
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

  onInputText(event: WechatMiniprogram.Input) {
    this.setData({
      inputText: String(event.detail.value),
      error: ""
    });
  },

  async handleParse() {
    let result: ParseEventResult;
    try {
      result = await parseTextEvent(this.data.roomCode, this.data.inputText);
    } catch (error) {
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
      const snapshot = await confirmDraftEvent(this.data.roomCode, this.data.draft);
      this.setData({
        snapshot,
        draft: null,
        inputText: "",
        error: ""
      });
    } catch (error) {
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
    } catch (error) {
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
