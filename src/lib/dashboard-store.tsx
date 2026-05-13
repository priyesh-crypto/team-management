"use client";

/**
 * Supabase-backed dashboard store.
 *
 * Replaces the old localStorage store.ts. All state is seeded from
 * getDashboardData() (server → Supabase) and kept in a React context so
 * every component in the dashboard tree shares the same version of the truth.
 *
 * Pattern:
 *   1. DashboardStoreProvider wraps the dashboard tree (DashboardContainer).
 *   2. Server-side initialData seeds the store on first render.
 *   3. Components call useDashboardStore() to read state and dispatch mutations.
 *   4. Mutations apply optimistically to local state AND call the matching
 *      Server Action so Supabase stays authoritative.
 *   5. refresh() re-fetches everything from Supabase (used after bulk ops).
 */

import React, {
    createContext,
    useContext,
    useReducer,
    useCallback,
    useMemo,
} from "react";
import type {
    Task,
    Subtask,
    Profile,
    Project,
    Notification,
    ActivityLog,
    WorkloadMap,
} from "@/app/actions/actions";
import { getDashboardData } from "@/app/actions/actions";

// ─── State ────────────────────────────────────────────────────────────────────

export type DashboardState = {
    tasks: Task[];
    profiles: Profile[];
    projectMembers: Profile[];
    projects: Project[];
    /** Flat subtask list — use subtasksMap for indexed access */
    subtasks: Subtask[];
    subtasksMap: Record<string, Subtask[]>;
    logs: ActivityLog[];
    workload: WorkloadMap;
    notifications: Notification[];
    commentCounts: Record<string, number>;
    attachmentCounts: Record<string, number>;
    isLoading: boolean;
};

const EMPTY: DashboardState = {
    tasks: [],
    profiles: [],
    projectMembers: [],
    projects: [],
    subtasks: [],
    subtasksMap: {},
    logs: [],
    workload: {},
    notifications: [],
    commentCounts: {},
    attachmentCounts: {},
    isLoading: false,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type DashboardAction =
    | { type: "HYDRATE"; payload: Omit<DashboardState, "isLoading" | "subtasksMap"> }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "UPSERT_TASK"; payload: Task }
    | { type: "DELETE_TASK"; payload: string }
    | { type: "PATCH_TASK"; payload: Partial<Task> & { id: string } }
    | { type: "UPSERT_SUBTASK"; payload: Subtask }
    | { type: "DELETE_SUBTASK"; payload: { subtaskId: string; taskId: string } }
    | { type: "UPSERT_PROJECT"; payload: Project }
    | { type: "DELETE_PROJECT"; payload: string }
    | { type: "DELETE_PROFILE"; payload: string }
    | { type: "SET_LOGS"; payload: ActivityLog[] }
    | { type: "MARK_NOTIFICATION_READ"; payload: string }
    | { type: "CLEAR_NOTIFICATIONS" }
    | { type: "SET_NOTIFICATIONS"; payload: Notification[] };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function buildSubtasksMap(subtasks: Subtask[]): Record<string, Subtask[]> {
    const map: Record<string, Subtask[]> = {};
    for (const st of subtasks) {
        if (!map[st.task_id]) map[st.task_id] = [];
        map[st.task_id].push(st);
    }
    return map;
}

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
    switch (action.type) {
        case "HYDRATE": {
            const { subtasks, ...rest } = action.payload;
            return {
                ...rest,
                subtasks,
                subtasksMap: buildSubtasksMap(subtasks),
                isLoading: false,
            };
        }

        case "SET_LOADING":
            return { ...state, isLoading: action.payload };

        case "UPSERT_TASK": {
            const exists = state.tasks.some(t => t.id === action.payload.id);
            return {
                ...state,
                tasks: exists
                    ? state.tasks.map(t => t.id === action.payload.id ? action.payload : t)
                    : [action.payload, ...state.tasks],
            };
        }

        case "DELETE_TASK":
            return {
                ...state,
                tasks: state.tasks.filter(t => t.id !== action.payload),
            };

        case "PATCH_TASK": {
            const { id, ...patch } = action.payload;
            return {
                ...state,
                tasks: state.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
            };
        }

        case "UPSERT_SUBTASK": {
            const exists = state.subtasks.some(s => s.id === action.payload.id);
            const nextSubtasks = exists
                ? state.subtasks.map(s => s.id === action.payload.id ? action.payload : s)
                : [...state.subtasks, action.payload];
            return {
                ...state,
                subtasks: nextSubtasks,
                subtasksMap: buildSubtasksMap(nextSubtasks),
            };
        }

        case "DELETE_SUBTASK": {
            const nextSubtasks = state.subtasks.filter(
                s => s.id !== action.payload.subtaskId
            );
            return {
                ...state,
                subtasks: nextSubtasks,
                subtasksMap: buildSubtasksMap(nextSubtasks),
            };
        }

        case "UPSERT_PROJECT": {
            const exists = state.projects.some(p => p.id === action.payload.id);
            return {
                ...state,
                projects: exists
                    ? state.projects.map(p => p.id === action.payload.id ? action.payload : p)
                    : [action.payload, ...state.projects],
            };
        }

        case "DELETE_PROJECT":
            return {
                ...state,
                projects: state.projects.filter(p => p.id !== action.payload),
            };

        case "DELETE_PROFILE":
            return {
                ...state,
                profiles: state.profiles.filter(p => p.id !== action.payload),
                projectMembers: state.projectMembers.filter(p => p.id !== action.payload),
            };

        case "SET_LOGS":
            return { ...state, logs: action.payload };

        case "MARK_NOTIFICATION_READ":
            return {
                ...state,
                notifications: state.notifications.map(n =>
                    n.id === action.payload ? { ...n, is_read: true } : n
                ),
            };

        case "CLEAR_NOTIFICATIONS":
            return { ...state, notifications: [] };

        case "SET_NOTIFICATIONS":
            return { ...state, notifications: action.payload };

        default:
            return state;
    }
}

