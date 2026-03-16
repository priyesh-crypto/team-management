import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get all active users who have some channel enabled
    const { data: users, error: userError } = await supabase
      .from("digest_preferences")
      .select("*, profiles(name)")
      .eq("is_active", true)
      .neq("channel", "none");

    if (userError) throw userError;

    console.log('[DEBUG] Active users found:', users?.length ?? 0);
    if (users && users.length > 0) {
      console.log('[DEBUG] First user profile:', JSON.stringify(users[0]));
    }

    const results = await Promise.allSettled(
      (users ?? []).map(async (user: any) => {
        const now = new Date();
        const timezone = user.timezone || 'UTC';
        
        // Timezone-aware time formatting
        const userTimeStr = now.toLocaleTimeString("en-GB", { 
          timeZone: timezone, 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false 
        });

        // Bug 1 Fix: Window-based time check (10 minutes)
        const targetTime = user.send_time ? user.send_time.slice(0, 5) : '08:00';
        const [targetH, targetM] = targetTime.split(':').map(Number);
        const targetMinutesTotal = targetH * 60 + targetM;

        const [currentH, currentM] = userTimeStr.split(':').map(Number);
        const currentMinutesTotal = currentH * 60 + currentM;

        const timeDiff = Math.abs(currentMinutesTotal - targetMinutesTotal);
        if (timeDiff > 10) return; // Outside the 10-minute window

        // Weekend check
        const day = now.toLocaleDateString("en-US", { timeZone: timezone, weekday: 'long' });
        if ((day === 'Saturday' || day === 'Sunday') && !user.send_on_weekends) return;

        // Bug 2 Fix: Timezone-safe last_sent_at check
        const todayInUserTZ = now.toLocaleDateString("en-CA", { timeZone: timezone });
        const lastSentInUserTZ = user.last_sent_at
          ? new Date(user.last_sent_at).toLocaleDateString("en-CA", { timeZone: timezone })
          : '';
        
        if (lastSentInUserTZ === todayInUserTZ) {
          console.log(`[SKIP] Digest already sent today for ${user.user_id} (${timezone})`);
          return;
        }

        // Fetch digest data via RPC
        const { data: digest, error: digestError } = await supabase
          .rpc("get_daily_digest", { p_user_id: user.user_id });

        if (digestError) {
          console.error(`Error fetching digest for ${user.user_id}:`, digestError);
          return;
        }

        if (!hasAnythingToReport(digest)) {
          console.log(`[SKIP] Nothing to report for user ${user.user_id}`);
          return;
        }

        // Route delivery
        if (user.channel === "slack" || user.channel === "both") {
          await sendSlackDigest(user, digest);
        }
        if (user.channel === "email" || user.channel === "both") {
          await sendEmailDigest(user, digest);
        }

        // Update last_sent_at to prevent double sending
        await supabase
          .from("digest_preferences")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("user_id", user.user_id);
      })
    );

    const sent = results.filter((r: any) => r.status === 'fulfilled').length;
    const failed = results.filter((r: any) => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ 
        message: "Digests processed", 
        total_users: results.length,
        sent,
        failed,
        timestamp: new Date().toISOString() 
      }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (err: any) {
    console.error('[FATAL] Edge Function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});

function hasAnythingToReport(digest: any) {
  return (
    (digest?.due_today && digest.due_today.length > 0) || 
    (digest?.overdue && digest.overdue.length > 0) || 
    (digest?.blocked && digest.blocked.length > 0)
  );
}

async function sendSlackDigest(user: any, digest: any) {
  if (!user.slack_user_id) {
    console.warn(`[SLACK] No slack_user_id for user ${user.user_id}, skipping`);
    return;
  }
  // TODO: Implement actual Slack API call
  console.log(`[SLACK STUB] Would send to ${user.slack_user_id} for ${user.profiles?.full_name}`);
}

async function sendEmailDigest(user: any, digest: any) {
  // TODO: Implement actual Email delivery (e.g., via Resend)
  console.log(`[EMAIL STUB] Would send digest to user ${user.user_id} for ${user.profiles?.full_name}`);
}
