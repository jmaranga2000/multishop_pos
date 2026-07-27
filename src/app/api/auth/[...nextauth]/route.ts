import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "Auth route removed. Use /api/auth/login or /api/auth/logout instead." }, { status: 404 });
}

export function POST() {
  return NextResponse.json({ error: "Auth route removed. Use /api/auth/login or /api/auth/logout instead." }, { status: 404 });
}
