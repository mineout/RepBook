import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { parseWorkoutHistoryCsv } from "./lib/workout-history-parser.ts";
import type { ImportError, ImportStats, ParsedSet } from "./lib/workout-history-types.ts";

type CliOptions = {
  file: string;
  userId?: string;
  dryRun: boolean;
  allowEmptyReps: boolean;
};

const DEMO_EMAIL_FALLBACK = "demo@repbook.local";

function loadDotEnvLocalIfPresent() {
  const dotenvPath = path.resolve(process.cwd(), ".env.local");
  try {
    process.loadEnvFile(dotenvPath);
  } catch {
    // no-op when file is missing
  }
}

function parseArgs(argv: string[]): CliOptions {
  const defaultFile = path.resolve(process.cwd(), "data/lift-workout-history/workout-history.csv");
  const options: CliOptions = {
    file: defaultFile,
    userId: process.env.SUPABASE_DEFAULT_USER_ID,
    dryRun: false,
    allowEmptyReps: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    }
    if (arg === "--file") {
      options.file = path.resolve(process.cwd(), argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg === "--user-id") {
      options.userId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--allow-empty-reps") {
      options.allowEmptyReps = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`알 수 없는 옵션: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(
    [
      "Usage:",
      "  pnpm import:workout-history -- --file <csvPath> --user-id <uuid> [--dry-run] [--allow-empty-reps]",
      "",
      "Options:",
      "  --file               CSV 파일 경로 (기본값: data/lift-workout-history/workout-history.csv)",
      "  --user-id            가져올 대상 사용자 UUID (기본값: SUPABASE_DEFAULT_USER_ID)",
      "  --dry-run            DB 저장 없이 파싱/검증만 수행",
      "  --allow-empty-reps   '30kg' 같은 토큰을 reps=null로 허용",
    ].join("\n"),
  );
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name}가 필요합니다.`);
  }
  return value;
}

function printImportError(error: unknown) {
  const maybe = error as Error & { importError?: ImportError };
  if (!maybe.importError) {
    console.error(error);
    return;
  }
  const info = maybe.importError;
  console.error("Import 실패");
  console.error(`- row: ${info.rowNumber}`);
  console.error(`- stage: ${info.stage}`);
  console.error(`- reason: ${info.message}`);
  if (info.rawRow) {
    console.error(`- raw: ${JSON.stringify(info.rawRow)}`);
  }
}

function createStats(totalRows: number): ImportStats {
  return {
    totalRows,
    successRows: 0,
    createdExercises: 0,
    updatedExercises: 0,
    createdSessions: 0,
    updatedSessions: 0,
    insertedSets: 0,
    startedAt: performance.now(),
  };
}

function summarizeSets(sets: ParsedSet[]): string {
  return sets
    .map((set) => {
      if (set.weight != null && set.reps != null) {
        return `${set.weight}kgx${set.reps}`;
      }
      if (set.reps != null) {
        return `${set.reps}`;
      }
      return `${set.weight ?? "na"}kg`;
    })
    .join(";");
}

