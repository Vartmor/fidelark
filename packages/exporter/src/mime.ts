const BY_EXTENSION: Record<string, string> = {
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  vtt: "text/vtt",
  html: "text/html",
};

/** Media type from a Content-Type header, falling back to the file extension. */
export function mediaTypeOf(url: URL, contentType: string | null): string {
  const fromHeader = contentType?.split(";")[0]?.trim().toLowerCase();
  if (fromHeader && fromHeader !== "application/octet-stream" && fromHeader !== "text/plain") {
    return fromHeader;
  }
  const ext = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase();
  return (ext && BY_EXTENSION[ext]) ?? fromHeader ?? "application/octet-stream";
}

export function dataUri(mediaType: string, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Decodes text resources (scripts, stylesheets) as UTF-8, dropping a byte order mark. */
export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}
