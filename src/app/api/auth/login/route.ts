import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateUser, buildLoginResponse } from "@/lib/auth";

const LOGIN_ATTEMPT_COOKIE = "multishop-pos-login-attempts";
const MAX_LOGIN_ATTEMPTS_PER_SESSION = 3;

const requestSchema = z.object({
  email: z.string().trim().email().max(50),
  password: z.string().min(1).max(20),
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

  const cookieStore = await cookies();
  const attemptsCookie = cookieStore.get(LOGIN_ATTEMPT_COOKIE)?.value;
  let attempts = 0;

  if (attemptsCookie) {
    try {
      const parsedAttempts = JSON.parse(attemptsCookie) as { count?: number };
      if (typeof parsedAttempts.count === "number" && Number.isFinite(parsedAttempts.count)) {
        attempts = Math.max(0, Math.min(parsedAttempts.count, MAX_LOGIN_ATTEMPTS_PER_SESSION));
      }
    } catch {
      attempts = 0;
    }
  }

  if (attempts >= MAX_LOGIN_ATTEMPTS_PER_SESSION) {
    const response = NextResponse.json({ error: "Too many failed login attempts for this session. Please try again later." }, { status: 429 });
    response.cookies.set({
      name: LOGIN_ATTEMPT_COOKIE,
      value: JSON.stringify({ count: attempts }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    const nextAttemptCount = attempts + 1;
    const response = NextResponse.json({ error: "Invalid credentials, suspended account, or temporarily locked login." }, { status: 401 });
    response.cookies.set({
      name: LOGIN_ATTEMPT_COOKIE,
      value: JSON.stringify({ count: nextAttemptCount }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  }

  const response = buildLoginResponse(user, !(contentType.includes("application/json")));
  response.cookies.set({
    name: LOGIN_ATTEMPT_COOKIE,
    value: "",
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
