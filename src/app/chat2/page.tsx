import Chat2Client from "./Chat2Client";

// Server-only routing/cache flags (allowed here, not in client files)
export const dynamic = "force-dynamic";
export const revalidate = false;
export const fetchCache = "force-no-store";

export default function Page() {
  return <Chat2Client />;
}
