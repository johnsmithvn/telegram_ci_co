import { Context } from "telegraf";
import { User } from "../types/domain";

export interface BotContext extends Context {
  state: Context["state"] & {
    trackedUser?: User;
    inactiveUser?: boolean;
  };
}
