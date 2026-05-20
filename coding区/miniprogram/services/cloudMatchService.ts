import type {
  ArchiveVersion,
  CreateMatchInput,
  DraftEvent,
  MatchSnapshot,
  ParseEventResult,
  Room,
  SignatureRecord,
  SignatureRole
} from "../domain/models";
import { isValidRoomCode } from "../domain/validation";

type SnapshotDoc = MatchSnapshot & { _id?: string };

function getDatabase() {
  return wx.cloud.database();
}

function normalizeCloudError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

async function callFunction<T>(name: string, data: Record<string, unknown>): Promise<T> {
  const response = await wx.cloud.callFunction({
    name,
    data
  });

  return response.result as T;
}

async function findRoom(roomCode: string): Promise<Room> {
  if (!isValidRoomCode(roomCode)) {
    throw new Error("房间码必须是 4 位数字。");
  }

  try {
    const result = await getDatabase().collection("rooms").doc(roomCode).get();
    const room = result.data as Room;
    if (!room || room.status !== "active") {
      throw new Error("房间不存在或已失效。");
    }
    return room;
  } catch (error) {
    throw normalizeCloudError(error, "房间不存在或已失效。");
  }
}

export async function createMatch(input: CreateMatchInput): Promise<MatchSnapshot> {
  const result = await callFunction<{ snapshot: MatchSnapshot }>("createMatch", { input });
  return result.snapshot;
}

export async function joinRoom(roomCode: string): Promise<MatchSnapshot> {
  const room = await findRoom(roomCode);

  try {
    const result = await getDatabase().collection("snapshots").doc(room.matchId).get();
    return result.data as MatchSnapshot;
  } catch (error) {
    throw normalizeCloudError(error, "比赛信息不存在。");
  }
}

export async function parseTextEvent(roomCode: string, text: string): Promise<ParseEventResult> {
  return callFunction<ParseEventResult>("parseEvent", {
    roomCode,
    text
  });
}

export async function confirmDraftEvent(roomCode: string, draft: DraftEvent): Promise<MatchSnapshot> {
  const result = await callFunction<{ snapshot: MatchSnapshot }>("confirmEvent", {
    roomCode,
    draft
  });
  return result.snapshot;
}

export async function watchRoomSnapshot(
  roomCode: string,
  listener: (snapshot: MatchSnapshot) => void
): Promise<() => void> {
  const room = await findRoom(roomCode);
  const watcher = getDatabase()
    .collection("snapshots")
    .doc(room.matchId)
    .watch({
      onChange(snapshot) {
        const doc = snapshot.docs[0] as SnapshotDoc | undefined;
        if (doc) {
          listener(doc);
        }
      },
      onError(error) {
        console.error("snapshot watch failed", error);
      }
    });

  return () => {
    watcher.close();
  };
}

export async function transcribeAudio(tempFilePath: string): Promise<string> {
  const cloudPath = `voice/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
  const uploadResult = await wx.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath
  });
  const result = await callFunction<{ text: string }>("transcribeAudio", {
    fileID: uploadResult.fileID,
    audioFormat: "wav",
    sampleRate: 16000,
    channel: 1,
    bits: 16
  });

  return result.text;
}

export async function saveSignature(
  matchId: string,
  role: SignatureRole,
  tempFilePath: string
): Promise<SignatureRecord> {
  const cloudPath = `signatures/${matchId}/${role}-${Date.now()}.png`;
  const uploadResult = await wx.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath
  });
  const result = await callFunction<{ signature: SignatureRecord }>("saveSignature", {
    matchId,
    role,
    fileID: uploadResult.fileID
  });

  return result.signature;
}

export async function generateArchive(matchId: string): Promise<ArchiveVersion> {
  const result = await callFunction<{ archive: ArchiveVersion }>("generateArchive", {
    matchId
  });

  return result.archive;
}

export async function getArchiveStatus(matchId: string): Promise<{
  signatures: SignatureRecord[];
  archive: ArchiveVersion | null;
}> {
  return callFunction<{
    signatures: SignatureRecord[];
    archive: ArchiveVersion | null;
  }>("getArchiveStatus", {
    matchId
  });
}
