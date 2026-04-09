"use server";

import { redirect } from "next/navigation";

import { signOutUser } from "@/lib/auth/session";

export async function logoutAction() {
  await signOutUser();
  redirect("/");
}
