import { NextResponse } from "next/server";

import { countChecks } from "@/lib/persistence/check-repository";
import { hasPappersMcpConfigured } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    status: "ok",
    mode: hasPappersMcpConfigured() ? "live" : "unconfigured",
    checksCount: countChecks(),
    timestamp: new Date().toISOString(),
  });
}
