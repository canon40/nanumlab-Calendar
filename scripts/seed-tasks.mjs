/**
 * 올바른 UTF-8 한글로 일정 재등록
 * 실행: node scripts/seed-tasks.mjs
 * 주의: 기존 일정(완료 포함)을 모두 삭제합니다. --force 없이 실행 시 확인을 요청합니다.
 */
import Database from "better-sqlite3";
import { existsSync, copyFileSync } from "fs";

const force = process.argv.includes("--force");
const db = new Database("tasks.db");

const count = db.prepare("SELECT COUNT(*) as n FROM tasks").get().n;
if (count > 0 && !force) {
  console.error("⚠️  기존 일정이", count, "건 있습니다. 모두 삭제 후 새로 등록됩니다.");
  console.error("   완료 처리·수정 내용이 사라집니다. 진행하려면 --force 옵션을 붙여 실행하세요.");
  console.error("   예: node scripts/seed-tasks.mjs --force");
  db.close();
  process.exit(1);
}

// 백업 (기존 데이터가 있을 때)
if (count > 0 && existsSync("tasks.db")) {
  const backup = `tasks.db.backup.${Date.now()}`;
  copyFileSync("tasks.db", backup);
  console.log("백업 생성:", backup);
}

// 기존 일정 삭제
db.prepare("DELETE FROM tasks").run();
console.log("기존 일정 삭제 완료");

const tasks = [
  // 제조 (Part 1, 10-12시) - "제품의 심장"
  { title: "코팅제 레시피 만들기: 신규 배합비 확정", category: "Part 1", scheduled_date: "2026-03-12" },
  { title: "유리막코팅제 안정화: PERMACOAT-CAR/BIKE 품질 테스트", category: "Part 1", scheduled_date: "2026-03-12" },
  { title: "테스트 시트 작성: 사진 포함 결과 보고서 자동 양식 연결", category: "Part 1", scheduled_date: "2026-03-12" },
  // 영업 (Part 2, 13-16시) - "수익의 엔진"
  { title: "협업 쇼핑몰 찾기: 입점 가능한 채널 리스트업", category: "Part 2", scheduled_date: "2026-03-12" },
  { title: "영업리스트 정리: 기존 및 신규 DB 통합", category: "Part 2", scheduled_date: "2026-03-12" },
  { title: "영업계획서 작성: DM 및 카탈로그 디자인 검토", category: "Part 2", scheduled_date: "2026-03-12" },
  { title: "견적서 공부: 표준 단가표 및 제안서 양식 확립", category: "Part 2", scheduled_date: "2026-03-12" },
  // 마케팅/글로벌 (Part 3, 16-18시) - "확장의 날개"
  { title: "알리바바 내용 정리: 글로벌 상세페이지 최적화", category: "Part 3", scheduled_date: "2026-03-12" },
  { title: "영어 사용설명서: 수출용 매뉴얼 번역 및 검수", category: "Part 3", scheduled_date: "2026-03-12" },
  { title: "블로그 글쓰기: 일일 성과 및 제품 홍보 포스팅", category: "Part 3", scheduled_date: "2026-03-12" },
  { title: "KITA 수출바우처: 지원 사업 서류 준비", category: "Part 3", scheduled_date: "2026-03-12" },
  // 행정/기획 (우선순위 배치) → Part 1에 배치
  { title: "공장등록 알아보기: 행정 절차 및 필요 서류 체크", category: "Part 1", scheduled_date: "2026-03-12" },
  { title: "건식코팅제 기획: 신제품 컨셉 및 성능 기획", category: "Part 1", scheduled_date: "2026-03-12" },
];

const insert = db.prepare(
  "INSERT INTO tasks (title, category, scheduled_date) VALUES (?, ?, ?)"
);

for (const t of tasks) {
  insert.run(t.title, t.category, t.scheduled_date);
}

console.log(`${tasks.length}건 일정 등록 완료`);
db.close();
