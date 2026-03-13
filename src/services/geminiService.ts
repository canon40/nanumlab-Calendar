import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Task {
  id: number;
  title: string;
  category: string;
  status: string;
  deadline?: string;
  scheduled_date?: string;
  notes?: string;
  impact: number;
  urgency: number;
  effort: number;
  is_locked: number;
  parent_id?: number | null;
  priority_score?: number;
  doc_url?: string | null;
  google_event_id?: string | null;
}

export const geminiService = {
  async generateReport(tasks: Task[], period: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' = 'Weekly') {
    const prompt = `
      대상 기간: ${period}
      현재 업무 데이터: ${JSON.stringify(tasks, null, 2)}
      목표: 연 매출 10억 달성 (NanumLab OS v2.0)

      [공통 톤앤매너]
      - 전문적이고 분석적이며, 영민 님을 독려하는 리더십 있는 어조.
      - 한국어로 작성하세요.

      [A. 주간 보고서(금요일용) 형식 – period가 Weekly일 때 반드시 포함]
      1. 요약
         - 이번 주에 실제로 완료된 핵심 업무 요약 (제조/영업/마케팅 관점에서 3~5줄).

      2. 업무별 상세 테이블 (제조 / 영업 / 마케팅 순서)
         각 업무마다 아래 항목을 빠짐없이 적습니다.
         - 업무명
         - 상태: 완료 / 진행 / 대기(연기)
         - 완료된 경우: "어떤 작업으로 완료했는지"를 2~3줄로 구체적으로 서술
         - 진행 중인 경우:
             · 현재 어디까지 진행됐는지 (진행률, 완료된 세부 단계)
             · 앞으로 남은 단계 2~3개
             · 예상 완료일 (YYYY-MM-DD 형식)
         - 대기(연기)인 경우:
             · 왜 대기/연기 상태인지 "구체적인 이유"
             · 이 업무를 다시 꺼내서 진행할 기준(조건) 1~2개
             · 새로 잡은 목표 완료일 (YYYY-MM-DD 형식)

      3. 수익 관점 정리
         - 이번 주에 매출 / 잠재 매출에 직접 영향을 준 활동들을 목록으로 정리.
         - "다음 주에 반드시 연결해야 할 후속 행동"을 3개 bullet로 제시.

      [B. 주간 계획서(일요일용) 형식 – period가 Weekly일 때 두 번째 섹션으로 포함]
      4. 다음 주 핵심 목표 3개
         - 제조 / 영업 / 마케팅 각각에서 "이번 주에 꼭 달성하고 싶은 결과"를 한 문장씩.

      5. 해야 할 일(TO-DO) 계획
         - 다음 주에 새로 해야 할 일 목록:
             · 업무명 / 예상 소요시간 / 배정 요일 / P 점수(중요+긴급) 코멘트
         - 이번 주 보고서 기준으로 "진행 중"과 "연기된" 업무에 대해:
             · 언제까지 끝낼지(YYYY-MM-DD) 다시 약속
             · 어떤 순서로 처리할지(우선순위 번호)를 함께 적습니다.

      6. 리스크 및 주의사항
         - 다음 주에 일정이 밀릴 수 있는 위험 요소 2~3개
         - 이를 줄이기 위한 예방 행동 2~3개

      [C. 개인 리플렉션 (간단하지만 중요)]
      7. 이번 주 나의 집중도/에너지 점수
         - 1~5점 중 하나를 선택하여, "이번 주 전체를 돌아봤을 때 몇 점인지"와 한 줄 이유를 적습니다.

      8. 다음 주 한 줄 다짐
         - "다음 주에는 ______ 만은 꼭 지키겠다." 형식으로 한 줄 다짐을 적습니다.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  },

  async smartIntegrateTask(taskDescription: string, existingTasks: Task[]) {
    const prompt = `
      당신은 나눔랩의 운영 총괄 비서입니다. 사용자가 업무 하나를 말하면, 그 업무가 완결되기 위해 필요한 전/후 단계 업무(Task Expansion)를 포함하여 스케줄을 짜야 합니다.

      새로운 업무 설명: "${taskDescription}"
      현재 업무 리스트: ${JSON.stringify(existingTasks)}

      나눔랩 AI 비서의 행동 강령:
      1. P(우선순위): (수익기여도(Impact) * 3) + (긴급도(Urgency) * 2) 를 계산하여 배치한다.
      2. Q(고정): 잠금된 일정은 건드리지 않음.
      3. T(연관 업무 탐색): 업무가 완결되기 위해 필요한 전후 단계(준비물, 서류, 마케팅) 3가지를 자동으로 생성한다.
         [지능형 연결 로직 (가~하, A~C 기반)]
         - 쇼핑몰/채널: ["(가) 협업 가능 쇼핑몰 찾기", "(바) 블로그 글쓰기", "(라) 영업계획서 작성"]
         - 공장/행정: ["(나) 공장등록 알아보기", "(하) KITA 수출바우처 자료 준비", "행정 서류 리스트업"]
         - 영업/리스트: ["(다) 영업리스트 정리", "(라) 영업계획서 작성", "(카) 견적서 만드는 방법 공부"]
         - 알리바바/수출: ["(마) 알리바바 내용정리", "(차) 영문 사용설명서 만들기", "(A) 수출관련 매뉴얼 만들기"]
         - 레시피/제조: ["(사) 코팅제 레시피만들기", "(자) 유리막코팅제 안정화", "(파) 테스트 시트 작성"]
         - 기획/매뉴얼: ["(아) 건식코팅제 기획서 작성", "(C) 기획서 작성 방법 연구", "(B) 사용 매뉴얼 만들기"]
      4. U(기한): 모든 업무에 마감 기한 설정.

      시간 배분(Time Blocking) 규칙:
      - 제조(Part 1): 오전 10-12시
      - 영업(Part 2): 오후 13-16시
      - 마케팅/정리(Part 3): 오후 16-18시

      결과를 메인 업무와 3개의 연관 업무가 포함된 배열로 반환하세요.
      JSON 형식:
      {
        "main_task": {
          "title": "메인 업무명",
          "category": "Part 1/2/3",
          "impact": 5,
          "urgency": 4,
          "effort": 60,
          "priority_score": 23,
          "deadline": "YYYY-MM-DD",
          "scheduled_date": "YYYY-MM-DD",
          "notes": "분석 근거"
        },
        "sub_tasks": [
          { "title": "연관 업무 1", "category": "Part 1/2/3", "impact": 3, "urgency": 3, "effort": 20, "priority_score": 15, "deadline": "YYYY-MM-DD", "scheduled_date": "YYYY-MM-DD" },
          { "title": "연관 업무 2", "category": "Part 1/2/3", "impact": 3, "urgency": 3, "effort": 20, "priority_score": 15, "deadline": "YYYY-MM-DD", "scheduled_date": "YYYY-MM-DD" },
          { "title": "연관 업무 3", "category": "Part 1/2/3", "impact": 3, "urgency": 3, "effort": 20, "priority_score": 15, "deadline": "YYYY-MM-DD", "scheduled_date": "YYYY-MM-DD" }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            main_task: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                impact: { type: Type.INTEGER },
                urgency: { type: Type.INTEGER },
                effort: { type: Type.INTEGER },
                priority_score: { type: Type.NUMBER },
                deadline: { type: Type.STRING },
                scheduled_date: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: ["title", "category", "impact", "urgency", "effort", "priority_score", "deadline", "scheduled_date"]
            },
            sub_tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  impact: { type: Type.INTEGER },
                  urgency: { type: Type.INTEGER },
                  effort: { type: Type.INTEGER },
                  priority_score: { type: Type.NUMBER },
                  deadline: { type: Type.STRING },
                  scheduled_date: { type: Type.STRING }
                },
                required: ["title", "category", "impact", "urgency", "effort", "priority_score", "deadline", "scheduled_date"]
              }
            }
          },
          required: ["main_task", "sub_tasks"]
        }
      }
    });

    return JSON.parse(response.text);
  },

  async suggestSchedule(tasks: Task[]) {
    const prompt = `
      현재 업무 리스트: ${JSON.stringify(tasks)}

      나눔랩의 '개구리를 먼저 먹어라(Eat the Frog)' 전략과 수익 기반 우선순위 로직을 적용하여 업무를 재배치해주세요.
      
      로직:
      1. 우선순위 점수 = (Impact * 3) + (Urgency * 2)
      2. 오전 (Part 1, 10-12시): 가장 점수가 높고 수익 기여도가 큰 일(Frog) 배치.
      3. 오후 (Part 2, 13-16시): 영업 및 기계적인 업무 배치.
      4. 늦은 오후 (Part 3, 16-18시): 마케팅 및 정리.
      5. 중요: is_locked가 1인 업무는 절대 변경하지 마세요.

      각 업무의 id와 새로운 category, scheduled_date, 그리고 계산된 priority_score를 결정해주세요.
      
      JSON 형식으로 응답해주세요:
      [{ "id": 1, "category": "Part 1", "scheduled_date": "YYYY-MM-DD", "priority_score": 25 }]
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              category: { type: Type.STRING },
              scheduled_date: { type: Type.STRING },
              priority_score: { type: Type.NUMBER }
            },
            required: ["id", "category", "scheduled_date", "priority_score"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  }
};
