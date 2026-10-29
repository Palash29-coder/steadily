// Optional live integration smoke test. Use two disposable, confirmed test accounts.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const env = process.env;
const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];
for (const key of required)
  if (!env[key]) throw new Error(`Missing ${key}. See README.`);
const clients = [0, 1].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
let taskId;
try {
  const ids = [];
  for (const [i, c] of clients.entries()) {
    const letter = i === 0 ? "A" : "B";
    const { data, error } = await c.auth.signInWithPassword({
      email: env[`TEST_USER_${letter}_EMAIL`],
      password: env[`TEST_USER_${letter}_PASSWORD`],
    });
    if (error)
      throw new Error(`Account ${letter} could not sign in: ${error.message}`);
    ids.push(data.user.id);
    const init = await c.rpc("initialize_workspace");
    if (init.error) throw init.error;
  }
  assert.notEqual(ids[0], ids[1], "Use two different accounts.");
  const [a, b] = clients;
  const task = await a
    .from("tasks")
    .insert({
      user_id: ids[0],
      title: "Disposable isolation smoke test",
      date: "2099-01-01",
    })
    .select()
    .single();
  if (task.error) throw task.error;
  taskId = task.data.id;
  for (const table of [
    "profiles",
    "habits",
    "habit_versions",
    "daily_records",
    "sessions",
    "tasks",
    "journals",
  ]) {
    const { data, error } = await b
      .from(table)
      .select("*")
      .eq("user_id", ids[0]);
    assert.ifError(error);
    assert.equal(data.length, 0, `User B read A's ${table}`);
  }
  const update = await b
    .from("tasks")
    .update({ title: "Unauthorized" })
    .eq("id", taskId)
    .select();
  assert.ifError(update.error);
  assert.equal(update.data.length, 0);
  const spoof = await b
    .from("tasks")
    .insert({ user_id: ids[0], title: "Spoof", date: "2099-01-01" });
  assert.ok(spoof.error, "Spoofed owner should be denied");
  const own = await a.from("tasks").select("*").eq("id", taskId).single();
  assert.ifError(own.error);
  assert.equal(own.data.title, "Disposable isolation smoke test");
  await a.auth.signOut();
  const again = await a.auth.signInWithPassword({
    email: env.TEST_USER_A_EMAIL,
    password: env.TEST_USER_A_PASSWORD,
  });
  assert.ifError(again.error);
  const persisted = await a.from("tasks").select("*").eq("id", taskId).single();
  assert.ifError(persisted.error);
  assert.equal(persisted.data.id, taskId);
  console.log(
    "PASS: live authentication, sign-out/re-sign-in persistence, ownership reads, writes and spoof prevention.",
  );
} finally {
  if (taskId) await clients[0].from("tasks").delete().eq("id", taskId);
  for (const c of clients) await c.auth.signOut();
}
