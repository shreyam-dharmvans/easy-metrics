'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThresholdConfig } from '../types';

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  fastMs: 150,
  slowMs: 500,
  bottleneckPercent: 40,
};

interface ThresholdContextType {
  thresholds: ThresholdConfig;
  updateThresholds: (partial: Partial<ThresholdConfig>) => void;
  resetThresholds: () => void;
}

const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

export function ThresholdProvider({ children }: { children: React.ReactNode }) {
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('easymetrics_thresholds');
      if (saved) {
        const parsed = JSON.parse(saved);
        setThresholds({
          fastMs: Number(parsed.fastMs) || DEFAULT_THRESHOLDS.fastMs,
          slowMs: Number(parsed.slowMs) || DEFAULT_THRESHOLDS.slowMs,
          bottleneckPercent: Number(parsed.bottleneckPercent) || DEFAULT_THRESHOLDS.bottleneckPercent,
        });
      }
    } catch {
      // LocalStorage access may fail in private browsing mode
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateThresholds = (partial: Partial<ThresholdConfig>) => {
    setThresholds((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('easymetrics_thresholds', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const resetThresholds = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    try {
      localStorage.removeItem('easymetrics_thresholds');
    } catch { }
  };

  return (
    <ThresholdContext.Provider value={{ thresholds, updateThresholds, resetThresholds }}>
      {children}
    </ThresholdContext.Provider>
  );
}

export function useThresholds() {
  const ctx = useContext(ThresholdContext);
  if (!ctx) {
    throw new Error('useThresholds must be used within a ThresholdProvider');
  }
  return ctx;
}

