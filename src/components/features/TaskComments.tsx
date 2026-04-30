"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { Send, Pencil, Trash2, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { addComment, editComment, deleteComment, toggleReaction, type Comment, type Reaction } from "@/app/actions/comments";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const QUICK_EMOJIS = ["👍", "👎", "❤️", "😂", "🎉", "🚀", "👀", "✅"];

interface Props {
    taskId: string;
    orgId: string;
    currentUserId: string;
    initialComments: Comment[];
    initialReactions: Reaction[];
}

export function TaskComments({ taskId, orgId, currentUserId, initialComments, initialReactions }: Props) {
    const [comments, setComments] = useOptimistic(initialComments);
    const [reactions, setReactions] = useState(initialReactions);
    const [draft, setDraft] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!draft.trim()) return;
        const optimistic: Comment = {
            id: `opt-${Date.now()}`,
            task_id: taskId,
            user_id: currentUserId,
            content: draft,
            mentions: [],
            edited_at: null,
            created_at: new Date().toISOString(),
        };
        startTransition(async () => {
            setComments(cs => [...cs, optimistic]);
            const result = await addComment(taskId, orgId, draft);
            if (result.error) { toast.error(result.error); return; }
            setComments(cs => cs.filter(c => c.id !== optimistic.id).concat(result.data as Comment));
        });
        setDraft("");
    }

    function handleEdit(comment: Comment) {
        setEditingId(comment.id);
        setEditContent(comment.content);
    }

    function handleEditSave(commentId: string) {
        startTransition(async () => {
            const result = await editComment(commentId, editContent);
            if (result.error) { toast.error(result.error); return; }
            setComments(cs => cs.map(c => c.id === commentId ? { ...c, content: editContent, edited_at: new Date().toISOString() } : c));
            setEditingId(null);
        });
    }

    function handleDelete(commentId: string) {
        startTransition(async () => {
            const result = await deleteComment(commentId);
            if (result.error) { toast.error(result.error); return; }
            setComments(cs => cs.filter(c => c.id !== commentId));
        });
    }

    function handleReaction(commentId: string, emoji: string) {
        startTransition(async () => {
            await toggleReaction(commentId, orgId, emoji);
            setReactions(rs => {
                const existing = rs.find(r => r.comment_id === commentId && r.user_id === currentUserId && r.emoji === emoji);
                if (existing) return rs.filter(r => r.id !== existing.id);
                return [...rs, { id: `r-${Date.now()}`, comment_id: commentId, user_id: currentUserId, emoji, created_at: new Date().toISOString() }];
            });
        });
        setEmojiPickerFor(null);
    }

    function groupedReactions(commentId: string) {
        const commentReactions = reactions.filter(r => r.comment_id === commentId);
        const grouped: Record<string, { count: number; mine: boolean }> = {};
        for (const r of commentReactions) {
            if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
            grouped[r.emoji].count++;
            if (r.user_id === currentUserId) grouped[r.emoji].mine = true;
        }
        return grouped;
    }

    return (
        <UpgradeGate feature="task_comments">
            <div className="space-y-4">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Comments ({comments.length})
                </div>

                <div className="space-y-3">
                    {comments.map(comment => (
                        <div key={comment.id} className="group flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#0c64ef]/10 flex items-center justify-center text-[11px] font-black text-[#0c64ef] flex-shrink-0 mt-0.5">
                                {comment.user_id.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-[11px] font-black text-[#1d1d1f]">{comment.user_id.slice(0, 8)}</span>
                                    <span className="text-[9px] text-slate-400">
                                        {new Date(comment.created_at).toLocaleString()}
                                        {comment.edited_at && " (edited)"}
                                    </span>
                                </div>

                                {editingId === comment.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none resize-none"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditSave(comment.id)} disabled={pending}
                                                className="px-3 py-1 rounded-lg bg-[#0c64ef] text-white text-xs font-black disabled:opacity-50">
                                                Save
                                            </button>
                                            <button onClick={() => setEditingId(null)}
                                                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-500">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                                    </div>
                                )}

                                {/* Reactions */}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {Object.entries(groupedReactions(comment.id)).map(([emoji, { count, mine }]) => (
                                        <button key={emoji} onClick={() => handleReaction(comment.id, emoji)}
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors ${mine ? "border-[#0c64ef]/30 bg-[#0c64ef]/5 text-[#0c64ef]" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                                            <span>{emoji}</span>
                                            <span className="font-bold text-[10px]">{count}</span>
                                        </button>
                                    ))}

                                    <div className="relative">
                                        <button onClick={() => setEmojiPickerFor(id => id === comment.id ? null : comment.id)}
                                            className="p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                                            <SmilePlus size={12} />
                                        </button>
                                        {emojiPickerFor === comment.id && (
                                            <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 z-10">
                                                {QUICK_EMOJIS.map(e => (
                                                    <button key={e} onClick={() => handleReaction(comment.id, e)}
                                                        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-base transition-colors">
                                                        {e}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {comment.user_id === currentUserId && editingId !== comment.id && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                            <button onClick={() => handleEdit(comment)}
                                                className="p-1 rounded text-slate-300 hover:text-slate-600 transition-colors">
                                                <Pencil size={11} />
                                            </button>
                                            <button onClick={() => handleDelete(comment.id)} disabled={pending}
                                                className="p-1 rounded text-slate-300 hover:text-[#ff3b30] transition-colors">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Composer */}
                <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
                        placeholder="Add a comment… (Enter to send, Shift+Enter for newline)"
                        rows={1}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none resize-none"
                    />
                    <button type="submit" disabled={pending || !draft.trim()}
                        className="p-2.5 rounded-xl bg-[#0c64ef] text-white hover:bg-[#005bb7] disabled:opacity-40 transition-colors flex-shrink-0">
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </UpgradeGate>
    );
}
