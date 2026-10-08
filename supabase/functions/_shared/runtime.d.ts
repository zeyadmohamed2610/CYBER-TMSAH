/** Host API used by the deployed Edge handler; implementations are supplied by Deno. */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};
