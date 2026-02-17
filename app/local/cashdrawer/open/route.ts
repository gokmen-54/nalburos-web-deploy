import { NextResponse } from "next/server";
import { newId, readStore, writeStore } from "@/lib/store";

export async function POST(): Promise<NextResponse> {
  const jobs = await readStore("device-jobs");
  jobs.unshift({
    id: newId("job"),
    type: "OPEN_CASHDRAWER",
    payload: "{}",
    status: "DONE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await writeStore("device-jobs", jobs);
  return NextResponse.json({ ok: true, jobId: jobs[0].id });
}
