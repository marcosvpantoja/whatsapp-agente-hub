import { env } from "./env.js";
import { HttpError } from "./utils.js";

interface EvolutionConnectionStateResponse {
  instance?: {
    instanceName?: string;
    state?: string;
  };
}

interface EvolutionConnectResponseItem {
  pairingCode?: string | null;
  code?: string | null;
  base64?: string | null;
  count?: number | null;
  qrcode?: {
    pairingCode?: string | null;
    code?: string | null;
    base64?: string | null;
    count?: number | null;
  } | null;
}

interface EvolutionFetchInstanceRecord {
  instance?: {
    instanceName?: string;
    profileName?: string | null;
    owner?: string | null;
    ownerJid?: string | null;
    phoneNumber?: string | null;
    number?: string | null;
  };
  instanceName?: string;
  profileName?: string | null;
  owner?: string | null;
  ownerJid?: string | null;
  phoneNumber?: string | null;
  number?: string | null;
}

function getEvolutionConfig() {
  if (!env.EVOLUTION_HOST || !env.EVOLUTION_INSTANCE || !env.EVOLUTION_API_KEY) {
    throw new HttpError(503, "A integracao com a Evolution API nao esta configurada.");
  }

  return {
    host: env.EVOLUTION_HOST.replace(/\/+$/, ""),
    instance: env.EVOLUTION_INSTANCE,
    apiKey: env.EVOLUTION_API_KEY,
  };
}

function getEvolutionHeaders(apiKey: string) {
  return {
    apiKey,
    Accept: "application/json",
  };
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizeEvolutionPayload<T>(value: unknown) {
  let normalized = value;

  for (let index = 0; index < 2; index += 1) {
    if (typeof normalized !== "string") {
      break;
    }

    const trimmedValue = normalized.trim();
    if (!trimmedValue) {
      break;
    }

    const parsedValue = tryParseJson(trimmedValue);
    if (parsedValue === normalized) {
      break;
    }

    normalized = parsedValue;
  }

  return normalized as T;
}

async function requestEvolution<T>(path: string) {
  const { host, apiKey } = getEvolutionConfig();
  const response = await fetch(`${host}${path}`, {
    method: "GET",
    headers: getEvolutionHeaders(apiKey),
  });

  const responseText = await response.text();
  let payload = null as unknown;

  if (responseText) {
    payload = normalizeEvolutionPayload(responseText);
  }

  if (!response.ok) {
    const providerMessage =
      typeof payload === "object" && payload && "response" in payload
        ? String((payload as { response?: { message?: unknown } }).response?.message || "")
        : typeof payload === "object" && payload && "message" in payload
          ? String((payload as { message?: unknown }).message || "")
          : "";

    const suffix = providerMessage ? `: ${providerMessage}` : ".";
    throw new HttpError(502, `Nao foi possivel consultar a Evolution API (${response.status})${suffix}`);
  }

  return payload as T;
}

export async function getEvolutionConnectionState() {
  const { instance } = getEvolutionConfig();
  const payload = await requestEvolution<EvolutionConnectionStateResponse>(
    `/instance/connectionState/${encodeURIComponent(instance)}`,
  );

  return {
    instanceName: payload.instance?.instanceName || instance,
    state: payload.instance?.state || null,
  };
}

function normalizeEvolutionPhoneNumber(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return null;
  }

  const withoutDomain = normalized.split("@")[0]?.split(":")[0] || normalized;
  const digitsOnly = withoutDomain.replace(/\D/g, "");

  return digitsOnly || withoutDomain || null;
}

function normalizeQrCodeBase64(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("data:image/")) {
    return normalized;
  }

  return `data:image/png;base64,${normalized}`;
}

function getNestedValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractQrCodeCandidate(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const parsedValue = normalizeEvolutionPayload<unknown>(value);
    if (parsedValue === value) {
      return null;
    }
    return extractQrCodeCandidate(parsedValue);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractQrCodeCandidate(item);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.base64 === "string" && record.base64.trim()) {
    return record;
  }

  const nestedKeys = ["qrcode", "qrCode", "data", "response"];
  for (const key of nestedKeys) {
    const nestedValue = getNestedValue(record, key);
    if (!nestedValue) {
      continue;
    }

    const candidate = extractQrCodeCandidate(nestedValue);
    if (candidate) {
      return candidate;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const candidate = extractQrCodeCandidate(nestedValue);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function extractQrCodePayload(payload: EvolutionConnectResponseItem[] | EvolutionConnectResponseItem | null) {
  const qrCodeItem = extractQrCodeCandidate(payload);
  const qrCodeBase64 = normalizeQrCodeBase64(typeof qrCodeItem?.base64 === "string" ? qrCodeItem.base64 : null);

  if (!qrCodeBase64) {
    return null;
  }

  return {
    pairingCode: typeof qrCodeItem?.pairingCode === "string" ? qrCodeItem.pairingCode : null,
    code: typeof qrCodeItem?.code === "string" ? qrCodeItem.code : null,
    qrCodeBase64,
    count: typeof qrCodeItem?.count === "number" ? qrCodeItem.count : 0,
  };
}

export async function getEvolutionInstanceProfile() {
  const { instance } = getEvolutionConfig();
  const payload = await requestEvolution<EvolutionFetchInstanceRecord[] | EvolutionFetchInstanceRecord>(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`,
  );

  const record = Array.isArray(payload)
    ? payload.find((item) => (item.instance?.instanceName || item.instanceName) === instance) || payload[0]
    : payload;
  const instanceData = record?.instance || record;

  return {
    instanceName: instanceData?.instanceName || instance,
    displayName: instanceData?.profileName || null,
    phoneNumber: normalizeEvolutionPhoneNumber(
      instanceData?.phoneNumber || instanceData?.number || instanceData?.owner || instanceData?.ownerJid,
    ),
  };
}

export async function disconnectEvolutionInstance() {
  const { instance, host, apiKey } = getEvolutionConfig();
  const response = await fetch(`${host}/instance/logout/${encodeURIComponent(instance)}`, {
    method: "DELETE",
    headers: getEvolutionHeaders(apiKey),
  });

  if (!response.ok) {
    throw new HttpError(502, "Nao foi possivel desconectar a instancia na Evolution API.");
  }
}

export async function generateEvolutionQrCode() {
  const { instance } = getEvolutionConfig();
  const payload = await requestEvolution<EvolutionConnectResponseItem[] | EvolutionConnectResponseItem>(
    `/instance/connect/${encodeURIComponent(instance)}`,
  );
  const qrCode = extractQrCodePayload(payload);

  if (!qrCode?.qrCodeBase64) {
    throw new HttpError(502, "A Evolution API nao retornou um QR Code valido.");
  }

  return {
    pairingCode: qrCode.pairingCode,
    code: qrCode.code,
    qrCodeBase64: qrCode.qrCodeBase64,
    count: qrCode.count,
  };
}
