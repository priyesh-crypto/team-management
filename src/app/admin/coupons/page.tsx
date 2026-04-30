import { getCoupons } from "../actions-tier2";
import { PageHeader } from "../_components/ui";
import { CouponsClient } from "./CouponsClient";

export default async function CouponsPage() {
    const coupons = await getCoupons();

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <PageHeader
                title="Coupons"
                subtitle="Create and manage discount codes. Deactivating stops future redemptions."
            />
            <CouponsClient initialCoupons={coupons} />
        </div>
    );
}
