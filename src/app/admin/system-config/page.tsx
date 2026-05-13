import { getSystemConfig } from "../actions-system-config";
import { PageHeader } from "../_components/ui";
import { SystemConfigClient } from "./SystemConfigClient";

export default async function SystemConfigPage() {
    const config = await getSystemConfig();

    return (
        <div className="p-10 max-w-3xl space-y-6">
            <PageHeader
                title="System Configuration"
                subtitle="Edit platform-wide settings without a deploy. Changes take effect immediately."
            />
            <SystemConfigClient config={config} />
        </div>
    );
}
