import { html, nothing } from "lit-html";
import type { Tweet, TweetDetail, MediaItem, TwitterUser } from "../types";

// Decode HTML entities in text
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => entities[match] || match);
}

// Action handlers interface
export interface TweetActions {
  like: (tweetId: string) => void;
  unlike: (tweetId: string) => void;
  viewReply: (tweetId: string) => void;
  openExternal: (tweetId: string) => void;
  loadMoreReplies: () => void;
}

// Global actions instance (set by main.ts)
export let actions: TweetActions;

export function setActions(a: TweetActions) {
  actions = a;
}

// Utility functions
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatTweetText(text: string) {
  // First decode HTML entities
  const decodedText = decodeHtmlEntities(text);

  const parts: Array<{
    type: "text" | "url" | "mention" | "hashtag";
    value: string;
  }> = [];
  const regex = /(https?:\/\/[^\s]+)|(@\w+)|(#\w+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(decodedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: decodedText.slice(lastIndex, match.index),
      });
    }
    if (match[1]) {
      parts.push({ type: "url", value: match[1] });
    } else if (match[2]) {
      parts.push({ type: "mention", value: match[2] });
    } else if (match[3]) {
      parts.push({ type: "hashtag", value: match[3] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < decodedText.length) {
    parts.push({ type: "text", value: decodedText.slice(lastIndex) });
  }

  return parts.map((part) => {
    switch (part.type) {
      case "url":
        return html`<a href="${part.value}" target="_blank">${part.value}</a>`;
      case "mention":
        return html`<a
          href="https://twitter.com/${part.value.slice(1)}"
          target="_blank"
          >${part.value}</a
        >`;
      case "hashtag":
        return html`<a
          href="https://twitter.com/hashtag/${part.value.slice(1)}"
          target="_blank"
          >${part.value}</a
        >`;
      default:
        return part.value;
    }
  });
}

// 通用的作者头部渲染
function renderAuthorHeader(author?: TwitterUser) {
  return html`
    <div class="tweet-header">
      ${
        author?.profile_image_url
          ? html`<img
            class="avatar"
            src="${author.profile_image_url}"
            alt="${author.name}"
          />`
          : html`<div class="avatar"></div>`
      }
      <div class="author-info">
        <div class="author-name">
          ${author?.name || "Unknown"}
          ${author?.verified ? html`<span class="verified-badge">✓</span>` : nothing}
        </div>
        <div class="author-username">@${author?.username || "unknown"}</div>
      </div>
    </div>
  `;
}

// Media rendering
function renderMedia(media: MediaItem[]) {
  if (!media || media.length === 0) return nothing;

  const gridClass =
    media.length === 1
      ? "single"
      : media.length === 2
        ? "double"
        : media.length === 3
          ? "triple"
          : "quad";

  return html`
    <div class="media-container">
      <div class="media-grid ${gridClass}">
        ${media.map((item) => {
          if (item.type === "video" || item.type === "animated_gif") {
            const variants = item.variants?.filter((v) => v.content_type === "video/mp4") || [];
            const bestVariant = variants.sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0];
            const videoUrl = bestVariant?.url || item.preview_image_url;

            return html`
              <div class="video-container">
                <video
                  controls
                  ?autoplay=${item.type === "animated_gif"}
                  ?loop=${item.type === "animated_gif"}
                  ?muted=${item.type === "animated_gif"}
                  poster="${item.preview_image_url || ""}"
                >
                  <source src="${videoUrl}" type="video/mp4" />
                  Your browser does not support video playback.
                </video>
              </div>
            `;
          } else {
            return html`<img
              class="media-item"
              src="${item.url || item.preview_image_url}"
              alt="${item.alt_text || "Image"}"
            />`;
          }
        })}
      </div>
    </div>
  `;
}

// Quoted tweet rendering
function renderQuotedTweet(tweet: Tweet) {
  return html`
    <div class="quoted-tweet" @click=${() => actions.viewReply(tweet.id)}>
      ${renderAuthorHeader(tweet.author)}
      <div class="tweet-text">${formatTweetText(tweet.text)}</div>
    </div>
  `;
}

// Reply to rendering (shows the tweet being replied to)
function renderReplyTo(tweet: Tweet) {
  return html`
    <div class="reply-to-section">
      <div class="reply-to-label">Replying to</div>
      <div class="reply-to-card" @click=${() => actions.viewReply(tweet.id)}>
        ${renderAuthorHeader(tweet.author)}
        <div class="reply-to-text">${formatTweetText(tweet.text)}</div>
      </div>
    </div>
  `;
}

// Reply card rendering
function renderReplyCard(reply: Tweet) {
  return html`
    <div class="reply-card" @click=${() => actions.viewReply(reply.id)}>
      ${renderAuthorHeader(reply.author)}
      <div class="reply-text">${formatTweetText(reply.text)}</div>
    </div>
  `;
}

// Replies section rendering
function renderReplies(replies: Tweet[], hasMoreReplies?: boolean, loadingMore?: boolean) {
  if (!replies || replies.length === 0) {
    return html`
      <div class="replies-section">
        <div class="replies-header">Replies</div>
        <div class="no-replies">No replies yet</div>
      </div>
    `;
  }

  return html`
    <div class="replies-section">
      <div class="replies-header">Replies (${replies.length})</div>
      ${replies.map((reply) => renderReplyCard(reply))}
      ${
        hasMoreReplies
          ? html`
            <button
              class="load-more-btn"
              @click=${() => actions.loadMoreReplies()}
              ?disabled=${loadingMore}
            >
              ${loadingMore ? "Loading..." : "Load More Replies"}
            </button>
          `
          : nothing
      }
    </div>
  `;
}

// Main tweet template
export function renderTweet(tweet: TweetDetail, loadingMore?: boolean) {
  const metrics = tweet.public_metrics;
  const date = new Date(tweet.created_at).toLocaleString();

  return html`
    <div class="tweet-container">
      ${tweet.reply_to_tweet ? renderReplyTo(tweet.reply_to_tweet) : nothing}

      <div class="tweet-card" style="position: relative;">
        <button
          class="external-link"
          @click=${() => actions.openExternal(tweet.id)}
          title="Open in Browser"
        >
          ↗
        </button>

        ${renderAuthorHeader(tweet.author)}

        <div class="tweet-text">${formatTweetText(tweet.text)}</div>

        ${tweet.media && tweet.media.length > 0 ? renderMedia(tweet.media) : nothing}
        ${tweet.quoted_tweet ? renderQuotedTweet(tweet.quoted_tweet) : nothing}

        <div class="tweet-date">${date}</div>

        ${
          metrics
            ? html`
              <div class="tweet-metrics">
                <div class="metric">
                  <span class="metric-value"
                    >${formatNumber(metrics.retweet_count)}</span
                  >
                  Retweets
                </div>
                <div class="metric">
                  <span class="metric-value"
                    >${formatNumber(metrics.quote_count)}</span
                  >
                  Quotes
                </div>
                <div class="metric">
                  <span class="metric-value"
                    >${formatNumber(metrics.like_count)}</span
                  >
                  Likes
                </div>
                <div class="metric">
                  <span class="metric-value"
                    >${formatNumber(metrics.reply_count)}</span
                  >
                  Replies
                </div>
              </div>
            `
            : nothing
        }

        <div class="actions">
          <button
            class="action-btn like ${tweet.liked ? "active" : ""}"
            @click=${() => (tweet.liked ? actions.unlike(tweet.id) : actions.like(tweet.id))}
          >
            ${tweet.liked ? "❤️" : "🤍"} ${tweet.liked ? "Liked" : "Like"}
          </button>
        </div>
      </div>

      ${renderReplies(tweet.replies || [], tweet.hasMoreReplies, loadingMore)}
    </div>
  `;
}

// Loading template
export function renderLoading() {
  return html`
    <div class="loading-container">
      <div class="loader"></div>
    </div>
  `;
}

// Error template
export function renderError(error: string) {
  return html`
    <div class="error-container">
      <h2>Error Loading Tweet</h2>
      <p>${error}</p>
    </div>
  `;
}
