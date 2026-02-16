import { createHash } from "node:crypto";
import type {
  ImportError,
  MuscleGroup,
  NormalizedSessionInput,
  ParseOptions,
  ParsedSet,
  RawCsvRow,
} from "./workout-history-types.ts";

const BODY_PART_MAP: Record<string, MuscleGroup> = {
  가슴: "chest",
  등: "back",
  하체: "legs",
  어깨: "shoulders",
  팔: "arms",
  복부: "core",
  전신: "fullbody",
  기타: "other",
};

const DATE_PATTERN = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.$/;
const HEADER_DATE = "날짜";
const HEADER_BODY_PART = "부위";
const HEADER_EXERCISE = "운동";
const HEADER_SET_TEXT = "세트";
const HEADER_MAX = "Max";
const HEADER_SET_COUNT = "Set";

function createImportError(
  rowNumber: number,
  stage: ImportError["stage"],
  message: string,
  rawRow?: string[],
): Error {
  const error = new Error(message) as Error & { importError: ImportError };
  error.importError = { rowNumber, stage, message, rawRow };
  return error;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsvRows(csvText: string): string[][] {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return lines.map(splitCsvLine);
}

function findColumnIndex(headers: string[], target: string): number {
  return headers.findIndex((header) => header.replace(/\s+/g, "").toLowerCase() === target.toLowerCase());
}

function parseDateOrThrow(value: string, rowNumber: number, rawRow: string[]): string {
  const normalized = value.trim();
  const match = normalized.match(DATE_PATTERN);
  if (!match) {
    throw createImportError(rowNumber, "date-parse", `지원하지 않는 날짜 형식입니다: "${value}"`, rawRow);
  }
  const [, yyyy, mm, dd] = match;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function mapMuscleGroupOrThrow(value: string, rowNumber: number, rawRow: string[]): MuscleGroup {
  const normalized = value.trim();
  const mapped = BODY_PART_MAP[normalized];
  if (!mapped) {
    throw createImportError(rowNumber, "muscle-group-map", `지원하지 않는 부위 값입니다: "${value}"`, rawRow);
  }
  return mapped;
}

function parseDeclaredSetCount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSetTokenOrThrow(
  token: string,
  rowNumber: number,
  rawRow: string[],
  options: ParseOptions,
): ParsedSet {
  const cleaned = token
    .trim()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    throw createImportError(rowNumber, "set-parse", "빈 세트 토큰이 감지되었습니다.", rawRow);
  }

  const weightedPattern = /^(\d+(?:\.\d+)?)\s*(?:kg)?\s*[*xX]\s*(\d+)$/i;
  const repsOnlyPattern = /^(\d+)$/;
  const weightOnlyPattern = /^(\d+(?:\.\d+)?)\s*kg$/i;

  const weightedMatch = cleaned.match(weightedPattern);
  if (weightedMatch) {
    return {
      weight: Number.parseFloat(weightedMatch[1]),
      reps: Number.parseInt(weightedMatch[2], 10),
      sourceToken: token,
    };
  }

  const repsOnlyMatch = cleaned.match(repsOnlyPattern);
  if (repsOnlyMatch) {
    return {
      weight: null,
      reps: Number.parseInt(repsOnlyMatch[1], 10),
      sourceToken: token,
    };
  }

  const weightOnlyMatch = cleaned.match(weightOnlyPattern);
  if (weightOnlyMatch && options.allowEmptyReps) {
    return {
      weight: Number.parseFloat(weightOnlyMatch[1]),
      reps: null,
      sourceToken: token,
    };
  }

  throw createImportError(rowNumber, "set-parse", `세트 토큰 파싱 실패: "${token}"`, rawRow);
}

function parseSetTextOrThrow(
  setText: string,
  rowNumber: number,
  rawRow: string[],
  options: ParseOptions,
): ParsedSet[] {
  const normalized = setText
    .replace(/\. +/g, ", ")
    .replace(/，/g, ",")
    .replace(/×/g, "*")
    .trim();

  const tokens = normalized
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (!tokens.length) {
    throw createImportError(rowNumber, "set-parse", "세트 데이터가 비어 있습니다.", rawRow);
  }

  return tokens.map((token) => parseSetTokenOrThrow(token, rowNumber, rawRow, options));
}

function createSourceImportKey(input: {
  sessionDate: string;
  muscleGroup: MuscleGroup;
  exerciseName: string;
  sets: ParsedSet[];
}): string {
  const setSignature = input.sets
    .map((set) => `${set.weight ?? "bw"}x${set.reps ?? "na"}`)
    .join(";");

  const hashSource = `${input.sessionDate}|${input.muscleGroup}|${input.exerciseName}|${setSignature}`;
  return createHash("sha1").update(hashSource).digest("hex");
}

function extractRowsOrThrow(csvRows: string[][]): RawCsvRow[] {
  if (!csvRows.length) {
    throw createImportError(1, "csv-parse", "CSV가 비어 있습니다.");
  }

  const headers = csvRows[0];
  const dateIndex = findColumnIndex(headers, HEADER_DATE);
  const bodyPartIndex = findColumnIndex(headers, HEADER_BODY_PART);
  const exerciseIndex = findColumnIndex(headers, HEADER_EXERCISE);
  const setTextIndex = findColumnIndex(headers, HEADER_SET_TEXT);
  const maxIndex = findColumnIndex(headers, HEADER_MAX);
  const setCountIndex = findColumnIndex(headers, HEADER_SET_COUNT);

  const missing: string[] = [];
  if (dateIndex < 0) missing.push(HEADER_DATE);
  if (bodyPartIndex < 0) missing.push(HEADER_BODY_PART);
  if (exerciseIndex < 0) missing.push(HEADER_EXERCISE);
  if (setTextIndex < 0) missing.push(HEADER_SET_TEXT);
  if (maxIndex < 0) missing.push(HEADER_MAX);
  if (setCountIndex < 0) missing.push(HEADER_SET_COUNT);

  if (missing.length > 0) {
    throw createImportError(
      1,
      "row-map",
      `필수 헤더가 없습니다: ${missing.join(", ")}`,
      headers,
    );
  }

  return csvRows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    return {
      rowNumber,
      raw: row,
      date: row[dateIndex] ?? "",
      bodyPart: row[bodyPartIndex] ?? "",
      exercise: row[exerciseIndex] ?? "",
      setText: row[setTextIndex] ?? "",
      maxText: row[maxIndex] ?? "",
      setCountText: row[setCountIndex] ?? "",
    };
  });
}

