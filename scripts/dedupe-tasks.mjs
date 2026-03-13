/**
 * 하루 1건씩(제조·영업·마케팅) 정리 - 중복 제거
 * 실행: node scripts/dedupe-tasks.mjs
 */
import Database from "better-sqlite3";

const db = new Database("tasks.db");

const rows = db.prepare(`
  SELECT id FROM tasks WHERE id NOT IN (
    SELECT MIN(id) FROM tasks GROUP BY scheduled_date, category
  )
`).all();

const toDelete = rows.map(r => r.id);
if (toDelete.length === 0) {
  console.log("중복 없음. 정리 완료.");
  db.close();
  process.exit(0);
}

const del = db.prepare("DELETE FROM tasks WHERE id = ?");
for (const id of toDelete) {
  del.run(id);
}

console.log(`${toDelete.length}건 중복 제거 완료 (하루 제조1·영업1·마케팅1)`);
db.close();
