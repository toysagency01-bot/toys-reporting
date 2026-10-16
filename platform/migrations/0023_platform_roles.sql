-- Existing client grants and credentials remain intact.
CREATE TABLE platform_user_roles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('admin','team','client')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER platform_last_admin_role BEFORE UPDATE OF role ON platform_user_roles
WHEN OLD.role='admin' AND NEW.role!='admin'
 AND (SELECT COUNT(*) FROM platform_user_roles r JOIN users u ON u.id=r.user_id WHERE r.role='admin' AND u.status!='disabled')<=1
BEGIN SELECT RAISE(ABORT,'last_admin_required'); END;
CREATE TRIGGER platform_last_admin_status BEFORE UPDATE OF status ON users
WHEN NEW.status='disabled' AND OLD.status!='disabled'
 AND EXISTS(SELECT 1 FROM platform_user_roles WHERE user_id=OLD.id AND role='admin')
 AND (SELECT COUNT(*) FROM platform_user_roles r JOIN users u ON u.id=r.user_id WHERE r.role='admin' AND u.status!='disabled')<=1
BEGIN SELECT RAISE(ABORT,'last_admin_required'); END;
