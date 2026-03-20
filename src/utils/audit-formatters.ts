import { formatDistanceToNow } from 'date-fns'
import { ActivityLog } from '@/app/actions/actions'

export function formatAuditEntry(log: ActivityLog): string {
    if (!log) return 'An action was performed'
    const actor = log.actor_name ?? 'Someone'
    const time = log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : 'recently'

    if (log.description) {
        return `${log.description} ${time}`
    }

    // Fallback logic - ensure type exists and is a string
    const activityType = typeof log.type === 'string' ? log.type.replace(/_/g, ' ') : 'an action'
    return `${actor} performed ${activityType} ${time}`
}
