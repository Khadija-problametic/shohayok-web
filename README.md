# 🤝 Shohayok (সহায়ক) — প্রতিবেশীর হাতে আপনার কাজ

> ঢাকার ৬টি এলাকায় প্রবীণ নাগরিকদের দৈনন্দিন কেনাকাটা, জরুরি ওষুধ সংগ্রহ এবং হাসপাতালে সঙ্গী হওয়ার জন্য NID-যাচাইকৃত স্থানীয় সহায়কদের সাথে যুক্ত করার কমিউনিটি ওয়েব প্ল্যাটফর্ম।

---

## 🌟 মূল বৈশিষ্ট্যসমূহ (Key Features)

- **মানবিক ও প্রবীণ-বান্ধব ডিজাইন (Human-Centered UI):**
  - বড় ফন্ট, হাই-কনট্রাস্ট ও সহজ নেভিগেশন।
  - **ভয়েস-ফার্স্ট অর্ডার:** টাইপ করার পাশাপাশি সরাসরি মুখে বলে লিখে নেওয়া (Speech-to-Text) অথবা অডিও ভয়েস নোট রেকর্ড করে কাজ পোস্ট করার সুবিধা।
- **বহুমাত্রিক সুরক্ষা ও আস্থা (Multi-Layer Trust System):**
  - **NID ভেরিফিকেশন ও অ্যাডমিন রিভিউ:** জাতীয় পরিচয়পত্রের উভয় পাশের ছবি যাচাইয়ের পর অ্যাডমিন অনুমোদন দিলে তবেই সহায়ক কাজ নিতে পারেন।
  - **৪-সংখ্যার হ্যান্ডশেক পিন (Handshake PIN):** দরজায় সহায়ক পৌঁছালে গ্রাহক পিন দেখালে তবেই কাজ সম্পন্ন হয়।
  - **অভিভাবক সংযোগ (Guardian Supervision):** দূর থেকে পরিবারের সদস্য যুক্ত হয়ে কাজ পর্যবেক্ষণ ও প্রয়োজনে বিল পরিশোধের সুবিধা।
- **স্বচ্ছ আর্থিক হিসাব ও পেমেন্ট (Transparent Ledger & Payment):**
  - সার্ভার-সাইড নির্ধারিত প্ল্যাটফর্ম কমিশন (১০% অ্যাডমিন ও ৯০% সহায়ক)।
  - ক্যাশ অন ডেলিভারি (দরজায় নগদ) এবং বিকাশ (অগ্রিম বা কাজ শেষে) উভয় পেমেন্ট অপশন।
  - মালামাল কেনার পর আসল ভাউচারের মেমো খরচ (Item Cost) হালনাগাদের সুযোগ।
- **বিতর্ক ও অভিযোগ নিষ্পত্তি (Dispute Resolution):**
  - কাজ চলাকালীন যেকোনো পক্ষ থেকে অভিযোগ জমা দেওয়ার ব্যবস্থা এবং অ্যাডমিন কর্তৃক নিরপেক্ষ নিষ্পত্তির সুবিধা।

---

## 🛠️ ব্যবহৃত প্রযুক্তি (Tech Stack)

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Responsive Design System, Dark/Light Mode)
- **Backend:** PHP 8.x (REST-style JSON API, Session-based Authentication)
- **Database:** MySQL 8.x (InnoDB, Foreign Key Constraints, Generated Stored Columns)
- **APIs & Features:** Web Speech API (bn-BD STT), MediaRecorder API (Audio Voice Notes), PDO MySQL.

---

## 🚀 লোকাল সেটআপ নির্দেশিকা (Local Setup)

### ১. পূর্বশর্ত
- [XAMPP](https://www.apachefriends.org/) বা Apache ও MySQL চালিত যেকোনো লোকাল সার্ভার।
- PHP ৮.০ বা তার পরবর্তী সংস্করণ।

### ২. ফাইল ডাউনলোড ও প্রতিস্থাপন
প্রজেক্টটি ক্লোন করে XAMPP-এর `htdocs` ফোল্ডারে রাখুন:
```bash
cd C:/xampp/htdocs/
git clone [https://github.com/YOUR_USERNAME/shohayok.git](https://github.com/YOUR_USERNAME/shohayok.git)
# 🧡 Shohayok (সহায়ক) — প্রতিবেশীর হাতে আপনার কাজ

> 🌐 **লাইভ ওয়েবসাইট ভিজিট করুন:** [shohayok-care.infinityfreeapp.com](http://shohayok-care.infinityfreeapp.com/)
