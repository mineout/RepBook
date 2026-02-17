"use client";

import { useState } from "react";
import { ExerciseForm, type ExerciseFormInitialValues } from "@/components/exercise-form";

type AddSessionPanelProps = {
  onSaved?: () => void;
  mode?: "create" | "edit";
  sessionId?: string;
  initialValues?: ExerciseFormInitialValues;
  onCancelEdit?: () => void;
  onDraftFilterChange?: (filter: { muscleGroup: string; exerciseName: string } | null) => void;
};

export function AddSessionPanel({
  onSaved,
  mode = "create",
  sessionId,
  initialValues,
  onCancelEdit,
  onDraftFilterChange,
}: AddSessionPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const isEditMode = mode === "edit";
  const open = isEditMode ? true : createOpen;
  const handleToggleCreate = () => {
    const nextOpen = !createOpen;
    setCreateOpen(nextOpen);
    if (!nextOpen) {
      onDraftFilterChange?.(null);
    }
  };

  return (
    <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            {isEditMode ? "수정 중" : "새로운 기록"}
          </p>
          <h2 className="text-2xl font-bold text-zinc-900">
            {isEditMode ? "운동 세션 수정" : "운동 세션 추가"}
          </h2>
          <p className="text-sm text-zinc-500">
            {isEditMode
              ? "선택한 운동 기록을 수정하고 저장하면 즉시 리스트에 반영됩니다."
              : "날짜·세트·메모를 채워 넣고 저장하면 자동으로 최근 기록과 누적 볼륨에 반영됩니다."}
          </p>
        </div>
        {isEditMode ? (
          <button
            type="button"
            onClick={() => {
              onCancelEdit?.();
              onDraftFilterChange?.(null);
              setCreateOpen(false);
            }}
            className="h-12 rounded-full border border-zinc-200 px-6 text-base font-semibold text-zinc-600 transition hover:bg-zinc-50"
          >
            수정 취소
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleCreate}
            className="h-12 rounded-full bg-blue-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            {open ? "입력창 닫기" : "운동 세션 추가"}
          </button>
        )}
      </div>

      {open ? (
        <ExerciseForm
          key={isEditMode ? sessionId ?? "edit" : "create"}
          onSaved={onSaved}
          mode={isEditMode ? "edit" : "create"}
          sessionId={sessionId}
          initialValues={initialValues}
          onDraftFilterChange={onDraftFilterChange}
        />
      ) : null}
    </section>
  );
}
