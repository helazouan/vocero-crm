import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import{spawnSync}from'node:child_process';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';
import {seedDemo} from '@/server/seed/demo';
const source=new URL(process.env.DATABASE_URL!);assert(['localhost','127.0.0.1'].includes(source.hostname));source.pathname='/postgres';
const admin=postgres(source.toString(),{max:1});const database='vocero_demo_'+randomBytes(6).toString('hex');
await admin.unsafe(`CREATE DATABASE ${database}`);source.pathname='/'+database;
const sql=postgres(source.toString(),{max:1,connection:{TimeZone:'UTC'}});const db=drizzle(sql,{schema});
try{
 const migration=spawnSync(process.execPath,['node_modules/drizzle-kit/bin.cjs','migrate'],{env:{...process.env,DATABASE_URL:source.toString()},encoding:'utf8'});assert.equal(migration.status,0);
 for(const org of ['org_demo_a','org_demo_b']){
  await sql`insert into organization(id,name) values(${org},'Ensayo')`;
  await sql`insert into agent_profile(id,organization_id) values(${org+'_profile'},${org})`;
  for(const [index,name]of ['Nuevo','En conversación','Interesado','Cliente','Perdido'].entries()) await sql`insert into pipeline_stage(id,organization_id,name,position) values(${org+'_stage_'+index},${org},${name},${index})`;
 }
 await seedDemo(db,'org_demo_a');const ids=await sql`select id from contact where organization_id='org_demo_a' order by id`;
 await seedDemo(db,'org_demo_b');assert.deepEqual(await sql`select id from contact where organization_id='org_demo_a' order by id`,ids);
 for(const org of ['org_demo_a','org_demo_b']){
  const [count]=await sql`select count(*)::int as n from contact where organization_id=${org}`;assert.equal(count.n,8);
  const [{n}]=await sql`select count(*)::int as n from message where organization_id=${org} and text ~* '(MXN|taladro|cemento|ferretería|Naucalpan)'`;assert.equal(n,0);
  assert.equal((await sql`select count(*)::int as n from message where organization_id=${org}`)[0].n,31);
  assert.equal((await sql`select metadata::jsonb->'branding'->>'currency' as currency from organization where id=${org}`)[0].currency,'EUR');
 }
 await seedDemo(db,'org_demo_a');assert.equal((await sql`select count(*)::int as n from contact where organization_id='org_demo_a'`)[0].n,8);
 assert.equal((await sql`select count(*)::int as n from contact where organization_id='org_demo_b'`)[0].n,8);
 console.log('Demo inmobiliaria: 8 contactos, 31 mensajes, euros, recarga sin duplicados y aislamiento entre organizaciones correctos.');
}finally{await sql.end();await admin.unsafe(`DROP DATABASE ${database} WITH (FORCE)`);await admin.end();}
