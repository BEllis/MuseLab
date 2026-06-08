import { createReadStream } from "fs";
import { access, readFile, stat } from "fs/promises";
import path from "path";

const EXTENSION_MIMES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
};

export function mimeFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MIMES[ext] ?? "application/octet-stream";
}

export function resolveAssetProtocolPath(requestUrl: string): string {
  const pathname = decodeURIComponent(new URL(requestUrl).pathname);
  if (process.platform === "win32") {
    return path.win32.normalize(pathname.replace(/^\//, "").replace(/\//g, "\\"));
  }
  return path.normalize(pathname);
}

export async function readAssetFile(
  filePath: string
): Promise<{ data: Uint8Array; mime: string }> {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Asset path is not absolute: ${filePath}`);
  }
  const data = await readFile(filePath);
  return { data: new Uint8Array(data), mime: mimeFromExtension(filePath) };
}

async function serveAssetFile(filePath: string, request: Request): Promise<Response> {
  const fileStat = await stat(filePath);
  const mime = mimeFromExtension(filePath);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      const size = fileStat.size;
      let start = match[1] ? Number.parseInt(match[1], 10) : 0;
      let end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
      if (Number.isNaN(start) || start < 0) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start >= size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const chunkSize = end - start + 1;
      return new Response(createReadStream(filePath, { start, end }) as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  return new Response(createReadStream(filePath) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(fileStat.size),
      "Accept-Ranges": "bytes",
    },
  });
}

export async function handleAssetProtocolRequest(request: Request): Promise<Response> {
  try {
    const filePath = resolveAssetProtocolPath(request.url);
    if (!path.isAbsolute(filePath)) {
      return new Response("Not Found", { status: 404 });
    }
    await access(filePath);
    return serveAssetFile(filePath, request);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
