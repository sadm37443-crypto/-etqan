CREATE TABLE IF NOT EXISTS quiz_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  exam_type VARCHAR(80) NOT NULL,
  skill VARCHAR(120) NOT NULL,
  prompt TEXT NOT NULL,
  options_json JSON NOT NULL,
  correct_index TINYINT UNSIGNED NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_question_bank (exam_type, difficulty, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  exam_type VARCHAR(80) NOT NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 5,
  answered_count INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  current_difficulty TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_quiz_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_session_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  selected_index TINYINT UNSIGNED NULL,
  is_correct TINYINT(1) NULL,
  answered_at TIMESTAMP NULL,
  CONSTRAINT fk_session_questions_session FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_questions_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_position (session_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  buyer_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'SAR',
  status VARCHAR(40) NOT NULL DEFAULT 'awaiting_payment',
  escrow_status VARCHAR(40) NOT NULL DEFAULT 'unfunded',
  buyer_note TEXT NULL,
  delivery_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_service FOREIGN KEY (service_id) REFERENCES marketplace_services(id) ON DELETE RESTRICT,
  KEY idx_orders_buyer (buyer_id, created_at),
  KEY idx_orders_status (status, escrow_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  duration_seconds INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assets_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO quiz_questions (exam_type, skill, prompt, options_json, correct_index, explanation, difficulty) VALUES
('قدرات كمي', 'المتتاليات', 'ما العدد التالي في المتتالية؟ ٢، ٤، ٨، ١٦، ؟', '["٢٤","٣٢","٣٦","٤٠"]', 1, 'كل حد يساوي ضعف الحد السابق، لذلك ١٦ × ٢ = ٣٢.', 1),
('قدرات كمي', 'المعادلات', 'إذا كان ٣س + ٢ = ١٤، فما قيمة س؟', '["٣","٤","٥","٦"]', 1, 'نطرح ٢ ثم نقسم على ٣: س = ٤.', 1),
('قدرات كمي', 'النسب', 'إذا كانت نسبة الطلاب إلى الطالبات ٢:٣ وكان المجموع ٢٥، فكم عدد الطالبات؟', '["١٠","١٢","١٥","٢٠"]', 2, 'مجموع الأجزاء ٥، قيمة الجزء ٥، وعدد الطالبات ٣ × ٥ = ١٥.', 2),
('قدرات لفظي', 'التناظر', 'كتاب : قراءة :: آلة : ؟', '["صوت","تشغيل","صناعة","لون"]', 1, 'العلاقة هي الشيء والفعل المرتبط باستخدامه.', 1),
('قدرات لفظي', 'إكمال الجمل', 'كلما زاد وضوح الهدف، ______ اتخاذ القرار.', '["تعقّد","تأخر","سهُل","اختفى"]', 2, 'وضوح الهدف يجعل اتخاذ القرار أسهل.', 2),
('تحصيلي', 'الفيزياء', 'ما الوحدة الأساسية لقياس القوة؟', '["جول","نيوتن","واط","باسكال"]', 1, 'القوة تقاس بالنيوتن في النظام الدولي.', 1),
('تحصيلي', 'الأحياء', 'أي عضية مسؤولة غالبًا عن إنتاج الطاقة في الخلية؟', '["النواة","الريبوسوم","الميتوكوندريا","الجدار الخلوي"]', 2, 'الميتوكوندريا تنتج معظم ATP في الخلية.', 2),
('تحصيلي', 'الكيمياء', 'قيمة الرقم الهيدروجيني للمحلول المتعادل عند ٢٥°م هي:', '["٠","٥","٧","١٤"]', 2, 'المحلول المتعادل له pH يساوي ٧.', 1);
