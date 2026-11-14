import { extname } from "node:path";
import type { Finding, InputFormat } from "@fidelark/schema";

export type Classification = {
  format: InputFormat;
  findings: Finding[];
};

const BY_EXTENSION: Record<string, InputFormat> = {
  ".html": "html",
  ".htm": "html",
  ".jsx": "jsx",
  ".tsx": "tsx",
  ".md": "markdown",
  ".markdown": "markdown",
  ".zip": "zip",
};

/** How many leading bytes are inspected to sniff the content type. */
const SNIFF_BYTES = 8192;

type Sniffed = "zip" | "binary" | "html" | "module" | "text";

function sniff(bytes: Uint8Array): Sniffed {
  // ZIP local file header or empty-archive end record.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return "zip";
  }
  const head = bytes.subarray(0, SNIFF_BYTES);
  if (head.includes(0)) {
    return "binary";
  }
  const text = new TextDecoder("utf-8").decode(head).trimStart().toLowerCase();
  if (
    text.startsWith("<!doctype html") ||
    text.startsWith("<html") ||
    /<(head|body)[\s>]/.test(text)
  ) {
    return "html";
  }
  if (/^\s*(import|export)\s/m.test(text) || /from\s+["']react["']/.test(text)) {
    return "module";
  }
  return "text";
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decides the input format from the file extension and the leading bytes.
 *
 * Rules, in order: a ZIP signature always wins; other binary content is unknown;
 * a known extension wins over text heuristics (with a warning on a clear mismatch);
 * without a known extension, decisive content (HTML, JS module) is used.
 */
export function classifyInput(name: string, bytes: Uint8Array): Classification {
  const ext = extname(name).toLowerCase();
  const byExtension = BY_EXTENSION[ext];
  const sniffed = sniff(bytes);
  const findings: Finding[] = [];

  if (sniffed === "zip") {
    if (byExtension !== undefined && byExtension !== "zip") {
      findings.push({
        code: "input.extension-mismatch",
        severity: "warning",
        message: `File has a ${ext} extension but is a ZIP archive; treating it as ZIP.`,
      });
    }
    return { format: "zip", findings };
  }

  if (sniffed === "binary") {
    findings.push({
      code: "input.binary-content",
      severity: "error",
      message: "File contains binary data and is not a supported text format or ZIP archive.",
    });
    return { format: "unknown", findings };
  }

  if (!isValidUtf8(bytes)) {
    findings.push({
      code: "input.invalid-utf8",
      severity: "warning",
      message: "File is not valid UTF-8; some characters may be misread.",
    });
  }

  if (byExtension === "zip") {
    findings.push({
      code: "input.extension-mismatch",
      severity: "error",
      message: "File has a .zip extension but no ZIP signature.",
    });
    return { format: "unknown", findings };
  }

  if (byExtension !== undefined) {
    const looksLikeOtherFormat =
      (byExtension === "jsx" || byExtension === "tsx") && sniffed === "html";
    if (looksLikeOtherFormat) {
      findings.push({
        code: "input.extension-mismatch",
        severity: "warning",
        message: `File has a ${ext} extension but its content looks like an HTML document.`,
      });
    }
    return { format: byExtension, findings };
  }

  if (sniffed === "html" || sniffed === "module") {
    const format: InputFormat = sniffed === "html" ? "html" : "jsx";
    findings.push({
      code: "input.format-from-content",
      severity: "info",
      message: `Unrecognized extension "${ext || "(none)"}"; detected ${format} from content.`,
    });
    return { format, findings };
  }

  findings.push({
    code: "input.unsupported-format",
    severity: "error",
    message: `Unrecognized extension "${ext || "(none)"}" and no recognizable content.`,
  });
  return { format: "unknown", findings };
}
