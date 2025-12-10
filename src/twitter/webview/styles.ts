export const styles = `
  * {
    box-sizing: border-box;
  }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 16px;
    line-height: 1.5;
  }
  .tweet-container {
    max-width: 600px;
    margin: 0 auto;
  }
  .tweet-card {
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .tweet-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    margin-right: 12px;
    background: var(--vscode-button-background);
  }
  .author-info {
    flex: 1;
  }
  .author-name {
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .verified-badge {
    color: var(--vscode-button-background);
  }
  .author-username {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
  }
  .tweet-text {
    font-size: 1.1em;
    margin-bottom: 12px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .tweet-text a {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
  }
  .tweet-text a:hover {
    text-decoration: underline;
  }
  .media-container {
    margin: 12px 0;
    border-radius: 12px;
    overflow: hidden;
  }
  .media-grid {
    display: grid;
    gap: 4px;
  }
  .media-grid.single {
    grid-template-columns: 1fr;
  }
  .media-grid.double {
    grid-template-columns: 1fr 1fr;
  }
  .media-grid.triple {
    grid-template-columns: 1fr 1fr;
  }
  .media-grid.quad {
    grid-template-columns: 1fr 1fr;
  }
  .media-item {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .media-item:hover {
    opacity: 0.9;
  }
  .video-container {
    position: relative;
    width: 100%;
  }
  .video-container video {
    width: 100%;
    max-height: 400px;
    border-radius: 8px;
  }
  .tweet-date {
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
    margin-bottom: 12px;
  }
  .tweet-metrics {
    display: flex;
    gap: 20px;
    padding: 12px 0;
    border-top: 1px solid var(--vscode-widget-border);
    border-bottom: 1px solid var(--vscode-widget-border);
    margin-bottom: 12px;
  }
  .metric {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--vscode-descriptionForeground);
  }
  .metric-value {
    font-weight: bold;
    color: var(--vscode-foreground);
  }
  .actions {
    display: flex;
    gap: 12px;
  }
  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .action-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  .action-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .action-btn.like.active {
    background: #e0245e;
    color: white;
  }
  
  /* Quoted Tweet */
  .quoted-tweet {
    border: 1px solid var(--vscode-widget-border);
    border-radius: 12px;
    padding: 12px;
    margin: 12px 0;
    cursor: pointer;
    transition: background 0.2s;
  }
  .quoted-tweet:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .quoted-tweet .tweet-header {
    margin-bottom: 8px;
  }
  .quoted-tweet .avatar {
    width: 24px;
    height: 24px;
  }
  .quoted-tweet .tweet-text {
    font-size: 0.95em;
  }
  
  /* Reply to */
  .reply-to-section {
    margin-bottom: 16px;
  }
  .reply-to-label {
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
    margin-bottom: 8px;
    padding-left: 4px;
  }
  .reply-to-card {
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 12px;
    padding: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border-left: 3px solid var(--vscode-textLink-foreground);
  }
  .reply-to-card:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .reply-to-card .tweet-header {
    margin-bottom: 8px;
  }
  .reply-to-card .avatar {
    width: 32px;
    height: 32px;
  }
  .reply-to-text {
    font-size: 0.95em;
    color: var(--vscode-foreground);
    opacity: 0.9;
  }
  .reply-to-text a {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
  }
  .reply-to-text a:hover {
    text-decoration: underline;
  }
  
  /* Replies section */
  .replies-section {
    margin-top: 24px;
  }
  .replies-header {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-widget-border);
  }
  .reply-card {
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .reply-card:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .reply-card .tweet-header {
    margin-bottom: 8px;
  }
  .reply-card .avatar {
    width: 32px;
    height: 32px;
  }
  .reply-text {
    font-size: 0.95em;
  }
  
  /* External link button */
  .external-link {
    position: absolute;
    top: 16px;
    right: 16px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .external-link:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  
  .no-replies {
    color: var(--vscode-descriptionForeground);
    text-align: center;
    padding: 24px;
  }
  
  /* Load more button */
  .load-more-btn {
    display: block;
    width: 100%;
    padding: 12px;
    margin-top: 12px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 8px;
    font-size: 0.95em;
    cursor: pointer;
    transition: background 0.2s;
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
  }
  .load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loader {
    border: 4px solid var(--vscode-widget-border);
    border-top: 4px solid var(--vscode-button-background);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
  }
  .error-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    color: var(--vscode-errorForeground);
  }
`;
