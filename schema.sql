-- ============================================================
-- 学习群社区平台 — 数据库 Schema
-- 在现有 members/accounts/questions/submissions 基础上新增社区表
-- ============================================================

-- 1. 扩展 members 表：加入社区身份字段
-- 如果 members 表已有 points 字段则跳过
ALTER TABLE members ADD COLUMN IF NOT EXISTS title text DEFAULT '萌新';
ALTER TABLE members ADD COLUMN IF NOT EXISTS intro text;          -- 自我介绍
ALTER TABLE members ADD COLUMN IF NOT EXISTS specialty text;       -- 擅长科目
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '👤'; -- emoji头像
ALTER TABLE members ADD COLUMN IF NOT EXISTS join_ritual_answer text; -- 入群仪式回答

-- 2. 贡献记录表 — 谁贡献了什么
CREATE TABLE IF NOT EXISTS contributions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS identity,
  member_id bigint REFERENCES members(id),
  type text NOT NULL DEFAULT '资料',  -- '资料' / '题解' / '活动策划' / '群史记录'
  title text NOT NULL,
  description text,
  points int DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- 3. 资料库 — 共享学习资料
CREATE TABLE IF NOT EXISTS resources (
  id bigint PRIMARY KEY GENERATED ALWAYS AS identity,
  title text NOT NULL,
  subject text NOT NULL DEFAULT '综合',  -- 数学/语文/物理/化学/生物/综合
  description text,
  url text,
  file_type text DEFAULT '链接',  -- '链接' / '文档' / '图片' / '视频'
  contributed_by bigint REFERENCES members(id),
  contributor_name text,  -- 冗余存名字，方便查询
  likes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. 题解库 — 群友撰写的题解
CREATE TABLE IF NOT EXISTS solutions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS identity,
  title text NOT NULL,
  subject text NOT NULL DEFAULT '综合',
  content text NOT NULL,  -- Markdown 格式
  author_id bigint REFERENCES members(id),
  author_name text,
  question_id bigint,  -- 可选关联 questions 表
  likes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. 群史馆 — 经典名场面、梗、截图
CREATE TABLE IF NOT EXISTS group_moments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS identity,
  title text NOT NULL,
  content text,          -- 文字描述
  image_url text,        -- 截图链接
  moment_type text DEFAULT '名场面',  -- '名场面' / '玩梗' / '经典对话' / '暴题夜'
  author_id bigint REFERENCES members(id),
  author_name text,
  created_at timestamptz DEFAULT now()
);

-- 6. 社区活动 — 定期活动 + 特别活动
CREATE TABLE IF NOT EXISTS community_events (
  id bigint PRIMARY KEY GENERATED ALWAYS AS identity,
  title text NOT NULL,
  event_type text DEFAULT '固定活动',  -- '固定活动' / '特别活动' / '答题夜'
  description text,
  event_date date NOT NULL,
  start_time text DEFAULT '20:00',
  end_time text DEFAULT '21:00',
  subject text,  -- 答题夜的科目
  status text DEFAULT '即将开始',  -- '即将开始' / '进行中' / '已结束'
  created_at timestamptz DEFAULT now()
);

-- 7. 启用 RLS（行级安全）— 允许匿名读取，仅认证用户写入
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "allow_read_contributions" ON contributions FOR SELECT USING (true);
CREATE POLICY "allow_read_resources" ON resources FOR SELECT USING (true);
CREATE POLICY "allow_read_solutions" ON solutions FOR SELECT USING (true);
CREATE POLICY "allow_read_group_moments" ON group_moments FOR SELECT USING (true);
CREATE POLICY "allow_read_community_events" ON community_events FOR SELECT USING (true);

-- 允许认证用户插入和更新（群主管理）
CREATE POLICY "allow_write_contributions" ON contributions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_write_resources" ON resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_write_solutions" ON solutions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_write_group_moments" ON group_moments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_write_community_events" ON community_events FOR ALL USING (true) WITH CHECK (true);

-- 8. 等级体系自动更新函数
CREATE OR REPLACE FUNCTION update_member_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.points >= 500 THEN
    NEW.title := '编外管理员';
  ELSIF NEW.points >= 300 THEN
    NEW.title := '元老';
  ELSIF NEW.points >= 100 THEN
    NEW.title := '常驻';
  ELSE
    NEW.title := '萌新';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_title
BEFORE INSERT OR UPDATE OF points ON members
FOR EACH ROW EXECUTE FUNCTION update_member_title();

-- 9. 插入示例活动
INSERT INTO community_events (title, event_type, description, event_date, start_time, end_time, subject, status)
VALUES
  ('暴题夜·数学', '固定活动', '每周日晚，一起攻克一道数学难题', '2026-10-11', '20:00', '21:30', '数学', '即将开始'),
  ('吐槽日', '固定活动', '每周五，吐槽一周学习中的趣事烦恼', '2026-10-10', '20:00', '21:00', NULL, '即将开始'),
  ('答题夜·语文+数学', '答题夜', '国庆答题夜', '2026-10-04', '20:00', '22:00', '语文、数学', '即将开始')
ON CONFLICT DO NOTHING;
