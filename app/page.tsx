"use client";

import { useMemo, useState } from "react";
import { AddSessionPanel } from "@/components/add-session-panel";
import { SessionFeed, type SessionFeedItem } from "@/components/session-feed";
import type { ExerciseFormInitialValues } from "@/components/exercise-form";

export default function Home() {
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [editingSession, setEditingSession] = useState<SessionFeedItem | null>(null);

  const handleSaved = () => {
    setFeedRefreshKey((prev) => prev + 1);
    setEditingSession(null);
  };

  const handleEditRequest = (session: SessionFeedItem) => {
    setEditingSession(session);
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
  };

  const initialValues = useMemo<ExerciseFormInitialValues | undefined>(() => {
    if (!editingSession) return undefined;
    return {
      sessionDate: editingSession.performedAt.slice(0, 10),
      muscleGroup: editingSession.muscleGroup,
      exerciseName: editingSession.exerciseName,
      perceivedEffort: editingSession.perceivedIntensity,
      note: editingSession.note,
      sets: editingSession.sets,
    };
  }, [editingSession]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">RepBook</h1>
        </header>

        <AddSessionPanel
          onSaved={handleSaved}
          mode={editingSession ? "edit" : "create"}
          sessionId={editingSession?.id}
          initialValues={initialValues}
          onCancelEdit={editingSession ? handleCancelEdit : undefined}
        />
        <SessionFeed refreshKey={feedRefreshKey} onEditRequest={handleEditRequest} />
      </div>
    </div>
  );
}
