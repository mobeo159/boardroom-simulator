-- =========================================================
-- BOARDROOM CLASSROOM
-- CASE: KOKUYO – THIÊN LONG
-- MÔN: KỸ NĂNG QUẢN LÝ VÀ LÃNH ĐẠO
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- 1. BẢNG PHÒNG HỌC
-- =========================================================

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),

  room_code text not null unique,

  course_name text not null,

  case_title text not null,

  decision_question text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now()
);


-- =========================================================
-- 2. BẢNG NỘI DUNG CASE
-- =========================================================

create table if not exists public.case_sections (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.class_sessions(id)
    on delete cascade,

  section_key text not null,

  title text not null,

  content jsonb not null default '{}'::jsonb,

  sort_order integer not null default 0,

  unique(session_id, section_key)
);


-- =========================================================
-- 3. BẢNG TIÊU CHÍ ĐÁNH GIÁ
-- =========================================================

create table if not exists public.decision_criteria (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.class_sessions(id)
    on delete cascade,

  type text not null
    check (
      type in (
        'rational',
        'intuitive'
      )
    ),

  title text not null,

  description text not null,

  weight numeric not null default 1,

  sort_order integer not null default 0
);


-- =========================================================
-- 4. BẢNG PHẢN HỒI VÀ BỎ PHIẾU
-- =========================================================

create table if not exists public.class_responses (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.class_sessions(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  display_name text not null
    check (
      char_length(display_name)
      between 1 and 100
    ),

  scores jsonb not null default '{}'::jsonb,

  rational_reason text,

  intuitive_reason text,

  final_vote text not null
    check (
      final_vote in (
        'approve',
        'conditional',
        'reject',
        'abstain'
      )
    ),

  overall_comment text,

  submitted_at timestamptz
    not null default now(),

  unique(session_id, user_id)
);


-- =========================================================
-- 5. INDEX TĂNG TỐC TRUY VẤN
-- =========================================================

create index if not exists
  case_sections_session_idx
on public.case_sections(session_id);


create index if not exists
  decision_criteria_session_idx
on public.decision_criteria(session_id);


create index if not exists
  class_responses_session_idx
on public.class_responses(session_id);


create index if not exists
  class_responses_user_idx
on public.class_responses(user_id);


-- =========================================================
-- 6. BẬT ROW LEVEL SECURITY
-- =========================================================

alter table public.class_sessions
enable row level security;


alter table public.case_sections
enable row level security;


alter table public.decision_criteria
enable row level security;


alter table public.class_responses
enable row level security;


-- =========================================================
-- 7. POLICY ĐỌC PHÒNG HỌC
-- =========================================================

drop policy if exists
  "Read active class sessions"
on public.class_sessions;


create policy
  "Read active class sessions"
on public.class_sessions
for select
to authenticated
using (
  is_active = true
);


-- =========================================================
-- 8. POLICY ĐỌC DỮ LIỆU CASE
-- =========================================================

drop policy if exists
  "Read case sections"
on public.case_sections;


create policy
  "Read case sections"
on public.case_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions session_row
    where session_row.id = case_sections.session_id
      and session_row.is_active = true
  )
);


-- =========================================================
-- 9. POLICY ĐỌC TIÊU CHÍ
-- =========================================================

drop policy if exists
  "Read decision criteria"
on public.decision_criteria;


create policy
  "Read decision criteria"
on public.decision_criteria
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions session_row
    where session_row.id = decision_criteria.session_id
      and session_row.is_active = true
  )
);


-- =========================================================
-- 10. POLICY ĐỌC DASHBOARD
-- CẢ LỚP CÓ THỂ ĐỌC PHẢN HỒI
-- =========================================================

drop policy if exists
  "Class reads responses"
on public.class_responses;


create policy
  "Class reads responses"
on public.class_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions session_row
    where session_row.id = class_responses.session_id
      and session_row.is_active = true
  )
);


-- =========================================================
-- 11. POLICY GỬI PHIẾU
-- MỖI NGƯỜI CHỈ GỬI PHIẾU CHO CHÍNH MÌNH
-- =========================================================

