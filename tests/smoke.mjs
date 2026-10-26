import { chromium } from "playwright-core";
const URL = "http://localhost:8765/";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`); };

async function newPage(viewport = { width: 420, height: 860 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/status of 503/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}

// 1) Offline demo mode
{
  const { ctx, page, errors } = await newPage();
  await page.goto(URL + "?demo=1");
  ok("demo badge", (await page.textContent("#modeBadge")) === "OFFLINE DEMO");
  ok("demo banner visible", await page.isVisible("#demoBanner"));
  await page.fill("#input", "Your welds look like bird droppings, Jimmy");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 2, null, { timeout: 5000 });
  const last = page.locator(".msg.jimmy").last();
  const txt = await last.textContent();
  ok("demo reply in log", !!txt && txt.length > 10, JSON.stringify(txt));
  ok("demo reply tagged DEMO", (await last.getAttribute("data-demo")) === "true");
  ok("user msg in log", (await page.locator(".msg.you").count()) === 1);
  await page.fill("#input", "Bet you can't even run a bead on aluminum");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 3, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "./screenshot.png" });
  ok("no JS errors (demo)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 1b) Desktop screenshot
{
  const { ctx, page } = await newPage({ width: 1200, height: 800 });
  await page.goto(URL + "?demo=1");
  await page.fill("#input", "What's up loser");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 2);
  await page.screenshot({ path: "./screenshot-desktop.png" });
  await ctx.close();
}

// 1b) Photo avatar: both layers load, jaw opens while talking and shuts after
{
  const { ctx, page, errors } = await newPage({ width: 1200, height: 800 });
  await page.goto(URL + "?demo=1");
  await page.waitForFunction(() => [...document.querySelectorAll("#avatar img")].every((i) => i.complete && i.naturalWidth > 0));
  const sizes = await page.evaluate(() => [...document.querySelectorAll("#avatar img")].map((i) => i.naturalWidth + "x" + i.naturalHeight));
  ok("avatar photo layers loaded", sizes.join() === "480x600,191x119", sizes.join());
  ok("jaw shut at idle", (await page.evaluate(() => getComputedStyle(document.getElementById("avatar")).getPropertyValue("--jaw").trim())) === "0");
  await page.evaluate(() => window.__jerk.setAvatar("talking"));
  let maxJaw = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    maxJaw = Math.max(maxJaw, await page.evaluate(() => parseFloat(document.getElementById("avatar").style.getPropertyValue("--jaw")) || 0));
  }
  ok("jaw flaps while talking", maxJaw > 0.3, `max --jaw ${maxJaw}`);
  await page.evaluate(() => window.__jerk.setAvatar(null));
  await page.waitForTimeout(600);
  ok("jaw shuts after talking", (await page.evaluate(() => parseFloat(document.getElementById("avatar").style.getPropertyValue("--jaw")) || 0)) === 0);
  ok("no JS errors (avatar)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// 2) Live mode with mocked Supabase functions (no real keys)
async function liveCtx(roastHandler, speakHandler = null) {
  const t = await newPage();
  await t.page.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript",
    body: 'window.JERK_CONFIG={supabaseUrl:"https://fake.supabase.co",supabaseAnonKey:"anon"};' }));
  const seen = {};
  await t.page.route("https://fake.supabase.co/functions/v1/**", async (r) => {
    const fn = r.request().url().split("/").pop();
    seen[fn] = JSON.parse(r.request().postData() || "{}");
    if (fn === "roast") return roastHandler(r);
    if (speakHandler) return speakHandler(r);
    return r.fulfill({ status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"configured":false}' });
  });
  return { ...t, seen };
}
{
  const { ctx, page, errors, seen } = await liveCtx((r) => r.fulfill({ status: 200, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ reply: "LIVE: nice try, kid." }) }));
  await page.goto(URL);
  ok("live badge says LIVE AI only (voice not proven yet)", (await page.textContent("#modeBadge")) === "LIVE AI");
  ok("live banner hidden", !(await page.isVisible("#demoBanner")));
  await page.fill("#input", "hello");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 2);
  const last = page.locator(".msg.jimmy").last();
  ok("live reply shown", (await last.textContent()).includes("LIVE: nice try"));
  ok("live reply not tagged demo", (await last.getAttribute("data-demo")) === null);
  await page.waitForTimeout(800);
  ok("speak called, 503 -> browser voice", seen.speak?.text === "LIVE: nice try, kid." &&
     (await page.evaluate(() => window.__jerk.state.voice)) === "browser");
  ok("badge still LIVE AI after speak 503", (await page.textContent("#modeBadge")) === "LIVE AI");
  await page.fill("#input", "round two");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 3);
  ok("history sent on 2nd turn", seen.roast?.history?.length === 2, JSON.stringify(seen.roast?.history));
  ok("no JS errors (live)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
// 2b) speak really returns audio -> only then claim Jimmy's voice
{
  const { ctx, page } = await liveCtx(
    (r) => r.fulfill({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ reply: "voiced roast" }) }),
    (r) => r.fulfill({ status: 200, contentType: "audio/mpeg",
      headers: { "Access-Control-Allow-Origin": "*" }, body: Buffer.from([0xff, 0xfb, 0x90, 0x00]) }),
  );
  await page.goto(URL);
  ok("voice badge hidden before speak works", (await page.textContent("#modeBadge")) === "LIVE AI");
  await page.fill("#input", "hello");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.getElementById("modeBadge").textContent.includes("Jimmy's voice"), null, { timeout: 5000 }).catch(() => {});
  ok("speak audio -> LIVE AI + Jimmy's voice", (await page.textContent("#modeBadge")) === "LIVE AI + Jimmy's voice");
  await ctx.close();
}
// 3) Backend up but no AI key -> switches to demo
{
  const { ctx, page } = await liveCtx((r) => r.fulfill({ status: 503, contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" }, body: '{"configured":false}' }));
  await page.goto(URL);
  await page.fill("#input", "hello");
  await page.click("#sendBtn");
  await page.waitForFunction(() => document.querySelectorAll(".msg.jimmy").length >= 2);
  ok("503 -> demo mode", (await page.textContent("#modeBadge")) === "OFFLINE DEMO" &&
     (await page.locator(".msg.jimmy").last().getAttribute("data-demo")) === "true");
  await ctx.close();
}
await browser.close();
console.log(results.join("\n"));
