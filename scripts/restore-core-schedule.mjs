/**
 * 핵심 스케줄 복구
 * 실행: node scripts/restore-core-schedule.mjs [--replace]
 * - 3/16~3/20 주중에 핵심 업무 등록
 * - --replace: 해당 주 기존 일정 삭제 후 재등록
 */
import Database from "better-sqlite3";

const replace = process.argv.includes("--replace");
const db = new Database("tasks.db");

const weekDates = ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20"];

// (제목, 카테고리, scheduled_date) - 3/16~3/20 주중 배치
const tasks = [
  { title: "코팅제 레시피 만들기: 신규 배합비 확정", category: "Part 1", scheduled_date: "2026-03-16" },
  { title: "협업 쇼핑몰 찾기: 입점 가능한 채널 리스트업", category: "Part 2", scheduled_date: "2026-03-16" },
  { title: "알리바바 내용 정리: 글로벌 상세페이지 최적화", category: "Part 3", scheduled_date: "2026-03-16" },
  { title: "유리막코팅제 안정화: PERMACOAT-CAR/BIKE 품질 테스트", category: "Part 1", scheduled_date: "2026-03-17" },
  { title: "영업리스트 정리: 기존 및 신규 DB 통합", category: "Part 2", scheduled_date: "2026-03-17" },
  { title: "영어 사용설명서: 수출용 매뉴얼 번역 및 검수", category: "Part 3", scheduled_date: "2026-03-17" },
  { title: "테스트 시트 작성: 사진 포함 결과 보고서 자동 양식 연결", category: "Part 1", scheduled_date: "2026-03-18" },
  { title: "영업계획서 작성: DM 및 카탈로그 디자인 검토", category: "Part 2", scheduled_date: "2026-03-18" },
  { title: "블로그 글쓰기: 일일 성과 및 제품 홍보 포스팅", category: "Part 3", scheduled_date: "2026-03-18" },
  { title: "공장등록 알아보기: 행정 절차 및 필요 서류 체크", category: "Part 1", scheduled_date: "2026-03-19" },
  { title: "견적서 공부: 표준 단가표 및 제안서 양식 확립", category: "Part 2", scheduled_date: "2026-03-19" },
  { title: "KITA 수출바우처: 지원 사업 서류 준비", category: "Part 3", scheduled_date: "2026-03-19" },
  { title: "건식코팅제 기획: 신제품 컨셉 및 성능 기획", category: "Part 1", scheduled_date: "2026-03-20" },
];

if (replace) {
  const del = db.prepare("DELETE FROM tasks WHERE scheduled_date = ?");
  for (const d of weekDates) del.run(d);
  console.log("해당 주(3/16~3/20) 기존 일정 삭제 완료");
}

const check = db.prepare("SELECT id FROM tasks WHERE scheduled_date = ? AND category = ? LIMIT 1");
const insert = db.prepare(
  "INSERT INTO tasks (title, category, scheduled_date) VALUES (?, ?, ?)"
);

let added = 0;
let skipped = 0;

for (const t of tasks) {
  if (check.get(t.scheduled_date, t.category)) {
    console.warn("건너뜀 (해당 날짜에 이미 동일 카테고리 있음):", t.title);
    skipped++;
    continue;
  }
  insert.run(t.title, t.category, t.scheduled_date);
  added++;
}

console.log(`${added}건 핵심 스케줄 등록 완료 (${skipped}건 건너뜀)`);
db.close();
