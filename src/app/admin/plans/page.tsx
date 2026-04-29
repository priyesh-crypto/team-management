import { createClient } from "@/utils/supabase/server";
import { PlansClient } from "./PlansClient";

export default async function PlansPage() {
    const supabase = await createClient();
    const [{ data: plans }, { data: prices }] = await Promise.all([
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("plan_prices").select("*").order("country_code"),
    ]);

    return <PlansClient plans={plans ?? []} prices={prices ?? []} />;
}
