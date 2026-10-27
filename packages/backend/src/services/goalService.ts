import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { goals, goalContributions } from '../db/schema.js'
import type { Goal, GoalContribution } from '../db/schema.js'
import { makeError, type ServiceError } from '../lib/errors.js'

export type { ServiceError }

export interface GoalWithProgress extends Goal {
  percentage: number       // currentAmount / targetAmount * 100
  remaining: number        // targetAmount - currentAmount (nunca negativo)
}

export interface CreateGoalData {
  name: string
  targetAmount: number
  targetDate?: string | null
  color?: string | null
}

export type UpdateGoalData = Partial<CreateGoalData> & { archived?: boolean }

function validate(data: Partial<CreateGoalData>) {
  if (data.name !== undefined && !data.name.trim()) {
    throw makeError(422, 'VALIDATION_ERROR', 'O nome da meta é obrigatório.')
  }
  if (data.targetAmount !== undefined && (!Number.isInteger(data.targetAmount) || data.targetAmount <= 0)) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor alvo deve ser maior que zero.')
  }
  if (data.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Data alvo inválida (YYYY-MM-DD).')
  }
}

function withProgress(goal: Goal): GoalWithProgress {
  const percentage = goal.targetAmount > 0
    ? Math.round((goal.currentAmount / goal.targetAmount) * 10000) / 100
    : 0
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0)
  return { ...goal, percentage, remaining }
}

export async function listGoals(userId: string): Promise<GoalWithProgress[]> {
  const list = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt)
  return list.map(withProgress)
}

export async function createGoal(data: CreateGoalData, userId: string): Promise<GoalWithProgress> {
  validate(data)
  if (!data.name?.trim()) throw makeError(422, 'VALIDATION_ERROR', 'O nome da meta é obrigatório.')

  const [created] = await db
    .insert(goals)
    .values({
      name: data.name.trim(),
      targetAmount: data.targetAmount,
      targetDate: data.targetDate ?? null,
      color: data.color ?? null,
      userId,
    })
    .returning()
  return withProgress(created)
}

export async function updateGoal(id: string, data: UpdateGoalData, userId: string): Promise<GoalWithProgress> {
  validate(data)
  const [existing] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Meta não encontrada.')

  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.targetAmount !== undefined) updates.targetAmount = data.targetAmount
  if (data.targetDate !== undefined) updates.targetDate = data.targetDate
  if (data.color !== undefined) updates.color = data.color
  if (data.archived !== undefined) updates.archived = data.archived

  const [updated] = await db
    .update(goals)
    .set(updates)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning()
  return withProgress(updated)
}

export async function deleteGoal(id: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1)
  if (!existing) throw makeError(404, 'NOT_FOUND', 'Meta não encontrada.')
  // Aportes são removidos por CASCADE
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)))
}

export async function listContributions(goalId: string, userId: string): Promise<GoalContribution[]> {
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)
  if (!goal) throw makeError(404, 'NOT_FOUND', 'Meta não encontrada.')

  return db
    .select()
    .from(goalContributions)
    .where(eq(goalContributions.goalId, goalId))
    .orderBy(desc(goalContributions.date))
}

export interface AddContributionData {
  amount: number   // positivo = aporte; negativo = retirada
  date: string
  note?: string | null
}

export async function addContribution(goalId: string, data: AddContributionData, userId: string): Promise<GoalWithProgress> {
  if (!Number.isInteger(data.amount) || data.amount === 0) {
    throw makeError(422, 'VALIDATION_ERROR', 'O valor do aporte não pode ser zero.')
  }
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw makeError(422, 'VALIDATION_ERROR', 'Data inválida (YYYY-MM-DD).')
  }

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)
  if (!goal) throw makeError(404, 'NOT_FOUND', 'Meta não encontrada.')

  const updated = await db.transaction(async (tx) => {
    await tx.insert(goalContributions).values({
      goalId,
      amount: data.amount,
      date: data.date,
      note: data.note ?? null,
      userId,
    })
    // Atualiza o acumulado (não deixa ficar negativo)
    const newCurrent = Math.max(goal.currentAmount + data.amount, 0)
    const [g] = await tx
      .update(goals)
      .set({ currentAmount: newCurrent })
      .where(eq(goals.id, goalId))
      .returning()
    return g
  })

  return withProgress(updated)
}
