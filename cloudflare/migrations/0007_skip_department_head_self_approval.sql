-- Fix legacy pending workflows where the Department Head is wrongly waiting
-- to approve the requisition they submitted. No account, PR, or approval rows
-- are deleted. Safe to run more than once.
-- Apply AFTER 0006_finance_workflows.sql.
UPDATE pr_approval_steps
SET status = 'Approved',
    comment = 'Request submitted by Department Head; this is not an approval.',
    decided_by = NULL,
    decided_at = (SELECT created_at FROM pr_approval_requests r WHERE r.pr_id = pr_approval_steps.pr_id)
WHERE step_no = 1
  AND step_role = 'Department Head'
  AND status = 'Pending'
  AND EXISTS (
    SELECT 1 FROM pr_approval_requests r
    WHERE r.pr_id = pr_approval_steps.pr_id
      AND r.status = 'Pending' AND r.current_step = 1
  );

UPDATE pr_approval_requests
SET current_step = 2
WHERE status = 'Pending' AND current_step = 1
  AND EXISTS (
    SELECT 1 FROM pr_approval_steps s
    WHERE s.pr_id = pr_approval_requests.pr_id
      AND s.step_no = 1 AND s.step_role = 'Department Head'
      AND s.status = 'Approved'
      AND s.comment = 'Request submitted by Department Head; this is not an approval.'
  );
