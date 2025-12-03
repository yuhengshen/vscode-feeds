import { render } from "lit-html";
import { renderTweet, renderLoading, renderError, setActions } from "./TweetDetail";
import { styles } from "./styles";
import type { TweetDetail } from "../types";


const vscode = acquireVsCodeApi();

// Set up actions
setActions({
  like: (tweetId) => vscode.postMessage({ type: "like", tweetId }),
  unlike: (tweetId) => vscode.postMessage({ type: "unlike", tweetId }),
  bookmark: (tweetId) => vscode.postMessage({ type: "bookmark", tweetId }),
  removeBookmark: (tweetId) => vscode.postMessage({ type: "removeBookmark", tweetId }),
  viewReply: (tweetId) => vscode.postMessage({ type: "viewReply", tweetId }),
  openExternal: (tweetId) => vscode.postMessage({ type: "openExternal", tweetId }),
  loadMoreReplies: () => vscode.postMessage({ type: "loadMoreReplies" }),
});

// State
let currentTweet: TweetDetail | null = null;
let loading = true;
let error: string | null = null;
let loadingMore = false;

// Render function
function renderApp() {
  const container = document.getElementById("app")!;

  if (loading) {
    render(renderLoading(), container);
  } else if (error) {
    render(renderError(error), container);
  } else if (currentTweet) {
    render(renderTweet(currentTweet, loadingMore), container);
  } else {
    render(renderLoading(), container);
  }
}

// Handle messages from extension
window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.type) {
    case "loading":
      loading = true;
      error = null;
      renderApp();
      break;

    case "tweet":
      currentTweet = message.tweet;
      loading = false;
      loadingMore = false;
      error = null;
      renderApp();
      break;

    case "error":
      error = message.error;
      loading = false;
      renderApp();
      break;

    case "loadingMore":
      loadingMore = true;
      renderApp();
      break;

    case "loadMoreError":
      loadingMore = false;
      renderApp();
      break;
  }
});

// Initial setup
function init() {
  // Add styles
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  renderApp();
}

// Run init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
