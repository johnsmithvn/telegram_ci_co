import { ensureUser } from "../services/sessionService";
import { BotContext } from "./context";

export async function attachTrackedUser(
  ctx: BotContext,
  next: () => Promise<unknown>
): Promise<void> {
  if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") {
    await next();
    return;
  }

  const user = await ensureUser({
    telegramId: ctx.from.id,
    chatId: ctx.chat.id,
    name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ").trim() || ctx.from.username || null
  });

  ctx.state.trackedUser = user;
  await next();
}
