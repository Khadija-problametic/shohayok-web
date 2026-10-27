-- Shohayok ডাটাবেস: নতুন করে শুরু। phpMyAdmin > Import অথবা SQL ট্যাবে চালান।
-- ডেমো ডেটা: ১১ জন ব্যবহারকারী, ১১টি কাজ (সম্পন্ন, চলমান, খালি, বাতিল), NID যাচাইয়ের অপেক্ষায় ২ জন সহায়ক।
-- সব ডেমো একাউন্টের পাসওয়ার্ড: Demo@1234   (আসল সাইটে তোলার আগে ডেমো ডেটা মুছে দিন)
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS shohayok_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shohayok_v2;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS guardian_links;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS helper_profiles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('elderly','guardian','helper','admin') NOT NULL DEFAULT 'elderly',
  area VARCHAR(100) NOT NULL,
  address TEXT NULL,
  is_phone_verified TINYINT(1) NOT NULL DEFAULT 0,
  remember_token VARCHAR(100) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_area (area)
) ENGINE=InnoDB;

CREATE TABLE helper_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  nid_number VARCHAR(30) NOT NULL UNIQUE,
  nid_front_path VARCHAR(255) NOT NULL,
  nid_back_path VARCHAR(255) NOT NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  total_rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  total_tasks_completed INT UNSIGNED NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (verification_status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id BIGINT UNSIGNED NOT NULL,
  helper_id BIGINT UNSIGNED NULL,
  category ENUM('pharmacy','grocery','hospital','other') NOT NULL,
  description TEXT NOT NULL,
  pickup_address VARCHAR(300) NOT NULL,
  delivery_address VARCHAR(300) NOT NULL,
  area VARCHAR(100) NOT NULL,
  base_fee DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  item_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (base_fee + tip_amount + item_cost) STORED,
  handshake_pin CHAR(4) NOT NULL,
  pin_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','accepted','on_the_way','arrived','completed','cancelled') NOT NULL DEFAULT 'pending',
  payment_method ENUM('bkash','cash') NOT NULL DEFAULT 'cash',
  payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  bkash_trx_id VARCHAR(100) NULL,
  cancel_reason VARCHAR(255) NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feed (status, area),
  INDEX idx_requester (requester_id),
  INDEX idx_helper (helper_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (helper_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE guardian_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guardian_id BIGINT UNSIGNED NOT NULL,
  elderly_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','approved') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_link (guardian_id, elderly_id),
  FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (elderly_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  reviewee_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(500) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (task_id, reviewer_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (reviewee_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ===== ডেমো ডেটা =====
INSERT INTO users (id, name, phone, password, role, area, is_phone_verified, created_at) VALUES
(1,'অ্যাডমিন','01700000001','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','admin','ধানমন্ডি',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 39 DAY), INTERVAL 0 MINUTE)),
(2,'আব্দুর রহিম','01711000001','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','elderly','ধানমন্ডি',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 38 DAY), INTERVAL 0 MINUTE)),
(3,'সালমা বেগম','01711000002','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','elderly','মিরপুর',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 37 DAY), INTERVAL 0 MINUTE)),
(4,'রফিকুল ইসলাম','01711000003','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','elderly','উত্তরা',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 36 DAY), INTERVAL 0 MINUTE)),
(5,'তানভীর আহমেদ','01722000001','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','ধানমন্ডি',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 35 DAY), INTERVAL 0 MINUTE)),
(6,'মাসুদ রানা','01722000002','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','মিরপুর',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 34 DAY), INTERVAL 0 MINUTE)),
(7,'নাজমুল হক','01722000003','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','উত্তরা',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 33 DAY), INTERVAL 0 MINUTE)),
(8,'শিউলি আক্তার','01722000004','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','ধানমন্ডি',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 32 DAY), INTERVAL 0 MINUTE)),
(9,'ইমরান হোসেন','01722000005','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','গুলশান',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 31 DAY), INTERVAL 0 MINUTE)),
(10,'কামাল উদ্দিন','01722000006','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','helper','মিরপুর',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 30 DAY), INTERVAL 0 MINUTE)),
(11,'ফারহানা ইসলাম','01733000001','$2y$12$6auAGwMEpj7bP6WPSMXbleW.xoI7/e5PxRIP5qZmBADoRIBq2JA6G','guardian','গুলশান',1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 29 DAY), INTERVAL 0 MINUTE));

INSERT INTO helper_profiles (user_id, nid_number, nid_front_path, nid_back_path, verification_status, rejection_reason, reviewed_at, reviewed_by, total_rating, total_tasks_completed, is_available, created_at) VALUES
(5,'1995269123','demo_front.png','demo_back.png','approved',NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 0 MINUTE),1,4.5,2,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE)),
(6,'1990123456789','demo_front.png','demo_back.png','approved',NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 0 MINUTE),1,5.0,1,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE)),
(7,'19881234567890123','demo_front.png','demo_back.png','approved',NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 0 MINUTE),1,5.0,1,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE)),
(8,'1998765432','demo_front.png','demo_back.png','pending',NULL,NULL,NULL,5.0,0,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE)),
(9,'2001123456789','demo_front.png','demo_back.png','pending',NULL,NULL,NULL,5.0,0,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE)),
(10,'19921112223334445','demo_front.png','demo_back.png','rejected','NID-এর ছবি অস্পষ্ট, আবার পরিষ্কার ছবি দিন',DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 0 MINUTE),1,5.0,0,1,DATE_ADD(DATE_SUB(NOW(), INTERVAL 25 DAY), INTERVAL 0 MINUTE));

