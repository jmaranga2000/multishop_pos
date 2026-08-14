import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, buildLoginResponse } from "@/lib/auth";

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  let body: any;
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    // Accept traditional form posts from non-JS clients (e.g. Safari without JS)
    const form = await request.formData();
    body = {
      email: form.get("email")?.toString() || "",
      password: form.get("password")?.toString() || "",
    };
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials, suspended account, or temporarily locked login." }, { status: 401 });
  }

  // If this was a form post, redirect so the browser follows with the cookie applied.
  const isFormPost = !(contentType.includes("application/json"));
  return buildLoginResponse(user, isFormPost);
}
