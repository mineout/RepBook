type BasePayload = {
  sessionDate: string;
  muscleGroup: string;
  exerciseName: string;
  note: string;
  sets: { weight: string; reps: string }[];
};

type ActionLogContext = {
  action: string;
  stage: string;
  userId?: string;
  sessionId?: string;
  payload: BasePayload;
};

function toErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: "digest" in error ? String(error.digest) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "알 수 없는 예외",
    stack: undefined,
    digest: undefined,
  };
}

function summarizePayload(payload: BasePayload) {
  return {
    sessionDate: payload.sessionDate,
    muscleGroup: payload.muscleGroup,
    exerciseName: payload.exerciseName.trim(),
    noteLength: payload.note.length,
    setCount: payload.sets.length,
    sets: payload.sets.map((set, index) => ({
      index,
      weight: set.weight,
      reps: set.reps,
    })),
  };
}

export function logActionFailure(context: ActionLogContext, error: unknown) {
  const errorDetails = toErrorDetails(error);

  console.error(`[${context.action}] failed at ${context.stage}`, {
    action: context.action,
    stage: context.stage,
    userId: context.userId,
    sessionId: context.sessionId,
    payload: summarizePayload(context.payload),
    error: errorDetails,
  });
}
