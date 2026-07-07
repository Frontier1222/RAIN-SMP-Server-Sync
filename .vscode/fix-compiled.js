/**
 * Patch Essentials compiled.js for Script API compatibility on 1.21.130+.
 * Run: node fix-compiled.js
 */
const fs = require("fs");
const path = require("path");

const compiledPath = path.join(
  __dirname,
  "..",
  "behavior_packs",
  "Essentials BP",
  "scripts",
  "unlinked",
  "compiled.js"
);

let code = fs.readFileSync(compiledPath, "utf8");
const original = code;

function replace(oldStr, newStr, label) {
  if (!code.includes(oldStr)) {
    console.warn(`SKIP (not found): ${label}`);
    return false;
  }
  code = code.replace(oldStr, newStr);
  console.log(`OK: ${label}`);
  return true;
}

function replaceAll(oldStr, newStr, label) {
  const count = code.split(oldStr).length - 1;
  if (count === 0) {
    console.warn(`SKIP (not found): ${label}`);
    return 0;
  }
  code = code.split(oldStr).join(newStr);
  console.log(`OK: ${label} (${count}x)`);
  return count;
}

// Marker so we can verify server received the patch
const essHelper =
  'function __essWorldPlayers(w){try{return w.getPlayers()}catch(e){}try{return w.getAllPlayers()}catch(e){}let p=[];for(let d of["minecraft:overworld","minecraft:nether","minecraft:the_end"])try{p.push(...w.getDimension(d).getEntities({type:"minecraft:player"}))}catch(e){}return p}';

if (!/^var __ESS_PATCH\s*=/.test(code)) {
  code = "var __ESS_PATCH = 9;\n" + essHelper + "\n" + code;
  console.log("OK: added __ESS_PATCH = 9 marker and __essWorldPlayers helper");
} else {
  code = code.replace(/^var __ESS_PATCH\s*=\s*\d+;\s*/, "var __ESS_PATCH = 9;\n");
  if (!code.includes("function __essWorldPlayers")) {
    code = code.replace(/^var __ESS_PATCH\s*=\s*9;\s*/, "var __ESS_PATCH = 9;\n" + essHelper + "\n");
    console.log("OK: added __essWorldPlayers helper");
  }
  console.log("OK: updated __ESS_PATCH marker");
}

// PebbleHost: getPlayers/getAllPlayers exist on prototype but throw at runtime — use try/catch + dimension fallback
replaceAll(
  '(typeof fa.getPlayers=="function"?fa.getPlayers:fa.getAllPlayers)()',
  "__essWorldPlayers(fa)",
  "fa world players helper (minified typeof fallback)"
);

replaceAll(
  '(typeof fa.getPlayers == "function" ? fa.getPlayers : fa.getAllPlayers)()',
  "__essWorldPlayers(fa)",
  "fa world players helper (formatted typeof fallback)"
);

replace(
  "this.push(...fn.getAllPlayers())",
  "this.push(...__essWorldPlayers(fn))",
  "Ce scheduler initial players (minified)"
);

replace(
  "this.push(...(typeof fn.getAllPlayers==\"function\"?fn.getAllPlayers:fn.getPlayers)())",
  "this.push(...__essWorldPlayers(fn))",
  "Ce scheduler initial players (typeof fallback minified)"
);

replace(
  'this.push(...(typeof fn.getAllPlayers == "function" ? fn.getAllPlayers : fn.getPlayers)\n        ())',
  "this.push(...__essWorldPlayers(fn))",
  "Ce scheduler initial players (formatted typeof fallback)"
);

replaceAll(
  "fa.getPlayers()",
  "__essWorldPlayers(fa)",
  "fa.getPlayers direct calls"
);

replaceAll(
  "fn.getAllPlayers()",
  "__essWorldPlayers(fn)",
  "fn.getAllPlayers direct calls"
);

// BlockPermutation.getTags() guard in tree/crop registration scan
replace(
  "let o=m.getTags();if(o.some(i=>i.startsWith(dt)))",
  'let o=typeof m.getTags=="function"?m.getTags():[];if(o.some(i=>i.startsWith(dt)))',
  "mm() getTags guard"
);

replace(
  "let t=Wi.getAll();for(let r of t)",
  'let t=typeof Wi.getAll=="function"?Wi.getAll():[];for(let r of t)',
  "mm() BlockTypes.getAll guard"
);

// Safer bootstrap
replace(
  "Yn.afterEvents.worldLoad.subscribe(()=>{Jr(),vo.runJob(mm())});",
  "Yn.afterEvents.worldLoad.subscribe(()=>{Jr();try{vo.runJob(mm())}catch(e){console.error(\"[Essentials] runJob(mm) failed:\",e)}});",
  "worldLoad runJob guard"
);