INSERT INTO tasks (id, requester_id, helper_id, category, description, pickup_address, delivery_address, area, base_fee, tip_amount, item_cost, handshake_pin, pin_attempts, status, payment_method, payment_status, bkash_trx_id, cancel_reason, accepted_at, completed_at, created_at) VALUES
(1,2,5,'pharmacy','ডায়াবেটিস ও প্রেশারের ওষুধ, ৩০ দিনের','লাজ ফার্মা, ধানমন্ডি ২৭','বাড়ি ১৪, রোড ৭, ধানমন্ডি','ধানমন্ডি',100.00,50,420,'3945',0,'completed','cash','paid',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY), INTERVAL 5 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY), INTERVAL 75 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY), INTERVAL -30 MINUTE)),
(2,2,5,'grocery','চাল, ডাল, তেল ও সবজি','কাঁচাবাজার, ধানমন্ডি ৮','বাড়ি ১৪, রোড ৭, ধানমন্ডি','ধানমন্ডি',100.00,0,860,'1288',0,'completed','bkash','paid','DEMOA1B2C3D4',NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 8 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 95 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL -30 MINUTE)),
(3,3,6,'hospital','ডাক্তারের চেম্বারে সঙ্গী হয়ে নিয়ে যাওয়া','বাসা, মিরপুর ১০','ইউনাইটেড হাসপাতাল, গুলশান','মিরপুর',100.00,100,0,'5521',0,'completed','cash','paid',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 5 DAY), INTERVAL 10 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 5 DAY), INTERVAL 180 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 5 DAY), INTERVAL -30 MINUTE)),
(4,4,7,'pharmacy','হার্টের ওষুধ (প্রেসক্রিপশন অনুযায়ী)','সানরাইজ ফার্মেসি, উত্তরা সেক্টর ৭','বাড়ি ৫, সেক্টর ৭, উত্তরা','উত্তরা',100.00,20,310,'8067',0,'completed','cash','paid',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 6 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 60 MINUTE),DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL -30 MINUTE)),
(5,2,5,'pharmacy','গ্যাস্ট্রিক ও ভিটামিনের ওষুধ','লাজ ফার্মা, ধানমন্ডি ২৭','বাড়ি ১৪, রোড ৭, ধানমন্ডি','ধানমন্ডি',100.00,30,0,'4410',0,'on_the_way','cash','unpaid',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL 10 MINUTE),NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(6,3,6,'grocery','সপ্তাহের বাজার (তালিকা ফোনে বলা)','মিরপুর ১১ বাজার','বাড়ি ২২, মিরপুর ১০','মিরপুর',100.00,0,540,'7210',0,'arrived','bkash','unpaid',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL 15 MINUTE),NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(7,2,NULL,'pharmacy','প্রেসারের ওষুধ, ১৫ দিনের','লাজ ফার্মা, ধানমন্ডি ২৭','বাড়ি ১৪, রোড ৭, ধানমন্ডি','ধানমন্ডি',100.00,0,0,'2935',0,'pending','cash','unpaid',NULL,NULL,NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(8,3,NULL,'grocery','চাল ও আটা ৫ কেজি করে','মিরপুর ১ বাজার','বাড়ি ২২, মিরপুর ১০','মিরপুর',100.00,20,0,'6143',0,'pending','cash','unpaid',NULL,NULL,NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(9,4,NULL,'hospital','চোখের ডাক্তার দেখাতে সঙ্গী লাগবে','বাসা, উত্তরা সেক্টর ৭','ল্যাবএইড, ধানমন্ডি','উত্তরা',100.00,50,0,'3086',0,'pending','bkash','unpaid',NULL,NULL,NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(10,2,NULL,'other','বিদ্যুৎ বিল জমা দেওয়া','ডেসকো অফিস, ধানমন্ডি','বাড়ি ১৪, রোড ৭, ধানমন্ডি','ধানমন্ডি',100.00,30,0,'9714',0,'pending','cash','unpaid',NULL,NULL,NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL -30 MINUTE)),
(11,4,NULL,'pharmacy','সর্দি-কাশির ওষুধ','সানরাইজ ফার্মেসি, উত্তরা সেক্টর ৭','বাড়ি ৫, সেক্টর ৭, উত্তরা','উত্তরা',100.00,0,0,'1357',0,'cancelled','cash','unpaid',NULL,'আর প্রয়োজন নেই, পরিবারের সদস্য এনে দিয়েছেন',NULL,NULL,DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL -30 MINUTE));

INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating, comment, created_at) VALUES
(1,2,5,5,'খুব ভদ্র ও সময়মতো এসেছেন, ধন্যবাদ।',DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY), INTERVAL 0 MINUTE)),
(2,2,5,4,'বাজার ভালো ছিল, একটু দেরি হয়েছে।',DATE_ADD(DATE_SUB(NOW(), INTERVAL 8 DAY), INTERVAL 0 MINUTE)),
(3,3,6,5,'হাসপাতালে খুব যত্ন নিয়েছেন।',DATE_ADD(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 0 MINUTE)),
(4,4,7,5,'দ্রুত ওষুধ এনে দিয়েছেন।',DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 0 MINUTE));

-- ডেমো: ফারহানা (অভিভাবক) → আব্দুর রহিম (অনুমোদিত), সালমা বেগম (অনুমোদনের অপেক্ষায়)
INSERT INTO guardian_links (guardian_id, elderly_id, status) VALUES (11, 2, 'approved'), (11, 3, 'pending');
