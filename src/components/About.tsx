export default function About() {
  return (
    <div className="page about-page">
      <header className="page-header">
        <h1>About ProcureCorp</h1>
        <p className="text-muted">Modern procurement for modern teams</p>
      </header>

      <section className="panel">
        <h2>What is a Procurement System?</h2>
        <p>
          A procurement system is the set of processes, tools and policies an organization uses to
          acquire goods and services. It covers everything from identifying needs, selecting
          suppliers, creating purchase orders, receiving goods, and managing payments — while
          ensuring compliance, cost control and auditability.
        </p>
      </section>

      <section className="panel">
        <h2>Key Capabilities of This Platform</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">1</div>
            <h3>Role-Based Access Control</h3>
            <p>
              Three distinct roles — <strong>Admin</strong>, <strong>Employee</strong> and{' '}
              <strong>Guest</strong> — each with tailored permissions and views. Admins approve
              orders and manage suppliers; Employees create and track requests; Guests see public
              information only.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">2</div>
            <h3>Purchase Order Lifecycle</h3>
            <p>
              Full lifecycle support: draft → pending → approved / rejected → completed. Real-time
              status tracking and clear ownership of each request.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">3</div>
            <h3>Supplier Management</h3>
            <p>
              Centralized directory of vendors with categories, contact details, performance ratings
              and active/inactive status. Helps maintain preferred supplier lists.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">4</div>
            <h3>Spend Visibility</h3>
            <p>
              Dashboard metrics for pending approvals, total order value and approved spend give
              managers instant insight into procurement activity.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Demo Roles Explained</h2>
        <div className="roles-table">
          <div className="role-row">
            <span className="role-badge admin">Admin</span>
            <div>
              <strong>Alex Rivera</strong> — Full access. Can approve/reject orders, manage
              suppliers, view all reports and perform administrative actions.
            </div>
          </div>
          <div className="role-row">
            <span className="role-badge employee">Employee</span>
            <div>
              <strong>Jordan Lee</strong> — Create purchase requests, track own orders, view
              suppliers. Cannot approve or manage system settings.
            </div>
          </div>
          <div className="role-row">
            <span className="role-badge guest">Guest</span>
            <div>
              Limited public view. Can read about the platform and high-level information only.
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Technology Stack</h2>
        <ul className="tech-list">
          <li>
            <strong>React 19</strong> + TypeScript — Component-based UI with strong typing
          </li>
          <li>
            <strong>Vite</strong> — Fast development server and optimized production builds
          </li>
          <li>
            <strong>React Context</strong> — Lightweight authentication state management
          </li>
          <li>
            <strong>LocalStorage</strong> — Session persistence for demo purposes
          </li>
          <li>
            <strong>Pure CSS</strong> — Modern, responsive design without external UI libraries
          </li>
        </ul>
      </section>

      <footer className="about-footer">
        <p>ProcureCorp Demo · Built for educational purposes · 2026</p>
      </footer>
    </div>
  );
}