replace(
  "});Ur();",
  '});try{Ur()}catch(e){console.error("[Essentials] Ur failed:",e)}',
  "Ur() guard"
);

replace(
  "function Jr(){for(let e of st)try{e.onWorldLoad?.()}catch(a){console.error(`Error in module ${e.constructor.name}:`,a)}}",
  'function Jr(){for(let e of st)try{e.onWorldLoad?.()}catch(a){console.error(`[Essentials] onWorldLoad failed in ${e.constructor.name}:`,a)}}',
  "Jr error prefix"
);

replace(
  "function Yr(){for(let e of st)try{e.onStartup?.()}catch(a){console.error(`Error in module ${e.constructor.name}:`,a)}}",
  'function Yr(){for(let e of st)try{e.onStartup?.()}catch(a){console.error(`[Essentials] onStartup failed in ${e.constructor.name}:`,a)}}',
  "Yr error prefix"
);

// Interval ticks that run every few ticks — wrap so one bad API call does not spam logs
replace(
  "hr.runInterval(()=>{let a=B.getPlayers();for(let n of a)for(let t of na){",
  "hr.runInterval(()=>{try{let a=B.getPlayers();for(let n of a)for(let t of na){",
  "portables interval try open"
);

replace(
  "t.handler.destroy(n,t,r),Da(n,t,r))}},20)",
  "t.handler.destroy(n,t,r),Da(n,t,r))}}catch(e){console.error(\"[Essentials] portables tick failed:\",e.message||e)}},20)",
  "portables interval try close"
);

replace(
  "static onUpdate(){let a=B.getPlayers();for(let n of a){",
  'static onUpdate(){try{let a=B.getPlayers();for(let n of a){',
  "chunks onUpdate try open"
);

replace(
  'r.spawnParticle("ulkd_ess:essentials19",g))}}};Ye=y([A],Ye);',
  'r.spawnParticle("ulkd_ess:essentials19",g))}}catch(e){console.error("[Essentials] chunks tick failed:",e.message||e)}}};Ye=y([A],Ye);',
  "chunks onUpdate try close"
);

replace(
  "function Ur(){ai.beforeEvents.startup.subscribe(e=>{ri(e.itemComponentRegistry,e.blockComponentRegistry)})}",
  'function Ur(){ai.beforeEvents.startup.subscribe(e=>{try{ri(e.itemComponentRegistry,e.blockComponentRegistry)}catch(a){console.error("[Essentials] component registration failed:",a)}})}',
  "Ur startup callback guard"
);

replace(
  "vo.beforeEvents.startup.subscribe(()=>{Yr(),Yn.afterEvents.itemUse.subscribe(e=>{if(e.itemStack.typeId!==\"ulkd_ess:clear_waypoint\")return;let n=e.source;ga(n)?(n.runCommand(\"kill @e[type=ulkd_ess:waypoint,r=5]\"),n.runCommand(\"kill @e[type=ulkd_ess:waypoint_public,r=5]\"),n.sendMessage({translate:\"ulkd.ess.waypoints.cleared\"})):n.sendMessage({translate:\"ulkd.ess.insufficient_permissions\"})}),Yn.beforeEvents.itemUse.subscribe(e=>{let a=e.itemStack.typeId;if(a===\"ulkd_ess:sleeping_bag\"){let n=e.source;v.sleepingBag.globalGet()||(n.sendMessage({translate:\"ulkd.ess.sleeping_bag.disabled\"}),e.cancel=!0);return}if(a===\"ulkd_ess:clear_waypoint\"){let n=e.source;if(!v.clearWaypoint.globalGet()){if(e.cancel=!0,$.debounce(\"Essentials.clearWaypoint\",n))return;n.sendMessage({translate:\"ulkd.ess.clear_waypoint.disabled\"})}return}}),Yn.afterEvents.entitySpawn.subscribe(e=>{let a=e.entity;if(a.typeId===\"ulkd_ess:sleeping_bag\"){let t=a.dimension.id;a.setProperty(\"ulkd_ess:in_overworld\",t===se.Overworld)}})});",
  'vo.beforeEvents.startup.subscribe(()=>{vo.run(()=>{try{Yr(),Yn.afterEvents.itemUse.subscribe(e=>{if(e.itemStack.typeId!=="ulkd_ess:clear_waypoint")return;let n=e.source;ga(n)?(n.runCommand("kill @e[type=ulkd_ess:waypoint,r=5]"),n.runCommand("kill @e[type=ulkd_ess:waypoint_public,r=5]"),n.sendMessage({translate:"ulkd.ess.waypoints.cleared"})):n.sendMessage({translate:"ulkd.ess.insufficient_permissions"})}),Yn.beforeEvents.itemUse.subscribe(e=>{let a=e.itemStack.typeId;if(a==="ulkd_ess:sleeping_bag"){let n=e.source;v.sleepingBag.globalGet()||(n.sendMessage({translate:"ulkd.ess.sleeping_bag.disabled"}),e.cancel=!0);return}if(a==="ulkd_ess:clear_waypoint"){let n=e.source;if(!v.clearWaypoint.globalGet()){if(e.cancel=!0,$.debounce("Essentials.clearWaypoint",n))return;n.sendMessage({translate:"ulkd.ess.clear_waypoint.disabled"})}return}}),Yn.afterEvents.entitySpawn.subscribe(e=>{let a=e.entity;if(a.typeId==="ulkd_ess:sleeping_bag"){let t=a.dimension.id;a.setProperty("ulkd_ess:in_overworld",t===se.Overworld)}})}catch(e){console.error("[Essentials] deferred startup failed:",e)}})});',
  "defer Yr() to full execution via system.run"
);

