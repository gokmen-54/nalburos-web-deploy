import { NextResponse } from "next/server";
import { newId, readStore, writeStore } from "@/lib/store";

type Body = {
  saleId?: string;
  content?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as Body;
  const jobs = await readStore("device-jobs");
  jobs.unshift({
    id: newId("job"),
    type: "PRINT_RECEIPT",
    payload: JSON.stringify(body),
    status: "DONE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await writeStore("device-jobs", jobs);
  return NextResponse.json({ ok: true, jobId: jobs[0].id });
}
