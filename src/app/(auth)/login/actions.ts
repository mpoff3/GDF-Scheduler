"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { validateCredentials, getAuthCookie } from "@/lib/auth";

export async function login(formData: FormData) {
  const username = (formData.get("username") as string)?.trim() ?? "";
  const password = (formData.get("password") as string) ?? "";
  const from = (formData.get("from") as string)?.trim() || "/forecast";

  if (!validateCredentials(username, password)) {
    const params = new URLSearchParams({ error: "invalid" });
    if (from && from !== "/forecast") params.set("from", from);
    redirect(`/login?${params.toString()}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(getAuthCookie()!, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });

  redirect(from);
}