// Portable blocks: saved loc is plain {x,y,z} from JSON, not a Vector — wrap before equals/subtract/add
replace(
  "t.equals(i.loc)",
  "t.equals(h.from(i.loc))",
  "go() Vector.from saved loc"
);

replace(
  "let i=!1;for(let l of o.matchId)",
  "let i=!1,loc=h.from(r.loc);for(let l of o.matchId)",
  "portable scan loc vector (minified)"
);

replace(
  "let i = !1; for (let l of o.matchId)",
  "let i = !1, loc = h.from(r.loc); for (let l of o.matchId)",
  "portable scan loc vector (formatted)"
);

replaceAll(
  "testforblock ${r.loc.x} ${r.loc.y} ${r.loc.z}",
  "testforblock ${loc.x} ${loc.y} ${loc.z}",
  "portable scan testforblock loc"
);

replaceAll(
  "r.loc.subtract(1,1,1),r.loc.add(1,1,1)",
  "loc.subtract(1,1,1),loc.add(1,1,1)",
  "portable scan getBlocks bounds (minified)"
);

replaceAll(
  "r.loc.subtract(1, 1, 1), r.loc.add(1, 1, 1)",
  "loc.subtract(1, 1, 1), loc.add(1, 1, 1)",
  "portable scan getBlocks bounds (formatted)"
);

replace(
  "hr.runInterval(()=>{M||Bn();for(let[a,n]of Object.entries(M))",
  "hr.runInterval(()=>{try{M||Bn();for(let[a,n]of Object.entries(M))",
  "portable scan interval try open (minified)"
);

replace(
  "hr.runInterval(() => { M || Bn(); for (",
  "hr.runInterval(() => { try { M || Bn(); for (",
  "portable scan interval try open (formatted)"
);

replace(
  "r.loc=h.from(l),Da(a,o,r);break}}},1)}",
  'r.loc=h.from(l),Da(a,o,r);break}}}catch(e){console.error("[Essentials] portable block scan failed:",e.message||e)}},1)}',
  "portable scan interval try close (minified)"
);

replace(
  "r.loc = h.from(l), Da(a, o, r); break } } }, 1) } };",
  'r.loc = h.from(l), Da(a, o, r); break } } } catch (e) { console.error("[Essentials] portable block scan failed:", e.message || e) } }, 1) } };',
  "portable scan interval try close (formatted)"
);

// Death coords: action bar only — sendMessage hits BDS chat log / Discord relay bots
replace(
  '.sendMessage({translate:"ulkd.ess.deathpoint.died_at",with:[i]})',
  '.onScreenDisplay.setActionBar({translate:"ulkd.ess.deathpoint.died_at",with:[i]})',
  "deathpoint action bar (minified)"
);

replace(
  '.sendMessage({ translate: "ulkd.ess.deathpoint.died_at", with: [i] })',
  '.onScreenDisplay.setActionBar({ translate: "ulkd.ess.deathpoint.died_at", with: [i] })',
  "deathpoint action bar (formatted)"
);

if (code === original && !/^var __ESS_PATCH\s*=/.test(code)) {
  console.error("No changes applied — file may already be patched or structure changed.");
  process.exit(1);
}

fs.writeFileSync(compiledPath, code, "utf8");
console.log("\nPatched:", compiledPath);
console.log("Size:", code.length, "bytes");
