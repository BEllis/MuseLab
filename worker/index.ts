interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/app") {
      return Response.redirect(new URL("/app/", url), 308);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    if (pathname.startsWith("/app/")) {
      return env.ASSETS.fetch(new Request(new URL("/app/index.html", url), request));
    }

    return response;
  },
};