async function main() {
  loadDotEnvLocalIfPresent();
  const options = parseArgs(process.argv.slice(2));

  if (!options.userId) {
    throw new Error("--user-id 또는 SUPABASE_DEFAULT_USER_ID가 필요합니다.");
  }

  const csvText = readFileSync(options.file, "utf8");
  const sessions = parseWorkoutHistoryCsv(csvText, {
    allowEmptyReps: options.allowEmptyReps,
  });

  const stats = createStats(sessions.length);

  if (options.dryRun) {
    stats.successRows = sessions.length;
    stats.insertedSets = sessions.reduce((sum, session) => sum + session.sets.length, 0);
    stats.finishedAt = performance.now();
    printSummary(stats, true);
    return;
  }

  const supabaseUrl = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnvOrThrow("SUPABASE_SERVICE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  await supabase.from("profiles").upsert({
    id: options.userId,
    email: process.env.SUPABASE_DEFAULT_USER_EMAIL ?? DEMO_EMAIL_FALLBACK,
    display_name: "RepBook 사용자",
  });

  for (const session of sessions) {
    const { data: exerciseRow, error: selectExerciseError } = await supabase
      .from("exercises")
      .select("id")
      .eq("user_id", options.userId)
      .eq("name", session.exerciseName)
      .maybeSingle();

    if (selectExerciseError) {
      throw new Error(`row ${session.rowNumber}: exercise 조회 실패 - ${selectExerciseError.message}`);
    }

    let exerciseId = exerciseRow?.id;
    if (!exerciseId) {
      const { data: insertedExercise, error: insertExerciseError } = await supabase
        .from("exercises")
        .insert({
          name: session.exerciseName,
          muscle_group: session.muscleGroup,
          user_id: options.userId,
        })
        .select("id")
        .single();

      if (insertExerciseError || !insertedExercise) {
        throw new Error(
          `row ${session.rowNumber}: exercise 생성 실패 - ${insertExerciseError?.message ?? "unknown"}`,
        );
      }
      exerciseId = insertedExercise.id;
      stats.createdExercises += 1;
    } else {
      stats.updatedExercises += 1;
    }

    const { data: existingSession, error: existingSessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", options.userId)
      .eq("source_import_key", session.sourceImportKey)
      .maybeSingle();

    if (existingSessionError) {
      throw new Error(`row ${session.rowNumber}: session 조회 실패 - ${existingSessionError.message}`);
    }

    const { data: upsertedSession, error: upsertSessionError } = await supabase
      .from("sessions")
      .upsert(
        {
          user_id: options.userId,
          performed_at: session.performedAtIso,
          muscle_group: session.muscleGroup,
          note: "",
          perceived_intensity: null,
          source_import_key: session.sourceImportKey,
        },
        {
          onConflict: "user_id,source_import_key",
        },
      )
      .select("id")
      .single();

    if (upsertSessionError || !upsertedSession) {
      throw new Error(
        `row ${session.rowNumber}: session upsert 실패 - ${upsertSessionError?.message ?? "unknown"}`,
      );
    }

    if (existingSession?.id) {
      stats.updatedSessions += 1;
    } else {
      stats.createdSessions += 1;
    }

    const { error: deleteSetsError } = await supabase
      .from("sets")
      .delete()
      .eq("session_id", upsertedSession.id);

    if (deleteSetsError) {
      throw new Error(`row ${session.rowNumber}: 기존 sets 삭제 실패 - ${deleteSetsError.message}`);
    }

    const setRows = session.sets.map((set, index) => ({
      session_id: upsertedSession.id,
      exercise_id: exerciseId,
      weight: set.weight,
      reps: set.reps,
      set_order: index + 1,
      is_pr: false,
    }));

    const { error: insertSetsError } = await supabase.from("sets").insert(setRows);
    if (insertSetsError) {
      throw new Error(
        `row ${session.rowNumber}: sets insert 실패 - ${insertSetsError.message} (setSignature=${summarizeSets(
          session.sets,
        )})`,
      );
    }

    stats.successRows += 1;
    stats.insertedSets += setRows.length;
  }

  stats.finishedAt = performance.now();
  printSummary(stats, false);
}

function printSummary(stats: ImportStats, isDryRun: boolean) {
  const finishedAt = stats.finishedAt ?? performance.now();
  const elapsedMs = Math.round(finishedAt - stats.startedAt);
  console.log(isDryRun ? "Dry Run Summary" : "Import Summary");
  console.log(`- total rows: ${stats.totalRows}`);
  console.log(`- success rows: ${stats.successRows}`);
  console.log(`- created exercises: ${stats.createdExercises}`);
  console.log(`- updated exercises: ${stats.updatedExercises}`);
  console.log(`- created sessions: ${stats.createdSessions}`);
  console.log(`- updated sessions: ${stats.updatedSessions}`);
  console.log(`- inserted sets: ${stats.insertedSets}`);
  console.log(`- elapsed(ms): ${elapsedMs}`);
}

main().catch((error) => {
  printImportError(error);
  process.exit(1);
});
