import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/database.mjs';
import {createApi} from '../server/index.mjs';
import {createApiAdapter,fromApi,toApi} from './api-adapter.js';

test('frontend adapter → HTTP API → SQLite persists full draft, submit, review and export lifecycle',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dispatch-adapter-'));const filename=join(dir,'demo.sqlite');let db=openDatabase(filename);const server=createApi(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const adapter=createApiAdapter('http://127.0.0.1:'+server.address().port);const data=await adapter.load('Technician');
 const expense={id:'frontend-new',job:data.jobs[0].id,category:'Supplies',merchant:'Fictional adapter store',date:'2026-10-15',amount:9.99,payment:'Out of pocket',receipt:false,missingReceipt:false,reportName:data.reports[0].name,notes:'Synthetic frontend adapter test'};
 let row=await adapter.save(expense,data,false);assert.equal(row.amountCents,999);assert.equal(row.status,'draft');
 const d2=await adapter.load('Technician');let front=fromApi(row,d2);assert.equal(front.amount,9.99);front.amount=8.75;row=await adapter.save(front,d2,true);assert.equal(row.status,'submitted');assert.equal(row.amountCents,875);
 row=await adapter.review(fromApi(row,d2),'approve','Verified',undefined,true);assert.equal(row.status,'approved');const csv=await adapter.export([fromApi(row,d2)]);assert.match(csv,/Fictional adapter store/);
 const d3=await adapter.load('Accounting');assert.equal(d3.expenses.find(e=>e.id===row.id).status,'exported');assert.ok(d3.audit.some(a=>a.expenseId===row.id));
 await new Promise(r=>server.close(r));db.close();db=openDatabase(filename);assert.equal(db.prepare('SELECT amount_cents,status FROM expenses WHERE id=?').get(row.id).status,'exported');
 }finally{if(server.listening)await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});}
});

test('adapter translates personal, evidence and report fields without real bank data',()=>{const data={reports:[{id:'rep1',name:'Field report'}],receipts:[{id:'r1',userId:'u1'}]};const row=toApi({job:'j1',category:'Meals',merchant:'Demo',date:'2026-10-15',amount:20,payment:'Corporate card',deductiblePersonal:5,receipt:true,reportName:'Field report'},data);assert.equal(row.personalCents,500);assert.equal(row.receiptId,'r1');assert.equal(row.reportId,'rep1');assert.equal(row.paymentSource,'company_card');assert.equal(row.miles,null);});
