"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { logWarn } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Informe um e-mail e uma senha válidos." };
  }

  const limit = checkRateLimit(`login:${parsed.data.email}`, 8, 60_000);
  if (!limit.allowed) {
    return { error: "Muitas tentativas. Aguarde um minuto e tente novamente." };
  }

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
      redirectTo: "/",
    });

    const resultUrl = typeof result === "string" ? result : "";
    if (resultUrl.includes("error=")) {
      return { error: "E-mail ou senha inválidos." };
    }
  } catch (error) {
    logWarn("Falha de login", {
      email: parsed.data.email,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { error: "Não foi possível iniciar a sessão. Tente novamente." };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
