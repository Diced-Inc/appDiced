import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendPushToUser(userId, {
      title: "Teste de Notificação",
      body: "As notificações estão funcionando corretamente!",
      url: "/settings",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
