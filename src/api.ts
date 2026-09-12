import type { CareerId, StartingPoint } from "./data";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
  };
}
export function requestId() {
  return crypto.randomUUID();
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "include",
      signal: options.signal ?? AbortSignal.timeout(45000),
    });
    text = await response.text();
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError" &&
      options.signal?.aborted
    )
      throw error;
    throw new ApiError(
      "연결을 완료하지 못했어요. 입력을 유지한 채 다시 시도해 주세요.",
      0,
    );
  }
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    value = null;
  }
  if (!response.ok) {
    const detail =
      value && typeof value === "object" && "detail" in value
        ? (value as { detail: unknown }).detail
        : null;
    const message =
      typeof detail === "string"
        ? detail
        : response.status === 401
          ? "로그인 후 이용해 주세요."
          : response.status === 409
            ? "다른 화면에서 기록이 변경됐어요. 최신 상태를 불러온 뒤 다시 시도해 주세요."
            : response.status === 422
              ? "입력한 내용을 다시 확인해 주세요."
              : "요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
    throw new ApiError(message, response.status);
  }
  if (text && value === null)
    throw new ApiError(
      "기록을 불러오지 못했어요. 잠시 후 다시 연결해 주세요.",
      502,
    );
  return value as T;
}
export type SimulationTurn = {
  answer: string;
  response: string;
  lesson: string;
};
export type SimulationSession = {
  startingPoint?: StartingPoint | null;
  id: string;
  careerId: CareerId;
  mode: "template" | "ai";
  stage: "brief" | "play" | "reflection" | "completed";
  step: number;
  version: number;
  scenario: { title: string; text: string; choices: string[] };
  turns: SimulationTurn[];
  response: SimulationTurn | null;
  questionReply?: string;
  activityId?: string;
};
export type ProjectDraft = {
  careerId: CareerId;
  answers: string[];
  version: number;
};
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "요청을 완료하지 못했어요. 다시 시도해 주세요.";
}
