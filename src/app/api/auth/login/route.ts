import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, buildLoginResponse } from "@/lib/auth";

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials, suspended account, or temporarily locked login." }, { status: 401 });
  }

  return buildLoginResponse(user);
}
