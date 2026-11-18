/**
 * YAI Studio — Conversation Markdown Generator
 *
 * Generates human-readable Markdown transcripts from canonical messages.json data.
 * messages.json is the authoritative structured source of truth; conversation.md
 * is a generated projection for inspection, reading, and git version history.
 *
 * @module lib/storage/conversation-markdown
 */
import 'server-only';

import type { ConversationMeta, Message } from '@/types/personal-intelligence';

export function generateConversationMarkdown(
  meta: ConversationMeta,
  messages: Message[],
): string {
  const lines: string[] = [];

  // Header metadata
  lines.push(`# ${meta.title}`);
  lines.push('');
  lines.push(`- **ID:** \`${meta.id}\``);
  lines.push(`- **Created:** ${meta.createdAt}`);
  lines.push(`- **Updated:** ${meta.updatedAt}`);
  if (meta.workspacePath) {
    lines.push(`- **Workspace:** \`${meta.workspacePath}\``);
  } else {
    lines.push(`- **Workspace:** _Unfiled_`);
  }
  if (meta.model) {
    lines.push(`- **Model:** ${meta.model}${meta.provider ? ` (${meta.provider})` : ''}`);
  }
  lines.push(`- **Status:** ${meta.status}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages in sequence order
  if (messages.length === 0) {
    lines.push('_No messages in this conversation yet._');
  } else {
    const sortedMessages = [...messages].sort((a, b) => a.sequence - b.sequence);

    for (const msg of sortedMessages) {
      const roleCapitalized =
        msg.role === 'assistant'
          ? 'YAI Assistant'
          : msg.role === 'user'
            ? 'User'
            : 'System';

      const modelMeta = msg.model ? ` · \`${msg.model}\`` : '';
      lines.push(`### ${roleCapitalized} · ${msg.createdAt}${modelMeta}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}
