import { describe, it, expect } from 'vitest';
import type {
  PillarId,
  DbPillar,
  DuePeriod,
  DbPlannerItem,
  PlannerItemInsert,
  PlannerItemUpdate,
  TimeHorizon,
  GoalStatus,
  DbGoal,
  GoalInsert,
  GoalUpdate,
} from '../database';

/**
 * Type-level tests for database types.
 * These tests verify that the type definitions are correct and usable.
 * They also serve as documentation for the expected type structure.
 */

describe('Pillar types', () => {
  it('should define valid PillarId values', () => {
    const validIds: PillarId[] = ['business', 'product', 'marketing', 'money'];
    expect(validIds).toHaveLength(4);
  });

  it('should define DbPillar with all required fields', () => {
    const pillar: DbPillar = {
      id: 'business',
      name: 'Business',
      color: '#FF0000',
      icon: 'briefcase',
      display_order: 1,
      created_at: '2024-01-01T00:00:00Z',
    };

    expect(pillar.id).toBe('business');
    expect(pillar.name).toBe('Business');
    expect(pillar.color).toBe('#FF0000');
    expect(pillar.icon).toBe('briefcase');
    expect(pillar.display_order).toBe(1);
  });

  it('should allow null for optional DbPillar fields', () => {
    const pillar: DbPillar = {
      id: 'product',
      name: 'Product',
      color: null,
      icon: null,
      display_order: 2,
      created_at: '2024-01-01T00:00:00Z',
    };

    expect(pillar.color).toBeNull();
    expect(pillar.icon).toBeNull();
  });
});

describe('Planner types', () => {
  it('should define valid DuePeriod values', () => {
    const validPeriods: DuePeriod[] = ['today', 'this_week', 'next_week'];
    expect(validPeriods).toHaveLength(3);
  });

  it('should define DbPlannerItem with all required fields', () => {
    const item: DbPlannerItem = {
      id: 'planner-123',
      business_id: 'business-456',
      title: 'Complete task',
      description: 'Task description',
      due_date: '2024-01-15',
      due_period: 'today',
      pillar_id: 'business',
      completed: false,
      completed_at: null,
      sort_order: 1,
      source_workflow: 'onboarding',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(item.id).toBe('planner-123');
    expect(item.title).toBe('Complete task');
    expect(item.completed).toBe(false);
  });

  it('should allow null for optional DbPlannerItem fields', () => {
    const item: DbPlannerItem = {
      id: 'planner-123',
      business_id: 'business-456',
      title: 'Simple task',
      description: null,
      due_date: null,
      due_period: 'this_week',
      pillar_id: null,
      completed: false,
      completed_at: null,
      sort_order: 0,
      source_workflow: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(item.description).toBeNull();
    expect(item.pillar_id).toBeNull();
  });

  it('should define PlannerItemInsert with required and optional fields', () => {
    // Minimal insert
    const minimal: PlannerItemInsert = {
      business_id: 'business-456',
      title: 'New task',
      due_period: 'today',
    };

    expect(minimal.business_id).toBe('business-456');
    expect(minimal.title).toBe('New task');
    expect(minimal.due_period).toBe('today');

    // Full insert
    const full: PlannerItemInsert = {
      business_id: 'business-456',
      title: 'Full task',
      description: 'Description',
      due_date: '2024-01-15',
      due_period: 'this_week',
      pillar_id: 'product',
      completed: false,
      sort_order: 5,
      source_workflow: 'planning',
    };

    expect(full.description).toBe('Description');
    expect(full.pillar_id).toBe('product');
  });

  it('should define PlannerItemUpdate with all optional fields', () => {
    const emptyUpdate: PlannerItemUpdate = {};
    expect(emptyUpdate).toEqual({});

    const partialUpdate: PlannerItemUpdate = {
      title: 'Updated title',
      completed: true,
      completed_at: '2024-01-15T10:00:00Z',
    };

    expect(partialUpdate.title).toBe('Updated title');
    expect(partialUpdate.completed).toBe(true);
  });
});

describe('Goal types', () => {
  it('should define valid TimeHorizon values', () => {
    const validHorizons: TimeHorizon[] = ['this_week', 'this_month', 'this_quarter'];
    expect(validHorizons).toHaveLength(3);
  });

  it('should define valid GoalStatus values', () => {
    const validStatuses: GoalStatus[] = ['active', 'achieved', 'archived'];
    expect(validStatuses).toHaveLength(3);
  });

  it('should define DbGoal with all required fields', () => {
    const goal: DbGoal = {
      id: 'goal-123',
      business_id: 'business-456',
      title: 'Increase revenue',
      description: 'Goal description',
      time_horizon: 'this_quarter',
      pillar_id: 'money',
      status: 'active',
      achieved_at: null,
      sort_order: 1,
      source_workflow: 'planning',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(goal.id).toBe('goal-123');
    expect(goal.title).toBe('Increase revenue');
    expect(goal.status).toBe('active');
  });

  it('should allow null for optional DbGoal fields', () => {
    const goal: DbGoal = {
      id: 'goal-123',
      business_id: 'business-456',
      title: 'Simple goal',
      description: null,
      time_horizon: 'this_week',
      pillar_id: null,
      status: 'active',
      achieved_at: null,
      sort_order: 0,
      source_workflow: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(goal.description).toBeNull();
    expect(goal.pillar_id).toBeNull();
  });

  it('should define GoalInsert with required and optional fields', () => {
    // Minimal insert
    const minimal: GoalInsert = {
      business_id: 'business-456',
      title: 'New goal',
      time_horizon: 'this_month',
    };

    expect(minimal.business_id).toBe('business-456');
    expect(minimal.title).toBe('New goal');
    expect(minimal.time_horizon).toBe('this_month');

    // Full insert
    const full: GoalInsert = {
      business_id: 'business-456',
      title: 'Full goal',
      description: 'Description',
      time_horizon: 'this_quarter',
      pillar_id: 'marketing',
      status: 'active',
      sort_order: 3,
      source_workflow: 'onboarding',
    };

    expect(full.description).toBe('Description');
    expect(full.pillar_id).toBe('marketing');
  });

  it('should define GoalUpdate with all optional fields', () => {
    const emptyUpdate: GoalUpdate = {};
    expect(emptyUpdate).toEqual({});

    const partialUpdate: GoalUpdate = {
      title: 'Updated goal',
      status: 'achieved',
      achieved_at: '2024-03-15T10:00:00Z',
    };

    expect(partialUpdate.title).toBe('Updated goal');
    expect(partialUpdate.status).toBe('achieved');
  });
});
