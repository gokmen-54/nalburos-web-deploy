import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function HomePage(): Promise<never> {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
