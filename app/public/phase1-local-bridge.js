/*
 * Phase 1 local integration bridge.
 *
 * The recovered V6 bundle remains untouched. On the local reconstruction server,
 * its public CMS GETs are mapped to the captured JSON snapshots in this workspace.
 */
(() => {
  const gcsOrigin = 'https://storage.googleapis.com';
  const cmsPathPrefix = '/activetheory-v6.appspot.com/cms/';
  const assistantOrigin = 'https://backend-dot-activetheory-v6.uc.r.appspot.com';
  const assistantPrefix = '/api/assistant/';
  const originalFetch = window.fetch.bind(window);

  window.fetch = function phase1Fetch(input, init) {
    let rawUrl;
    try {
      rawUrl = input instanceof Request ? input.url : String(input);
    } catch {
      return originalFetch(input, init);
    }

    let parsed;
    try {
      parsed = new URL(rawUrl, window.location.href);
    } catch {
      return originalFetch(input, init);
    }

    if (parsed.origin === assistantOrigin && parsed.pathname.startsWith(assistantPrefix)) {
      const action = parsed.pathname.slice(assistantPrefix.length);
      if (['createThread', 'createMessage', 'createRun', 'listMessage'].includes(action)) {
        const localAssistantPath = assistantPrefix + action + parsed.search;
        if (input instanceof Request) return originalFetch(new Request(localAssistantPath, input), init);
        return originalFetch(localAssistantPath, init);
      }
    }

    if (parsed.origin !== gcsOrigin || !parsed.pathname.startsWith(cmsPathPrefix)) {
      return originalFetch(input, init);
    }

    const match = /\/cms\/(about|contact|media|metadata|projects)-(production|staging|dev|latest)\.json$/.exec(parsed.pathname);
    if (!match) return originalFetch(input, init);

    const localPath = `/cms/${match[1]}-${match[2]}.json${parsed.search}`;
    if (input instanceof Request) {
      return originalFetch(new Request(localPath, input), init);
    }
    return originalFetch(localPath, init);
  };
})();
