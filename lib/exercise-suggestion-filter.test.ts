import test from "node:test";
import assert from "node:assert/strict";

import { getFilteredExerciseSuggestions } from "./exercise-suggestion-filter.ts";

test("prioritizes prefix matches before substring matches", () => {
  const result = getFilteredExerciseSuggestions(
    [
      "레그 프레스",
      "스쿼트",
      "덤벨 스쿼트",
      "스미스 머신 스쿼트",
      "스탠딩 카프 레이즈",
      "바벨 로우",
      "스텝업",
    ],
    "스",
  );

  assert.deepEqual(result, [
    "스미스 머신 스쿼트",
    "스쿼트",
    "스탠딩 카프 레이즈",
    "스텝업",
    "덤벨 스쿼트",
    "레그 프레스",
  ]);
});

test("supports mixed latin and korean exercise names like ab슬라이드", () => {
  const result = getFilteredExerciseSuggestions(
    [
      "슬라이드 런지",
      "ab슬라이드",
      "케이블 ab 크런치",
      "AB슬라이드",
      "abc row",
    ],
    "ab",
  );

  assert.deepEqual(result, [
    "ab슬라이드",
    "AB슬라이드",
    "abc row",
    "케이블 ab 크런치",
  ]);
});

test("keeps mixed latin and korean names searchable by korean substrings", () => {
  const result = getFilteredExerciseSuggestions(
    ["슬라이드 런지", "ab슬라이드", "AB슬라이드"],
    "슬",
  );

  assert.deepEqual(result, ["슬라이드 런지", "ab슬라이드", "AB슬라이드"]);
});

test("sorts alphabetically in ko-KR locale when query is empty", () => {
  const result = getFilteredExerciseSuggestions(
    ["하이바 스쿼트", "가블릿 스쿼트", "백 스쿼트"],
    "",
  );

  assert.deepEqual(result, ["가블릿 스쿼트", "백 스쿼트", "하이바 스쿼트"]);
});
