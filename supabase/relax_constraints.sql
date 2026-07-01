-- 放寬「樂器 / 班型」的固定限制，讓你能自由新增新課程（例如新樂器、新班型）
-- 到 SQL Editor 貼上執行一次即可
alter table students drop constraint if exists students_instrument_check;
alter table students drop constraint if exists students_class_type_check;
alter table plans    drop constraint if exists plans_instrument_check;
alter table plans    drop constraint if exists plans_class_type_check;
