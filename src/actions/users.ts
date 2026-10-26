"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/audit";
import { formString, firstZodMessage, type ActionState } from "@/lib/forms";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";
import { logError } from "@/lib/logger";

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = userCreateSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    role: formString(formData, "role") || "member",
  });
  if (!parsed.success) return { error: firstZodMessage(parsed.error), success: null };

  try {
    const db = getDb();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
    if (existing) return { error: "Já existe um usuário com este e-mail.", success: null };
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [created] = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
      })
      .returning();
    await recordActivity({
      actorType: "user",
      actorId: admin.id,
      action: "user_created",
      entityType: "user",
      entityId: created.id,
      summary: `Usuário criado: ${created.email}`,
      metadata: { role: created.role },
    });
  } catch (error) {
    logError("Falha ao criar usuário", error, { adminId: admin.id });
    return { error: "Não foi possível criar o usuário.", success: null };
  }

  revalidatePath("/configuracoes");
  return { error: null, success: "Usuário criado." };
}

export async function updateUserAction(userId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const rawPassword = formString(formData, "password");
  const parsed = userUpdateSchema.safeParse({
    userId,
    name: formString(formData, "name"),
    role: formString(formData, "role"),
    password: rawPassword,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent(firstZodMessage(parsed.error))}`);
  }
  if (admin.id === userId && parsed.data.active === false) {
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent("Você não pode desativar a própria conta.")}`);
  }

  const db = getDb();
  let mustKeepAdmin = false;
  try {
    const patch: Partial<typeof users.$inferInsert> = {
      name: parsed.data.name,
      role: parsed.data.role,
      active: parsed.data.active,
      updatedAt: new Date(),
    };
    if (rawPassword) patch.passwordHash = await bcrypt.hash(rawPassword, 12);
    mustKeepAdmin = await db.transaction(async (tx) => {
      // Serialize count and mutation so concurrent requests cannot remove every admin.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('jb_agent_user_administration'))`);
      if (parsed.data.role === "member" || parsed.data.active === false) {
        const [countRow] = await tx.select({ value: count() }).from(users)
          .where(and(eq(users.role, "admin"), eq(users.active, true)));
        const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        if (target?.role === "admin" && target.active && Number(countRow?.value ?? 0) <= 1) return true;
      }
      await tx.update(users).set({
        ...patch,
        ...(rawPassword || !parsed.data.active ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
      }).where(eq(users.id, userId));
      return false;
    });
    if (!mustKeepAdmin) await recordActivity({
      actorType: "user",
      actorId: admin.id,
      action: "user_updated",
      entityType: "user",
      entityId: userId,
      summary: `Usuário atualizado: ${parsed.data.name ?? userId}`,
      metadata: { role: parsed.data.role, active: parsed.data.active, passwordChanged: Boolean(rawPassword) },
    });
  } catch (error) {
    logError("Falha ao atualizar usuário", error, { userId, adminId: admin.id });
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent("Não foi possível atualizar o usuário.")}`);
  }

  if (mustKeepAdmin) {
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent("É necessário manter ao menos um administrador ativo.")}`);
  }
  revalidatePath("/configuracoes");
  redirect("/configuracoes?tab=admin&ok=1");
}

export async function toggleUserActiveAction(userId: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (typeof active !== "boolean") throw new Error("INVALID_ACTIVE");
  if (admin.id === userId && !active) {
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent("Você não pode desativar a própria conta.")}`);
  }
  const mustKeepAdmin = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('jb_agent_user_administration'))`);
    if (!active) {
      const [countRow] = await tx.select({ value: count() }).from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true)));
      const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (target?.role === "admin" && target.active && Number(countRow?.value ?? 0) <= 1) return true;
    }
    await tx.update(users).set({
      active,
      updatedAt: new Date(),
      ...(!active ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
    }).where(eq(users.id, userId));
    return false;
  });
  if (mustKeepAdmin) {
    redirect(`/configuracoes?tab=admin&error=${encodeURIComponent("É necessário manter ao menos um administrador ativo.")}`);
  }
  await recordActivity({
    actorType: "user",
    actorId: admin.id,
    action: active ? "user_activated" : "user_deactivated",
    entityType: "user",
    entityId: userId,
    summary: active ? "Usuário reativado" : "Usuário desativado",
  });
  revalidatePath("/configuracoes");
  redirect("/configuracoes?tab=admin&ok=1");
}