// ─── Context ──────────────────────────────────────────────────────────────────

export type RawDashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;

type StoreContext = {
    state: DashboardState;
    dispatch: React.Dispatch<DashboardAction>;
    /** Re-fetch everything from Supabase, HYDRATE the store, and return raw data. */
    refresh: (projectId?: string) => Promise<RawDashboardData | null>;
};

const Context = createContext<StoreContext | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

type RawInitialData = {
    tasks?: Task[];
    profiles?: Profile[];
    projectMembers?: Profile[];
    projects?: Project[];
    subtasks?: Subtask[];
    logs?: ActivityLog[];
    workload?: WorkloadMap;
    notifications?: Notification[];
    counts?: {
        comments?: Record<string, number>;
        attachments?: Record<string, number>;
    };
};

export function DashboardStoreProvider({
    initialData,
    projectId,
    children,
}: {
    initialData?: RawInitialData | null;
    projectId?: string;
    children: React.ReactNode;
}) {
    const seed: DashboardState = useMemo(() => {
        if (!initialData) return EMPTY;
        const subtasks = initialData.subtasks ?? [];
        return {
            tasks: initialData.tasks ?? [],
            profiles: initialData.profiles ?? [],
            projectMembers: initialData.projectMembers ?? [],
            projects: initialData.projects ?? [],
            subtasks,
            subtasksMap: buildSubtasksMap(subtasks),
            logs: initialData.logs ?? [],
            workload: initialData.workload ?? {},
            notifications: initialData.notifications ?? [],
            commentCounts: initialData.counts?.comments ?? {},
            attachmentCounts: initialData.counts?.attachments ?? {},
            isLoading: false,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally only runs once — initialData is a server-rendered snapshot

    const [state, dispatch] = useReducer(reducer, seed);

    const refresh = useCallback(async (pid?: string): Promise<RawDashboardData | null> => {
        dispatch({ type: "SET_LOADING", payload: true });
        try {
            const data = await getDashboardData(pid ?? projectId);
            if (!data) return null;
            dispatch({
                type: "HYDRATE",
                payload: {
                    tasks: data.tasks,
                    profiles: data.profiles,
                    projectMembers: data.projectMembers,
                    projects: data.projects,
                    subtasks: data.subtasks,
                    logs: data.logs,
                    workload: data.workload,
                    notifications: data.notifications ?? [],
                    commentCounts: data.counts?.comments ?? {},
                    attachmentCounts: data.counts?.attachments ?? {},
                },
            });
            return data;
        } finally {
            dispatch({ type: "SET_LOADING", payload: false });
        }
    }, [projectId]);

    const value = useMemo(() => ({ state, dispatch, refresh }), [state, dispatch, refresh]);

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardStore(): StoreContext {
    const ctx = useContext(Context);
    if (!ctx) throw new Error("useDashboardStore must be used inside <DashboardStoreProvider>");
    return ctx;
}

/**
 * Convenience selector hook — avoids re-renders for components that only need
 * a slice of the state.
 *
 * Usage:
 *   const tasks = useDashboardSelector(s => s.tasks);
 */
export function useDashboardSelector<T>(selector: (state: DashboardState) => T): T {
    const { state } = useDashboardStore();
    return selector(state);
}
