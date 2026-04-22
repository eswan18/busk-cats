import type { Env } from "./env";
import { route } from "./router";

export type { Env } from "./env";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return route(request, env);
  },
};
