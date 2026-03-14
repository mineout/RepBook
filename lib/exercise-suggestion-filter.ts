export function getFilteredExerciseSuggestions(
  suggestions: string[],
  query: string,
  limit = 6,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return suggestions
    .filter((name) =>
      normalizedQuery ? name.toLowerCase().includes(normalizedQuery) : true,
    )
    .sort((a, b) => {
      const aStarts = normalizedQuery
        ? a.toLowerCase().startsWith(normalizedQuery)
        : true;
      const bStarts = normalizedQuery
        ? b.toLowerCase().startsWith(normalizedQuery)
        : true;

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return a.localeCompare(b, "ko-KR");
    })
    .slice(0, limit);
}
