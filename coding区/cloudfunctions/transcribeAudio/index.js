const crypto = require("crypto");
const https = require("https");
const zlib = require("zlib");
const WebSocket = require("ws");
const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const CLIENT_FULL_REQUEST = 0x01;
const CLIENT_AUDIO_ONLY_REQUEST = 0x02;
const SERVER_FULL_RESPONSE = 0x09;
const SERVER_ACK = 0x0b;
const SERVER_ERROR_RESPONSE = 0x0f;
const JSON_SERIALIZATION = 0x01;
const GZIP_COMPRESSION = 0x01;
const NEG_SEQUENCE = 0x02;
const SUCCESS_CODE = 1000;
const NO_VALID_SPEECH_CODE = 1013;
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BITS = 16;
const DEFAULT_CHANNELS = 1;
const PCM_CHUNK_MS = 1000;

function assertEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少云函数环境变量 ${name}`);
  }
  return value;
}

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`录音下载失败：HTTP ${response.statusCode}`));
          response.resume();
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      })
      .on("error", reject);
  });
}

async function getAudioBuffer(event) {
  if (event.fileID) {
    const result = await cloud.downloadFile({
      fileID: event.fileID
    });
    return result.fileContent;
  }

  if (event.audioUrl) {
    return downloadUrl(event.audioUrl);
  }

  throw new Error("缺少录音文件。");
}

function parseWavPcm(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }

  let offset = 12;
  let fmt = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (id === "fmt ") {
      fmt = {
        audioFormat: buffer.readUInt16LE(start),
        channel: buffer.readUInt16LE(start + 2),
        rate: buffer.readUInt32LE(start + 4),
        bits: buffer.readUInt16LE(start + 14)
      };
    }

    if (id === "data") {
      data = buffer.subarray(start, start + size);
    }

    offset = start + size + (size % 2);
  }

  if (!fmt || !data || fmt.audioFormat !== 1) {
    throw new Error("仅支持 PCM 编码的 WAV 录音。");
  }

  return {
    payload: data,
    format: "raw",
    codec: "raw",
    rate: fmt.rate,
    bits: fmt.bits,
    channel: fmt.channel
  };
}

function normalizeAudio(buffer, event) {
  const declaredFormat = String(event.audioFormat || "").toLowerCase();
  const wav = parseWavPcm(buffer);
  if (wav) {
    return wav;
  }

  if (declaredFormat === "pcm" || declaredFormat === "raw") {
    return {
      payload: buffer,
      format: "raw",
      codec: "raw",
      rate: Number(event.sampleRate || DEFAULT_SAMPLE_RATE),
      bits: Number(event.bits || DEFAULT_BITS),
      channel: Number(event.channel || DEFAULT_CHANNELS)
    };
  }

  const compressedFormat = declaredFormat || "mp3";
  return {
    payload: buffer,
    format: compressedFormat,
    codec: compressedFormat,
    rate: Number(event.sampleRate || DEFAULT_SAMPLE_RATE),
    bits: Number(event.bits || DEFAULT_BITS),
    channel: Number(event.channel || DEFAULT_CHANNELS)
  };
}

function createHeader(messageType, flags = 0) {
  return Buffer.from([
    (0x01 << 4) | 0x01,
    (messageType << 4) | flags,
    (JSON_SERIALIZATION << 4) | GZIP_COMPRESSION,
    0x00
  ]);
}

function createPacket(messageType, flags, payload) {
  const compressed = zlib.gzipSync(payload);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(compressed.length);
  return Buffer.concat([createHeader(messageType, flags), size, compressed]);
}

function parseResponse(buffer) {
  const headerSize = (buffer[0] & 0x0f) * 4;
  const messageType = buffer[1] >> 4;
  const serialization = buffer[2] >> 4;
  const compression = buffer[2] & 0x0f;
  const body = buffer.subarray(headerSize);
  let payload = Buffer.alloc(0);
  const result = {
    messageType
  };

  if (messageType === SERVER_FULL_RESPONSE) {
    result.payloadSize = body.readUInt32BE(0);
    payload = body.subarray(4);
  } else if (messageType === SERVER_ACK) {
    result.sequence = body.readInt32BE(0);
    if (body.length >= 8) {
      result.payloadSize = body.readUInt32BE(4);
      payload = body.subarray(8);
    }
  } else if (messageType === SERVER_ERROR_RESPONSE) {
    result.code = body.readUInt32BE(0);
    result.payloadSize = body.readUInt32BE(4);
    payload = body.subarray(8);
  } else {
    payload = body;
  }

  if (compression === GZIP_COMPRESSION && payload.length > 0) {
    payload = zlib.gunzipSync(payload);
  }

  if (serialization === JSON_SERIALIZATION && payload.length > 0) {
    result.payload = JSON.parse(payload.toString("utf8"));
  }

  return result;
}

function receiveMessage(ws) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
    };
    const onMessage = (data) => {
      cleanup();
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("ASR 连接已关闭。"));
    };

    ws.once("message", onMessage);
    ws.once("error", onError);
    ws.once("close", onClose);
  });
}

function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://openspeech.bytedance.com/api/v2/asr", {
      headers: {
        Authorization: `Bearer; ${token}`
      }
    });

    ws.once("open", () => {
      resolve(ws);
    });
    ws.once("error", reject);
  });
}

function ensureSuccess(response, action) {
  const payload = response.payload;
  if (!payload) {
    return;
  }

  if (payload.code === SUCCESS_CODE || payload.code === NO_VALID_SPEECH_CODE) {
    return;
  }

  throw new Error(`${action}失败：${payload.code || response.code || "unknown"} ${payload.message || payload.error || ""}`.trim());
}

function extractText(payload) {
  const result = payload && payload.result;
  if (!result) {
    return "";
  }

  if (Array.isArray(result)) {
    return result
      .map((item) => item.text)
      .filter(Boolean)
      .join("")
      .trim();
  }

  if (typeof result.text === "string" && result.text.trim()) {
    return result.text.trim();
  }

  if (Array.isArray(result.utterances)) {
    return result.utterances
      .map((item) => item.text)
      .filter(Boolean)
      .join("")
      .trim();
  }

  return "";
}

function slicePayload(audio) {
  const bytesPerSecond = audio.rate * audio.channel * Math.max(audio.bits / 8, 1);
  const chunkSize = Math.max(4096, Math.floor((bytesPerSecond * PCM_CHUNK_MS) / 1000));
  const chunks = [];
  for (let offset = 0; offset < audio.payload.length; offset += chunkSize) {
    chunks.push(audio.payload.subarray(offset, offset + chunkSize));
  }
  return chunks.length > 0 ? chunks : [Buffer.alloc(0)];
}

async function callVolcAsr(audio, credentials) {
  const ws = await connectWebSocket(credentials.token);
  const timeout = setTimeout(() => {
    ws.terminate();
  }, 30000);

  try {
    const request = {
      app: {
        appid: credentials.appid,
        cluster: credentials.cluster,
        token: credentials.token
      },
      user: {
        uid: cloud.getWXContext().OPENID || "anonymous"
      },
      request: {
        reqid: crypto.randomUUID(),
        show_utterances: false,
        sequence: 1
      },
      audio: {
        format: audio.format,
        rate: audio.rate,
        language: "zh-CN",
        bits: audio.bits,
        channel: audio.channel,
        codec: audio.codec
      }
    };

    ws.send(createPacket(CLIENT_FULL_REQUEST, 0, Buffer.from(JSON.stringify(request))));
    ensureSuccess(parseResponse(await receiveMessage(ws)), "语音识别初始化");

    let text = "";
    const chunks = slicePayload(audio);
    for (let index = 0; index < chunks.length; index += 1) {
      const isLast = index === chunks.length - 1;
      ws.send(createPacket(CLIENT_AUDIO_ONLY_REQUEST, isLast ? NEG_SEQUENCE : 0, chunks[index]));
      const response = parseResponse(await receiveMessage(ws));
      ensureSuccess(response, "语音识别");

      if (response.payload && response.payload.code === NO_VALID_SPEECH_CODE) {
        continue;
      }

      text = extractText(response.payload) || text;
    }

    if (!text) {
      throw new Error("语音识别完成，但未返回文本。");
    }

    return text;
  } finally {
    clearTimeout(timeout);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
}

exports.main = async (event) => {
  const credentials = {
    appid: assertEnv("VOLC_ASR_APP_ID"),
    token: assertEnv("VOLC_ASR_ACCESS_TOKEN"),
    cluster: assertEnv("VOLC_ASR_CLUSTER")
  };
  assertEnv("VOLC_ASR_SECRET_KEY");

  const audioBuffer = await getAudioBuffer(event);
  const audio = normalizeAudio(audioBuffer, event);
  const text = await callVolcAsr(audio, credentials);

  return {
    text
  };
};
