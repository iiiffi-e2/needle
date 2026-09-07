"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readStageViewMode,
  writeStageViewMode,
  type StageViewMode,
} from "@/lib/stage-view";

export function useStageViewMode() {
  const [stageViewMode, setStageViewModeState] = useState<StageViewMode>("full");

  useEffect(() => {
    setStageViewModeState(readStageViewMode());
  }, []);

  const setStageViewMode = useCallback((mode: StageViewMode) => {
    setStageViewModeState(mode);
    writeStageViewMode(mode);
  }, []);

  return [stageViewMode, setStageViewMode] as const;
}
