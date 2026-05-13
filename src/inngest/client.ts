import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "task-flow-pro" });

// Event payload types — used for type-safe inngest.send() calls.
export type TaskAssignedEvent = {
    name: "task/assigned";
    data: {
        taskId:       string;
        taskName:     string;
        assigneeId:   string;
        assignerName: string;
        orgId:        string;
    };
};

export type TaskStatusChangedEvent = {
    name: "task/status-changed";
    data: {
        taskId:    string;
        taskName:  string;
        newStatus: string;
        userId:    string;
        orgId:     string;
    };
};

export type MemberInvitedEvent = {
    name: "member/invited";
    data: {
        email:     string;
        orgName:   string;
        invitedBy: string;
        orgId:     string;
        inviteUrl: string;
        role:      string;
    };
};

export type ActivityLogEvent = {
    name: "activity/log";
    data: {
        orgId:      string;
        userId:     string;
        action:     string;
        entityType: string;
        entityId:   string;
        metadata?:  Record<string, unknown>;
    };
};

export type InngestEvent =
    | TaskAssignedEvent
    | TaskStatusChangedEvent
    | MemberInvitedEvent
    | ActivityLogEvent;
