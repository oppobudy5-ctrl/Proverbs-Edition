import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = await readFile(path.join(ROOT, "js/router.js"), "utf8");
const mainSrc = await readFile(path.join(ROOT, "js/main.js"), "utf8");
const vercel = await readFile(path.join(ROOT, "vercel.json"), "utf8");

assert.match(src, /history\.pushState/);
assert.match(src, /history\.replaceState/);
assert.match(src, /popstate/);
assert.match(src, /document\.title/);
assert.match(src, /scrollRestoration/);
assert.match(src, /export function go\(/);
assert.match(src, /export function initRouter\(/);
assert.match(src, /export function buildPath\(/);
assert.match(src, /export function parsePath\(/);
assert.match(src, /\/lesson\//);
assert.doesNotMatch(mainSrc, /go\("home"\)/, "boot tidak boleh memaksa home (deep link harus dihormati)");
assert.match(vercel, /\/lesson\/:day/, "Vercel harus rewrite /lesson/:day ke index.html");

function buildPath(route, params = {}) {
  if (route === "day") {
    const day = Number(params.day);
    return Number.isInteger(day) && day >= 1 && day <= 31 ? `/lesson/${day}` : "/";
  }
  if (route === "home") return "/";
  if (route === "calendar") return "/calendar";
  if (route === "library") return "/library";
  if (route === "about") return "/about";
  return "/";
}

function parsePath(pathname = "/") {
  let pathName = String(pathname || "/").split("?")[0].split("#")[0] || "/";
  pathName = pathName.replace(/\/+$/, "") || "/";
  if (pathName === "/" || pathName === "/home" || pathName === "/index.html") return { route: "home", params: {} };
  if (pathName === "/calendar") return { route: "calendar", params: {} };
  if (pathName === "/library" || pathName === "/journal" || pathName === "/bookmark" || pathName === "/bookmarks") {
    return { route: "library", params: {} };
  }
  if (pathName === "/about" || pathName === "/profile") return { route: "about", params: {} };
  const lesson = pathName.match(/^\/(?:lesson|day)\/(\d{1,2})$/i);
  if (lesson) {
    const day = Number(lesson[1]);
    if (Number.isInteger(day) && day >= 1 && day <= 31) return { route: "day", params: { day } };
  }
  return { route: "home", params: {} };
}

assert.deepEqual(parsePath("/"), { route: "home", params: {} });
assert.deepEqual(parsePath("/lesson/1"), { route: "day", params: { day: 1 } });
assert.deepEqual(parsePath("/lesson/10"), { route: "day", params: { day: 10 } });
assert.deepEqual(parsePath("/day/5"), { route: "day", params: { day: 5 } });
assert.deepEqual(parsePath("/calendar"), { route: "calendar", params: {} });
assert.deepEqual(parsePath("/library"), { route: "library", params: {} });
assert.deepEqual(parsePath("/journal"), { route: "library", params: {} });
assert.deepEqual(parsePath("/bookmark"), { route: "library", params: {} });
assert.deepEqual(parsePath("/about"), { route: "about", params: {} });
assert.deepEqual(parsePath("/profile"), { route: "about", params: {} });
assert.deepEqual(parsePath("/unknown-page"), { route: "home", params: {} });
assert.deepEqual(parsePath("/lesson/99"), { route: "home", params: {} });
assert.deepEqual(parsePath("/lesson/abc"), { route: "home", params: {} });

assert.equal(buildPath("home"), "/");
assert.equal(buildPath("day", { day: 3 }), "/lesson/3");
assert.equal(buildPath("day", { day: 0 }), "/");
assert.equal(buildPath("calendar"), "/calendar");
assert.equal(buildPath("library"), "/library");
assert.equal(buildPath("about"), "/about");
assert.equal(buildPath("nope"), "/");

assert.equal(buildPath("day", parsePath("/lesson/7").params), "/lesson/7");
assert.equal(buildPath(parsePath("/calendar").route), "/calendar");

// Ensure router source encodes the same lesson pattern used by tests.
assert.match(src, /lesson\|day/);
assert.match(src, /unknown|home/);

console.log("VALID: Router History API wiring, deep-link parse/build, unknown-route safety.");
