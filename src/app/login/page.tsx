import { redirect } from "next/navigation";

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.error
    ? `/?error=${encodeURIComponent(params.error)}`
    : "/";

  redirect(nextUrl);
}