export function parseWorkoutHistoryCsv(
  csvText: string,
  options: ParseOptions = {},
): NormalizedSessionInput[] {
  const onSetCountMismatch = options.onSetCountMismatch ?? "useParsed";
  const csvRows = parseCsvRows(csvText);
  const rawRows = extractRowsOrThrow(csvRows);

  return rawRows.map((rawRow) => {
    const sessionDate = parseDateOrThrow(rawRow.date, rawRow.rowNumber, rawRow.raw);
    const muscleGroup = mapMuscleGroupOrThrow(rawRow.bodyPart, rawRow.rowNumber, rawRow.raw);
    const exerciseName = rawRow.exercise.trim();

    if (!exerciseName) {
      throw createImportError(rawRow.rowNumber, "row-map", "운동명은 비어 있을 수 없습니다.", rawRow.raw);
    }

    const sets = parseSetTextOrThrow(rawRow.setText, rawRow.rowNumber, rawRow.raw, options);
    const declaredSetCount = parseDeclaredSetCount(rawRow.setCountText);

    if (
      onSetCountMismatch === "error" &&
      declaredSetCount !== null &&
      declaredSetCount !== sets.length
    ) {
      throw createImportError(
        rawRow.rowNumber,
        "set-validate",
        `Set 컬럼(${declaredSetCount})과 파싱된 세트 수(${sets.length})가 다릅니다.`,
        rawRow.raw,
      );
    }

    const sourceImportKey = createSourceImportKey({
      sessionDate,
      muscleGroup,
      exerciseName,
      sets,
    });

    return {
      rowNumber: rawRow.rowNumber,
      raw: rawRow,
      sessionDate,
      muscleGroup,
      exerciseName,
      sets,
      declaredSetCount,
      sourceImportKey,
      performedAtIso: new Date(sessionDate).toISOString(),
    };
  });
}
