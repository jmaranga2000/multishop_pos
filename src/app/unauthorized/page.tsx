import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function UnauthorizedPage(){return <main className="flex min-h-screen items-center justify-center p-6"><div className="surface max-w-lg rounded-3xl p-8 text-center"><ShieldX className="mx-auto h-12 w-12 text-red-600"/><h1 className="mt-4 text-2xl font-black">Access denied</h1><p className="mt-2 text-slate-500">Your account does not have permission to open this workspace.</p><Link href="/"><Button className="mt-6">Return to dashboard</Button></Link></div></main>}
