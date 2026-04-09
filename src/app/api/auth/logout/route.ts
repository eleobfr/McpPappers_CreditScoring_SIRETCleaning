import { NextResponse } from "next/server";

import { appEnv } from "@/lib/env";
import { signOutUser } from "@/lib/auth/session";

function publicUrl(pathname: string) {
  return new URL(pathname, appEnv.appBaseUrl);
}

export async function POST() {
  await signOutUser();
  return NextResponse.redirect(publicUrl("/"), 303);
}
