import { joinRoom } from "../../services/cloudMatchService";
import { normalizeRoomCode } from "../../domain/validation";

Page({
  data: {
    roomCode: "",
    error: ""
  },

  onRoomCodeInput(event: WechatMiniprogram.Input) {
    this.setData({
      roomCode: normalizeRoomCode(String(event.detail.value)),
      error: ""
    });
  },

  async handleJoin() {
    try {
      await joinRoom(this.data.roomCode);
      wx.navigateTo({
        url: `/pages/match-info/index?roomCode=${this.data.roomCode}`
      });
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : "无法进入比赛。"
      });
    }
  },

  handleCreate() {
    wx.navigateTo({
      url: "/pages/create/index"
    });
  }
});
