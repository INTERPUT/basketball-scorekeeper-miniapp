import type { CreateMatchInput } from "../../domain/models";
import { normalizeRoomCode, parseRosterText } from "../../domain/validation";
import { createMatch } from "../../services/cloudMatchService";

Page({
  data: {
    roomCode: "",
    periodLengthMinutes: "10",
    homeTeamName: "",
    homeTeamColor: "白色",
    homeRosterText: "",
    awayTeamName: "",
    awayTeamColor: "蓝色",
    awayRosterText: "",
    showAdvanced: false,
    competitionName: "",
    venue: "",
    referee: "",
    error: ""
  },

  onRoomCodeInput(event: WechatMiniprogram.Input) {
    this.setData({
      roomCode: normalizeRoomCode(String(event.detail.value)),
      error: ""
    });
  },

  onFieldInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field as string;
    this.setData({
      [field]: String(event.detail.value),
      error: ""
    });
  },

  toggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced
    });
  },

  async handleSubmit() {
    try {
      const input: CreateMatchInput = {
        roomCode: this.data.roomCode,
        periodLengthMinutes: Number(this.data.periodLengthMinutes),
        operatorId: "local_operator",
        header: {
          competitionName: this.data.competitionName.trim() || undefined,
          venue: this.data.venue.trim() || undefined,
          referee: this.data.referee.trim() || undefined
        },
        teams: [
          {
            name: this.data.homeTeamName,
            color: this.data.homeTeamColor,
            players: parseRosterText(this.data.homeRosterText)
          },
          {
            name: this.data.awayTeamName,
            color: this.data.awayTeamColor,
            players: parseRosterText(this.data.awayRosterText)
          }
        ]
      };

      const snapshot = await createMatch(input);
      wx.navigateTo({
        url: `/pages/scoreboard/index?roomCode=${snapshot.roomCode}`
      });
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : "创建比赛失败。"
      });
    }
  }
});
