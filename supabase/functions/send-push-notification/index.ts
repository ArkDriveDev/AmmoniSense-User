/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Use the new variable names
const supabaseUrl = Deno.env.get('SB_URL')!;  // ← Changed
const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY')!;  // ← Changed
const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  try {
    const { notification_id } = await req.json();

    const { data: notification } = await supabase
      .from('notifications')
      .select('*, profiles(id)')
      .eq('id', notification_id)
      .single();

    if (!notification) {
      return new Response('Notification not found', { status: 404 });
    }

    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', notification.profile_id);

    if (!tokens || tokens.length === 0) {
      return new Response('No device tokens found', { status: 200 });
    }

    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';