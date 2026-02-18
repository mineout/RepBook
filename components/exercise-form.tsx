"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExercise, type SaveExercisePayload } from "@/lib/actions/save-exercise";
import { updateSession } from "@/lib/actions/update-session";

const muscleGroups = [
  { value: "chest", label: "가슴" },
  { value: "back", label: "등" },
  { value: "legs", label: "하체" },
  { value: "shoulders", label: "어깨" },
  { value: "arms", label: "팔" },
  { value: "core", label: "복부" },
  { value: "fullbody", label: "전신" },
  { value: "other", label: "기타" },
];

type SetInput = {
  id: string;
  weight: string;
  reps: string;
};

const createSet = (): SetInput => ({
  id: Math.random().toString(36).slice(2),
  weight: "",
  reps: "",
});

export type ExerciseFormInitialValues = {
  sessionDate: string;
  muscleGroup: string;
  exerciseName: string;
  note?: string | null;
  sets: { weight: number | null; reps: number | null }[];
};

type ExerciseFormProps = {
  onSaved?: () => void;
  mode?: "create" | "edit";
  sessionId?: string;
  initialValues?: ExerciseFormInitialValues;
  onDraftFilterChange?: (filter: { muscleGroup: string; exerciseName: string } | null) => void;
};

export function ExerciseForm({
  onSaved,
  mode = "create",
  sessionId,
  initialValues,
  onDraftFilterChange,
}: ExerciseFormProps = {}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const router = useRouter();
  const isEditMode = mode === "edit" && Boolean(sessionId);

  const buildInitialSets = useCallback(
    (source?: { weight: number | null; reps: number | null }[]) => {
      if (!source || !source.length) {
        return [createSet()];
      }
      return source.map((set) => ({
        id: Math.random().toString(36).slice(2),
        weight: set.weight != null ? String(set.weight) : "",
        reps: set.reps != null ? String(set.reps) : "",
      }));
    },
    [],
  );

  const initialFormState = useMemo(() => {
    if (isEditMode && initialValues) {
      return {
        exerciseName: initialValues.exerciseName,
        muscleGroup: initialValues.muscleGroup,
        sessionDate: initialValues.sessionDate,
        note: initialValues.note ?? "",
        sets: buildInitialSets(initialValues.sets),
      };
    }
    return {
      exerciseName: "",
      muscleGroup: "chest",
      sessionDate: today,
      note: "",
      sets: [createSet()],
    };
  }, [buildInitialSets, initialValues, isEditMode, today]);

  const [step, setStep] = useState(1);
  const [exerciseName, setExerciseName] = useState(initialFormState.exerciseName);
  const [muscleGroup, setMuscleGroup] = useState(initialFormState.muscleGroup);
  const [sessionDate, setSessionDate] = useState(initialFormState.sessionDate);
  const [note, setNote] = useState(initialFormState.note);
  const [sets, setSets] = useState<SetInput[]>(initialFormState.sets);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalSteps = 3;

  const filledSets = useMemo(
    () => sets.filter((set) => set.reps.trim()),
    [sets],
  );

  const summary = useMemo<SaveExercisePayload>(
    () => ({
      sessionDate,
      muscleGroup,
      exerciseName,
      note,
      sets: filledSets,
    }),
    [exerciseName, filledSets, muscleGroup, note, sessionDate],
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchExercises() {
      try {
        const response = await fetch("/api/exercises", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "운동 목록을 불러오지 못했습니다.");
        }
        if (!cancelled) {
          setExerciseSuggestions(body.exercises ?? []);
        }
      } catch (error) {
        console.error(error);
      }
    }

    fetchExercises();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const trimmedName = exerciseName.trim();
    if (step >= 2 && muscleGroup && trimmedName) {
      onDraftFilterChange?.({
        muscleGroup,
        exerciseName: trimmedName,
      });
      return;
    }
    onDraftFilterChange?.(null);
  }, [exerciseName, isEditMode, muscleGroup, onDraftFilterChange, step]);

  const handleSetChange = (id: string, field: keyof SetInput, value: string) => {
    setSets((prev) => prev.map((set) => (set.id === id ? { ...set, [field]: value } : set)));
  };

  const handleSetAdd = () => setSets((prev) => [...prev, createSet()]);
  const handleSetRemove = (id: string) =>
    setSets((prev) => (prev.length === 1 ? prev : prev.filter((set) => set.id !== id)));

  const resetForm = useCallback(() => {
    setExerciseName(initialFormState.exerciseName);
    setMuscleGroup(initialFormState.muscleGroup);
    setSessionDate(initialFormState.sessionDate);
    setNote(initialFormState.note);
    setSets(initialFormState.sets);
    setStep(1);
    setStatus("idle");
    setStatusMessage(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [initialFormState]);

  const isStepValid = () => {
    if (step === 1) {
      return Boolean(sessionDate && muscleGroup && exerciseName.trim());
    }
    if (step === 2) {
      return filledSets.length > 0;
    }
    return true;
  };

  const goNext = () => {
    if (step < totalSteps && isStepValid()) {
      setStep((current) => current + 1);
    }
  };

  const goBack = () => setStep((current) => Math.max(1, current - 1));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isStepValid()) return;

    try {
      setStatus("saving");
      setStatusMessage("운동 저장 중입니다...");
      if (isEditMode && sessionId) {
        await updateSession({ ...summary, sessionId });
      } else {
        await saveExercise(summary);
      }
      timerRef.current = setTimeout(() => {
        onSaved?.();
        router.push("/");
        router.refresh();
        resetForm();
      }, 2000);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "운동 저장 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex-1 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <header className="mb-6 space-y-1">
          <p className="text-sm font-medium text-blue-700">세션 기록</p>
          <h1 className="text-2xl font-semibold text-zinc-900">운동 추가</h1>
          <p className="text-sm text-zinc-500">단계별로 정보를 입력해 새로운 운동 세션을 만듭니다.</p>
        </header>

        <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-zinc-500">
          <span className="text-blue-600">STEP {step}</span>
          <span className="text-zinc-300">/</span>
          <span>{totalSteps}</span>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {statusMessage}
          </div>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                수행 날짜
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(event) => setSessionDate(event.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                근육 부위
                <select
                  value={muscleGroup}
                  onChange={(event) => setMuscleGroup(event.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {muscleGroups.map((group) => (
                    <option key={group.value} value={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
            운동 이름
            <div className="relative">
              <input
                required
                value={exerciseName}
                onChange={(event) => {
                  setExerciseName(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="예: 바벨 스쿼트"
              />
              {showSuggestions && exerciseSuggestions.length > 0 ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-zinc-100 bg-white shadow-lg">
                  <ul className="max-h-40 overflow-y-auto text-sm text-zinc-700">
                    {exerciseSuggestions
                      .filter((name) =>
                        exerciseName ? name.toLowerCase().includes(exerciseName.toLowerCase()) : true,
                      )
                      .slice(0, 6)
                      .map((name, index) => (
                        <li key={`${name}-${index}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setExerciseName(name);
                              setShowSuggestions(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-zinc-50"
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                  </ul>
                  <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400">
                    새 이름을 입력하면 자동으로 추가됩니다.
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">세트 입력</h2>
            </div>

            <div className="space-y-3">
              {sets.map((set, index) => (
                <div
                  key={set.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between text-sm text-zinc-500">
                    <span>세트 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleSetRemove(set.id)}
                      className="text-xs font-medium text-rose-500 disabled:text-zinc-300"
                      disabled={sets.length === 1}
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
                      중량 (kg, 선택)
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={set.weight}
                        onChange={(event) => handleSetChange(set.id, "weight", event.target.value)}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="예: 40 (맨몸 운동이면 비워두세요)"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
                      횟수 (reps)
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={set.reps}
                        onChange={(event) => handleSetChange(set.id, "reps", event.target.value)}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="예: 12"
                      />
                    </label>
                  </div>
                  {index === sets.length - 1 ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSetAdd}
                        disabled={!set.reps.trim()}
                        className="rounded-full border border-rose-300 bg-rose-50 px-4 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-zinc-100"
                      >
                        세트 추가
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900">세트 요약</h2>
              {filledSets.length ? (
                <ul className="space-y-2 text-sm text-zinc-600">
                  {filledSets.map((set, index) => (
                    <li key={set.id} className="flex justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                      <span>세트 {index + 1}</span>
                      <span className="font-semibold text-zinc-900">
                        {set.weight.trim() ? `${set.weight}kg × ${set.reps}회` : `${set.reps}회`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">입력된 세트가 없습니다. 이전 단계로 돌아가 추가하세요.</p>
              )}
            </div>

            <div className="grid gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
                메모
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-[120px] rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="세션 중 특이사항을 기록하세요"
                />
              </label>
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-zinc-200 px-6 py-3 text-base font-semibold text-zinc-600 transition hover:bg-zinc-50"
            >
              이전 단계
            </button>
          )}

          {step < totalSteps && (
            <button
              type="button"
              onClick={goNext}
              disabled={!isStepValid() || status === "saving"}
              className="flex-1 rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition enabled:hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-200"
            >
              다음 단계
            </button>
          )}

          {step === totalSteps && (
            <button
              type="submit"
              disabled={status === "saving"}
              className="flex-1 rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-200"
            >
              {status === "saving" ? "저장 중..." : "운동 저장"}
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            disabled={status === "saving"}
            className="rounded-full border border-zinc-200 px-6 py-3 text-base font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            초기화
          </button>
        </div>
      </form>

      {status === "saving" ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/65">
          <div className="rounded-2xl border border-white/20 bg-zinc-900 px-8 py-6 text-center text-white shadow-2xl">
            <p className="text-xl font-semibold">운동 저장중...</p>
            <p className="mt-2 text-sm text-zinc-200">잠시만 기다려주세요.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
