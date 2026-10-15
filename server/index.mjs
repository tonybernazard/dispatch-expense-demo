import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { openDatabase,service,ApiError } from './database.mjs';
export function createApi(db){
 const api=service(db);
 return createServer(async(req,res)=>{
  // Local demo only: deliberately no cookies, bearer tokens, or real SSO.
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){res.writeHead(403);res.end('Only local demo origins accepted');return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Demo-User');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  try{
   const path=new URL(req.url,'http://localhost').pathname,user=req.headers['x-demo-user']||'u1';let body={};
   if(['POST','PATCH','PUT'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw new ApiError('Request too large',413);}if(raw){try{body=JSON.parse(raw);}catch{throw new ApiError('Invalid JSON');}}if(!body||Array.isArray(body)||typeof body!=='object')throw new ApiError('JSON object required');}
   let result,status=200;
   if(path==='/api/health'&&req.method==='GET')result={ok:true,storage:'sqlite',demo:true};
   else if(path==='/api/bootstrap'&&req.method==='GET')result=api.bootstrap(user);
   else if(path==='/api/expenses'&&req.method==='POST'){result=api.create(user,body);status=201;}
   else if(/^\/api\/expenses\/[^/]+$/.test(path)&&req.method==='PATCH')result=api.edit(user,decodeURIComponent(path.split('/')[3]),body);
   else if(/^\/api\/expenses\/[^/]+\/[^/]+$/.test(path)&&req.method==='POST')result=api.transition(user,decodeURIComponent(path.split('/')[3]),path.split('/')[4],body);
   else if(/^\/api\/card-transactions\/[^/]+\/match$/.test(path)&&req.method==='POST')result=api.match(user,decodeURIComponent(path.split('/')[3]),body.expenseId);
   else if(/^\/api\/categories\/[^/]+$/.test(path)&&req.method==='PUT')result=api.updateCategory(user,decodeURIComponent(path.split('/')[3]),body);
   else if(path==='/api/totals'&&req.method==='GET')result=api.totals(user);
   else if(/^\/api\/policies\/[^/]+$/.test(path)&&req.method==='PUT')result=api.updatePolicy(user,decodeURIComponent(path.split('/')[3]),body);
   else if(/^\/api\/reports\/[^/]+\/[^/]+$/.test(path)&&req.method==='POST')result=api.reportAction(user,decodeURIComponent(path.split('/')[3]),path.split('/')[4],body);
   else if(path==='/api/export'&&req.method==='POST'){const csv=api.export(user);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="dispatch-accounting.csv"'});res.end(csv);return;}
   else throw new ApiError('Route not found',404);
   res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  }catch(err){const constraint=String(err.message).includes('constraint');res.writeHead(err.status||(constraint?409:500),{'Content-Type':'application/json'});res.end(JSON.stringify({error:err.status?err.message:constraint?'Database constraint prevented invalid or duplicate data':'Internal server error'}));}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const db=openDatabase(process.env.DATABASE_PATH||new URL('../db/dispatch.sqlite',import.meta.url).pathname);
 const server=createApi(db);server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log(`Dispatch synthetic demo SQL API: http://127.0.0.1:${process.env.PORT||3001}`));
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>{db.close();process.exit(0);}));
}
