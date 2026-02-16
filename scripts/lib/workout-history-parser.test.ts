import test from "node:test";
import assert from "node:assert/strict";
import { parseSetTokenOrThrow, parseWorkoutHistoryCsv } from "./workout-history-parser.ts";

const CSV_HEADER = ",날짜,부위,운동,세트,Max,Set";

test("parseSetTokenOrThrow parses weighted and reps-only formats", () => {
  const raw = ["", "2025. 2. 9.", "하체", "스쿼트", "40kg*10", "", "1"];
  assert.deepEqual(parseSetTokenOrThrow("40kg*10", 2, raw, {}), {
    weight: 40,
    reps: 10,
    sourceToken: "40kg*10",
  });
  assert.deepEqual(parseSetTokenOrThrow("40*10", 2, raw, {}), {
    weight: 40,
    reps: 10,
    sourceToken: "40*10",
  });
  assert.deepEqual(parseSetTokenOrThrow("15", 2, raw, {}), {
    weight: null,
    reps: 15,
    sourceToken: "15",
  });
});

test("parseSetTokenOrThrow supports comments", () => {
  const raw = ["", "2025. 2. 9.", "하체", "스쿼트", "35kg*10 (겨우)", "", "1"];
  assert.deepEqual(parseSetTokenOrThrow("35kg*10 (겨우)", 2, raw, {}), {
    weight: 35,
    reps: 10,
    sourceToken: "35kg*10 (겨우)",
  });
});

test("parseWorkoutHistoryCsv fails on invalid set tokens", () => {
  const badTokens = ["20kg^8", "35kg*.15", "30kg,20"];
  for (const token of badTokens) {
    const csv = `${CSV_HEADER}\n,2025. 2. 9.,하체,스쿼트,"${token}",,1`;
    assert.throws(() => parseWorkoutHistoryCsv(csv), /세트 토큰 파싱 실패|Set 컬럼/);
  }
});

test("parseWorkoutHistoryCsv normalizes date and maps muscle group", () => {
  const csv = `${CSV_HEADER}\n,2025. 2. 9.,하체,스쿼트,"40kg*10, 45kg*8",,2`;
  const rows = parseWorkoutHistoryCsv(csv);
  assert.equal(rows[0].sessionDate, "2025-02-09");
  assert.equal(rows[0].muscleGroup, "legs");
  assert.equal(rows[0].performedAtIso, "2025-02-09T00:00:00.000Z");
});

test("parseWorkoutHistoryCsv supports bodyweight reps-only sets", () => {
  const csv = `${CSV_HEADER}\n,2025. 2. 9.,가슴,푸쉬업,"20, 15, 12",,3`;
  const rows = parseWorkoutHistoryCsv(csv);
  assert.deepEqual(rows[0].sets, [
    { weight: null, reps: 20, sourceToken: "20" },
    { weight: null, reps: 15, sourceToken: "15" },
    { weight: null, reps: 12, sourceToken: "12" },
  ]);
});

test("parseWorkoutHistoryCsv prefers parsed sets when declared set count mismatches", () => {
  const csv = `${CSV_HEADER}\n,2025. 2. 9.,하체,스쿼트,"40kg*10, 45kg*8",,3`;
  const rows = parseWorkoutHistoryCsv(csv);
  assert.equal(rows[0].declaredSetCount, 3);
  assert.equal(rows[0].sets.length, 2);
});

test("parseWorkoutHistoryCsv can enforce set count mismatch in error mode", () => {
  const csv = `${CSV_HEADER}\n,2025. 2. 9.,하체,스쿼트,"40kg*10, 45kg*8",,3`;
  assert.throws(
    () => parseWorkoutHistoryCsv(csv, { onSetCountMismatch: "error" }),
    /파싱된 세트 수/,
  );
});

test("parseWorkoutHistoryCsv fails on unsupported muscle group", () => {
  const csv = `${CSV_HEADER}\n,2025. 2. 9.,엉덩이,스쿼트,"40kg*10",,1`;
  assert.throws(() => parseWorkoutHistoryCsv(csv), /지원하지 않는 부위 값/);
});
