/**
 * Isolated release regression: run local Postgres on 55432 and Next on 3100.
 * Refuses remote targets; fixtures never touch production.
 * Next: AUTH_SECRET=qa-local-secret-only MAX_MATERIAL_MB=1 SMTP_HOST=''
 * Run: OQU_RELEASE_QA=local pnpm exec tsx scripts/qa-release.ts
 * Leaves local fixtures for browser QA; the next run replaces them.
 */
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { hashPassword } from "../src/lib/password-hash";
import { cleanFilename, validMaterialSignature } from "../src/lib/material-policy";

async function main() {
  assert.equal(process.env.OQU_RELEASE_QA, "local", "Explicit local QA flag required");
  const origin = "http://localhost:3100";
  const sql = postgres("postgres://oqu:local-qa-only@127.0.0.1:55432/oqu", { max: 2 });
  let checks = 0;
  const expect = (actual: unknown, expected: unknown, message: string) => { assert.deepEqual(actual, expected, message); checks++; };
  const cookie = (id: string, role = "student", sv = 0) => {
    const body = Buffer.from(JSON.stringify({ userId: id, role, sv, exp: Date.now() + 86400000 })).toString("base64url");
    return "oqu_session=" + body + "." + createHmac("sha256", "qa-local-secret-only").update(body).digest("base64url");
  };
  const request = (url: string, token = "", method = "GET", body?: BodyInit, headers: Record<string, string> = {}) =>
    fetch(origin + url, { method, body, redirect: "manual", headers: { Cookie: token, Origin: origin, ...headers } });
  const json = (url: string, token: string, method: string, data: object) => request(url, token, method, JSON.stringify(data), { "Content-Type": "application/json" });
  try {
    expect((await fetch(origin + "/api/health")).status, 200, "local health");
    const old = await sql`SELECT lm.storage_key FROM lesson_materials lm JOIN lessons l ON l.id=lm.lesson_id JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE c.slug LIKE 'qa-ux-%'`;
    for (const f of old) await unlink(path.join("storage", "materials", f.storage_key)).catch(() => {});
    await sql`DELETE FROM courses WHERE slug LIKE 'qa-ux-%'`;
    await sql`DELETE FROM profiles WHERE email LIKE 'qa-ux-%@example.test'`;
    const hash = await hashPassword("QaRelease2026test");
    const [admin] = await sql`INSERT INTO profiles (full_name,email,role,password_hash) VALUES ('Администратор QA','qa-ux-admin@example.test','admin',${hash}) RETURNING id`;
    const [student] = await sql`INSERT INTO profiles (full_name,email,password_hash) VALUES ('Ученик QA','qa-ux-student@example.test',${hash}) RETURNING id`;
    const [other] = await sql`INSERT INTO profiles (full_name,email,password_hash) VALUES ('Другой ученик','qa-ux-other@example.test',${hash}) RETURNING id`;
    const [course] = await sql`INSERT INTO courses (slug,title,description,weeks,price,is_published,outcomes,audience,requirements,included,access_terms)
      VALUES ('qa-ux-practical-ai','AI для рабочих задач','Разберите повседневные задачи: от подготовки текста до автоматизации повторяющихся действий.',4,49000,true,'Подготовите структуру рабочего текста\nСоберёте прототип помощника','Специалистам, которые хотят разобраться в AI','Компьютер и доступ к интернету','Видеоуроки и рабочие материалы','Условия для локальной проверки интерфейса') RETURNING id`;
    const [second] = await sql`INSERT INTO courses (slug,title,description,is_published) VALUES ('qa-ux-agents','AI-агенты: от идеи к сценарию','Разберитесь в инструментах и спроектируйте рабочий сценарий.',true) RETURNING id`;
    const [module] = await sql`INSERT INTO modules (course_id,title) VALUES (${course.id},'Основы и первые задачи') RETURNING id`;
    const [lesson] = await sql`INSERT INTO lessons (module_id,title,description,content,video_duration_sec) VALUES (${module.id},'Как поставить задачу AI','Разберём понятный запрос и проверку результата.','Откройте рабочий лист под видео и запишите задачу, которую хотите решить.',60) RETURNING id`;
    const [next] = await sql`INSERT INTO lessons (module_id,title,order_index) VALUES (${module.id},'Практика: от запроса к результату',1) RETURNING id`;
    await sql`INSERT INTO enrollments (user_id,course_id,access_type) VALUES (${student.id},${course.id},'full'),(${other.id},${second.id},'full')`;
    const a = cookie(admin.id, "admin"), u = cookie(student.id), o = cookie(other.id);
    const endpoint = `/api/admin/lessons/${lesson.id}/materials`;
    expect((await request(endpoint)).status, 401, "anonymous upload listing denied");
    expect((await request(endpoint, u)).status, 403, "student admin access denied");
    const limits = await (await request(endpoint, a)).json();
    expect(limits.maxBytes, 1048576, "test max upload limit");
    const id = randomUUID();
    const bytes = Buffer.from("%PDF-1.7\nQA release fixture\n%%EOF");
    const upload = (uploadId: string, name: string, data: Uint8Array | string, token = a, url = endpoint) =>
      request(url, token, "POST", data as BodyInit, { "Content-Type": "application/octet-stream", "X-Upload-Id": uploadId, "X-File-Name": encodeURIComponent(name) });
    expect((await upload(id, "Рабочий лист.pdf", bytes, u)).status, 403, "student upload denied");
    expect((await upload(id, "Рабочий лист.pdf", bytes)).status, 200, "admin upload");
    expect((await upload(id, "Рабочий лист.pdf", bytes)).status, 200, "lost response retry is idempotent");
    let files = (await (await request(endpoint, a)).json()).materials;
    expect(files.length, 1, "retry creates only one row");
    expect("storageKey" in files[0], false, "storage key not exposed");
    const dl = `/api/materials/${id}`;
    expect((await request(dl)).status, 401, "anonymous download denied");
    expect((await request(dl, o)).status, 403, "another course download denied");
    const response = await request(dl, u);
    expect(response.status, 200, "enrolled download allowed");
    expect(Buffer.from(await response.arrayBuffer()), bytes, "download byte integrity");
    expect(response.headers.get("content-disposition")?.includes("filename*=UTF-8"), true, "unicode download name");
    expect(response.headers.get("cache-control"), "private, no-store", "downloads not cached");
    expect((await request(dl, u, "HEAD")).status, 200, "download preflight");
    const etag = response.headers.get("etag")!;
    for (const [range, expected] of [["bytes=0-4", bytes.subarray(0,5)], ["bytes=5-", bytes.subarray(5)], ["bytes=-5", bytes.subarray(-5)]] as const) {
      const part = await request(dl, u, "GET", undefined, { Range: range, "If-Range": etag });
      expect(part.status, 206, "partial download " + range);
      expect(Buffer.from(await part.arrayBuffer()), expected, "partial bytes " + range);
    }
    for (const range of ["bytes=-", "bytes=-0", "bytes=9999-", "bytes=5-2", "bytes=0-1,4-5"]) {
      expect((await request(dl, u, "GET", undefined, { Range: range })).status, 416, "invalid range " + range);
    }
    const stale = await request(dl, u, "GET", undefined, { Range: "bytes=2-", "If-Range": '"stale"' });
    expect(stale.status, 200, "stale If-Range starts over");
    expect(Buffer.from(await stale.arrayBuffer()), bytes, "stale If-Range full integrity");
    expect((await request(dl, u, "HEAD", undefined, { Range: "bytes=2-3" })).headers.get("content-length"), String(bytes.length), "HEAD ignores Range");
    await sql`UPDATE enrollments SET access_type='locked' WHERE user_id=${student.id}`;
    expect((await request(dl, u)).status, 403, "revoked course access enforced immediately");
    expect((await request(dl, u, "GET", undefined, { Range: "bytes=2-", "If-Range": etag })).status, 403, "revoked course cannot resume downloads");
    await sql`UPDATE enrollments SET access_type='full' WHERE user_id=${student.id}`;
    await sql`UPDATE profiles SET session_version=1 WHERE id=${student.id}`;
    expect((await request(dl, u)).status, 401, "revoked session denied");
    await sql`UPDATE profiles SET session_version=0 WHERE id=${student.id}`;
    expect((await upload(randomUUID(), "script.html", "<script>bad</script>")).status, 400, "active format rejected");
    expect((await upload(randomUUID(), "fake.pdf", "not a pdf")).status, 400, "false file signature rejected");
    expect((await upload(randomUUID(), "empty.txt", "")).status, 400, "empty file rejected");
    expect((await upload(randomUUID(), "large.txt", "a".repeat(1048577))).status, 400, "oversized file rejected");
    const chunked = await fetch(origin + endpoint, { method: "POST", headers: { Cookie: a, Origin: origin, "X-Upload-Id": randomUUID(), "X-File-Name": "chunked.txt" },
      body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("a".repeat(1048577))); controller.close(); } }), duplex: "half" } as RequestInit);
    expect(chunked.status, 400, "actual streaming limit without Content-Length");
    await sql`UPDATE profiles SET role='student' WHERE id=${admin.id}`;
    expect((await request(endpoint, a)).status, 403, "demoted admin denied despite old token");
    await sql`UPDATE profiles SET role='admin' WHERE id=${admin.id}`;
    const beforeLimit = (await readdir("storage/materials")).sort();
    const placeholders = await sql`INSERT INTO lesson_materials (lesson_id,title,filename,storage_key,mime_type,size_bytes)
      SELECT ${lesson.id}, 'QA limit', 'limit.txt', gen_random_uuid()::text || '.txt', 'text/plain', 1 FROM generate_series(1,29) RETURNING id`;
    expect((await upload(randomUUID(), "over-limit.txt", "limit")).status, 409, "attachment count enforced in transaction");
    await sql`DELETE FROM lesson_materials WHERE id IN ${sql(placeholders.map(p => p.id))}`;
    expect((await readdir("storage/materials")).sort(), beforeLimit, "failed transaction cleans uploaded file");
    expect((await request(endpoint, a, "POST", bytes, { Origin: "https://evil.invalid", "X-Upload-Id": randomUUID(), "X-File-Name": "test.pdf" })).status, 403, "cross origin write denied");
    expect((await request(endpoint, a, "PATCH", JSON.stringify({id,title:"x"}), {Origin:"", "Content-Type":"application/json"})).status, 403, "missing origin write denied");
    expect((await json(endpoint, a, "PATCH", { id, title: "Рабочий лист к уроку" })).status, 200, "rename");
    expect((await json(`/api/admin/lessons/${next.id}/materials`, a, "DELETE", { id })).status, 404, "delete scoped to the correct lesson");
    const textId = randomUUID();
    expect((await upload(textId, "Памятка.txt", "Текст памятки")).status, 200, "second file");
    expect((await json(endpoint, a, "PATCH", { id: textId, direction: "up" })).status, 200, "reorder");
    files = (await (await request(endpoint, a)).json()).materials;
    expect(files[0].id, textId, "order persisted");
    const [oldFile] = await sql`SELECT storage_key FROM lesson_materials WHERE id=${id}`;
    const replacementId = randomUUID();
    expect((await upload(replacementId, "Обновлённый лист.pdf", bytes, a, endpoint + "?replace=" + id)).status, 200, "replace");
    expect((await request(dl, u)).status, 404, "old download removed");
    expect(await readFile(path.join("storage/materials", oldFile.storage_key)).then(() => true).catch(() => false), false, "old file removed from disk");
    expect((await json(endpoint, a, "DELETE", { id: textId })).status, 200, "delete");
    expect((await request("/api/materials/" + textId, u)).status, 404, "deleted material unavailable");
    const progressUrl = `/api/lessons/${lesson.id}/progress`, now = Date.now();
    expect((await json(progressUrl, o, "POST", { position: 12, pct: 10, capturedAt: now })).status, 403, "unowned progress denied");
    expect((await json(progressUrl, u, "POST", { position: 41, pct: 30, capturedAt: now })).status, 200, "progress accepted");
    expect((await json(progressUrl, u, "POST", { position: 5, pct: 20, capturedAt: now - 1000 })).status, 200, "late beacon accepted safely");
    const [progress] = await sql`SELECT last_position_sec,watched_pct,completed FROM lesson_progress WHERE user_id=${student.id} AND lesson_id=${lesson.id}`;
    expect(progress, { last_position_sec: 41, watched_pct: 30, completed: false }, "position differs from watch percent and stale write ignored");
    expect((await json(progressUrl, u, "POST", { position: -1, pct: 10, capturedAt: now })).status, 400, "invalid position denied");
    expect((await json(progressUrl, u, "POST", { position: null, pct: 10, capturedAt: now })).status, 400, "invalid numeric type denied");
    expect((await request(`/lesson/${next.id}`, u)).status, 200, "next lesson available without mandatory watching");
    expect(cleanFilename("../Рабочий\nлист.pdf").includes("/"), false, "filename traversal sanitized");
    expect(validMaterialSignature("png", new Uint8Array([1,2,3])), false, "bad image signature");
    await mkdir("output/playwright", { recursive: true });
    await writeFile("output/qa-fixture.json", JSON.stringify({ admin: a, student: u, other: o, courseId: course.id, lessonId: lesson.id, nextLessonId: next.id, materialId: replacementId, studentId: student.id }, null, 2));
    console.log(`PASS: ${checks} release checks; local browser fixture in output/qa-fixture.json`);
  } finally { await sql.end(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
