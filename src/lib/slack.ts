/** Lightweight Slack webhook helper — no SDK dependency needed */

export interface SlackMessage {
    text?: string;
    blocks?: SlackBlock[];
}

export interface SlackBlock {
    type: string;
    [key: string]: unknown;
}

export async function sendSlackMessage(webhookUrl: string, message: SlackMessage): Promise<boolean> {
    try {
        const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
        });
        return res.ok;
    } catch (err) {
        console.error("[Slack webhook]", err);
        return false;
    }
}

export function buildTaskNotification(event: string, task: {
    name: string;
    priority: string;
    status?: string;
    assignee?: string;
    deadline?: string;
    url?: string;
}): SlackMessage {
    const priority_emoji: Record<string, string> = {
        Urgent: "🔴", High: "🟠", Medium: "🟡", Low: "🟢",
    };
    const emoji = priority_emoji[task.priority] ?? "📋";
    const eventLabel: Record<string, string> = {
        "task.created": "New task created",
        "task.completed": "Task completed ✅",
        "task.overdue": "Task overdue ⚠️",
        "task.status_changed": "Task updated",
    };

    return {
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${eventLabel[event] ?? event}*\n${emoji} *${task.name}*`,
                },
            },
            {
                type: "context",
                elements: [
                    { type: "mrkdwn", text: `Priority: ${task.priority}` },
                    ...(task.assignee ? [{ type: "mrkdwn", text: `Assignee: ${task.assignee}` }] : []),
                    ...(task.deadline ? [{ type: "mrkdwn", text: `Due: ${new Date(task.deadline).toLocaleDateString()}` }] : []),
                ],
            },
            ...(task.url ? [{
                type: "actions",
                elements: [{
                    type: "button",
                    text: { type: "plain_text", text: "View task" },
                    url: task.url,
                }],
            }] : []),
        ],
    };
}
