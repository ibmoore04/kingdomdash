import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "http://localhost:5175";
const AUTH_EMAIL = "ibrostone27@gmail.com";
const AUTH_PASSWORD = "ibmoore27$";
const findings = { screenshots: [], overflowIssues: [], pageResults: {} };
async function checkOverflow(page) {
  return await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    return { scrollWidth: sw, clientWidth: cw, hasHorizontalOverflow: sw > cw, overflowAmount: sw - cw };
  });
}
async function captureButtonData(page) {
  return await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, [role=button], input[type=submit]"));
    return buttons.slice(0, 25).map(btn => {
      const s = window.getComputedStyle(btn);
      const r = btn.getBoundingClientRect();
      return { text: (btn.textContent||"").trim().substring(0,50), classes: (btn.className||"").toString().substring(0,150), height: Math.round(r.height), width: Math.round(r.width), bg: s.backgroundColor, color: s.color, radius: s.borderRadius, padding: s.padding, visible: r.width>0&&r.height>0 };
    });
  });
}
async function captureNavData(page) {
  return await page.evaluate(() => {
    const nav = document.querySelector("nav, header");
    if (!nav) return { found: false };
    const s = window.getComputedStyle(nav);
    const r = nav.getBoundingClientRect();
    return { found: true, height: Math.round(r.height), bg: s.backgroundColor, links: Array.from(nav.querySelectorAll("a")).slice(0,8).map(a=>a.textContent.trim().substring(0,25)) };
  });
}
async function screenshot(page, name, vp) {
  const filename = name+"_"+vp.width+"x"+vp.height+".png";
  const fp = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: fp, fullPage: true });
  findings.screenshots.push(filename);
  console.log("  shot: "+filename);
  return filename;
}
async function auditPage(page, name, url, vp) {
  const key = name+"_"+vp.width+"x"+vp.height;
  try {
    await page.goto(BASE_URL+url, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(800);
    const overflow = await checkOverflow(page);
    const buttons = await captureButtonData(page);
    const nav = await captureNavData(page);
    if(overflow.hasHorizontalOverflow) findings.overflowIssues.push({ page: name, vp: vp.width+"x"+vp.height, amount: overflow.overflowAmount });
    const sf = await screenshot(page, name, vp);
    findings.pageResults[key] = { name, url, vp: vp.width+"x"+vp.height, overflow, buttons, nav, screenshot: sf };
  } catch(e) {
    console.error("  ERR "+name+": "+e.message.substring(0,80));
    findings.pageResults[key] = { error: e.message.substring(0,100), name, vp: vp.width+"x"+vp.height };
  }
}
async function doLogin(page) {
  await page.goto(BASE_URL+"/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const ei = await page.$("input[type=email],input[name=email]");
  const pi = await page.$("input[type=password]");
  if(!ei||!pi) return false;
  await ei.fill(AUTH_EMAIL);
  await pi.fill(AUTH_PASSWORD);
  const sb = await page.$("button[type=submit]");
  if(!sb) return false;
  await sb.click();
  await page.waitForTimeout(3000);
  const u = page.url();
  console.log("  After login: "+u);
  return !u.includes("/auth/");
}
async function main() {
  if(!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, {recursive:true});
  const browser = await chromium.launch({ headless: true });
  try {
    const PUBLIC_PAGES = [
      ["homepage","/"],["food","/food"],["groceries","/groceries"],
      ["courier","/courier"],["contact","/contact"],["login","/auth/login"],
      ["register","/auth/register"],["cart","/cart"]
    ];
    const DESKTOP = {width:1440,height:900};
    const MOBILE = {width:390,height:844};
    const TABLET = {width:768,height:1024};
    // Phase 1: Public pages desktop
    console.log("\n=== PUBLIC PAGES DESKTOP 1440x900 ===");
    const ctx1 = await browser.newContext();
    const pg1 = await ctx1.newPage();
    await pg1.setViewportSize(DESKTOP);
    for(const [n,u] of PUBLIC_PAGES) { console.log("\n  "+n); await auditPage(pg1,n,u,DESKTOP); }
    // Phase 1b: Public pages mobile
    console.log("\n=== PUBLIC PAGES MOBILE 390x844 ===");
    await pg1.setViewportSize(MOBILE);
    for(const [n,u] of PUBLIC_PAGES) { console.log("\n  "+n+"_mob"); await auditPage(pg1,n+"_mob",u,MOBILE); }
    // Phase 1c: tablet homepage
    await pg1.setViewportSize(TABLET);
    await auditPage(pg1,"homepage_tablet","/" ,TABLET);
    await ctx1.close();
    // Phase 2: Customer dashboard
    console.log("\n=== CUSTOMER DASHBOARD ===");
    const ctx2 = await browser.newContext();
    const pg2 = await ctx2.newPage();
    await pg2.setViewportSize(DESKTOP);
    const loggedIn = await doLogin(pg2);
    if(loggedIn) {
      const CUST_PAGES = [
        ["cust_dashboard","/dashboard"],["cust_orders","/dashboard/orders"],
        ["cust_addresses","/dashboard/addresses"],["cust_profile","/dashboard/profile"],
        ["cust_notifications","/dashboard/notifications"],["cust_settings","/dashboard/settings"]
      ];
      for(const [n,u] of CUST_PAGES) { console.log("\n  "+n); await auditPage(pg2,n,u,DESKTOP); }
      await pg2.setViewportSize(MOBILE);
      for(const [n,u] of CUST_PAGES) { await auditPage(pg2,n+"_mob",u,MOBILE); }
    }
    await ctx2.close();
    // Phase 3: Protected routes (vendor/admin/rider)
    console.log("\n=== PROTECTED ROUTES ===");
    const ctx3 = await browser.newContext();
    const pg3 = await ctx3.newPage();
    await pg3.setViewportSize(DESKTOP);
    for(const [n,u] of [["vendor_dash","/vendor"],["admin_dash","/admin"],["rider_dash","/rider"]]) {
      try { await pg3.goto(BASE_URL+u,{waitUntil:"domcontentloaded",timeout:8000}); await pg3.waitForTimeout(800); console.log("  "+n+" => "+pg3.url()); await screenshot(pg3,n,DESKTOP); } catch(e) { console.log("  "+n+" err: "+e.message.substring(0,60)); }
    }
    await ctx3.close();
    // Phase 4: Overflow matrix
    console.log("\n=== OVERFLOW MATRIX ===");
    const ctx4 = await browser.newContext();
    const pg4 = await ctx4.newPage();
    const allVP = [{w:320,h:568},{w:375,h:667},{w:390,h:844},{w:414,h:896},{w:768,h:1024},{w:820,h:1180},{w:1024,h:768},{w:1280,h:800},{w:1440,h:900},{w:1920,h:1080}];
    const keyPgs = ["/","/food","/groceries","/auth/login","/cart"];
    const overflowMatrix = {};
    for(const u of keyPgs) {
      overflowMatrix[u] = {};
      for(const vp of allVP) {
        await pg4.setViewportSize({width:vp.w,height:vp.h});
        try { await pg4.goto(BASE_URL+u,{waitUntil:"domcontentloaded",timeout:8000}); await pg4.waitForTimeout(300); const ov = await checkOverflow(pg4); overflowMatrix[u][vp.w+"x"+vp.h] = ov.hasHorizontalOverflow ? "OVERFLOW+"+ov.overflowAmount : "OK"; } catch(e) { overflowMatrix[u][vp.w+"x"+vp.h] = "ERR"; }
      }
    }
    await ctx4.close();
    // Save
    const report = { timestamp: new Date().toISOString(), findings, overflowMatrix };
    fs.writeFileSync(path.join(__dirname,"visual_audit_raw.json"), JSON.stringify(report,null,2));
    // Print summary
    console.log("\n=== OVERFLOW MATRIX RESULTS ===");
    for(const [pg, vps] of Object.entries(overflowMatrix)) {
      const bad = Object.entries(vps).filter(([,v])=>v!=="OK");
      if(bad.length) console.log("  OVERFLOW on "+pg+": "+bad.map(([k,v])=>k+"="+v).join(", "));
      else console.log("  OK: "+pg);
    }
    console.log("\n=== BUTTON AUDIT ===");
    const allBtns = [];
    for(const r of Object.values(findings.pageResults)) { if(r.buttons) allBtns.push(...r.buttons.filter(b=>b.visible&&b.text)); }
    const uniq = [...new Map(allBtns.map(b=>[b.classes.substring(0,80),b])).values()];
    uniq.slice(0,25).forEach(b=>console.log("  ["+b.height+"px] \""+b.text+"\" bg="+b.bg+" r="+b.radius+" cls="+b.classes.substring(0,60)));
    console.log("\n=== SUMMARY ===");
    console.log("Screenshots: "+findings.screenshots.length);
    console.log("Pages audited: "+Object.keys(findings.pageResults).length);
    console.log("Overflow issues: "+findings.overflowIssues.length);
    if(findings.overflowIssues.length) findings.overflowIssues.forEach(o=>console.log("  OVERFLOW: "+o.page+" @"+o.vp+" +"+o.amount+"px"));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error("FATAL:",e);process.exit(1);});