drop policy if exists
  "Student inserts own response"
on public.class_responses;


create policy
  "Student inserts own response"
on public.class_responses
for insert
to authenticated
with check (
  auth.uid() = user_id

  and exists (
    select 1
    from public.class_sessions session_row
    where session_row.id = class_responses.session_id
      and session_row.is_active = true
  )
);


-- =========================================================
-- 12. POLICY SỬA PHIẾU
-- CHỈ ĐƯỢC SỬA PHIẾU CỦA CHÍNH MÌNH
-- =========================================================

drop policy if exists
  "Student updates own response"
on public.class_responses;


create policy
  "Student updates own response"
on public.class_responses
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id

  and exists (
    select 1
    from public.class_sessions session_row
    where session_row.id = class_responses.session_id
      and session_row.is_active = true
  )
);


-- =========================================================
-- 13. CẤP QUYỀN CHO NGƯỜI DÙNG ĐÃ XÁC THỰC
-- NGƯỜI DÙNG ẨN DANH CŨNG THUỘC ROLE authenticated
-- =========================================================

grant select
on public.class_sessions
to authenticated;


grant select
on public.case_sections
to authenticated;


grant select
on public.decision_criteria
to authenticated;


grant select, insert, update
on public.class_responses
to authenticated;


-- =========================================================
-- 14. BẬT REALTIME CHO DASHBOARD
-- =========================================================

do $$
begin
  alter publication supabase_realtime
  add table public.class_responses;

exception
  when duplicate_object then
    null;
end $$;


-- =========================================================
-- 15. TẠO PHÒNG HỌC KOKUYO2026
-- =========================================================

insert into public.class_sessions (
  room_code,
  course_name,
  case_title,
  decision_question,
  is_active
)
values (
  'KOKUYO2026',

  'Kỹ năng quản lý và lãnh đạo',

  'Kokuyo – Thiên Long',

  'Hội đồng quản trị Kokuyo có nên phê duyệt giao dịch đầu tư/M&A với Thiên Long hay không?',

  true
)
on conflict (room_code)
do update set
  course_name = excluded.course_name,

  case_title = excluded.case_title,

  decision_question =
    excluded.decision_question,

  is_active = excluded.is_active;


-- =========================================================
-- 16. TẠO DỮ LIỆU CASE VÀ TIÊU CHÍ
-- =========================================================

do $$
declare
  v_session_id uuid;

