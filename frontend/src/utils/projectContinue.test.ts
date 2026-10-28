import { describe, expect, it } from 'vitest'
import { continueStepForProject, projectNeedsAttention } from './projectContinue'
import type { Project } from '../types'

function project(partial: Partial<Project>): Project {
  return {
    id: 1,
    name: 't',
    status: 'draft',
    updated_at: '2026-01-01',
    ...partial,
  } as Project
}

describe('projectContinue', () => {
  it('routes to report when capex present', () => {
    expect(continueStepForProject(project({ summary: { capex: 1e6 } })).step).toBe('report')
  })

  it('routes to economics when robots known', () => {
    expect(continueStepForProject(project({ summary: { robots_count: 4 } })).step).toBe(
      'economics',
    )
  })

  it('flags incomplete projects for attention', () => {
    expect(projectNeedsAttention(project({ summary: {} }))).toBe(true)
    expect(projectNeedsAttention(project({ status: 'archived', summary: {} }))).toBe(false)
  })
})
