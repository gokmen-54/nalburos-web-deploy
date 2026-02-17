import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { calculateEstimate } from "@/lib/estimator";

type Body = {
  templateId?: string;
  areaValue?: number;
  thicknessCm?: number;
  wastePercent?: number;
  title?: string;
  customInputs?: Record<string, number>;
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.templateId || !body.areaValue) {
    return NextResponse.json({ error: "templateId ve areaValue zorunlu." }, { status: 400 });
  }
  try {
    const estimate = await calculateEstimate({
      templateId: body.templateId,
      areaValue: Number(body.areaValue),
      thicknessCm: body.thicknessCm,
      wastePercent: body.wastePercent,
      title: body.title,
      customInputs: body.customInputs
    });
    return NextResponse.json({ estimate });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
