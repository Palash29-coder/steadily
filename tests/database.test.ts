import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
async function asUser(who: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${who}',false);`,
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(
    "create table public.profiles(id uuid primary key, name text, preferences jsonb); insert into public.profiles values ('99999999-9999-4999-8999-999999999999','Existing app profile','{}');",
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await asUser(a);
  await db.exec("select public.steadily_initialize_workspace()");
  await asUser(b);
  await db.exec("select public.steadily_initialize_workspace()");
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL migration and RLS with two mock JWT subjects", () => {
  it("seeds exactly five defaults and is idempotent", async () => {
    await asUser(a);
    await db.exec("select public.steadily_initialize_workspace()");
    const { rows } = await db.query("select kind from steadily_habits");
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r: any) => r.kind)).size).toBe(5);
  });
  it("isolates habit definitions and versions", async () => {
    await asUser(b);
    expect(
      (await db.query("select * from steadily_habits where user_id=$1", [a]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from steadily_habit_versions where user_id=$1",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects spoofed ownership inserts", async () => {
    await asUser(b);
    await expect(
      db.query(
        "insert into steadily_tasks(user_id,title,date) values($1,$2,current_date)",
        [a, "Spoof"],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("prevents another user’s habit being used in a daily record", async () => {
    await asUser(a);
    const { rows } = await db.query<{ id: string }>(
      "select id from steadily_habits limit 1",
    );
    await asUser(b);
    await expect(
      db.query(
        "insert into steadily_daily_records(user_id,habit_id,date) values($1,$2,current_date)",
        [b, rows[0].id],
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it("isolates all private tables for reads, updates, and deletes", async () => {
    await asUser(a);
    const hid = (
      await db.query<{ id: string }>(
        "select id from steadily_habits where kind='growth'",
      )
    ).rows[0].id;
    await db.query(
      "insert into steadily_daily_records(user_id,habit_id,date,checked) values($1,$2,current_date,true)",
      [a, hid],
    );
    await db.query(
      "insert into steadily_sessions(user_id,kind,date,minutes) values($1,'study',current_date,40)",
      [a],
    );
    await db.query(
      "insert into steadily_tasks(user_id,title,date) values($1,'Private',current_date)",
      [a],
    );
    await db.query(
      "insert into steadily_journals(user_id,date,learned) values($1,current_date,'Private')",
      [a],
    );
    await asUser(b);
    for (const table of [
      "steadily_profiles",
      "steadily_habits",
      "steadily_habit_versions",
      "steadily_daily_records",
      "steadily_sessions",
      "steadily_tasks",
      "steadily_journals",
    ]) {
      expect(
        (await db.query(`select * from ${table} where user_id=$1`, [a])).rows,
      ).toHaveLength(0);
    }
    expect(
      (
        await db.query(
          "update steadily_journals set learned='Changed' where user_id=$1 returning id",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from steadily_tasks where user_id=$1 returning id",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(a);
    expect(
      (
        await db.query<{ learned: string }>(
          "select learned from steadily_journals",
        )
      ).rows[0].learned,
    ).toBe("Private");
  });
  it("enforces daily record uniqueness and supports repeated upserts", async () => {
    await asUser(a);
    const hid = (
      await db.query<{ id: string }>(
        "select id from steadily_habits where kind='growth'",
      )
    ).rows[0].id;
    await expect(
      db.query(
        "insert into steadily_daily_records(user_id,habit_id,date) values($1,$2,current_date)",
        [a, hid],
      ),
    ).rejects.toThrow(/unique/);
    await db.query(
      "insert into steadily_daily_records(user_id,habit_id,date,checked) values($1,$2,current_date,false) on conflict(habit_id,date) do update set checked=excluded.checked",
      [a, hid],
    );
    expect(
      (await db.query("select * from steadily_daily_records")).rows,
    ).toHaveLength(1);
  });
  it("blocks anonymous access", async () => {
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select * from steadily_daily_records"),
    ).rejects.toThrow(/permission denied/);
  });
  it("runs timer transitions idempotently and restricts active duplicates", async () => {
    await asUser(a);
    const id = "33333333-3333-4333-8333-333333333333";
    await db.query(
      "select steadily_timer_transition($1,'start','study','Math','')",
      [id],
    );
    await db.query(
      "select steadily_timer_transition($1,'start','study','Math','')",
      [id],
    );
    await expect(
      db.query(
        "select steadily_timer_transition('44444444-4444-4444-8444-444444444444','start','study','','')",
      ),
    ).rejects.toThrow(/unique/);
    await db.query("select steadily_timer_transition($1,'pause')", [id]);
    await db.query("select steadily_timer_transition($1,'resume')", [id]);
    await db.query("select steadily_timer_transition($1,'finish')", [id]);
    const first = (
      await db.query<{ segments: unknown[] }>(
        "select segments from steadily_sessions where id=$1",
        [id],
      )
    ).rows[0].segments;
    await db.query("select steadily_timer_transition($1,'finish')", [id]);
    expect(
      (
        await db.query<{ segments: unknown[] }>(
          "select segments from steadily_sessions where id=$1",
          [id],
        )
      ).rows[0].segments,
    ).toEqual(first);
    expect(first).toHaveLength(2);
    await asUser(b);
    await expect(
      db.query("select steadily_timer_transition($1,'finish')", [id]),
    ).rejects.toThrow(/not found/);
  });
  it("blocks changes to old versions and permits prospective versions", async () => {
    await asUser(a);
    const h = (
      await db.query<{ id: string }>(
        "select id from steadily_habits where kind='study'",
      )
    ).rows[0].id;
    await db.exec(
      "reset role;alter table steadily_habit_versions disable trigger protect_history",
    );
    await db.query(
      "update steadily_habit_versions set effective_from=current_date-2 where habit_id=$1",
      [h],
    );
    await db.exec(
      "alter table steadily_habit_versions enable trigger protect_history",
    );
    await asUser(a);
    await expect(
      db.query(
        "update steadily_habit_versions set target=10 where habit_id=$1",
        [h],
      ),
    ).rejects.toThrow(/immutable/);
    await db.query(
      "insert into steadily_habit_versions(user_id,habit_id,effective_from,name,tracking,target,start_date) values($1,$2,current_date+1,'Deep work','duration',300,current_date)",
      [a, h],
    );
    const rows = (
      await db.query<{ target: string }>(
        "select target from steadily_habit_versions where habit_id=$1 order by effective_from",
        [h],
      )
    ).rows;
    expect(Number(rows[0].target)).toBe(240);
    expect(Number(rows[1].target)).toBe(300);
  });
});

it("keeps the other app profiles table intact", async () => {
  await db.exec("reset role");
  const { rows } = await db.query<{ name: string }>(
    "select name from public.profiles",
  );
  expect(rows).toEqual([{ name: "Existing app profile" }]);
});
