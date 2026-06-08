import { useEffect, useState } from "react";
import { loadUiPreferences, subscribeUiPreferences, type UiPreferences } from "./preferences";

export type UiLanguage = UiPreferences["language"];

export function useUiLanguage(): UiLanguage {
  const [language, setLanguage] = useState<UiLanguage>(() => loadUiPreferences().language);

  useEffect(() => subscribeUiPreferences((preferences) => setLanguage(preferences.language)), []);

  return language;
}

export function isTraditionalChinese(language: UiLanguage = loadUiPreferences().language): boolean {
  return language === "zh-TW";
}

export function uiText(language: UiLanguage, english: string, traditionalChinese: string): string {
  return isTraditionalChinese(language) ? traditionalChinese : english;
}
