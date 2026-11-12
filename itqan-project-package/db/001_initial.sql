CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  open_id VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NULL,
  avatar_url VARCHAR(500) NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'student',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  track VARCHAR(80) NOT NULL,
  system_name VARCHAR(80) NOT NULL,
  stage VARCHAR(80) NOT NULL,
  subject VARCHAR(80) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  lessons_count INT UNSIGNED NOT NULL DEFAULT 0,
  level VARCHAR(80) NOT NULL DEFAULT 'متوسط',
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 10,
  position INT UNSIGNED NOT NULL DEFAULT 1,
  content TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_lessons_position (course_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_lesson_id BIGINT UNSIGNED NULL,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_enrollments_user_course (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  watched_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY uq_progress_user_lesson (user_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  exam_type VARCHAR(80) NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  total_questions INT UNSIGNED NOT NULL,
  answers_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketplace_services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NULL,
  category VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
  rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  context_label VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO courses (slug, title, track, system_name, stage, subject, content_type, description, lessons_count, level) VALUES
('math-lab', 'مختبر الرياضيات', 'التعليم العام', 'عام', 'ابتدائي', 'رياضيات', 'درس', 'مفاهيم بصرية وتمارين تجعل الأرقام أقرب إلى الحياة.', 24, 'تأسيسي'),
('arabic-specialized', 'العربية التخصصية', 'التعليم الأزهري', 'أزهري', 'ثانوي', 'العربية', 'درس', 'نحو وصرف وبلاغة عبر خرائط ذهنية ومسارات قصيرة.', 18, 'متوسط'),
('science-alive', 'علوم تنبض', 'التعليم العام', 'عام', 'إعدادي', 'علوم', 'تمرين', 'شروحات معملية وتقييمات فورية ترسم فهمك بدقة.', 36, 'متوسط'),
('learn-how-to-learn', 'التعلّم كيف تتعلم', 'مهارات', 'عام', 'جامعي', 'مهارات', 'درس', 'أدوات عملية لبناء عادة، لا جدول مزدحم جديد.', 7, 'كل المستويات'),
('matn-mastery', 'حفظ المتون', 'التعليم الأزهري', 'أزهري', 'ثانوي', 'علوم شرعية', 'مراجعة', 'مسارات تفاعلية للتسميع مع ملاحظات النطق والمخارج.', 12, 'متقدم'),
('question-bank', 'بنك الأسئلة', 'القدرات والتحصيلي', 'عام', 'ثانوي', 'قدرات كمي', 'تمرين', 'نمط امتحان حقيقي مع تحليل نقاط الضعف لكل وحدة.', 48, 'متوسط'),
('deep-session', 'جلسة عميقة', 'مهارات', 'عام', 'جامعي', 'تركيز', 'مراجعة', 'طقوس صغيرة تساعدك على البدء والاستمرار دون تشتيت.', 10, 'كل المستويات'),
('recitation-review', 'مراجعة التلاوة', 'التعليم الأزهري', 'أزهري', 'كل المراحل', 'قرآن كريم', 'مراجعة', 'تقدم متدرج في الحفظ والمراجعة بصوتك أنت.', 30, 'كل المستويات');

INSERT IGNORE INTO lessons (course_id, title, duration_minutes, position, content)
SELECT id, 'مدخل إلى المسار', 12, 1, 'درس تمهيدي يشرح الهدف والخطوات الأولى.' FROM courses WHERE slug = 'math-lab';
INSERT IGNORE INTO lessons (course_id, title, duration_minutes, position, content)
SELECT id, 'خريطة المفاهيم الأساسية', 18, 2, 'بناء الفهم عبر أمثلة قصيرة وتطبيقات.' FROM courses WHERE slug = 'math-lab';
INSERT IGNORE INTO lessons (course_id, title, duration_minutes, position, content)
SELECT id, 'الوحدة الأولى', 15, 1, 'المدخل التفاعلي للمادة.' FROM courses WHERE slug = 'arabic-specialized';
INSERT IGNORE INTO lessons (course_id, title, duration_minutes, position, content)
SELECT id, 'تحدي اليوم', 10, 1, 'سؤال تدريبي مع شرح بعد المحاولة.' FROM courses WHERE slug = 'question-bank';
INSERT IGNORE INTO lessons (course_id, title, duration_minutes, position, content)
SELECT id, 'جلسة المراجعة', 14, 1, 'مراجعة قصيرة قابلة للتكرار.' FROM courses WHERE slug = 'recitation-review';

INSERT IGNORE INTO marketplace_services (category, title, description, price, currency, rating, review_count) VALUES
('research', 'مراجعة خطة بحث وتنسيق مراجع', 'خريطة واضحة قبل أن تبدأ الكتابة وتغرق في التفاصيل.', 120, 'SAR', 4.90, 18),
('learning', 'حصة خصوصية في القدرات الكمي', 'جلسة 1:1 مع استراتيجية حل تناسب وقتك ومستواك.', 80, 'SAR', 5.00, 24),
('creative', 'ترجمة وتلخيص أكاديمي عربي / English', 'نص مفهوم، منسق، ويحافظ على صوتك الأصلي.', 65, 'SAR', 4.80, 31),
('research', 'تحليل بيانات SPSS لمشروع تخرج', 'قراءة النتائج وتحويلها إلى فصل يمكن مناقشته بثقة.', 180, 'SAR', 4.90, 11),
('learning', 'مراجعة نحو وصرف أزهري', 'من القاعدة إلى المثال، بدون حفظ منفصل عن السياق.', 95, 'SAR', 4.90, 9),
('creative', 'عرض تقديمي يحكي فكرتك', 'بنية مختصرة وتصميم هادئ يخدم محتوى البحث.', 75, 'SAR', 4.70, 16);
