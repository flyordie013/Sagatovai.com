/** Local-only integration checks. Run AFTER qa-release.ts, with MAX_MATERIAL_MB=200. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, readFile, readdir } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  if (process.env.OQU_RELEASE_QA !== "local") throw new Error("Set OQU_RELEASE_QA=local; never run against production.");
  const origin = "http://localhost:3100";
  const sql = postgres("postgres://oqu:local-qa-only@127.0.0.1:55432/oqu", { max: 4 });
  const fixture = JSON.parse(await readFile("output/qa-fixture.json", "utf8"));
  let checks = 0;
  const equal = (actual: unknown, expected: unknown, message: string) => { assert.deepEqual(actual, expected, message); checks++; };
  const request = (url: string, token = fixture.admin, method = "GET", body?: BodyInit, headers: Record<string, string> = {}) =>
    fetch(origin + url, { method, body, redirect: "manual", headers: { Cookie: token, Origin: origin, Connection: "close", ...headers }, duplex: "half" } as RequestInit);
  async function digest(response: Response) {
    const hash = createHash("sha256"); let bytes = 0;
    for await (const chunk of response.body! as unknown as AsyncIterable<Uint8Array>) { hash.update(chunk); bytes += chunk.length; }
    return { hash: hash.digest("hex"), bytes };
  }
  const endpoint = `/api/admin/lessons/${fixture.lessonId}/materials`;
  const bigId = randomUUID();
  try {
    equal((await (await request(endpoint)).json()).maxBytes, 200 * 1024 ** 2, "200 MB effective limit");
    const chunk = Buffer.alloc(1024 ** 2, "a");
    const expected = createHash("sha256"); for (let i = 0; i < 200; i++) expected.update(chunk);
    let sent = 0;
    const body = new ReadableStream({ pull(controller) { if (sent++ < 200) controller.enqueue(chunk); else controller.close(); } });
    equal((await request(endpoint, fixture.admin, "POST", body, { "X-Upload-Id": bigId, "X-File-Name": "200-mb.txt" })).status, 200, "actual 200 MB streamed upload");
    const download = `/api/materials/${bigId}`;
    const full = await request(download, fixture.student);
    equal(full.status, 200, "large download status");
    const actual = await digest(full);
    equal(actual, { hash: expected.digest("hex"), bytes: 200 * 1024 ** 2 }, "full 200 MB integrity");
    const combined = createHash("sha256"); let resumedBytes = 0;
    for (const range of ["bytes=0-104857599", "bytes=104857600-"]) {
      const response = await request(download, fixture.student, "GET", undefined, { Range: range, "If-Range": full.headers.get("etag")! });
      equal(response.status, 206, "resume large download");
      for await (const part of response.body! as unknown as AsyncIterable<Uint8Array>) { combined.update(part); resumedBytes += part.length; }
    }
    equal(combined.digest("hex"), actual.hash, "resumed 200 MB integrity");
    equal(resumedBytes, actual.bytes, "resumed byte count");
    let overflowSent = 0;
    const overflow = new ReadableStream({ pull(controller) { if (overflowSent++ < 201) controller.enqueue(chunk); else controller.close(); } });
    const before = (await readdir("storage/materials")).sort();
    equal((await request(endpoint, fixture.admin, "POST", overflow, { "X-Upload-Id": randomUUID(), "X-File-Name": "too-big.txt" })).status, 400, "201 MB rejected without Content-Length");
    equal((await readdir("storage/materials")).sort(), before, "oversized partial cleaned");

    const sample = await readFile("output/playwright/qa-video.mp4");
    const videoEndpoint = `/api/admin/lessons/${fixture.nextLessonId}/video`;
    equal((await request(videoEndpoint, "", "POST", "", { "Content-Type": "video/mp4" })).status, 401, "anonymous video upload");
    equal((await request(videoEndpoint, fixture.student, "POST", "", { "Content-Type": "video/mp4" })).status, 403, "student video upload");
    equal((await request(videoEndpoint, fixture.admin, "POST", "", { "Content-Type": "video/mp4", Origin: "https://evil.invalid" })).status, 403, "cross-origin video upload");
    equal((await request(videoEndpoint.replace("/video", "x/video"), fixture.admin, "POST", "", { "Content-Type": "video/mp4" })).status, 400, "strict video lesson id");
    const beforeVideos = new Set(await readdir("storage/videos"));
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => request(videoEndpoint, fixture.admin, "POST", sample, { "Content-Type": "video/mp4", "X-Video-Duration": "60" })));
    equal(concurrent.map(r => r.status), [200,200,200,200,200], "concurrent video replacement");
    const [stored] = await sql`SELECT video_key FROM lessons WHERE id=${fixture.nextLessonId}`;
    equal((await readdir("storage/videos")).filter(k => !beforeVideos.has(k)), [stored.video_key], "only winning video remains");
    const video = `/api/lessons/${fixture.nextLessonId}/video`;
    equal((await request(video, "")).status, 401, "anonymous video streaming");
    const head = await request(video, fixture.student, "HEAD");
    equal(head.headers.get("content-length"), String(sample.length), "video HEAD full length");
    equal((await request(video, fixture.student, "GET", undefined, { Range: "bytes=-" })).status, 416, "empty video range rejected");
    const piece = await request(video, fixture.student, "GET", undefined, { Range: "bytes=4-40" });
    equal(piece.status, 206, "video partial response"); equal(Buffer.from(await piece.arrayBuffer()), sample.subarray(4,41), "video seek bytes");
    equal((await request(video, fixture.student, "GET", undefined, { "If-None-Match": head.headers.get("etag")! })).status, 304, "authorized video cache");
    await sql`UPDATE enrollments SET access_type='locked' WHERE user_id=${fixture.studentId}`;
    equal((await request(video, fixture.student, "GET", undefined, { "If-None-Match": head.headers.get("etag")! })).status, 403, "cached video denied after revocation");
    await sql`UPDATE enrollments SET access_type='full' WHERE user_id=${fixture.studentId}`;
    equal((await request(videoEndpoint, fixture.admin, "DELETE")).status, 200, "video deletion");
    equal((await readdir("storage/videos")).filter(k => !beforeVideos.has(k)), [], "video deletion cleans storage");
    const [temporary] = await sql`INSERT INTO lessons (module_id,title) SELECT module_id,'QA deleted upload' FROM lessons WHERE id=${fixture.lessonId} RETURNING id`;
    const diskBefore = (await readdir("storage/videos")).sort();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let chunkIndex = 0;
    const slow = new ReadableStream({ async pull(controller) {
      if (chunkIndex++ === 0) controller.enqueue(sample.subarray(0, 1024));
      else { await gate; controller.enqueue(sample.subarray(1024)); controller.close(); }
    } });
    const pendingUpload = request(`/api/admin/lessons/${temporary.id}/video`, fixture.admin, "POST", slow, { "Content-Type": "video/mp4" });
    try {
      let appeared = false;
      for (let i=0; i<100; i++) {
        if ((await readdir("storage/videos")).some(k=>!diskBefore.includes(k))) { appeared=true; break; }
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      equal(appeared, true, "slow video started writing");
      await sql`DELETE FROM lessons WHERE id=${temporary.id}`;
    } finally { release(); }
    equal((await pendingUpload).status, 409, "lesson deleted during upload rejected");
    equal((await readdir("storage/videos")).sort(), diskBefore, "deleted lesson upload cleaned");
    await copyFile("output/playwright/qa-video.mp4", "storage/videos/qa-ux-video.mp4");
    await sql`UPDATE lessons SET video_key='qa-ux-video.mp4',video_mime_type='video/mp4',video_duration_sec=60 WHERE id=${fixture.lessonId}`;
    console.log(`PASS: ${checks} media checks, including real 200 MB upload/full download/resume and concurrent replacements`);
  } finally {
    await request(endpoint, fixture.admin, "DELETE", JSON.stringify({ id: bigId }), { "Content-Type": "application/json" });
    await sql.end();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
