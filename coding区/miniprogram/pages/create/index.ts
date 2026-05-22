import type { CreateMatchInput, Player } from "../../domain/models";
import { normalizePlayerNumber, normalizeRoomCode } from "../../domain/validation";
import { createMatch } from "../../services/cloudMatchService";

type TeamSide = "home" | "away";
type PlayerDraft = Pick<Player, "number" | "name">;
type RosterKey = "homePlayers" | "awayPlayers";

function getRosterKey(team: TeamSide): RosterKey {
  return team === "home" ? "homePlayers" : "awayPlayers";
}

function getTeamLabel(team: TeamSide): string {
  return team === "home" ? "主队" : "客队";
}

Page({
  data: {
    roomCode: "",
    periodLengthMinutes: "10",
    homeTeamName: "",
    homeTeamColor: "白色",
    homePlayers: [] as PlayerDraft[],
    awayTeamName: "",
    awayTeamColor: "蓝色",
    awayPlayers: [] as PlayerDraft[],
    playerModalVisible: false,
    playerModalTeam: "home" as TeamSide,
    playerModalTeamLabel: "主队",
    playerNumber: "",
    playerName: "",
    playerModalError: "",
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

  openPlayerModal(event: WechatMiniprogram.TouchEvent) {
    const team = event.currentTarget.dataset.team === "away" ? "away" : "home";

    this.setData({
      playerModalVisible: true,
      playerModalTeam: team,
      playerModalTeamLabel: getTeamLabel(team),
      playerNumber: "",
      playerName: "",
      playerModalError: "",
      error: ""
    });
  },

  closePlayerModal() {
    this.setData({
      playerModalVisible: false,
      playerNumber: "",
      playerName: "",
      playerModalError: ""
    });
  },

  onPlayerNumberInput(event: WechatMiniprogram.Input) {
    this.setData({
      playerNumber: normalizePlayerNumber(String(event.detail.value)),
      playerModalError: ""
    });
  },

  onPlayerNameInput(event: WechatMiniprogram.Input) {
    this.setData({
      playerName: String(event.detail.value),
      playerModalError: ""
    });
  },

  confirmPlayerModal() {
    const team = this.data.playerModalTeam as TeamSide;
    const rosterKey = getRosterKey(team);
    const players = this.data[rosterKey] as PlayerDraft[];
    const number = normalizePlayerNumber(this.data.playerNumber);
    const name = this.data.playerName.trim();

    if (!number) {
      this.setData({ playerModalError: "请输入球衣号码。" });
      return;
    }

    if (!name) {
      this.setData({ playerModalError: "请输入球员名称。" });
      return;
    }

    if (players.some((player) => player.number === number)) {
      this.setData({
        playerModalError: `${getTeamLabel(team)}已有 ${number} 号球员。`
      });
      return;
    }

    this.setData({
      [rosterKey]: [...players, { number, name }],
      playerModalVisible: false,
      playerNumber: "",
      playerName: "",
      playerModalError: "",
      error: ""
    });
  },

  removePlayer(event: WechatMiniprogram.TouchEvent) {
    const team = event.currentTarget.dataset.team === "away" ? "away" : "home";
    const rosterKey = getRosterKey(team);
    const index = Number(event.currentTarget.dataset.index);
    const players = [...(this.data[rosterKey] as PlayerDraft[])];

    if (!Number.isInteger(index) || index < 0 || index >= players.length) {
      return;
    }

    players.splice(index, 1);
    this.setData({
      [rosterKey]: players,
      error: ""
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
            players: this.data.homePlayers
          },
          {
            name: this.data.awayTeamName,
            color: this.data.awayTeamColor,
            players: this.data.awayPlayers
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
