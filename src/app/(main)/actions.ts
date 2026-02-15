"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthCookie } from "@/lib/auth";

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(getAuthCookie()!);
  redirect("/login");
}