begin

  select id
  into v_session_id
  from public.class_sessions
  where room_code = 'KOKUYO2026';


  -- Xóa phiếu cũ để tránh điểm cũ tham chiếu
  -- tới các ID tiêu chí đã được tạo trước đó.

  delete from public.class_responses
  where session_id = v_session_id;


  -- Xóa dữ liệu case cũ.

  delete from public.case_sections
  where session_id = v_session_id;


  -- Xóa tiêu chí cũ.

  delete from public.decision_criteria
  where session_id = v_session_id;


  -- =======================================================
  -- 16.1. NỘI DUNG CASE
  -- CHỈ CÒN 7 PHẦN
  -- =======================================================

  insert into public.case_sections (
    session_id,
    section_key,
    title,
    content,
    sort_order
  )
  values

  -- -------------------------------------------------------
  -- 01. TỔNG QUAN
  -- -------------------------------------------------------

  (
    v_session_id,

    'overview',

    'Tổng quan tình huống',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Kokuyo đang xem xét đầu tư vào Thiên Long nhằm tăng tốc mở rộng tại Việt Nam và ASEAN.',

        'Bài toán lãnh đạo không chỉ là mức giá có hợp lý hay không mà còn là hai doanh nghiệp có thể phối hợp, tích hợp và tạo giá trị chung hay không.',

        'Người tham gia cần kết hợp phân tích lý trí với trực giác lãnh đạo trước khi đưa ra quyết định cuối cùng.'
      ),

      'highlights',

      jsonb_build_array(
        jsonb_build_object(
          'label',
          'Doanh thu năm 2025',

          'value',
          '4.174 tỷ đồng'
        ),

        jsonb_build_object(
          'label',
          'Tăng trưởng doanh thu',

          'value',
          '11,1%'
        ),

        jsonb_build_object(
          'label',
          'Thị trường xuất khẩu',

          'value',
          'Khoảng 70'
        ),

        jsonb_build_object(
          'label',
          'ROE năm 2025',

          'value',
          '18,3%'
        ),

        jsonb_build_object(
          'label',
          'Biên lợi nhuận gộp',

          'value',
          '49,6%'
        ),

        jsonb_build_object(
          'label',
          'Doanh thu xuất khẩu',

          'value',
          '1.185 tỷ đồng'
        )
      )
    ),

    1
  ),


  -- -------------------------------------------------------
  -- 02. MỤC TIÊU CHIẾN LƯỢC
  -- -------------------------------------------------------

  (
    v_session_id,

    'strategy',

    'Mục tiêu chiến lược',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Kokuyo muốn mở rộng nhanh tại Việt Nam và ASEAN thay vì tự xây dựng toàn bộ năng lực từ đầu.',

        'Thiên Long có thương hiệu mạnh tại thị trường địa phương, năng lực sản xuất, R&D, hệ thống phân phối và kinh nghiệm xuất khẩu.',

        'Việc đầu tư có thể giúp Kokuyo rút ngắn thời gian tiếp cận thị trường nhưng cũng làm tăng yêu cầu kiểm soát tích hợp.'
      ),

      'items',

      jsonb_build_array(
        'Tăng tốc hiện diện của Kokuyo tại Việt Nam và ASEAN.',

        'Kết hợp năng lực quản trị quốc tế với hiểu biết thị trường địa phương.',

        'Tận dụng thương hiệu và hệ thống phân phối sẵn có của Thiên Long.',

        'Khai thác năng lực sản xuất, R&D và chuỗi cung ứng.',

        'Mở rộng cơ hội hợp tác sản phẩm và xuất khẩu.'
      )
    ),

    2
  ),


  -- -------------------------------------------------------
  -- 03. TÀI CHÍNH VÀ ĐỊNH GIÁ
  -- -------------------------------------------------------

  (
    v_session_id,

    'financial',

    'Tài chính và định giá',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Giao dịch có mức premium đáng kể so với giá cổ phiếu trước khi thông tin được công bố.',

        'Hội đồng quản trị cần đánh giá liệu cộng hưởng trong tương lai có đủ bù phần giá trả thêm và chi phí tích hợp hay không.',

        'Nếu đặt mục tiêu thu hồi premium trong khoảng 5 năm, giao dịch cần tạo thêm mức lợi nhuận đáng kể mỗi năm trước khi tính đến chi phí tích hợp và các rủi ro khác.'
      ),

      'highlights',

      jsonb_build_array(
        jsonb_build_object(
          'label',
          'Tổng chi phí dự kiến',

          'value',
          'Khoảng 27,6 tỷ yên'
        ),

        jsonb_build_object(
          'label',
          'Giá trị quy đổi',

          'value',
          'Khoảng 4.600 tỷ đồng'
        ),

        jsonb_build_object(
          'label',
          'Giá mua hàm ý',

          'value',
          '80.633–82.000 đồng/cp'
        ),

        jsonb_build_object(
          'label',
          'Giá trước công bố',

          'value',
          '64.200 đồng/cp'
        ),

        jsonb_build_object(
          'label',
          'Premium dự kiến',

          'value',
          '25,6–27,7%'
        ),

        jsonb_build_object(
          'label',
          'P/E hàm ý',

          'value',
          '20,2–20,5 lần'
        ),

        jsonb_build_object(
          'label',
          'Premium tuyệt đối',

          'value',
          'Khoảng 940–1.020 tỷ đồng'
        ),

        jsonb_build_object(
          'label',
          'Lợi nhuận cần thêm mỗi năm',

          'value',
          'Khoảng 188–204 tỷ đồng'
        )
      )
    ),

    3
  ),


  -- -------------------------------------------------------
  -- 04. CON NGƯỜI VÀ VĂN HÓA
  -- -------------------------------------------------------

  (
    v_session_id,

    'people',

    'Con người và văn hóa',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Kokuyo có xu hướng tiêu chuẩn hóa, kỷ luật và quản trị theo quy trình.',

        'Thiên Long có phong cách linh hoạt, tốc độ nhanh và hiểu sâu thị trường địa phương.',

        'Sự khác biệt này có thể tạo ra bổ sung tích cực, nhưng cũng có thể gây xung đột nếu quá trình tích hợp được thực hiện quá cứng nhắc.',

        'Mối quan hệ OEM giữa hai bên trước giao dịch giúp giảm bất cân xứng thông tin và tạo nền tảng hợp tác ban đầu.'
      ),

      'items',

      jsonb_build_array(
        'Khác biệt về tốc độ và quy trình ra quyết định.',

        'Nguy cơ phụ thuộc vào người sáng lập và một số lãnh đạo chủ chốt.',

        'Cần giữ đội ngũ quản lý trung gian, R&D, bán hàng và vận hành.',

        'Nguy cơ mất động lực nếu áp dụng tiêu chuẩn hóa quá nhanh.',

        'Cần duy trì những thế mạnh địa phương của Thiên Long.',

        'Cần thiết kế cơ chế phối hợp giữa quản trị quốc tế và tính linh hoạt địa phương.'
      )
    ),

    4
  ),


  -- -------------------------------------------------------
  -- 05. RỦI RO TRỌNG YẾU
  -- -------------------------------------------------------

  (
    v_session_id,

    'risks',

    'Rủi ro trọng yếu',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Hội đồng quản trị cần đánh giá đồng thời rủi ro tài chính, pháp lý, vận hành, con người và văn hóa.',

        'Một giao dịch phù hợp chiến lược vẫn có thể thất bại nếu mức giá quá cao hoặc quá trình tích hợp không được kiểm soát.'
      ),

      'items',

      jsonb_build_array(
        'Định giá cao và cộng hưởng không đạt kỳ vọng.',

        'Chi phí tích hợp vượt kế hoạch.',

        'Biến động tỷ giá làm tăng chi phí thực tế.',

        'Mất nhà phân phối hoặc đối tác quan trọng.',

        'Mất nhân sự chủ chốt sau giao dịch.',

        'Xung đột văn hóa và phong cách quản trị.',

        'Rủi ro pháp lý, tài chính hoặc vận hành chưa được phát hiện.',

        'Tiêu chuẩn hóa quá mức làm giảm tính linh hoạt của Thiên Long.',

        'Khó duy trì hiệu quả kinh doanh trong giai đoạn chuyển đổi.'
      )
    ),

    5
  ),


  -- -------------------------------------------------------
  -- 06. CÁC PHƯƠNG ÁN THAY THẾ
  -- -------------------------------------------------------

  (
    v_session_id,

    'alternatives',

    'Các phương án thay thế',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Mua lại và nắm quyền kiểm soát không phải là phương án duy nhất.',

        'Hội đồng cần so sánh chi phí, tốc độ, quyền kiểm soát và mức độ rủi ro của từng phương án.'
      ),

      'items',

      jsonb_build_array(
        'Tự đầu tư và xây dựng năng lực mới tại Việt Nam.',

        'Tiếp tục hợp tác thương mại hoặc OEM sâu hơn.',

        'Thành lập liên doanh giữa Kokuyo và Thiên Long.',

        'Mua lại cổ phần và nắm quyền kiểm soát.',

        'Đầu tư từng giai đoạn thay vì mua ngay tỷ lệ kiểm soát.',

        'Hoãn giao dịch để tiếp tục thẩm định và đàm phán giá.'
      )
    ),

    6
  ),


  -- -------------------------------------------------------
  -- 07. TIẾN TRÌNH GIAO DỊCH
  -- KHÔNG CÒN PHẦN KHUYẾN NGHỊ
  -- -------------------------------------------------------

  (
    v_session_id,

    'timeline',

    'Tiến trình giao dịch',

    jsonb_build_object(
      'paragraphs',

      jsonb_build_array(
        'Các mốc sau tháng 7 năm 2026 là kế hoạch dự kiến và chưa phải kết quả đã hoàn tất.',

        'Người tham gia cần phân biệt rõ giữa sự kiện đã công bố và các mốc sở hữu dự kiến trong tương lai.'
      ),

      'items',

      jsonb_build_array(
        '04/12/2025: Kokuyo công bố kế hoạch và ký thỏa thuận chuyển nhượng cổ phần từ TLAT.',

        'Sau công bố: các bên thực hiện thủ tục pháp lý và quy trình chào mua công khai.',

        'Tháng 08/2026: dự kiến Kokuyo sở hữu gián tiếp 46,82% Thiên Long.',

        'Tháng 10–11/2026: dự kiến thực hiện chào mua công khai tối đa 18,19%.',

        'Tháng 11/2026: dự kiến tổng tỷ lệ sở hữu đạt 65,01%.',

        'Nếu hoàn tất theo kế hoạch, Thiên Long dự kiến trở thành công ty con của Kokuyo.'
      )
    ),

    7
  );


  -- =======================================================
  -- 16.2. TIÊU CHÍ ĐÁNH GIÁ
  -- 4 TIÊU CHÍ LÝ TRÍ + 4 TIÊU CHÍ TRỰC GIÁC
  -- =======================================================

  insert into public.decision_criteria (
    id,
    session_id,
    type,
    title,
    description,
    weight,
    sort_order
  )
  values

  -- -------------------------------------------------------
  -- NHÓM LÝ TRÍ
  -- -------------------------------------------------------

  (
    '10000000-0000-0000-0000-000000000001',

    v_session_id,

    'rational',

    'Phù hợp chiến lược',

    'Giao dịch có hỗ trợ rõ ràng cho mục tiêu mở rộng của Kokuyo tại Việt Nam và ASEAN không?',

    15,

    1
  ),

  (
    '10000000-0000-0000-0000-000000000002',

    v_session_id,

    'rational',

    'Khả thi kinh doanh',

    'Thương hiệu, phân phối, sản xuất, R&D và hoạt động xuất khẩu có thể được duy trì và phát triển sau giao dịch không?',

    15,

    2
  ),

  (
    '10000000-0000-0000-0000-000000000003',

    v_session_id,

    'rational',

    'Hợp lý của định giá',

    'Mức giá mua và premium có hợp lý so với lợi nhuận, rủi ro và giá trị cơ sở của Thiên Long không?',

    20,

    3
  ),

  (
    '10000000-0000-0000-0000-000000000004',

    v_session_id,

    'rational',

    'Hiện thực hóa cộng hưởng',

    'Cộng hưởng dự kiến có đủ bù phần giá trả thêm và chi phí tích hợp hay không?',

    15,

    4
  ),


  -- -------------------------------------------------------
  -- NHÓM TRỰC GIÁC
  -- -------------------------------------------------------

  (
    '20000000-0000-0000-0000-000000000001',

    v_session_id,

    'intuitive',

    'Tương thích văn hóa',

    'Dựa trên cảm nhận của bạn, hai tổ chức có thể phối hợp mà không làm mất thế mạnh riêng của nhau không?',

    10,

    5
  ),

  (
    '20000000-0000-0000-0000-000000000002',

    v_session_id,

    'intuitive',

    'Niềm tin vào đội ngũ lãnh đạo',

    'Bạn có tin đội ngũ lãnh đạo hai bên có thể dẫn dắt quá trình chuyển đổi và xử lý xung đột không?',

    10,

    6
  ),

  (
    '20000000-0000-0000-0000-000000000003',

    v_session_id,

    'intuitive',

    'Khả năng tích hợp',

    'Trực giác của bạn về khả năng tích hợp con người, hệ thống, thương hiệu và hoạt động kinh doanh là gì?',

    10,

    7
  ),

  (
    '20000000-0000-0000-0000-000000000004',

    v_session_id,

    'intuitive',

    'Kiểm soát rủi ro',

    'Bạn có cảm thấy các rủi ro trọng yếu có thể được kiểm soát ở mức chấp nhận được không?',

    5,

    8
  );

end $$;