ALTER TABLE quiz_questions MODIFY correct_index TINYINT UNSIGNED NULL;
ALTER TABLE quiz_questions ADD COLUMN question_type VARCHAR(20) NOT NULL DEFAULT 'mcq';
ALTER TABLE quiz_questions ADD COLUMN model_answer TEXT NULL;
ALTER TABLE quiz_questions ADD COLUMN rubric_json JSON NULL;

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
  interval_name VARCHAR(30) NOT NULL DEFAULT 'month',
  features_json JSON NOT NULL,
  provider_price_id VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'mock',
  provider_customer_id VARCHAR(255) NULL,
  provider_subscription_id VARCHAR(255) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'incomplete',
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT,
  KEY idx_subscriptions_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NULL,
  provider VARCHAR(40) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'subscription',
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_external (provider, external_id),
  CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  KEY idx_payment_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entitlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  entitlement_key VARCHAR(120) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_entitlement_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_entitlement (user_id, entitlement_key, source_type, source_id),
  KEY idx_entitlement_lookup (user_id, entitlement_key, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_event (provider, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refund_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refund_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refund_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO plans (code, title, description, amount, currency, interval_name, features_json) VALUES
('student-egypt-monthly', 'باقة الطالب التجريبية', 'وصول شهري كامل لمسار الثانوية العامة في بيئة MVP مصرية.', 100.00, 'EGP', 'month', '["الوصول إلى مسار الثانوية العامة التجريبي","بنك أسئلة ٢٤ سؤالًا","مساعد إتقان مع حدود استخدام تجريبية","ملفات PDF وفيديوهات Demo"]');

INSERT IGNORE INTO quiz_questions (exam_type, skill, prompt, options_json, correct_index, explanation, difficulty, question_type, model_answer, rubric_json) VALUES
('ثانوية عامة — رياضيات', 'المعادلات', 'إذا كان ٢س + ٤ = ١٦، فما قيمة س؟', '["٤","٦","٨","١٠"]', 1, 'نطرح ٤ ثم نقسم على ٢: س = ٦.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'النسب', 'إذا كانت النسبة ٢:٣ وكان مجموع الجزأين ٢٥، فما قيمة الجزء الأكبر؟', '["١٠","١٢","١٥","٢٠"]', 2, 'مجموع الأجزاء ٥، وقيمة الجزء ٥، والجزء الأكبر ١٥.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المتتاليات', 'ما الحد التالي: ٣، ٦، ١٢، ٢٤، ؟', '["٣٦","٤٢","٤٨","٥٤"]', 2, 'يتضاعف كل حد، إذن ٢٤ × ٢ = ٤٨.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الدوال', 'إذا كانت د(س)=س²، فما قيمة د(٣)؟', '["٣","٦","٩","١٢"]', 1, 'نعوض بس = ٣ فنحصل على ٩.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الهندسة', 'مجموع زوايا المثلث يساوي:', '["٩٠°","١٨٠°","٢٧٠°","٣٦٠°"]', 1, 'مجموع زوايا أي مثلث يساوي ١٨٠ درجة.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الاحتمال', 'عند رمي قطعة نقود عادلة مرة واحدة، احتمال ظهور الصورة هو:', '["٠","١/٤","١/٢","١"]', 2, 'للقطع العادلة نتيجتان متساويتان في الاحتمال.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'التفاضل', 'مشتقة س³ هي:', '["س²","٢س","٣س²","٣س"]', 2, 'قاعدة القوة: نضرب في الأس ثم نطرح واحدًا من الأس.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'التكامل', 'تكامل ٢س بالنسبة إلى س هو:', '["س² + ثابت","٢س² + ثابت","س + ثابت","٢ + ثابت"]', 0, 'تكامل ٢س يساوي س² زائد ثابت التكامل.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المتجهات', 'إذا كان المتجه أ=(٣،٤)، فما طوله؟', '["٣","٤","٥","٧"]', 2, 'الطول = جذر(٣² + ٤²) = ٥.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المصفوفات', 'محدد المصفوفة [[١،٢],[٣،٤]] يساوي:', '["-٢","٢","٤","١٠"]', 0, 'المحدد = ١×٤ - ٢×٣ = -٢.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المعادلات', 'حل المعادلة س² = ٢٥ هو:', '["٥ فقط","-٥ فقط","±٥","٢٥"]', 2, 'الجذران هما ٥ و-٥.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الهندسة', 'مساحة دائرة نصف قطرها نق تساوي:', '["πنق","٢πنق","πنق²","نق²/π"]', 2, 'قانون المساحة هو π × نق².', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الإحصاء', 'الوسيط للقيم ٢، ٤، ٧، ٩، ١١ هو:', '["٤","٧","٩","١١"]', 1, 'القيمة الوسطى بعد الترتيب هي ٧.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المتوسط', 'متوسط ٦ و١٠ و١٤ يساوي:', '["٨","١٠","١٢","١٤"]', 1, 'مجموع القيم ٣٠ مقسومًا على ٣ يساوي ١٠.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المتباينات', 'حل المتباينة س + ٣ > ٧ هو:', '["س > ٤","س < ٤","س > ١٠","س < ١٠"]', 0, 'نطرح ٣ من الطرفين فنحصل على س > ٤.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'اللوغاريتمات', 'قيمة لو(١٠٠) للأساس ١٠ هي:', '["٠","١","٢","١٠"]', 2, 'لأن ١٠² = ١٠٠.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المتتاليات', 'في المتتالية الحسابية ٥، ٨، ١١، ما الفرق المشترك؟', '["٢","٣","٤","٥"]', 1, 'الفرق بين كل حد والذي يليه هو ٣.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الاحتمال', 'إذا كان في صندوق ٣ كرات حمراء و٢ زرقاء، احتمال سحب حمراء هو:', '["٢/٥","٣/٥","١/٢","٣/٢"]', 1, 'عدد الحمراء ٣ من إجمالي ٥.', 2, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'الهندسة التحليلية', 'ميل المستقيم ص=٢س+١ يساوي:', '["١","٢","-٢","٣"]', 1, 'معامل س هو الميل، ويساوي ٢.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'المثلثات', 'قيمة جا(٩٠°) هي:', '["٠","١/٢","√٢/٢","١"]', 3, 'جيب الزاوية القائمة يساوي ١.', 1, 'mcq', NULL, NULL),
('ثانوية عامة — رياضيات', 'تفكير كتابي', 'اشرح بخطواتك كيف تحل معادلة خطية من الصورة أ س + ب = ج.', '[]', NULL, 'يُراجع المدرس وجود عزل للحد الثابت ثم القسمة على معامل س.', 1, 'essay', 'اطرح ب من الطرفين ثم اقسم الطرفين على أ، مع التحقق من أن أ لا تساوي صفرًا.', '{"requiredConcepts":["طرح الحد الثابت","القسمة على معامل س","التحقق"]}'),
('ثانوية عامة — رياضيات', 'تفكير كتابي', 'اكتب تفسيرًا قصيرًا للفرق بين المتوسط والوسيط ومتى تفضل استخدام كل منهما.', '[]', NULL, 'يُراجع المدرس تعريف كل مقياس وملاءمته للقيم المتطرفة.', 2, 'essay', 'المتوسط يتأثر بالقيم المتطرفة، والوسيط أكثر مقاومة لها؛ نختار وفق توزيع البيانات.', '{"requiredConcepts":["تعريف المتوسط","تعريف الوسيط","القيم المتطرفة"]}'),
('ثانوية عامة — رياضيات', 'تفكير كتابي', 'حل المسألة: إذا كان محيط مستطيل ٣٠ سم وطوله ٩ سم، فما عرضه؟ اشرح.', '[]', NULL, 'يُراجع المدرس استخدام 2(الطول+العرض)=المحيط.', 2, 'essay', 'العرض = ٦ سم لأن ٢(٩+العرض)=٣٠.', '{"requiredConcepts":["قانون المحيط","إعادة ترتيب المعادلة","٦ سم"]}'),
('ثانوية عامة — رياضيات', 'تفكير كتابي', 'اكتب استراتيجية تحقق منطقية بعد حل مسألة جبرية.', '[]', NULL, 'يُراجع المدرس التعويض والتحقق من الوحدات أو النتيجة.', 1, 'essay', 'أعوّض بالحل في المعادلة الأصلية وأراجع الإشارة والوحدات ومدى معقولية الناتج.', '{"requiredConcepts":["التعويض","الإشارة","المعقولية"]}');

INSERT IGNORE INTO content_assets (lesson_id, kind, title, storage_path, duration_seconds)
SELECT id, 'video', 'فيديو تجريبي — مدخل إلى المعادلات', '/demo/itqan-lesson.mp4', 32 FROM lessons WHERE title = 'تحدي اليوم';
INSERT IGNORE INTO content_assets (lesson_id, kind, title, storage_path, duration_seconds)
SELECT id, 'pdf', 'ملزمة تجريبية — أساسيات الجبر', '/demo/itqan-sample.pdf', NULL FROM lessons WHERE title = 'تحدي اليوم';
