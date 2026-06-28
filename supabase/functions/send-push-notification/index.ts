import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  try {
    const { notification_id } = await req.json();

    // Get notification details
    const { data: notification } = await supabase
      .from('notifications')
      .select('*, profiles(id)')
      .eq('id', notification_id)
      .single();

    if (!notification) {
      return new Response('Notification not found', { status: 404 });
    }

    // Get user's device tokens
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', notification.profile_id);

    if (!tokens || tokens.length === 0) {
      return new Response('No device tokens found', { status: 200 });
    }

    // Send push notification to each token
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const results = [];

    for (const { token } of tokens) {
      const payload = {
        to: token,
        notification: {
          title: notification.title,
          body: notification.message,
          sound: 'default',
          badge: '1',
        },
        data: {
          notification_id: notification_id.toString(),
          type: notification.type || 'alert',
          severity: notification.severity || 'info',
        },
        priority: 'high',
      };

      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      results.push({ token, success: response.ok, result });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});