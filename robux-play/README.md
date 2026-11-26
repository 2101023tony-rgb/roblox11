# ROBUX PLAY — 배포용 웹앱 소스

모바일 반응형 커뮤니티/제휴 캠페인 사이트입니다. 프런트엔드는 GitHub Pages에서 호스팅하고, 회원 세션·프로필·캠페인·클릭 기록은 Supabase에 저장합니다.

## 현재 구현된 기능
- Supabase 익명 로그인(이메일·전화번호를 받지 않는 세션)
- 닉네임 및 공개 동의 저장
- 미성년자 이용을 서면 허용받고 검토 완료한 캠페인만 공개
- 제휴 캠페인 클릭 기록(클릭은 전환/매출과 다름)
- 관리자 캠페인 등록/게시/중지/삭제
- 스폰서 문의 메일 링크
- 개인정보 안내 및 이용약관 페이지

## 배포 전 반드시 해야 하는 작업

### 1) Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성.
2. Authentication → Providers → Anonymous Sign-Ins를 활성화.
3. SQL Editor에서 `supabase/schema.sql` 전체 실행.
4. Project Settings → API에서 Project URL과 anon/publishable key를 복사.
5. `config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SPONSOR_EMAIL`을 실제 값으로 교체.
6. `service_role` 키는 절대 `config.js`나 GitHub에 넣지 마세요.

### 2) 본인을 관리자 지정하기
1. 배포된 사이트를 열고 닉네임을 한 번 저장합니다(익명 계정이 생성됨).
2. 브라우저 개발자 도구 콘솔에서 다음을 실행합니다.
   ```js
   const { data } = await window.supabase.createClient(
     window.ROBUX_PLAY_CONFIG.SUPABASE_URL,
     window.ROBUX_PLAY_CONFIG.SUPABASE_ANON_KEY
   ).auth.getUser();
   console.log(data.user.id);
   ```
   더 간단하게는 사이트의 세션을 유지한 상태에서 앱 클라이언트의 auth user UUID를 확인해야 합니다. 익명 사용자는 브라우저 저장소를 지우면 세션 복구가 어려울 수 있으니 관리자 지정 전에 브라우저 데이터를 삭제하지 마세요.
3. Supabase SQL Editor에서 다음 실행(본인 UUID로 교체):
   ```sql
   insert into public.admins(user_id) values ('본인-UUID');
   ```
4. 사이트 새로고침 후 아래쪽에 관리자 관리 화면이 보이면 완료.

### 3) GitHub Pages 배포
1. GitHub에서 새 Public 또는 Private 저장소 생성(계정 설정에 따라 Pages 공개 범위 확인).
2. 이 폴더 안의 파일/폴더 전체를 저장소 루트에 업로드합니다. `index.html`은 루트에 있어야 합니다.
3. 저장소 Settings → Pages → Deploy from a branch → `main` / `/ (root)` 선택 후 Save.
4. GitHub가 발급한 Pages URL로 접속해 테스트합니다.

## 캠페인 게시 기준
- 파트너와 실제 제휴 관계/게시 권한을 먼저 확보합니다.
- 미성년자 이용 가능 여부, 광고 표시, 개인정보 처리, 경품/보상 조건을 파트너에게 서면 확인합니다.
- 이용자가 해야 할 행동과 지급 조건을 명확히 고지합니다.
- 미성년자 이용을 허용하지 않거나 조건이 불명확한 캠페인은 게시하지 않습니다.
- 링크 클릭 수는 매출이나 승인 전환 수가 아닙니다. 실제 정산은 제휴사 대시보드/계약서로 확인해야 합니다.

## 중요한 제한
- 이 소스는 실제 Supabase 연결을 전제로 합니다. `config.js`에 프로젝트 값을 넣기 전에는 회원/캠페인 기능이 작동하지 않습니다.
- 이 프로젝트는 Robux 지급·출금·현금 교환을 구현하지 않습니다. Roblox의 공식 정책 및 지급 권한을 확인하지 않은 외부 Robux 보상 약속을 하지 마세요.
- 개인정보 안내의 이메일을 실제 운영 이메일로 바꾸고, 배포 전 한국 개인정보/청소년 관련 법률 검토를 받으세요.
- 제휴사 계약이나 승인, 광고 계정 승인, 매출 발생은 코드만으로 자동 생성되지 않습니다.
