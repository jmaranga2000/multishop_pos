"use client";
import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enableAdministratorPushNotifications } from "@/services/push/client-push-service";
export function PushSettings(){const [loading,setLoading]=useState(false);async function enable(){setLoading(true);try{await enableAdministratorPushNotifications();toast.success("Push notifications enabled")}catch(error){toast.error(error instanceof Error?error.message:"Unable to enable notifications")}finally{setLoading(false)}}return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2 text-blue-700"><BellRing className="h-5 w-5"/></div><div className="flex-1"><h3 className="font-extrabold">Administrator push notifications</h3><p className="mt-1 text-sm text-blue-900/70">Receive critical stock, out-of-stock, weekly report and synchronization conflict alerts on this device.</p><Button className="mt-4" onClick={()=>void enable()} disabled={loading}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<BellRing className="h-4 w-4"/>}Enable notifications</Button></div></div></div>}
