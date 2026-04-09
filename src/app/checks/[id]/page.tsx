import { redirect } from "next/navigation";

export default async function CheckRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/verify?check=${id}`);
}
