// Export only visible user/assistant text from explicitly selected project chats.
// Usage: node scripts/export-chat-history.mjs <directory containing session JSONL files>
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2];
if (!source) throw new Error('Pass the local directory containing the original session JSONL files.');
const chats = [
  ['01a14367-f3ac-7812-a3ed-12148202d3b7', '01-方案讨论'],
  ['01a143ee-6263-75c2-a2df-b5efa9fdb29c', '02-第一阶段开发与后续要求'],
  ['01a14430-f4be-7a81-8bb1-1c223e852f64', '03-跨电脑同步讨论'],
];
const files = await fs.readdir(source);
const outputs = [];
for (const [id, name] of chats) {
  const matches = files.filter(file => file.endsWith(`-${id}.jsonl`));
  if (matches.length !== 1) throw new Error(`Expected one original session for ${id}.`);
  const lines = (await fs.readFile(path.join(source, matches[0]), 'utf8')).split(/\r?\n/);
  const records = lines.filter(line => line.trim()).map(line => JSON.parse(line));
  const meta = records.find(record => record.type === 'session_meta')?.payload;
  if (meta?.id !== id || path.resolve(meta.cwd) !== path.resolve(root)) {
    throw new Error(`Session ${id} does not belong to this project at its original path.`);
  }
  const seen = new Set();
  const entries = [];
  for (const record of records) {
    if (record.type !== 'event_msg' || record.payload.type !== 'item_completed') continue;
    const item = record.payload.item;
    if (!['UserMessage', 'AgentMessage'].includes(item.type)) continue;
    if (item.id && seen.has(item.id)) continue;
    if (item.id) seen.add(item.id);
    const parts = (item.content ?? []).map(part => {
      if (typeof part.text === 'string') return part.text;
      return `[非文字内容未导出：${part.type ?? '附件'}]`;
    });
    let body = parts.join('\n\n').replace(/[\t ]+$/gm, '').trim();
    const reply = body.match(/^<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>$/);
    if (reply) {
      body = JSON.parse(reply[1]).map(answer => `问题：${answer.question}\n\n用户回答：${answer.answer}`).join('\n\n');
    }
    if (!body) continue;
    if (/sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]+|-----BEGIN[^\n]*PRIVATE KEY/.test(body)) {
      throw new Error(`Potential credential found in ${name}; review before exporting.`);
    }
    const role = item.type === 'UserMessage' ? '用户' : '助手';
    const time = new Date(record.timestamp).toISOString();
    entries.push({role, time, body});
  }
  if (!entries.some(entry => entry.role === '用户')) throw new Error(`No user messages in ${name}.`);
  const header = `# ${name}\n\n会话 ID：${id}\n\n快照截至：${entries.at(-1).time}（UTC）\n\n此文件是可见文字消息的历史快照，保留当时的需求、解释及可能已过时的说法。它不是 Codex 原生会话备份；工具调用、内部推理、系统信息及附件二进制不在其中。历史本机链接在另一台电脑可能不可用。\n\n`;
  const body = entries.map((entry, index) => `## ${index + 1}. ${entry.role} · ${entry.time}\n\n${entry.body}\n`).join('\n');
  outputs.push({name, text: header + body, count: entries.length});
}
const destination = path.join(root, 'docs', '聊天记录');
await fs.mkdir(destination, {recursive: true});
for (const output of outputs) {
  await fs.writeFile(path.join(destination, `${output.name}.md`), output.text, 'utf8');
  console.log(`${output.name}: ${output.count} visible messages exported`);
}
