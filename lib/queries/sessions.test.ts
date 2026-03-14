import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSessions } from "./sessions.ts";

test("normalizeSessions calculates total volume and top set", () => {
  const sessions = normalizeSessions([
    {
      id: "s1",
      performed_at: "2026-03-01T10:00:00.000Z",
      muscle_group: "legs",
      note: "heavy day",
      sets: [
        { weight: 100, reps: 5, exercise: { name: "Squat" } },
        { weight: 110, reps: 3, exercise: { name: "Squat" } },
      ],
    },
  ] as never);

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].totalVolume, 830);
  assert.deepEqual(sessions[0].topSet, { weight: 110, reps: 3 });
  assert.equal(sessions[0].exerciseName, "Squat");
});

test("normalizeSessions falls back to default exercise name", () => {
  const sessions = normalizeSessions([
    {
      id: "s2",
      performed_at: "2026-03-02T10:00:00.000Z",
      muscle_group: "core",
      note: null,
      sets: [{ weight: null, reps: 20, exercise: null }],
    },
  ] as never);

  assert.equal(sessions[0].exerciseName, "기록된 운동");
});
