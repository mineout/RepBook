"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const BATCH_SIZE = 8;

type SessionFeedProps = {
  refreshKey?: number;
  onEditRequest?: (session: SessionItem) => void;
};

const muscleGroupLabels: Record<string, string> = {
  chest: "가슴",
  back: "등",
  legs: "하체",
  shoulders: "어깨",
  arms: "팔",
  core: "복부",
  fullbody: "전신",
  other: "기타",
};

type SessionItem = {
  id: string;
  performedAt: string;
  muscleGroup: string;
  exerciseName: string;
  note: string | null;
  perceivedIntensity: number | null;
  setCount: number;
  totalVolume: number;
  topSet: { weight: number | null; reps: number | null } | null;
  sets: { weight: number | null; reps: number | null }[];
};

export type SessionFeedItem = SessionItem;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function SessionFeed({ refreshKey = 0, onEditRequest }: SessionFeedProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState({
    current: { dayCount: 0, totalVolume: 0 },
    previous: { dayCount: 0, totalVolume: 0 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string>("");
  const [exerciseFilter, setExerciseFilter] = useState<string>("");
  const exerciseOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; muscleGroup: string | null }[] = [];
    sessions.forEach((session) => {
      if (!seen.has(session.exerciseName)) {
        seen.add(session.exerciseName);
        result.push({ name: session.exerciseName, muscleGroup: session.muscleGroup });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const selectableExercises = useMemo(() => {
    if (exerciseFilter && !exerciseOptions.some((option) => option.name === exerciseFilter)) {
      return [...exerciseOptions, { name: exerciseFilter, muscleGroup: null }];
    }
    return exerciseOptions;
  }, [exerciseFilter, exerciseOptions]);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const fetchMonthlySummary = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions/summary", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "월간 요약을 불러오지 못했습니다.");
      }
      setMonthlySummary({
        current: {
          dayCount: Number(body.current?.dayCount) || 0,
          totalVolume: Number(body.current?.totalVolume) || 0,
        },
        previous: {
          dayCount: Number(body.previous?.dayCount) || 0,
          totalVolume: Number(body.previous?.totalVolume) || 0,
        },
      });
    } catch {
      // Keep existing summary values if summary fetch fails.
    }
  }, []);

  const fetchNext = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        offset: String(offsetRef.current),
        limit: String(BATCH_SIZE),
      });
      if (muscleFilter) {
        params.set("muscleGroup", muscleFilter);
      }
      if (exerciseFilter) {
        params.set("exerciseName", exerciseFilter);
      }

      const response = await fetch(`/api/sessions?${params.toString()}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "세션을 불러오지 못했습니다.");
      }

      setSessions((previous) => {
        const existingIds = new Set(previous.map((session) => session.id));
        const uniqueNew = body.sessions.filter((session: SessionItem) => !existingIds.has(session.id));
        return [...previous, ...uniqueNew];
      });
      offsetRef.current += body.sessions.length;
      hasMoreRef.current = body.hasMore;
      setHasMore(body.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 불러오기 중 오류가 발생했습니다.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [exerciseFilter, muscleFilter]);

  useEffect(() => {
    setSessions([]);
    offsetRef.current = 0;
    loadingRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setError(null);
    fetchNext();
  }, [fetchNext, refreshKey, exerciseFilter, muscleFilter]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [fetchMonthlySummary, refreshKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        fetchNext();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNext, hasMore]);

  const groupedSessions = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: SessionItem[] }[] = [];
    const indexMap = new Map<string, number>();

    sessions.forEach((session) => {
      const dateKey = session.performedAt.slice(0, 10);
      let index = indexMap.get(dateKey);
      if (index === undefined) {
        index = groups.length;
        indexMap.set(dateKey, index);
        groups.push({
          dateKey,
          dateLabel: dateFormatter.format(new Date(session.performedAt)),
          items: [],
        });
      }
      groups[index].items.push(session);
    });

    return groups;
  }, [sessions]);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      const confirmed = window.confirm("이 운동 세션을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.");
      if (!confirmed) {
        return;
      }
      setDeletingId(sessionId);
      setError(null);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error ?? "세션을 삭제하지 못했습니다.");
        }
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        offsetRef.current = Math.max(0, offsetRef.current - 1);
        fetchMonthlySummary();
      } catch (err) {
        setError(err instanceof Error ? err.message : "세션 삭제 중 문제가 발생했습니다.");
      } finally {
        setDeletingId(null);
      }
    },
    [fetchMonthlySummary],
  );

  return (
    <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">최근 운동</h2>
            <p className="text-sm text-zinc-500">필터를 조정해 원하는 세션만 확인하세요.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">이번 달</p>
            <p className="text-lg font-bold text-zinc-900">
              {monthlySummary.current.dayCount}일 · {monthlySummary.current.totalVolume.toLocaleString()} kg·rep
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">지난 달</p>
            <p className="text-lg font-bold text-zinc-900">
              {monthlySummary.previous.dayCount}일 · {monthlySummary.previous.totalVolume.toLocaleString()} kg·rep
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm text-zinc-600 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">근육 부위</span>
          <select
            value={muscleFilter}
            onChange={(event) => setMuscleFilter(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">전체</option>
            {Object.entries(muscleGroupLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">운동 이름</span>
          <select
            value={exerciseFilter}
            onChange={(event) => setExerciseFilter(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">전체</option>
            {selectableExercises.map((exercise) => (
              <option key={exercise.name} value={exercise.name}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
        {(muscleFilter || exerciseFilter) && (
          <button
            type="button"
            onClick={() => {
              setMuscleFilter("");
              setExerciseFilter("");
            }}
            className="h-12 rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:bg-white"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="space-y-4">
        {groupedSessions.map((group) => (
          <div key={group.dateKey} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-900">{group.dateLabel}</h3>
              <span className="rounded-full bg-zinc-50 px-3 py-1 text-sm text-zinc-600">
                {group.items.length}개의 운동
              </span>
            </div>

            <div className="space-y-3">
              {group.items.map((session) => {
                const setLine = session.sets
                  .map((set) => {
                    const weight = set.weight != null ? `${set.weight}kg` : null;
                    const reps = set.reps != null ? `${set.reps}회` : null;
                    return [weight, reps].filter(Boolean).join(" × ");
                  })
                  .filter((line) => line.length > 0)
                  .join(" · ") || "세트 정보 없음";

                return (
                  <article
                    key={session.id}
                    className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-zinc-900">
                          <span>
                            {muscleGroupLabels[session.muscleGroup] ?? session.muscleGroup} - {session.exerciseName}
                          </span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            세트 {session.setCount}개
                          </span>
                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
                            총 {session.totalVolume.toLocaleString()} kg·rep
                          </span>
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-zinc-600">
                        {session.perceivedIntensity ? (
                          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                            RPE {session.perceivedIntensity}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onEditRequest?.(session)}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(session.id)}
                          disabled={deletingId === session.id}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === session.id ? "삭제 중..." : "삭제"}
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-medium text-zinc-800">{setLine}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                      {session.note ? <span className="text-zinc-600">{session.note}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        {!sessions.length && !isLoading && !error ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-10 text-center text-sm text-zinc-500">
            아직 기록된 운동이 없습니다. 상단의 버튼을 눌러 첫 세션을 등록해보세요.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button
            type="button"
            onClick={fetchNext}
            className="ml-3 rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-center text-sm text-zinc-500">불러오는 중...</p>
      ) : null}

      {!hasMore && sessions.length ? (
        <p className="text-center text-xs uppercase tracking-wide text-zinc-400">
          마지막 세션까지 모두 확인했습니다.
        </p>
      ) : null}

      <div ref={sentinelRef} className="h-1" />
    </section>
  );
}
