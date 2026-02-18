"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AddSessionPanel } from "@/components/add-session-panel";
import { SessionFeed, type SessionFeedItem } from "@/components/session-feed";
import type { ExerciseFormInitialValues } from "@/components/exercise-form";

export default function Home() {
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [editingSession, setEditingSession] = useState<SessionFeedItem | null>(null);
  const [appliedFilter, setAppliedFilter] = useState<{ muscleGroup: string; exerciseName: string } | null>(null);

  const handleSaved = () => {
    setFeedRefreshKey((prev) => prev + 1);
    setAppliedFilter(null);
    setEditingSession(null);
  };

  const handleEditRequest = (session: SessionFeedItem) => {
    setEditingSession(session);
  };

  const handleCancelEdit = () => {
    setAppliedFilter(null);
    setEditingSession(null);
  };

  const initialValues = useMemo<ExerciseFormInitialValues | undefined>(() => {
    if (!editingSession) return undefined;
    return {
      sessionDate: editingSession.performedAt.slice(0, 10),
      muscleGroup: editingSession.muscleGroup,
      exerciseName: editingSession.exerciseName,
      note: editingSession.note,
      sets: editingSession.sets,
    };
  }, [editingSession]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex min-h-[174px] items-center justify-center rounded-3xl border border-zinc-200 bg-white px-6 py-3 shadow-sm">
          <Image
            src="/rep-book-logo.png"
            alt="RepBook"
            width={362}
            height={258}
            priority
            className="h-[155px] w-auto max-w-full"
          />
        </header>

        <AddSessionPanel
          onSaved={handleSaved}
          mode={editingSession ? "edit" : "create"}
          sessionId={editingSession?.id}
          initialValues={initialValues}
          onCancelEdit={editingSession ? handleCancelEdit : undefined}
          onDraftFilterChange={setAppliedFilter}
        />
        <SessionFeed refreshKey={feedRefreshKey} onEditRequest={handleEditRequest} appliedFilter={appliedFilter} />
      </div>
    </div>
  );
}
