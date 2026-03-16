import { formatDistanceToNow, format } from 'date-fns'
import { AuditLog } from '@/app/actions/actions'

export function formatAuditEntry(log: AuditLog): string {
    const actor = log.actor_name ?? 'Someone'
    const target = log.target_name ? `"${log.target_name}"` : 'this task'
    const time = formatDistanceToNow(new Date(log.created_at), { addSuffix: true })

    if (log.table_name === 'comments' && log.action === 'INSERT') {
        const content = log.new_data?.content ? 
            (log.new_data.content.length > 50 ? log.new_data.content.substring(0, 50) + '...' : log.new_data.content) 
            : 'a comment'
        return `${actor} commented "${content}" on ${target} ${time}`
    }

    if (log.action === 'INSERT') {
        return `${actor} created ${target} ${time}`
    }

    if (log.action === 'DELETE') {
        return `${actor} deleted ${target} ${time}`
    }

    // UPDATE — use changed_fields to build a readable summary
    if (!log.changed_fields?.length) return `${actor} updated ${target} ${time}`

    const changes = log.changed_fields.map(field => {
        const oldVal = log.old_data?.[field]
        const newVal = log.new_data?.[field]

        switch (field) {
            case 'status':
                return `status from "${oldVal}" → "${newVal}"`
            case 'priority':
                return `priority from "${oldVal}" → "${newVal}"`
            case 'assignee_ids':
                return `reassigned the task`
            case 'deadline':
                return `deadline to ${format(new Date(newVal), 'MMM do')}`
            case 'title':
                return `title to "${newVal}"`
            case 'name':
                return `name to "${newVal}"`
            default:
                return `${field}`
        }
    })

    return `${actor} updated ${changes.join(', ')} in ${target} ${time}`
}
