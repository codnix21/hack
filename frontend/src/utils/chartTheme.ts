import { useMemo } from 'react'
import { useThemeStore } from '../store/themeStore'

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

export function readCanvasColors() {
  return {
    floor: cssVar('--nc-canvas', '#1c2433'),
    grid: cssVar('--nc-canvas-grid', 'rgba(255,255,255,0.12)'),
    frame: cssVar('--nc-accent-line', 'rgba(240,115,22,0.55)'),
  }
}

/** Цвета recharts из CSS-токенов (пересчёт при смене темы). */
export function useChartTheme() {
  const theme = useThemeStore((s) => s.theme)
  return useMemo(
    () => ({
      theme,
      grid: cssVar('--nc-chart-grid', '#4a5870'),
      tick: cssVar('--nc-chart-tick', '#b6bfcf'),
      tooltipBg: cssVar('--nc-surface', '#1a2030'),
      tooltipBorder: cssVar('--nc-border', '#5c6d88'),
      cursor: cssVar('--nc-surface-hover', '#2a3346'),
      effect: cssVar('--nc-chart-1', '#f07316'),
      capex: cssVar('--nc-chart-2', '#3dd9c5'),
      opex: cssVar('--nc-chart-3', '#7aafff'),
      tco: cssVar('--nc-chart-4', '#c6f23a'),
    }),
    [theme],
  )
}
