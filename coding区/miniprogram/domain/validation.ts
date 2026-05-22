import type { Player } from "./models";

export const ROOM_CODE_PATTERN = /^\d{4}$/;

export function normalizeRoomCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function normalizePlayerNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 3);
}

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}

export function parseRosterText(value: string): Array<Pick<Player, "number" | "name">> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const [number, ...nameParts] = parts;
      return {
        number: number ?? "",
        name: nameParts.join(" ")
      };
    });
}

export function validateRoster(players: Array<Pick<Player, "number" | "name">>): string[] {
  const errors: string[] = [];
  const seenNumbers = new Set<string>();

  if (players.length === 0) {
    errors.push("至少需要录入 1 名球员。");
  }

  players.forEach((player, index) => {
    if (!player.number || !player.name) {
      errors.push(`第 ${index + 1} 名球员信息不完整，请补全号码和姓名。`);
      return;
    }

    if (seenNumbers.has(player.number)) {
      errors.push(`号码 ${player.number} 重复。`);
      return;
    }

    seenNumbers.add(player.number);
  });

  return errors;
}
