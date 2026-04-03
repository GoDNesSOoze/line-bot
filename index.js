const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    if (event.type !== 'message') continue;
    if (event.message.type !== 'text') continue;

    const text = event.message.text.trim();

    if (text.startsWith('訂貨 ')) {
      const item = text.replace(/^訂貨\s+/, '').trim();
      const groupId = event.source.groupId || 'private';
      const messageTime = new Date(event.timestamp).toISOString();
      const dateOnly = messageTime.split('T')[0];

      const { error } = await supabase.from('line-bot').insert([
        {
          group_id: groupId,
          item: item,
          status: 'pending',
          message_time: messageTime,
        },
      ]);

      if (error) {
        console.error('Supabase insert error:', error);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '寫入資料庫失敗',
        });
        continue;
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `已記錄訂貨：${item}\n日期：${dateOnly}`,
      });
    }
  }

  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Bot is running');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
