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
    const groupId = event.source.groupId || 'private';

    // 👉 訂貨功能
    if (text.startsWith('訂貨 ')) {
      const item = text.replace(/^訂貨\s+/, '').trim();
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

      continue;
    }

    // 👉 查清單功能
    if (text === '清單') {
      const { data, error } = await supabase
        .from('line-bot')
        .select('item, message_time, status')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('message_time', { ascending: true });

      if (error) {
        console.error('Supabase select error:', error);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '讀取清單失敗',
        });
        continue;
      }

      if (!data || data.length === 0) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '目前沒有待訂項目',
        });
        continue;
      }

      const listText = data
        .map((row, index) => {
          const dateOnly = row.message_time
            ? new Date(row.message_time).toISOString().split('T')[0]
            : '無日期';
          return `${index + 1}. ${row.item}（${dateOnly}）`;
        })
        .join('\n');

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `訂貨清單：\n${listText}`,
      });

      continue;
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
