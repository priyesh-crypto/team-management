import { notFound } from "next/navigation";
import { resolveShareToken } from "@/app/actions/share-links";
import { ShareClient } from "./ShareClient";

interface Props {
    params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: Props) {
    const { token } = await params;
    const result = await resolveShareToken(token);

    if (!result) return notFound();

    const { token: tokenRow, resource, tasks, subtasksMap, employees } = result;

    return (
        <ShareClient 
            tokenRow={tokenRow}
            resource={resource}
            tasks={tasks || []}
            subtasksMap={subtasksMap || {}}
            employees={employees || []}
        />
    );
}
