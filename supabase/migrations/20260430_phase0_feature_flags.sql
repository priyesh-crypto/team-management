-- ==============================================================================
-- Phase 0: Extend plans.features JSONB with all feature flag keys
-- Safe to re-run (idempotent). Uses jsonb_set to merge flags without overwriting
-- any values already customised per plan.
-- ==============================================================================

-- Full feature set per tier. Each key defaults to false and is explicitly
-- enabled on the tiers that should have it.

UPDATE public.plans
SET features = features
    -- ensure all keys exist with a safe default before tier-specific merge
    || '{"recurring_tasks":false,"task_templates":false,"custom_statuses":false,"saved_views":false,"time_tracker":false,"bulk_actions":false,"public_share_links":false,"email_to_task":false,"ai_breakdown":false,"ai_weekly_summary":false,"smart_due_dates":false,"slack_integration":false,"calendar_sync":false,"gantt_dependencies":false,"custom_fields":false,"forms":false,"automations":false,"client_portal":false,"approvals":false,"reports_dashboards":false,"org_audit_log":false,"webhooks_api":false}'::jsonb
WHERE id = 'free';

UPDATE public.plans
SET features = features
    || '{"recurring_tasks":false,"task_templates":false,"custom_statuses":false,"saved_views":false,"time_tracker":false,"bulk_actions":false,"public_share_links":false,"email_to_task":false,"ai_breakdown":false,"ai_weekly_summary":false,"smart_due_dates":false,"slack_integration":false,"calendar_sync":false,"gantt_dependencies":false,"custom_fields":false,"forms":false,"automations":false,"client_portal":false,"approvals":false,"reports_dashboards":false,"org_audit_log":false,"webhooks_api":false}'::jsonb
    -- then layer on the Pro-tier flags (overrides the false defaults)
    || '{"recurring_tasks":true,"task_templates":true,"custom_statuses":true,"saved_views":true,"time_tracker":true,"bulk_actions":true,"public_share_links":true,"ai_breakdown":true,"ai_weekly_summary":true,"smart_due_dates":true}'::jsonb
WHERE id = 'pro';

UPDATE public.plans
SET features = features
    || '{"recurring_tasks":false,"task_templates":false,"custom_statuses":false,"saved_views":false,"time_tracker":false,"bulk_actions":false,"public_share_links":false,"email_to_task":false,"ai_breakdown":false,"ai_weekly_summary":false,"smart_due_dates":false,"slack_integration":false,"calendar_sync":false,"gantt_dependencies":false,"custom_fields":false,"forms":false,"automations":false,"client_portal":false,"approvals":false,"reports_dashboards":false,"org_audit_log":false,"webhooks_api":false}'::jsonb
    -- Business gets everything
    || '{"recurring_tasks":true,"task_templates":true,"custom_statuses":true,"saved_views":true,"time_tracker":true,"bulk_actions":true,"public_share_links":true,"email_to_task":true,"ai_breakdown":true,"ai_weekly_summary":true,"smart_due_dates":true,"slack_integration":true,"calendar_sync":true,"gantt_dependencies":true,"custom_fields":true,"forms":true,"automations":true,"client_portal":true,"approvals":true,"reports_dashboards":true,"org_audit_log":true,"webhooks_api":true}'::jsonb
WHERE id = 'business';
