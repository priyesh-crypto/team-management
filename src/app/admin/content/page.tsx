import { getContentPages } from "../actions-system-config";
import { PageHeader } from "../_components/ui";
import { ContentEditorClient } from "./ContentEditorClient";

export default async function ContentPage() {
    const pages = await getContentPages();

    return (
        <div className="p-10 max-w-3xl space-y-6">
            <PageHeader
                title="Content / Legal"
                subtitle="Edit Terms of Service, Privacy Policy, and other public pages. Changes publish instantly — no deploy needed."
            />
            <ContentEditorClient pages={pages} />
        </div>
    );
}
