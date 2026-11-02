ALTER TABLE users ADD COLUMN app_role TEXT NOT NULL DEFAULT 'Employee'
  CHECK (app_role IN ('Admin', 'Employee', 'Procurement Officer', 'Procurement Head', 'Supplier'));
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN company_name TEXT NOT NULL DEFAULT '';

UPDATE users SET app_role = 'Admin' WHERE role = 'admin';
