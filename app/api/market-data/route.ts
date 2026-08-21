export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { error: "Market data cache is unavailable in this runtime." },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "3600",
      },
    },
  );
}
