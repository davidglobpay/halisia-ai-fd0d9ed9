import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
const original=readFileSync(new URL("../src/routes/api/public/hooks/pulse-refresh.ts",import.meta.url),"utf8");
const source=original.replace(/import \{ createFileRoute \} from [^;]+;/,"").replace(/type Mode = [^;]+;/,"").replace("export const Route","const Route").replace("let mode: Mode","let mode").replace(/ as \{ mode\?: Mode \| "check" \}/,"").replace("err instanceof Error ? err.message : String(err)","String(err)");
function handler(secret) {
 const context=vm.createContext({Response,process:{env:{PULSE_CRON_SECRET:secret}},console,createFileRoute:()=>config=>config});
 return vm.runInContext(source+"; Route.server.handlers.POST",context);
}
test("valid key check returns without ingestion import",async()=>{
 const response=await handler("synthetic-test-key")({request:new Request("https://example.invalid",{method:"POST",headers:{"x-cron-secret":"synthetic-test-key"},body:JSON.stringify({mode:"check"})})});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,mode:"check"});
});
for(const [label,expected,provided] of [["missing", "synthetic-test-key", ""],["wrong", "synthetic-test-key","wrong"],["unconfigured","",""]]) test(label+" credentials rejected",async()=>{
 const response=await handler(expected)({request:new Request("https://example.invalid",{method:"POST",headers:{"x-cron-secret":provided},body:JSON.stringify({mode:"check"})})});
 assert.equal(response.status,401);
});
