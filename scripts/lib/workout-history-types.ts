export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "fullbody"
  | "other";

export type RawCsvRow = {
  rowNumber: number;
  raw: string[];
  date: string;
  bodyPart: string;
  exercise: string;
  setText: string;
  maxText: string;
  setCountText: string;
};

export type ParsedSet = {
  weight: number | null;
  reps: number | null;
  sourceToken: string;
};

export type NormalizedSessionInput = {
  rowNumber: number;
  raw: RawCsvRow;
  sessionDate: string;
  muscleGroup: MuscleGroup;
  exerciseName: string;
  sets: ParsedSet[];
  declaredSetCount: number | null;
  sourceImportKey: string;
  performedAtIso: string;
};

export type ImportError = {
  rowNumber: number;
  stage: "csv-parse" | "row-map" | "date-parse" | "muscle-group-map" | "set-parse" | "set-validate";
  message: string;
  rawRow?: string[];
};

export type ImportStats = {
  totalRows: number;
  successRows: number;
  createdExercises: number;
  updatedExercises: number;
  createdSessions: number;
  updatedSessions: number;
  insertedSets: number;
  startedAt: number;
  finishedAt?: number;
};

export type ParseOptions = {
  allowEmptyReps?: boolean;
  onSetCountMismatch?: "error" | "useParsed";
};
