import fs from "fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/fix-multiline-strings.mjs <file>");
  process.exit(1);
}

let src = fs.readFileSync(path, "utf8");

function unescapeDoubleQuoted(body) {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && i + 1 < body.length) {
      const n = body[++i];
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === "r") out += "\r";
      else out += n;
      continue;
    }
    out += body[i];
  }
  return out;
}

function toTemplate(body) {
  return unescapeDoubleQuoted(body)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

/** Find field: "...." respecting escapes; convert only if body has raw newline. */
function convertFieldStrings(src, fieldNames) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (const field of fieldNames) {
      const prefix = `${field}: `;
      // also allow field: without space variants already covered by scanning
      const candidates = [`${field}: "`, `${field}:"`];
      for (const start of candidates) {
        if (src.startsWith(start, i)) {
          const quoteStart = i + start.length - 1; // index of opening "
          let j = quoteStart + 1;
          let body = "";
          while (j < src.length) {
            const ch = src[j];
            if (ch === "\\") {
              body += ch;
              if (j + 1 < src.length) body += src[++j];
              j++;
              continue;
            }
            if (ch === '"') break;
            body += ch;
            j++;
          }
          if (j >= src.length || src[j] !== '"') {
            out += src[i];
            i++;
            matched = true;
            break;
          }
          const pre = src.slice(i, quoteStart);
          if (body.includes("\n")) {
            out += `${pre}\`${toTemplate(body)}\``;
          } else {
            out += src.slice(i, j + 1);
          }
          i = j + 1;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) {
      out += src[i];
      i++;
    }
  }
  return out;
}

const fields = [
  "summary",
  "lead",
  "renungan",
  "exegesis",
  "prayer",
  "challenge",
  "theme",
  "title",
  "text",
];

const rewritten = convertFieldStrings(src, fields);
fs.writeFileSync(path, rewritten);
console.log("rewrote", path);
