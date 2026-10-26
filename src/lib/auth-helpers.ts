import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, hasDatabaseUrl } from "@/db/client";
import { users } from "@/db/schema";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !hasDatabaseUrl()) return null;

  const [current] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!current?.active || current.sessionVersion !== session.user.sessionVersion) return null;
  return {
    id: current.id,
    name: current.name,
    email: current.email,
    role: current.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export async function requireApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export function isAdmin(user: Pick<SessionUser, "role">): boolean {
  return user.role === "admin";
}
