export type MatchStatus = "draft" | "live" | "period_break" | "finished" | "archived";
export type RoomStatus = "active" | "closed";
export type ClockStatus = "ready" | "running" | "paused" | "period_ended";
export type AlertType = "player_foul_out_alert" | "team_bonus_alert" | "last_minute_alert";
export type SignatureRole = "home_captain" | "away_captain";
export type ExportFileType = "score_sheet_html" | "archive_json" | "pdf_report";
export type ConfirmedEventType =
  | "score_free_throw"
  | "free_throw_series_result"
  | "score_two_point"
  | "score_three_point"
  | "personal_foul"
  | "team_timeout"
  | "clock_start"
  | "clock_pause"
  | "clock_resume"
  | "clock_correct"
  | "period_end"
  | "game_end";

export interface Player {
  playerId: string;
  teamId: string;
  number: string;
  name: string;
  personalFouls: number;
  points: number;
}

export interface Team {
  teamId: string;
  name: string;
  color: string;
  players: Player[];
}

export interface ClockState {
  period: number;
  status: ClockStatus;
  remainingSeconds: number;
}

export interface MatchHeader {
  competitionName?: string;
  venue?: string;
  referee?: string;
}

export interface MatchRules {
  periodLengthMinutes: number;
}

export interface Match {
  matchId: string;
  status: MatchStatus;
  currentPeriod: number;
  operatorId: string;
  createdAt: string;
  header: MatchHeader;
  rules: MatchRules;
  teams: [Team, Team];
  clock: ClockState;
}

export interface Room {
  roomCode: string;
  matchId: string;
  status: RoomStatus;
  createdAt: string;
  expiresAt?: string;
}

export interface MatchSnapshot {
  matchId: string;
  roomCode: string;
  status: MatchStatus;
  currentPeriod: number;
  clock: ClockState;
  teams: Array<{
    teamId: string;
    name: string;
    color: string;
    score: number;
    playerCount: number;
    currentPeriodFouls: number;
    timeoutsRemaining: number;
  }>;
  periodScores: Record<string, [number, number]>;
  alerts: Alert[];
  recentEvents: ConfirmedEvent[];
}

export interface CreateMatchInput {
  roomCode: string;
  periodLengthMinutes: number;
  operatorId: string;
  header?: MatchHeader;
  teams: [
    {
      name: string;
      color: string;
      players: Array<Pick<Player, "number" | "name">>;
    },
    {
      name: string;
      color: string;
      players: Array<Pick<Player, "number" | "name">>;
    }
  ];
}

export interface BaseConfirmedEvent {
  eventId: string;
  eventType: ConfirmedEventType;
  period: number;
  gameClockSeconds: number;
  createdAt: string;
}

export interface ScoreEvent extends BaseConfirmedEvent {
  eventType: "score_free_throw" | "score_two_point" | "score_three_point";
  teamId: string;
  playerId: string;
}

export interface FreeThrowSeriesResultEvent extends BaseConfirmedEvent {
  eventType: "free_throw_series_result";
  teamId: string;
  playerId: string;
  attempts: number;
  made: number;
}

export interface PersonalFoulEvent extends BaseConfirmedEvent {
  eventType: "personal_foul";
  teamId: string;
  playerId: string;
}

export interface TeamTimeoutEvent extends BaseConfirmedEvent {
  eventType: "team_timeout";
  teamId: string;
}

export interface ClockStartEvent extends BaseConfirmedEvent {
  eventType: "clock_start";
}

export interface ClockPauseEvent extends BaseConfirmedEvent {
  eventType: "clock_pause";
}

export interface ClockResumeEvent extends BaseConfirmedEvent {
  eventType: "clock_resume";
}

export interface ClockCorrectEvent extends BaseConfirmedEvent {
  eventType: "clock_correct";
  targetRemainingSeconds: number;
}

export interface PeriodEndEvent extends BaseConfirmedEvent {
  eventType: "period_end";
}

export interface GameEndEvent extends BaseConfirmedEvent {
  eventType: "game_end";
}

export type ConfirmedEvent =
  | ScoreEvent
  | FreeThrowSeriesResultEvent
  | PersonalFoulEvent
  | TeamTimeoutEvent
  | ClockStartEvent
  | ClockPauseEvent
  | ClockResumeEvent
  | ClockCorrectEvent
  | PeriodEndEvent
  | GameEndEvent;

export interface Alert {
  alertId: string;
  type: AlertType;
  period: number;
  gameClockSeconds: number;
  teamId?: string;
  playerId?: string;
  relatedEventId: string;
}

export interface DraftEvent {
  draftEventId: string;
  eventType: ConfirmedEventType;
  period: number;
  gameClockSeconds: number;
  sourceText: string;
  teamId?: string;
  playerId?: string;
  attempts?: number;
  made?: number;
  targetRemainingSeconds?: number;
  dataEffect: string;
}

export type ParseEventResult =
  | {
      ok: true;
      draft: DraftEvent;
    }
  | {
      ok: false;
      reason: string;
    };

export interface SignatureRecord {
  signatureId: string;
  matchId: string;
  role: SignatureRole;
  fileID: string;
  signedAt: string;
}

export interface ExportFileRecord {
  exportFileId: string;
  matchId: string;
  archiveId: string;
  type: ExportFileType;
  fileID: string;
  tempFileURL?: string;
  createdAt: string;
}

export interface ArchiveVersion {
  archiveId: string;
  matchId: string;
  version: number;
  status: "generated";
  createdAt: string;
  signatures: SignatureRecord[];
  files: ExportFileRecord[];
}
